/**
 * Deep Education cryptographic primitives.
 *
 * AES-256-GCM protects content; PBKDF2 derives a key-encryption key from a
 * user-supplied passphrase; RSA-OAEP wraps random content keys for recipients.
 * No encryption secret is embedded in the application bundle.
 *
 * IMPORTANT: These primitives are not a complete E2EE deployment by themselves.
 * The application must authenticate users, distribute public keys, and ensure
 * each record's content key is wrapped only for its intended recipients.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const VERSION = 'DE-E2EE-1';
const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AES_KEY_BITS = 256;

const toBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const fromBase64 = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const requireCrypto = () => {
  if (!globalThis.crypto?.subtle || !globalThis.isSecureContext) {
    throw new Error('Secure cryptography requires HTTPS (or localhost) and Web Crypto support.');
  }
};

const deriveWrappingKey = async (passphrase, salt, usages = ['encrypt', 'decrypt']) => {
  if (typeof passphrase !== 'string' || passphrase.length < 12) {
    throw new Error('Use a passphrase with at least 12 characters.');
  }
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    usages,
  );
};

export const generateContentKey = async () => {
  requireCrypto();
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: AES_KEY_BITS }, true, ['encrypt', 'decrypt']);
};

export const encryptBytes = async (plainBytes, key, additionalData = '') => {
  requireCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(additionalData), tagLength: 128 },
    key,
    plainBytes,
  );
  return {
    version: VERSION,
    algorithm: 'AES-256-GCM',
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(cipher)),
    aad: additionalData,
  };
};

export const decryptBytes = async (envelope, key, expectedAdditionalData = envelope?.aad || '') => {
  requireCrypto();
  if (envelope?.version !== VERSION || envelope?.algorithm !== 'AES-256-GCM') {
    throw new Error('Unsupported or invalid encrypted-data format.');
  }
  if ((envelope.aad || '') !== expectedAdditionalData) throw new Error('Encrypted-data context does not match.');
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv), additionalData: encoder.encode(expectedAdditionalData), tagLength: 128 },
      key,
      fromBase64(envelope.ciphertext),
    );
    return new Uint8Array(plain);
  } catch {
    throw new Error('Decryption failed: wrong key or data was modified.');
  }
};

export const encryptText = async (text, key, context = '') => {
  const envelope = await encryptBytes(encoder.encode(String(text)), key, context);
  return envelope;
};

export const decryptText = async (envelope, key, context = envelope?.aad || '') => {
  return decoder.decode(await decryptBytes(envelope, key, context));
};

/** Encrypts an exported private key with a passphrase. Store this envelope, never the raw private key. */
export const protectPrivateKey = async (privateKey, passphrase) => {
  requireCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const wrappingKey = await deriveWrappingKey(passphrase, salt);
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  const envelope = await encryptBytes(new Uint8Array(exported), wrappingKey, 'deep-education-private-key');
  return {
    version: VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    encryptedPrivateKey: envelope,
  };
};

export const unlockPrivateKey = async (protectedKey, passphrase) => {
  requireCrypto();
  if (protectedKey?.version !== VERSION || protectedKey?.kdf !== 'PBKDF2-SHA256') {
    throw new Error('Unsupported private-key backup format.');
  }
  const wrappingKey = await deriveWrappingKey(passphrase, fromBase64(protectedKey.salt));
  const pkcs8 = await decryptBytes(protectedKey.encryptedPrivateKey, wrappingKey, 'deep-education-private-key');
  return crypto.subtle.importKey(
    'pkcs8', pkcs8,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
};

export const createUserKeyPair = async () => {
  requireCrypto();
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const publicKey = await crypto.subtle.exportKey('spki', pair.publicKey);
  return {
    publicKey: toBase64(new Uint8Array(publicKey)),
    privateKey: pair.privateKey,
  };
};

export const importUserPublicKey = async (publicKeyBase64) => {
  requireCrypto();
  return crypto.subtle.importKey(
    'spki', fromBase64(publicKeyBase64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt'],
  );
};

export const wrapContentKeyForRecipient = async (contentKey, recipientPublicKeyBase64) => {
  requireCrypto();
  const recipientKey = await importUserPublicKey(recipientPublicKeyBase64);
  const rawKey = await crypto.subtle.exportKey('raw', contentKey);
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientKey, rawKey);
  return { version: VERSION, algorithm: 'RSA-OAEP-3072-SHA256', wrappedKey: toBase64(new Uint8Array(wrapped)) };
};

export const unwrapContentKey = async (wrappedEnvelope, recipientPrivateKey) => {
  requireCrypto();
  if (wrappedEnvelope?.version !== VERSION || wrappedEnvelope?.algorithm !== 'RSA-OAEP-3072-SHA256') {
    throw new Error('Unsupported wrapped-key format.');
  }
  try {
    const rawKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, recipientPrivateKey, fromBase64(wrappedEnvelope.wrappedKey));
    return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: AES_KEY_BITS }, true, ['encrypt', 'decrypt']);
  } catch {
    throw new Error('This account is not an authorized recipient for the encrypted content.');
  }
};

export const isModernE2EEEnvelope = (value) => Boolean(value && typeof value === 'object' && value.version === VERSION);

/** Derive a classroom-shared AES-256-GCM key. The passphrase is entered locally
 * by the teacher and shared with the intended class through a separate trusted
 * channel; it is never uploaded to Firebase. */
export const deriveClassroomKey = async (passphrase, saltBase64) => {
  requireCrypto();
  const salt = saltBase64 ? fromBase64(saltBase64) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveWrappingKey(passphrase, salt);
  return { key, salt: toBase64(salt) };
};

export const encryptFileWithPassphrase = async (file, passphrase, context) => {
  requireCrypto();
  const { key, salt } = await deriveClassroomKey(passphrase);
  const envelope = await encryptBytes(new Uint8Array(await file.arrayBuffer()), key, context);
  return { ...envelope, salt, fileType: file.type || 'application/octet-stream', fileSize: file.size };
};

export const decryptFileWithPassphrase = async (envelope, passphrase, context) => {
  requireCrypto();
  if (envelope?.version !== VERSION || envelope?.algorithm !== 'AES-256-GCM' || !envelope?.salt) {
    throw new Error('Unsupported encrypted file format.');
  }
  const { key } = await deriveClassroomKey(passphrase, envelope.salt);
  const plain = await decryptBytes(envelope, key, context);
  return new Blob([plain], { type: envelope.fileType || 'application/octet-stream' });
};
