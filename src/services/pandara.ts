const API = 'https://pandara-api.onrender.com/api';

export interface ActivationResult {
  isValid: boolean;
  licenseKey: string;
  productName: string;
  licenseType: string;
  status: string;
  userName: string;
  userEmail: string;
  expiresAt: string | null;
  activatedAt: string | null;
  maxDevices: number;
  currentDevices: number;
  deviceRegistered: boolean;
  offlineToken: string | null;
  offlineValidUntil: string | null;
  message: string;
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

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok && !json.success) throw new Error(json.message || 'Request failed');
  return json.data;
}

const deviceId = getDeviceId();
const machineName = navigator.platform;
const os = navigator.userAgent;

export const pandara = {
  activate: (licenseKey: string) =>
    request<ActivationResult>('/licenses/activate', { licenseKey, deviceIdentifier: deviceId, machineName, operatingSystem: os }),

  validate: (licenseKey: string) =>
    request<ActivationResult>('/licenses/validate', { licenseKey, deviceIdentifier: deviceId, machineName, operatingSystem: os }),

  deactivate: (licenseKey: string) =>
    request<boolean>('/licenses/deactivate', { licenseKey, deviceIdentifier: deviceId }),

  submitActivationRequest: (params: {
    licenseKey: string; productName: string; customerName: string; customerEmail: string;
    licenseType: string; maxDevices: number; phone?: string; business?: string; address?: string;
  }) =>
    request<ActivationResult>('/activation-requests', {
      licenseKey: params.licenseKey, productName: params.productName,
      machineName, deviceIdentifier: deviceId, operatingSystem: os,
      customerName: params.customerName, customerEmail: params.customerEmail,
      customerPhone: params.phone || '', customerBusiness: params.business || '', customerAddress: params.address || '',
      requestedLicenseType: params.licenseType, requestedMaxDevices: params.maxDevices,
    }),
};
