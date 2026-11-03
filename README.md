# Deep Education

React + Vite + Firebase education portal for Deep Education, Madanpur, Nadia.

## Included
- Existing student and teacher portal feature set (attendance, fees, quizzes, PDFs, notices, live/recorded classes, feedback, doubt support).
- Browser-side AES-256-GCM encryption for newly uploaded PDF materials, PBKDF2 passphrase derivation, realtime PDF metadata sync and Firebase Storage delivery.
- Server-side 35-question Smart Quiz generation endpoint (requires Netlify `OPENAI_API_KEY`).
- Firebase Cloud Functions FCM notification delivery (requires authenticated device token registration and deployed functions).
- RSA-OAEP/AES-GCM cryptographic primitives in `src/e2ee.js` for the per-user key migration.

## Setup
1. Install dependencies: `npm ci`.
2. Configure the Firebase web project in `src/firebase.js` or via your preferred environment configuration.
3. Copy `.env.example` and set `VITE_FIREBASE_VAPID_KEY` for web push.
4. Set `OPENAI_API_KEY` as a Netlify server environment variable (never expose it in client code).
5. Configure Firebase Authentication and role profiles. Read `AUTH_MIGRATION.md` and `SECURITY_AND_DEPLOYMENT.md` before deploying security rules.
6. Deploy Cloud Functions from this folder with Firebase CLI after `cd functions && npm install`.

## Important
The existing legacy login flow and legacy XOR record compatibility code remain in this archive to avoid pretending that authentication/data migration has already happened. They are not production-grade E2EE. The new PDF flow is AES-256-GCM encrypted, but full-app per-student E2EE and Firebase Auth integration are deployment/migration tasks. Do not deploy the deny-by-default rules until the authentication and ownership migration is complete.
