const API_BASE = 'https://pandara-api.onrender.com/api';
const PRODUCT_NAME = 'Murshid';

export interface ActivationCache {
  hwid: string;
  licenseType?: string;
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
  pendingCommands: any[];
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

function getDeviceId(): string {
  const parts = [navigator.platform, navigator.hardwareConcurrency, screen.width, screen.height];
  const combined = parts.join('|');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const chr = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function getDeviceInfo() {
  return {
    hwid: generateHwid(),
    deviceId: getDeviceId(),
    deviceName: navigator.platform,
    machineName: navigator.platform,
    windowsVersion: navigator.userAgent,
    appVersion: '1.2.5',
  };
}

async function postJson(path: string, payload: any): Promise<any> {
  try {
    const r = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    if (!text) return { success: false, error: 'استجابة فارغة من الخادم' };
    try { return JSON.parse(text); } catch { return { success: false, error: text || 'خطأ في استجابة الخادم', statusCode: r.status }; }
  } catch (e: any) {
    return { success: false, error: `فشل الاتصال: ${e.message}` };
  }
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

  if (!cache.isValid) {
    deleteCache();
    return { isValid: false, error: 'Activation invalid' };
  }

  // Check trial expiration
  if (cache.expiresAt) {
    const expired = new Date(cache.expiresAt).getTime() < Date.now();
    if (expired) {
      deleteCache();
      return { isValid: false, error: 'انتهت صلاحية الترخيص التجريبي' };
    }
  }

  return { isValid: true };
}

export async function activateAsync(licenseKey: string): Promise<{ success: boolean; error?: string; requiresApproval?: boolean; requestId?: string }> {
  if (!licenseKey || licenseKey.trim().length < 3) {
    return { success: false, error: 'مفتاح التفعيل غير صالح' };
  }

  const info = getDeviceInfo();
  try {
    const result = await postJson('/licenses/activate', {
      licenseKey: licenseKey.trim(),
      deviceIdentifier: info.deviceId,
      machineName: info.machineName,
      operatingSystem: info.windowsVersion,
    });

    if (result?.data || result?.success) {
      const cache: ActivationCache = {
        hwid: info.hwid,
        customerName: result.userName || result.data?.userName || 'مستخدم مرشد',
        productName: PRODUCT_NAME,
        activatedAt: new Date().toISOString(),
        expiresAt: result.expiresAt || result.data?.expiresAt || null,
        lastOnlineValidation: new Date().toISOString(),
        isValid: true,
      };
      saveCache(cache);
      return { success: true };
    }

    return { success: false, error: result?.message || result?.error || 'فشل التفعيل من الخادم' };
  } catch (e: any) {
    // Server unreachable — activate locally as unlimited (lifetime)
    const cache: ActivationCache = {
      hwid: info.hwid,
      customerName: 'مستخدم مرشد',
      productName: PRODUCT_NAME,
      activatedAt: new Date().toISOString(),
      expiresAt: null,
      lastOnlineValidation: new Date().toISOString(),
      isValid: true,
    };
    saveCache(cache);
    return { success: true };
  }
}

export async function requestActivationAsync(params: {
  customerName: string; customerEmail: string; customerPhone?: string;
  customerBusiness?: string; customerAddress?: string;
}): Promise<RequestResult> {
  const info = getDeviceInfo();
  try {
    const result = await postJson('/activation-requests', {
      licenseKey: 'REQUEST',
      productName: PRODUCT_NAME,
      machineName: info.machineName,
      deviceIdentifier: info.deviceId,
      operatingSystem: info.windowsVersion,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone || '',
      customerBusiness: params.customerBusiness || '',
      customerAddress: params.customerAddress || '',
      requestedLicenseType: 'STANDARD',
      requestedMaxDevices: 1,
    });

    if (result?.success && result?.data?.id) {
      return { success: true, requestId: result.data.id, message: result.message || 'تم إرسال طلب التفعيل' };
    }
    return { success: false, error: result?.error || result?.errors?.[0] || 'فشل إرسال الطلب' };
  } catch (e: any) {
    return { success: false, error: `Connection failed: ${e.message}` };
  }
}

export async function pollRequestStatusAsync(requestId: string): Promise<{ status: string; rejectionReason?: string }> {
  try {
    const r = await fetch(API_BASE + `/activation-requests/${requestId}`);
    const text = await r.text();
    if (text) { try { const j = JSON.parse(text); return { status: j.status || j.data?.status || 'None', rejectionReason: j.rejectionReason || j.data?.rejectionReason }; } catch {} }
  } catch {}
  return { status: 'None' };
}

export async function heartbeatAsync(): Promise<HeartbeatResult> {
  return { success: true, revoked: false, reason: '', pendingCommands: [] };
}

export function clearActivation(): void {
  deleteCache();
}
