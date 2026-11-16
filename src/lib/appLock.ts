/**
 * Local application lock for Murshid.
 * Stores a salted SHA-256 hash (never the passcode itself).
 */

const LOCK_KEY = 'murshid_app_lock_v1';

interface LockRecord {
  salt: string;
  hash: string;
  createdAt: string;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveHash(passcode: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${passcode}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

function readRecord(): LockRecord | null {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockRecord;
    return parsed?.salt && parsed?.hash ? parsed : null;
  } catch {
    return null;
  }
}

export function isAppLockEnabled(): boolean {
  return readRecord() !== null;
}

export function validatePasscode(passcode: string): string | null {
  if (!passcode || passcode.length < 4) return 'يجب أن تكون كلمة القفل 4 أحرف على الأقل.';
  if (passcode.length > 64) return 'كلمة القفل طويلة جداً.';
  return null;
}

export async function enableAppLock(passcode: string): Promise<void> {
  const error = validatePasscode(passcode);
  if (error) throw new Error(error);
  const salt = crypto.randomUUID();
  const record: LockRecord = {
    salt,
    hash: await deriveHash(passcode, salt),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(LOCK_KEY, JSON.stringify(record));
}

export async function verifyAppLock(passcode: string): Promise<boolean> {
  const record = readRecord();
  if (!record) return true;
  return (await deriveHash(passcode, record.salt)) === record.hash;
}

export async function disableAppLock(passcode: string): Promise<boolean> {
  if (!(await verifyAppLock(passcode))) return false;
  localStorage.removeItem(LOCK_KEY);
  return true;
}

export async function changeAppLock(currentPasscode: string, nextPasscode: string): Promise<boolean> {
  if (!(await verifyAppLock(currentPasscode))) return false;
  await enableAppLock(nextPasscode);
  return true;
}
