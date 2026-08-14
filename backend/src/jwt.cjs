/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JWT issuance/verification for Murshid backend users.
 * The signing secret lives only on the server (env MURSHID_JWT_SECRET),
 * or is persisted once to data/secret on first boot.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function getSecret(config) {
  if (config.jwtSecret) return config.jwtSecret;
  const file = path.join(config.dataDir, 'secret');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) return existing;
  } catch {}
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

function sign(config, user, ttlSeconds = 60 * 60 * 24 * 365) {
  return jwt.sign({ sub: user.userId, name: user.name }, getSecret(config), {
    expiresIn: ttlSeconds,
    algorithm: 'HS256',
  });
}

function verify(config, token) {
  try {
    return jwt.verify(token, getSecret(config), { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

module.exports = { getSecret, sign, verify };
