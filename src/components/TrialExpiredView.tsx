/**
 * Trial expiry screen. This is the only screen shown after the 7-day trial.
 */

import { MessageCircle, ShieldAlert } from 'lucide-react';

const WHATSAPP_URL =
  'https://wa.me/9647700758915?text=' +
  encodeURIComponent('مرحباً، انتهت الفترة التجريبية لتطبيق مرشد وأرغب بطلب النسخة الكاملة.');

export default function TrialExpiredView() {
  const openWhatsApp = () => {
    const api = (window as any).electronAPI;
    if (typeof api?.openExternal === 'function') {
      api.openExternal(WHATSAPP_URL);
      return;
    }
    window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      dir="rtl"
      className="flex min-h-screen w-screen items-center justify-center bg-main-bg p-6 font-sans text-main"
    >
      <div className="w-full max-w-md overflow-hidden rounded-[18px] border border-border-color bg-card shadow-2xl">
        <div className="flex flex-col items-center gap-4 px-7 pt-9 pb-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-bg text-primary">
            <ShieldAlert className="h-7 w-7" strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="text-[22px] font-black leading-tight text-main">
              انتهت الفترة التجريبية
            </h1>
            <p className="mt-3 text-[12px] leading-relaxed text-sec">
              شكراً لتجربة تطبيق <strong className="text-main">مرشد</strong>. لمواصلة استخدام
              التطبيق والاحتفاظ بسجلاتك، يرجى طلب النسخة الكاملة.
            </p>
          </div>
          <button
            type="button"
            onClick={openWhatsApp}
            className="btn-primary mt-2 flex w-full items-center justify-center gap-2 !py-3"
          >
            <MessageCircle className="h-4 w-4" />
            طلب النسخة الكاملة عبر واتساب
          </button>
          <p className="text-[10px] text-muted" dir="ltr">
            9647700758915+
          </p>
        </div>
      </div>
    </div>
  );
}
