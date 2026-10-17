// Sending web push notifications through Firebase Cloud Messaging.
//
// Messages are data-only: public/sw.js shows the notification itself, so
// the browser never needs Firebase's own messaging service worker.

const MAX_TOKENS_PER_CALL = 500; // FCM's multicast limit

// Errors that mean a device token will never work again (the learner
// uninstalled, cleared site data, or turned notifications off).
const DEAD_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * @param {{ sendEachForMulticast: Function }} messaging firebase-admin Messaging
 * @param {string[]} tokens
 * @param {{ title: string, body: string, url: string, tag: string }} message
 * @param {number} ttlSeconds how long FCM keeps trying to reach a phone that's offline
 * @returns {Promise<{ sent: number, failed: number, deadTokens: string[] }>}
 */
export async function sendToTokens(messaging, tokens, message, ttlSeconds) {
  const result = { sent: 0, failed: 0, deadTokens: [] };
  for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_CALL) {
    const batch = tokens.slice(i, i + MAX_TOKENS_PER_CALL);
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      data: {
        title: String(message.title),
        body: String(message.body),
        url: String(message.url),
        tag: String(message.tag),
      },
      webpush: { headers: { TTL: String(ttlSeconds), Urgency: "normal" } },
    });
    response.responses.forEach((r, j) => {
      if (r.success) {
        result.sent += 1;
      } else {
        result.failed += 1;
        if (DEAD_TOKEN_ERRORS.has(r.error?.code)) result.deadTokens.push(batch[j]);
      }
    });
  }
  return result;
}

/**
 * A device token can end up on several accounts (a shared phone). Each token
 * belongs to the account that registered it most recently (`pushTokenAddedAt`),
 * so learners never get each other's notifications.
 * @returns {Map<string, string>} token → uid
 */
export function assignTokenOwners(users) {
  const owners = new Map();
  for (const user of users) {
    for (const token of Array.isArray(user.pushTokens) ? user.pushTokens : []) {
      if (typeof token !== "string" || !token) continue;
      const at = String(user.pushTokenAddedAt?.[token] || "");
      const current = owners.get(token);
      if (!current || at > current.at) owners.set(token, { uid: user.uid, at });
    }
  }
  return new Map([...owners].map(([token, { uid }]) => [token, uid]));
}

/** The user's tokens that they own (see assignTokenOwners). */
export function ownedTokens(user, owners) {
  return (Array.isArray(user.pushTokens) ? user.pushTokens : []).filter((t) => owners.get(t) === user.uid);
}

/** Removes device tokens FCM says are gone, so they aren't retried every day. */
export async function removeDeadTokens(db, FieldValue, uid, deadTokens) {
  if (!deadTokens.length) return;
  await db.collection("users").doc(uid).update({ pushTokens: FieldValue.arrayRemove(...deadTokens) });
}
