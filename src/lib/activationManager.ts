import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public/publishable configuration only. These values are not secrets: the
// anon key is restricted by RLS and the application key only identifies which
// section of the Activation Manager this app belongs to.
type ActivationConfig = {
  url?: string;
  anonKey?: string;
  applicationKey?: string;
};

function getDesktopConfig(): ActivationConfig {
  if (typeof window === 'undefined') return {};
  try {
    const bridge = (window as any).electronAPI;
    if (typeof bridge?.getActivationManagerConfig === 'function') {
      return (bridge.getActivationManagerConfig() ?? {}) as ActivationConfig;
    }
  } catch {
    /* ignore */
  }
  return {};
}

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env
  ? (import.meta as any).env
  : {}) as Record<string, string | undefined>;

const desktop = getDesktopConfig();

function first(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

const activationUrl = first(
  env.VITE_ACTIVATION_MANAGER_URL,
  env.ACTIVATION_MANAGER_URL,
  desktop.url,
  'https://tpkhfoimtcxjfksxlvmo.supabase.co'
);
const activationAnonKey = first(
  env.VITE_ACTIVATION_MANAGER_ANON_KEY,
  env.ACTIVATION_MANAGER_ANON_KEY,
  desktop.anonKey,
  'sb_publishable_2Y4swUzZu3tKn2o-KuIkMw_nRFud0Jb'
);
const applicationKey = first(
  env.VITE_MURSHID_APPLICATION_KEY,
  env.MURSHID_APPLICATION_KEY,
  desktop.applicationKey,
  '412ed76c-741a-49d8-afcc-e7eed62e8fcd'
);

const isConfigured =
  /^https?:\/\//i.test(activationUrl) &&
  activationAnonKey.length > 20 &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationKey);

const supabase: SupabaseClient | null = isConfigured
  ? createClient(activationUrl, activationAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const DEVICE_ID_KEY = 'murshid_device_id';

export function getDeviceId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      let id = localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    }
  } catch {
    /* ignore */
  }
  return crypto.randomUUID();
}

export function getPlatformLabel(): string {
  try {
    const p = (navigator.platform || navigator.userAgent || '').toLowerCase();
    if (p.includes('win')) return 'Windows';
    if (p.includes('mac')) return 'macOS';
    if (p.includes('linux')) return 'Linux';
    if (p.includes('android')) return 'Android';
    if (p.includes('iphone') || p.includes('ipad')) return 'iOS';
  } catch {
    /* ignore */
  }
  return 'جهاز';
}

export function getDeviceName(): string {
  return `${getPlatformLabel()} · ${getDeviceId().slice(0, 8)}`;
}

// ── Hardware-bound activation identity ─────────────────────────────────────
// Electron supplies a salted hardware fingerprint (Windows MachineGuid). The
// licence therefore follows the physical machine and cannot be moved by copying
// the application folder or its data.
interface ActivationDeviceIdentity {
  id: string;
  deviceName: string;
}

let cachedActivationIdentity: ActivationDeviceIdentity | null = null;

async function resolveActivationDeviceIdentity(): Promise<ActivationDeviceIdentity> {
  if (cachedActivationIdentity) return cachedActivationIdentity;
  try {
    const bridge = (window as any).electronAPI;
    if (typeof bridge?.getDeviceIdentity === 'function') {
      const identity = bridge.getDeviceIdentity();
      if (identity && typeof identity.id === 'string' && identity.id.trim()) {
        cachedActivationIdentity = {
          id: identity.id.trim(),
          deviceName: String(identity.deviceName || 'Windows').trim() || 'Windows',
        };
        return cachedActivationIdentity;
      }
    }
  } catch (error) {
    console.warn('[activationManager] Unable to read hardware identity:', error);
  }
  cachedActivationIdentity = { id: getDeviceId(), deviceName: getDeviceName() };
  return cachedActivationIdentity;
}

export type ActivationStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'expired'
  | 'invalid';

export interface ActivationStatusResult {
  status: ActivationStatus | 'error';
  requestId?: string;
  rejectionReason?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  error?: string;
  /** True when the result comes from the cached licence window (no network). */
  offline?: boolean;
}

// ── Local licence snapshot (offline expiry) ────────────────────────────────
// The last server-approved activatedAt/expiresAt pair is kept by Electron in
// userData (DPAPI-encrypted, never in the application folder). A copied
// installation has a different hardware deviceId, so the snapshot is ignored.
interface StoredActivationState {
  deviceId: string;
  requestId?: string;
  activatedAt?: string | null;
  expiresAt?: string | null;
  lastCheckedAt: string;
}

const LOCAL_ACTIVATION_KEY = 'murshid_activation_snapshot_v1';

async function loadStoredActivationState(): Promise<StoredActivationState | null> {
  try {
    const bridge = (window as any).electronAPI;
    if (typeof bridge?.getActivationState === 'function') {
      const state = await bridge.getActivationState();
      return state && typeof state === 'object' ? (state as StoredActivationState) : null;
    }
  } catch (error) {
    console.warn('[activationManager] Unable to read local activation state:', error);
  }
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVATION_KEY);
    return raw ? (JSON.parse(raw) as StoredActivationState) : null;
  } catch {
    return null;
  }
}

async function saveStoredActivationState(state: StoredActivationState): Promise<void> {
  try {
    const bridge = (window as any).electronAPI;
    if (typeof bridge?.setActivationState === 'function') {
      await bridge.setActivationState(state);
      return;
    }
  } catch (error) {
    console.warn('[activationManager] Unable to save local activation state:', error);
  }
  try {
    localStorage.setItem(LOCAL_ACTIVATION_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

async function clearStoredActivationState(): Promise<void> {
  try {
    const bridge = (window as any).electronAPI;
    if (typeof bridge?.clearActivationState === 'function') {
      await bridge.clearActivationState();
    }
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LOCAL_ACTIVATION_KEY);
  } catch {
    /* ignore */
  }
}

function evaluateStoredActivationState(
  stored: StoredActivationState | null,
  deviceId: string
): ActivationStatusResult | null {
  if (!stored || !stored.deviceId || stored.deviceId !== deviceId) return null;

  // Never let a clock rollback extend the licence window.
  const lastChecked = Date.parse(stored.lastCheckedAt || '') || 0;
  const now = Date.now();

  if (lastChecked && now < lastChecked - 5 * 60 * 1000) {
    return { status: 'expired', requestId: stored.requestId, expiresAt: stored.expiresAt ?? null };
  }

  const effectiveNow = Math.max(now, lastChecked);

  if (stored.expiresAt) {
    const expiresAtMs = Date.parse(stored.expiresAt);
    if (Number.isFinite(expiresAtMs) && effectiveNow >= expiresAtMs) {
      return { status: 'expired', requestId: stored.requestId, expiresAt: stored.expiresAt };
    }
  }

  return {
    status: 'approved',
    requestId: stored.requestId,
    activatedAt: stored.activatedAt ?? null,
    expiresAt: stored.expiresAt ?? null,
    offline: true,
  };
}

export const isActivationConfigured = isConfigured;

export async function getActivationStatus(): Promise<ActivationStatusResult> {
  if (!supabase) {
    return { status: 'error', error: 'إعداد نظام التفعيل غير مكتمل.' };
  }

  const identity = await resolveActivationDeviceIdentity();

  try {
    const { data, error } = await supabase.rpc('get_activation_status', {
      p_application_key: applicationKey,
      p_device_id: identity.id,
    });

    if (error) {
      const missing = error.code === 'PGRST202' || error.code === '42883';
      const message = missing
        ? 'دالة التحقق من الترخيص غير متوفرة في نظام التفعيل.'
        : error.message || 'تعذر التحقق من حالة الترخيص.';
      const cached = evaluateStoredActivationState(await loadStoredActivationState(), identity.id);
      return cached ?? { status: 'error', error: message };
    }

    const result = (data ?? {}) as Record<string, unknown>;
    const status = String(result.status ?? '').trim().toLowerCase();

    switch (status) {
      case 'none':
      case 'pending':
      case 'approved':
      case 'rejected':
      case 'revoked':
      case 'expired':
      case 'invalid': {
        const requestId = typeof result.request_id === 'string' ? result.request_id : undefined;
        const activatedAt = typeof result.activated_at === 'string' ? result.activated_at : null;
        const expiresAt = typeof result.expires_at === 'string' ? result.expires_at : null;

        if (status === 'approved') {
          await saveStoredActivationState({
            deviceId: identity.id,
            requestId,
            activatedAt,
            expiresAt,
            lastCheckedAt: new Date().toISOString(),
          });
        } else {
          await clearStoredActivationState();
        }

        return {
          status,
          requestId,
          rejectionReason: typeof result.rejection_reason === 'string' ? result.rejection_reason : null,
          activatedAt,
          expiresAt,
        };
      }
      default:
        return { status: 'error', error: 'استجابة غير متوقعة من نظام التفعيل.' };
    }
  } catch (err: any) {
    const cached = evaluateStoredActivationState(await loadStoredActivationState(), identity.id);
    return cached ?? { status: 'error', error: err?.message || 'تعذر الاتصال بنظام التفعيل.' };
  }
}

export async function submitActivationRequest(
  fullName: string,
  phoneNumber?: string,
  location?: string,
  additionalInfo?: string
): Promise<{
  success: boolean;
  data?: { id: string; status: string; created: boolean };
  error?: string;
}> {
  if (!supabase) {
    return { success: false, error: 'إعداد نظام التفعيل غير مكتمل.' };
  }

  try {
    const identity = await resolveActivationDeviceIdentity();
    const { data, error } = await supabase.rpc('submit_activation_request', {
      p_application_key: applicationKey,
      p_full_name: fullName,
      p_phone_number: phoneNumber || '',
      p_location: location || '',
      p_additional_info: additionalInfo || '',
      p_device_id: identity.id,
      p_device_name: identity.deviceName,
      p_operating_system: getPlatformLabel(),
    });

    if (error) {
      let message = 'تعذر إرسال طلب التنشيط. يرجى المحاولة مرة أخرى.';
      if (error.code === 'P0002') {
        message = 'مفتاح التطبيق غير مسجل في نظام التفعيل.';
      } else if (error.code === '22023') {
        message = 'بيانات غير صالحة. يرجى مراجعة الحقول المطلوبة.';
      } else if (error.code === '22P02') {
        message = 'معرف التطبيق غير صالح.';
      } else if (error.message?.toLowerCase().includes('duplicate')) {
        message = 'يوجد طلب تنشيط قيد الانتظار لنفس الجهاز.';
      } else if (error.message) {
        message = error.message;
      }
      return { success: false, error: message };
    }

    const result = data as { id?: string; status?: string; created?: boolean } | null;
    if (result?.created === true || result?.created === false) {
      return {
        success: true,
        data: {
          id: result.id || '',
          status: result.status || 'pending',
          created: result.created,
        },
      };
    }

    return { success: false, error: 'استجابة غير متوقعة من نظام التفعيل.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'حدث خطأ غير متوقع أثناء إرسال الطلب.' };
  }
}
