/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Optional passcode screen shown at startup when the user enabled the app lock.
 */

import { useState, type FormEvent } from 'react';
import { Lock, ShieldCheck, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { verifyAppLock } from '../lib/appLock';

interface PasscodeLockViewProps {
  onUnlock: () => void;
}

export default function PasscodeLockView({ onUnlock }: PasscodeLockViewProps) {
  const [passcode, setPasscode] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setChecking(true);
    setError('');
    try {
      const ok = await verifyAppLock(passcode);
      if (ok) {
        onUnlock();
        return;
      }
      setError('كلمة القفل غير صحيحة.');
      setPasscode('');
    } catch {
      setError('تعذر التحقق من كلمة القفل.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-office-bg p-5" dir="rtl">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-[-4rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-28 right-[-4rem] h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <form onSubmit={handleUnlock} className="card relative w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-orange-900/20">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-lg font-black text-main">مُرْشِد مقفل</h1>
          <p className="mt-1 text-[11px] text-muted">أدخل كلمة القفل للمتابعة إلى البرنامج.</p>
        </div>

        <div>
          <label htmlFor="murshid-lock-passcode" className="form-label">
            كلمة القفل
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="murshid-lock-passcode"
              type={show ? 'text' : 'password'}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="أدخل كلمة القفل"
              dir="ltr"
              className="form-input !pl-11 !pr-10 text-right"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition-colors hover:text-main"
              title={show ? 'إخفاء' : 'إظهار'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-bg px-3 py-2.5 text-[11px] font-bold text-danger">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={checking || !passcode.trim()}
          className="btn-primary flex w-full items-center justify-center gap-2 !py-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          فتح البرنامج
        </button>
      </form>
    </div>
  );
}
