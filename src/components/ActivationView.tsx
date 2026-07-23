import React, { useState, useEffect, useRef } from 'react';
import { Key, ShieldAlert, BadgeCheck, HelpCircle, PhoneCall, Globe, Cpu, Monitor, Wifi } from 'lucide-react';
import { LicenseInfo } from '../types';
import { saveLicense, loadLicense } from '../lib/storage';
import {
  activateAsync,
  requestActivationAsync,
  pollRequestStatusAsync,
  validateAsync,
  clearActivation,
  generateHwid,
  loadCache,
} from '../lib/pandaraActivation';

interface ActivationViewProps {
  onActivated: (license: LicenseInfo) => void;
}

export default function ActivationView({ onActivated }: ActivationViewProps) {
  const [tab, setTab] = useState<'key' | 'request'>('key');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [internetOk, setInternetOk] = useState<boolean | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState('');
  const pollingRef = useRef<number | null>(null);

  const hwid = generateHwid();
  const deviceName = navigator.platform;
  const computerName = navigator.platform.split(' ')[0] || 'DEVICE';

  useEffect(() => {
    fetch('https://mentisadmin-api.onrender.com/activation/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(() => setInternetOk(true))
      .catch(() => setInternetOk(false));
  }, []);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const startPolling = (reqId: string) => {
    setRequestStatus('Waiting for administrator approval...');
    pollingRef.current = window.setInterval(async () => {
      const result = await pollRequestStatusAsync(hwid);
      if (result.status === 'Approved') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        const cache = loadCache();
        const lic: LicenseInfo = {
          licenseKey: cache?.licenseKey || 'approved',
          isActivated: true,
          activatedAt: new Date().toISOString(),
          activatedTo: 'Approved by administrator',
        };
        setSuccess(true);
        saveLicense(lic);
        setTimeout(() => onActivated(lic), 1500);
      } else if (result.status === 'Rejected') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setError(`❌ Rejected: ${result.rejectionReason || 'No reason provided'}`);
        setLoading(false);
        setRequestStatus('');
      }
    }, 2000);
  };

  const handleRequestActivation = async () => {
    setLoading(true);
    setError('');
    const result = await requestActivationAsync();
    if (result.success && result.requestId) {
      setRequestId(result.requestId);
      startPolling(result.requestId);
    } else {
      setError(result.error || 'Failed to submit request');
      setLoading(false);
    }
  };

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const trimmedKey = key.trim();
    if (!trimmedKey) { setError('Please enter an activation key.'); setLoading(false); return; }

    const result = await activateAsync(trimmedKey);
    if (result.success) {
      setSuccess(true);
      const lic: LicenseInfo = {
        licenseKey: trimmedKey,
        isActivated: true,
        activatedAt: new Date().toISOString(),
        activatedTo: 'Activated',
      };
      saveLicense(lic);
      setTimeout(() => onActivated(lic), 1500);
    } else {
      setError(result.error || 'Activation failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm z-50">
      <div className="w-[580px] bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-800" dir="rtl">
        {/* Title Bar */}
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
          {/* Device Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Device:</span><span className="font-medium text-slate-700" dir="ltr">{deviceName}</span></div>
            <div className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Computer:</span><span className="font-medium text-slate-700">{computerName}</span></div>
            <div className="flex items-center gap-1.5 col-span-2"><Key className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">HWID:</span><span className="font-mono text-[10px] text-slate-600" dir="ltr">{hwid}</span></div>
            <div className="flex items-center gap-1.5 col-span-2">
              <Wifi className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Internet:</span>
              {internetOk === null ? <span className="text-slate-400">Checking...</span> :
               internetOk ? <span className="text-emerald-600 font-bold">✅ Connected</span> :
               <span className="text-rose-600 font-bold">❌ Disconnected</span>}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-4">
            <button onClick={() => setTab('key')} className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${tab === 'key' ? 'text-office-blue border-b-2 border-office-blue' : 'text-slate-500 hover:text-slate-700'}`}>🔑 Activation Key</button>
            <button onClick={() => setTab('request')} className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${tab === 'request' ? 'text-office-blue border-b-2 border-office-blue' : 'text-slate-500 hover:text-slate-700'}`}>🟢 Request Activation</button>
          </div>

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-center my-6 animate-pulse">
              <BadgeCheck className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
              <h3 className="text-base font-bold text-emerald-950">تم التنشيط بنجاح!</h3>
              <p className="text-xs text-emerald-700 mt-1">رخصة مرشد مفعلة. جاري تشغيل التطبيق...</p>
            </div>
          ) : tab === 'key' ? (
            <form onSubmit={handleActivateKey} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700" htmlFor="lic_key">مفتاح التفعيل (Activation Key):</label>
                <input id="lic_key" type="text" value={key} onChange={e => setKey(e.target.value)}
                  placeholder="XXXXXX-XXXXXX-XX" dir="ltr"
                  className="w-full text-center tracking-widest font-mono uppercase bg-slate-50 text-slate-900 border border-slate-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-office-blue focus:bg-white placeholder:text-slate-400 placeholder:tracking-normal" />
              </div>
              {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-3 leading-relaxed">{error}</div>}
              <button type="submit" disabled={loading || internetOk === false}
                className="w-full bg-office-blue hover:bg-office-hover text-white font-bold py-2.5 px-4 rounded-md text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50">
                {loading ? 'جاري التفعيل...' : '🔑 تفعيل البرنامج'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50/50 border border-office-blue/20 rounded p-3 text-center">
                <p className="text-xs text-slate-700 leading-relaxed">Submit a request. An administrator will be notified via Telegram to approve or reject.</p>
              </div>
              {requestStatus && <div className="text-xs text-office-blue bg-blue-50 border border-blue-200 rounded p-3 text-center font-bold">{requestStatus}</div>}
              {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-3 leading-relaxed">{error}</div>}
              <button onClick={handleRequestActivation} disabled={loading || internetOk === false}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-md text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50">
                {loading ? 'جاري الإرسال...' : '🟢 Request Activation'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center text-[11px] text-slate-500">
          <div className="flex items-center gap-1"><PhoneCall className="w-3.5 h-3.5 text-slate-400" /><span>Support: <bdi dir="ltr">0770 075 8915</bdi></span></div>
          <div className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-slate-400" /><span>Pandara Tech</span></div>
        </div>
      </div>
    </div>
  );
}
