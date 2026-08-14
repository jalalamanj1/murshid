/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * User registry (persisted to disk). A user is bound to a machine HWID.
 * The uploader name is captured at first registration and never updated,
 * so clients cannot retroactively claim a different identity.
 */

const path = require('path');
const fs = require('fs');
const { deriveUserId } = require('./crypto.cjs');

function loadUsers(dataDir) {
  const file = path.join(dataDir, 'users.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function saveUsers(dataDir, users) {
  const file = path.join(dataDir, 'users.json');
  fs.writeFileSync(file, JSON.stringify(users, null, 2));
}

/**
 * Register or fetch an existing user.
 * `name` is trusted only on FIRST registration; existing users keep
 * their original server-side name even if the client later sends a new one.
 */
function getOrCreateUser(dataDir, { hwid, deviceId, name, schoolName, province }) {
  const users = loadUsers(dataDir);
  const userId = deriveUserId(hwid || deviceId || 'unknown');

  if (users[userId]) {
    return { user: users[userId], created: false };
  }

  const now = new Date().toISOString();
  const user = {
    userId,
    deviceId: deviceId || '',
    name: String(name || '').trim() || 'مستخدم مرشد',
    schoolName: String(schoolName || '').trim() || '',
    province: String(province || '').trim() || '',
    createdAt: now,
    updatedAt: now,
  };
  users[userId] = user;
  saveUsers(dataDir, users);
  return { user, created: true };
}

function getUserById(dataDir, userId) {
  const users = loadUsers(dataDir);
  return users[userId] || null;
}

module.exports = { loadUsers, getOrCreateUser, getUserById };
