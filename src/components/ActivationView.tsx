import React, { useState } from 'react';
import { Key, BadgeCheck, Monitor, Cpu, Copy, Check } from 'lucide-react';
import { LicenseInfo } from '../types';
import { saveLicense } from '../lib/storage';
import {
  generateHwid,
  saveCache,
  ActivationCache,
} from '../lib/pandaraActivation';

const SECRET_KEY = 'Pandara@2026!Secure#Key$Murshid&Mentis';

interface ActivationViewProps {
  onActivated: (license: LicenseInfo) => void;
}

async function computeSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkType(hwid: string, licenseType: string, enteredCode: string): Promise<boolean> {
  const data = `${hwid}|${licenseType}|${SECRET_KEY}`;
  const hash = await computeSha256(data);
  const value = parseInt(hash.substring(0, 8), 16) >>> 0;
  const expected = (value % 100000000).toString().padStart(8, '0');
  return expected === enteredCode;
}

async function findMatchingLicenseType(hwid: string, enteredCode: string): Promise<string | null> {
  // Standard (non-trial) types
  for (const lt of ['Lifetime', 'Monthly', 'SixMonths', 'TwelveMonths']) {
    if (await checkType(hwid, lt, enteredCode)) return lt;
  }
  // Trial variants — cover common durations across days, hours, minutes
  for (const d of [1, 2, 3, 5, 7, 10, 14, 15, 21, 30, 45, 60]) {
    const t = `Trial_${d}_Days`; if (await checkType(hwid, t, enteredCode)) return t;
  }
  for (const h of [1, 2, 3, 5, 6, 7, 8, 10, 12, 15, 18, 20, 24]) {
    const t = `Trial_${h}_Hours`; if (await checkType(hwid, t, enteredCode)) return t;
  }
  for (const m of [1, 2, 3, 5, 10, 15, 20, 30, 45, 60]) {
    const t = `Trial_${m}_Minutes`; if (await checkType(hwid, t, enteredCode)) return t;
  }
  return null;
}

function computeExpiresAt(licenseType: string): string | undefined {
  if (!licenseType.startsWith('Trial_')) return undefined;
  const parts = licenseType.split('_');
  if (parts.length < 3) return undefined;
  const value = parseInt(parts[1], 10);
  const unit = parts[2];
  if (isNaN(value) || value < 1) return undefined;

  const now = new Date();
  switch (unit) {
    case 'Days': now.setDate(now.getDate() + value); break;
    case 'Hours': now.setHours(now.getHours() + value); break;
    case 'Minutes': now.setMinutes(now.getMinutes() + value); break;
    default: return undefined;
  }
  return now.toISOString();
}

export default function ActivationView({ onActivated }: ActivationViewProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hwidCopied, setHwidCopied] = useState(false);

  const hwid = generateHwid();
  const deviceName = navigator.platform;
  const computerName = navigator.platform.split(' ')[0] || 'DEVICE';

  const handleCopyHwid = () => {
    navigator.clipboard.writeText(hwid);
    setHwidCopied(true);
    setTimeout(() => setHwidCopied(false), 2000);
  };

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedKey = key.trim();
    if (!trimmedKey) { setError('الرجاء إدخال مفتاح التفعيل'); return; }
    if (!/^\d{8}$/.test(trimmedKey)) {
      setError('مفتاح التفعيل يجب أن يتكون من 8 أرقام');
      return;
    }

    setLoading(true);
    try {
      const matchedType = await findMatchingLicenseType(hwid, trimmedKey);
      if (!matchedType) {
        setError('مفتاح التفعيل غير صالح لهذا الجهاز');
        setLoading(false);
        return;
      }

      const expiresAt = computeExpiresAt(matchedType);

      const cache: ActivationCache = {
        hwid,
        licenseType: matchedType,
        customerName: 'مستخدم مرشد',
        productName: 'Murshid',
        activatedAt: new Date().toISOString(),
        expiresAt,
        isValid: true,
      };
      saveCache(cache);

      const lic: LicenseInfo = {
        isActivated: true,
        licenseType: matchedType,
        activatedAt: new Date().toISOString(),
        activatedTo: 'Activated',
      };
      saveLicense(lic);

      setSuccess(true);
      setTimeout(() => onActivated(lic), 1500);
    } catch {
      setError('حدث خطأ أثناء التحقق من المفتاح');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm z-50">
      <div className="w-[580px] bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-800" dir="rtl">
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center select-none">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-office-blue" />
            <span className="text-xs font-bold text-slate-700">تنشيط نظام مرشد - Murshid Activation</span>
          </div>
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-300 block"></span>
            <span className="w-3 h-3 rounded-full bg-slate-300 block"></span>
            <span className="w-3 h-3 rounded-full bg-slate-400 block"></span>
          </div>
        </div>

        <div className="p-5 flex-1">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Device:</span><span className="font-medium text-slate-700" dir="ltr">{deviceName}</span></div>
            <div className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Computer:</span><span className="font-medium text-slate-700">{computerName}</span></div>
            <div className="flex items-center gap-1.5 col-span-2">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">HWID:</span>
              <span className="font-mono text-[10px] text-slate-600 ml-1" dir="ltr">{hwid}</span>
              <button onClick={handleCopyHwid} className="mr-auto flex items-center gap-1 text-[10px] text-office-blue hover:text-office-hover cursor-pointer">
                {hwidCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{hwidCopied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleActivateKey} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700" htmlFor="lic_key">مفتاح التفعيل:</label>
              <input id="lic_key" type="text" value={key} onChange={e => setKey(e.target.value)}
                placeholder="" maxLength={8} dir="ltr" autoFocus
                className="w-full text-center tracking-[0.5em] font-mono text-lg text-office-blue bg-slate-50 text-slate-900 border border-slate-300 rounded-md px-3 py-3 focus:outline-none focus:ring-2 focus:ring-office-blue focus:bg-white placeholder:text-slate-300" />
            </div>
            {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-3 leading-relaxed">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-office-blue hover:bg-office-hover text-white font-bold py-3 px-4 rounded-md text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50">
              {loading ? 'جاري التحقق...' : '🔑 تفعيل البرنامج'}
            </button>
          </form>
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-center mt-4 animate-pulse">
              <BadgeCheck className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
              <h3 className="text-base font-bold text-emerald-950">تم التنشيط بنجاح!</h3>
              <p className="text-xs text-emerald-700 mt-1">جاري تشغيل التطبيق...</p>
            </div>
          )}
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 text-center text-[11px] text-slate-400">
          Pandara Tech - منصة إدارة التراخيص
        </div>
      </div>
    </div>
  );
}
