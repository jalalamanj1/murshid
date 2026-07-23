const API_BASE = 'https://mentisadmin-api.onrender.com';
const PRODUCT_NAME = 'Murshid';

export interface ActivationCache {
  licenseKey: string;
  hwid: string;
  customerName?: string;
  productName?: string;
  activatedAt?: string;
  expiresAt?: string;
  lastOnlineValidation?: string;
  isValid: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  isOffline?: boolean;
  daysRemaining?: number;
  error?: string;
}

export interface HeartbeatResult {
  success: boolean;
  revoked: boolean;
  reason: string;
  pendingCommands: PendingCommand[];
}

export interface PendingCommand {
  commandType: string;
  payload: string;
  commandId: string;
}

export interface RequestResult {
  success: boolean;
  requestId?: string;
  message?: string;
  error?: string;
}

export function generateHwid(): string {
  const parts = [
    navigator.hardwareConcurrency?.toString() || '4',
    navigator.platform || 'unknown',
    screen.width.toString(),
    screen.height.toString(),
  ];
  const raw = parts.join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return 'HWID-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

function getDeviceInfo() {
  return {
    hwid: generateHwid(),
    deviceName: navigator.platform,
    machineName: navigator.platform,
    windowsVersion: navigator.userAgent,
    appVersion: '1.0.0',
  };
}

async function postJson(path: string, payload: any): Promise<any> {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

export function loadCache(): ActivationCache | null {
  try {
    const data = localStorage.getItem('pandara_activation');
    if (!data) return null;
    return JSON.parse(data);
  } catch { return null; }
}

export function saveCache(cache: ActivationCache): void {
  localStorage.setItem('pandara_activation', JSON.stringify(cache));
}

export function deleteCache(): void {
  localStorage.removeItem('pandara_activation');
}

export async function validateAsync(): Promise<ValidationResult> {
  const cache = loadCache();
  if (!cache) return { isValid: false, error: 'No activation found' };

  const info = getDeviceInfo();
  if (cache.hwid !== info.hwid) {
    cache.isValid = false;
    saveCache(cache);
    deleteCache();
    return { isValid: false, error: 'Hardware changed' };
  }

  try {
    const result = await postJson('/activation/validate', {
      productName: PRODUCT_NAME,
      licenseKey: cache.licenseKey,
      hwid: info.hwid,
      machineName: info.machineName,
      windowsVersion: info.windowsVersion,
      appVersion: info.appVersion,
    });

    if (result?.success && result?.activated) {
      cache.lastOnlineValidation = new Date().toISOString();
      cache.expiresAt = result.expiresAt;
      cache.isValid = true;
      saveCache(cache);
      return { isValid: true };
    }

    deleteCache();
    return {
      isValid: false,
      error: result?.licenseStatus === 'Revoked' ? 'License revoked by administrator'
        : result?.licenseStatus === 'Suspended' ? 'License suspended'
        : result?.error || 'Activation validation failed',
    };
  } catch {
    const offlineDays = cache.lastOnlineValidation
      ? (Date.now() - new Date(cache.lastOnlineValidation).getTime()) / 86400000
      : 999;
    if (offlineDays <= 30) {
      return { isValid: true, isOffline: true, daysRemaining: 30 - Math.floor(offlineDays) };
    }
    deleteCache();
    return { isValid: false, error: 'Offline grace period expired' };
  }
}

export async function activateAsync(licenseKey: string): Promise<{ success: boolean; error?: string; requiresApproval?: boolean; requestId?: string }> {
  const info = getDeviceInfo();
  try {
    const result = await postJson('/activation/activate', {
      productName: PRODUCT_NAME,
      licenseKey,
      hwid: info.hwid,
      deviceName: info.deviceName,
      machineName: info.machineName,
      windowsVersion: info.windowsVersion,
      appVersion: info.appVersion,
    });

    if (result?.success && result?.activated) {
      const cache: ActivationCache = {
        licenseKey,
        hwid: info.hwid,
        customerName: result.customerName,
        productName: result.productName,
        activatedAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
        lastOnlineValidation: new Date().toISOString(),
        isValid: true,
      };
      saveCache(cache);
      return { success: true };
    }

    if (result?.requiresApproval && result?.requestId) {
      return { success: false, requiresApproval: true, requestId: result.requestId, error: result.message || 'Waiting for admin approval' };
    }

    return { success: false, error: result?.error || 'Activation failed' };
  } catch (e: any) {
    return { success: false, error: `Connection failed: ${e.message}` };
  }
}

export async function requestActivationAsync(): Promise<RequestResult> {
  const info = getDeviceInfo();
  try {
    const result = await postJson('/activation/request', {
      productName: PRODUCT_NAME,
      licenseKey: '',
      hwid: info.hwid,
      deviceName: info.deviceName,
      machineName: info.machineName,
      windowsVersion: info.windowsVersion,
      appVersion: info.appVersion,
    });
    if (result?.success) return { success: true, requestId: result.requestId, message: result.message };
    return { success: false, error: result?.error || 'Request failed' };
  } catch (e: any) {
    return { success: false, error: `Connection failed: ${e.message}` };
  }
}

export async function pollRequestStatusAsync(hwid: string): Promise<{ status: string; rejectionReason?: string }> {
  try {
    const r = await fetch(API_BASE + `/activation/request/${hwid}/status`);
    const result = await r.json();
    return { status: result.status || 'None', rejectionReason: result.rejectionReason };
  } catch {
    return { status: 'None' };
  }
}

export async function heartbeatAsync(): Promise<HeartbeatResult> {
  const cache = loadCache();
  const result: HeartbeatResult = { success: true, revoked: false, reason: '', pendingCommands: [] };
  if (!cache) return result;
  const info = getDeviceInfo();
  try {
    const r = await fetch(API_BASE + '/activation/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: cache.licenseKey,
        hwid: info.hwid,
        machineName: info.machineName,
        appVersion: info.appVersion,
        windowsVersion: info.windowsVersion,
      }),
    });
    const json = await r.json();
    if (json.revoked) {
      result.revoked = true;
      result.reason = json.reason || 'License revoked by administrator';
      deleteCache();
    }
    if (json.pendingCommands) {
      result.pendingCommands = json.pendingCommands.map((c: any) => ({
        commandType: c.commandType,
        payload: c.payload || '',
        commandId: c.id || '',
      }));
    }
  } catch {}
  return result;
}

export function clearActivation(): void {
  deleteCache();
}
