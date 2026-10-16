// Web push (Firebase Cloud Messaging) public key — the "Key pair" under
// Firebase Console → Project settings → Cloud Messaging → Web configuration →
// Web Push certificates. It's a public key, so it's fine in source.
//
// While this is empty, the "Remind me" buttons stay hidden and nothing about
// push notifications runs in the browser.
export const FCM_VAPID_KEY = "";
