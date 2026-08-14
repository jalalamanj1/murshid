/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hashing + HMAC helpers (no secrets shipped to clients).
 */

const crypto = require('crypto');

/** Stable server-side user id derived from the machine's HWID. */
function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function deriveUserId(hwid) {
  return sha256(String(hwid || '')).slice(0, 24);
}

/**
 * HMAC-sign a payload using a secret. Used for time-limited public
 * share links so the owner's Drive is never exposed without a signed link.
 */
function hmacSign(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 48);
}

function hmacVerify(secret, payload, sig) {
  if (!sig) return false;
  const expected = hmacSign(secret, payload);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(sig), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { sha256, deriveUserId, hmacSign, hmacVerify };
