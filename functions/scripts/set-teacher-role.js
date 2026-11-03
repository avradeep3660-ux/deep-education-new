/* Run only on a trusted administrator machine after creating the teacher's Firebase Auth account. */
const admin = require('firebase-admin');

async function main() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const uid = process.env.TEACHER_AUTH_UID;
  if (!serviceAccountJson || !uid) throw new Error('Set FIREBASE_SERVICE_ACCOUNT and TEACHER_AUTH_UID.');
  const serviceAccount = JSON.parse(serviceAccountJson);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  await admin.auth().setCustomUserClaims(uid, { role: 'teacher' });
  await admin.firestore().doc(`userProfiles/${uid}`).set({ role: 'teacher', active: true, updatedAt: Date.now() }, { merge: true });
  process.stdout.write(`Teacher role assigned to Firebase Auth UID ${uid}. Sign out and sign in again to refresh claims.\n`);
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
