import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase.js';

/** Register this browser/device for background push. A VAPID key is required. */
export async function enableStudentPushNotifications(studentId, batch = 'ALL') {
  if (!studentId || !auth.currentUser || !('Notification' in window) || !('serviceWorker' in navigator)) return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn('VITE_FIREBASE_VAPID_KEY is missing; background push is not configured.');
    return null;
  }
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging();
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return null;
  // Token registration must be restricted by authenticated-user Firestore rules before production.
  await setDoc(doc(db, 'student_push_tokens', token), {
    token, studentId, authUid: auth.currentUser.uid, batch, updatedAt: Date.now(), platform: 'web'
  }, { merge: true });
  return token;
}
