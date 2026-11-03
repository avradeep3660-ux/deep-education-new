# Firebase Authentication migration — required before production

The current UI uses a local browser session and custom phone/password matching. That is not a secure identity boundary. Firebase Auth is already initialized in `src/firebase.js`, but the legacy UI is not yet migrated to it.

Production login must be UID-based:
- Student sign-in: a real Firebase Auth provider (phone/SMS or verified email).
- Teacher sign-in: Firebase Auth plus an Admin-SDK-assigned `role=teacher` custom claim.
- Student profile: `/userProfiles/{uid}` with `{ role: 'student', active: true, studentId, batch }`.
- Teacher profile: `/userProfiles/{uid}` with `{ role: 'teacher', active: true }` or a custom claim.
- Each student-owned record must include an immutable `ownerUid`; batch-scoped records must include `batch`.
- Client-side phone/password lookup and client-generated OTP must be removed. Do not store student passwords in Firestore or localStorage.

No Firebase Admin service-account credential or Firebase Console access was supplied in the source archive, so custom claims and live provider configuration cannot be provisioned from this code workspace. Keep the deny-by-default rules until this migration is complete.
