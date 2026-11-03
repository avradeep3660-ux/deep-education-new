# Deep Education — security and deployment notes

This project contains application-side upgrades, but a secure production deployment requires the Firebase Console and server environment configuration. Do not describe the whole application as fully E2EE until the account/key migration below is complete.

## Implemented in this project

- PDF files are encrypted in the browser using Web Crypto AES-256-GCM before upload. The passphrase is used locally with PBKDF2-SHA256 (310,000 iterations); the passphrase is never written to Firestore or Storage. Only ciphertext is uploaded to Firebase Storage. Firestore stores metadata, salt, IV, AAD and the storage path.
- PDF metadata is subscribed to with Firestore `onSnapshot`, so the student list updates without a manual refresh. Student batch filtering is applied in the UI.
- PDF upload errors are surfaced to the teacher; an orphaned Storage object is removed if metadata creation fails. Delete removes both Storage object and Firestore metadata.
- A Firebase Cloud Function listens for new notification records and sends FCM notifications to matching student/device tokens. It supports targeted student notifications, batch notifications and ALL notifications. Invalid tokens are removed.
- Student browsers can register FCM tokens after Firebase Authentication is active and the user grants notification permission. Background notifications use `firebase-messaging-sw.js`.
- Smart Quiz generation now calls a server-side Netlify Function. It requires `OPENAI_API_KEY` in Netlify environment variables and returns exactly 35 structured MCQs with four options, answer, difficulty and explanation. The client still allows the teacher to edit questions before publishing.
- Reduced-motion support, keyboard focus states, typography and subtle interface animations were added.
- The `src/e2ee.js` module contains AES-GCM, PBKDF2 and RSA-OAEP primitives.

## Important encryption scope

The PDF feature uses a class-shared passphrase. The teacher must share that passphrase with intended students through a separate trusted channel. Anyone who receives it can decrypt those class PDFs. This protects PDF content from Firebase/server-side inspection, but it is not the final per-student RSA recipient-key workflow.

The existing application still contains a legacy XOR-based compatibility cipher for older student, attendance, fee, chat and feedback records. Its old key is embedded in the previous client code and therefore must **not** be considered cryptographically secure. It remains temporarily so legacy records can still be read. New personal-record encryption must be migrated to per-user RSA-OAEP keypairs with AES-GCM content keys, protected private-key backups, and authenticated Firebase identities before claiming full-app E2EE.

## Firebase Authentication migration is required before production

The current application still has its legacy phone/password + teacher PIN flow. The FCM token registration helper deliberately requires `auth.currentUser`; it will not register a token while only the legacy local session is active. This prevents an unauthenticated browser from registering another student's identity and receiving private notifications.

Recommended rollout:

1. Enable Firebase Authentication in the Firebase Console. Choose a real sign-in provider. Phone/SMS authentication requires Firebase phone provider configuration and authorized domains; do not use a client-generated OTP as proof of phone ownership.
2. Create teacher's Firebase Auth account and assign a trusted `role: teacher` custom claim from Admin SDK. Students should have `role: student`, `active: true`, and their own UID-bound profile.
3. Migrate the app's student and teacher login flows to Firebase Auth. Add `authUid` ownership fields to student records and owner/batch fields to all student-scoped records. Do not let students query every student's data.
4. Only after the login/data migration, deploy the deny-by-default Firestore and Storage rules in `firebase/`. These templates intentionally deny access until explicit role/ownership rules are added and reviewed. Deploying them prematurely will block the existing app.
5. Set `VITE_FIREBASE_VAPID_KEY` in the frontend build environment. Get it from Firebase Console → Project settings → Cloud Messaging → Web Push certificates.
6. Deploy Cloud Functions: `cd functions && npm install`, then `firebase deploy --only functions` from the project root. The notification trigger uses the Admin SDK and default service credentials.
7. In Netlify, set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`). Never add the AI key to a `VITE_*` variable or frontend source. Deploy the site with `netlify.toml`.
8. Confirm browser notification permission is granted and test with the app both open and closed. Push cannot be delivered if the user blocks permission, the browser/device disables background delivery, or the device is offline; delivery is not guaranteed by the web platform.

## Required deployment configuration

Copy `.env.example` values into the appropriate hosting settings. `VITE_FIREBASE_VAPID_KEY` is public configuration; `OPENAI_API_KEY` is a server secret. Firebase web config is also public client configuration and must be protected by correct Firebase Security Rules and App Check, not by hiding the API key.

## Build verification

The uploaded ZIP's `node_modules` directory is incomplete for this Linux build environment (the Vite/Rolldown native optional binding is missing). Run `npm ci` on a clean machine after extracting the project, then `npm run build`. The source archive intentionally excludes `node_modules` and generated `dist` files.
