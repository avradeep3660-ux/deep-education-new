const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

admin.initializeApp();
const db = admin.firestore();
const NOTIFICATIONS = 'deep_notifications_permanent_v3';
const TOKENS = 'student_push_tokens';

exports.deliverDeepEducationPush = onDocumentCreated(`${NOTIFICATIONS}/{notificationId}`, async (event) => {
  const data = event.data?.data();
  if (!data) return;
  let query = db.collection(TOKENS);
  if (data.studentId && data.studentId !== 'ALL') query = query.where('studentId', '==', data.studentId);
  else if (data.targetBatch && data.targetBatch !== 'ALL') query = query.where('batch', '==', data.targetBatch);
  const snapshot = await query.get();
  const tokens = snapshot.docs.map((doc) => ({ id: doc.id, token: doc.data().token })).filter((item) => item.token);
  for (let index = 0; index < tokens.length; index += 500) {
    const chunk = tokens.slice(index, index + 500);
    const result = await admin.messaging().sendEachForMulticast({
      tokens: chunk.map((item) => item.token),
      notification: { title: data.title || 'Deep Education', body: data.message || 'You have a new update.' },
      data: { title: data.title || 'Deep Education', body: data.message || '', url: '/', tag: event.params.notificationId },
      webpush: { notification: { icon: '/deep_education_logo_de_2.png.png' } }
    });
    const invalid = [];
    result.responses.forEach((response, i) => {
      const code = response.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) invalid.push(chunk[i].id);
    });
    await Promise.all(invalid.map((id) => db.collection(TOKENS).doc(id).delete()));
  }
});
