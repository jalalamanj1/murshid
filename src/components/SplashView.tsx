/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SplashView — Professional flat splash screen.
 * Always renders in light theme regardless of app dark mode.
 */

import { useState, useEffect } from 'react';

interface SplashViewProps {
  onComplete: () => void;
}

export default function SplashView({ onComplete }: SplashViewProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('الاتصال بوحدة التخزين المحلية للبرنامج...');
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const fadeInTimer = setTimeout(() => setOpacity(1), 50);

    const intervals = [
      { delay: 400, text: 'جاري فحص ترخيص التشغيل المحلي لشركة Pandara Tech...' },
      { delay: 900, text: 'الاتصال بوحدة التخزين المحلية للبرنامج...' },
      { delay: 1400, text: 'جاري تحميل سجلات الطلاب وجلسات الإرشاد...' },
      { delay: 2000, text: 'جاري إعداد القوالب الرسمية ووزارة التربية العراقية...' },
      { delay: 2600, text: 'تم التحقق من سلامة البيانات. جاري تشغيل مرشد...' },
    ];

    const timeouts = intervals.map((item) =>
      setTimeout(() => setStatusText(item.text), item.delay)
    );

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setOpacity(0);
            setTimeout(onComplete, 500);
          }, 500);
          return 100;
        }
        return prev + 1;
      });
    }, 30);

    return () => {
      clearTimeout(fadeInTimer);
      timeouts.forEach(clearTimeout);
      clearInterval(timer);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: '#FFFFFF', colorScheme: 'light' }}
    >
      <style>{`
#splash_form,#splash_form *{
  color-scheme:light!important;
  background-color:transparent!important;
  border-color:#E8ECF0!important
}
#splash_form{background-color:#FFFFFF!important}
#splash_form .sp-title{color:#0B1F3A!important}
#splash_form .sp-desc{color:#7A8BA0!important}
#splash_form .sp-percent{color:#2D8CFF!important}
#splash_form .sp-bar-bg{background-color:#F0F2F5!important}
#splash_form .sp-bar-fill{background-color:#2D8CFF!important}
#splash_form .sp-footer{color:#A0B4CC!important}
#splash_form .sp-status{color:#7A8BA0!important}
`}</style>
      <div
        id="splash_form"
        dir="rtl"
        className="flex flex-col"
        style={{
          width: 620,
          height: 360,
          backgroundColor: '#FFFFFF',
          opacity,
          transition: 'opacity 0.5s ease-in-out',
        }}
      >
        {/* Main Content */}
        <div className="flex-1 flex">
          <div className="w-[200px] flex items-center justify-center shrink-0">
            <img src="./logo.png" alt="مرشد" className="w-[120px] h-[120px] object-contain" />
          </div>
          <div className="flex-1 flex flex-col justify-center pr-8 pl-4">
            <h1 className="leading-none mb-2 sp-title" style={{ fontSize: 42, fontWeight: 900, color: '#0B1F3A', fontFamily: 'Arial, sans-serif' }}>مرشد</h1>
            <p className="leading-relaxed max-w-[320px] sp-desc" style={{ fontSize: 13, fontWeight: 400, color: '#7A8BA0', fontFamily: 'Arial, sans-serif', lineHeight: '22px' }}>
              برنامج مكتبي ذكي مصمم لمساعدة المرشد التربوي في إدارة الطلبة، السجلات الإرشادية والوثائق المدرسية الرسمية.
            </p>
          </div>
        </div>

        <div className="mx-6" style={{ borderTop: '1px solid #E8ECF0' }} />

        {/* Bottom */}
        <div className="px-6 pt-4 pb-3">
          <div className="mb-1.5">
            <span className="sp-percent" style={{ fontSize: 13, fontWeight: 700, color: '#2D8CFF', fontFamily: 'Arial, sans-serif' }}>{progress}%</span>
          </div>
          <div className="w-full overflow-hidden" style={{ height: 6, backgroundColor: '#F0F2F5', borderRadius: 3 }}>
            <div className="sp-bar-fill" style={{ width: `${progress}%`, height: '100%', backgroundColor: '#2D8CFF', borderRadius: 3, transition: 'width 30ms linear' }} />
          </div>
          <div className="flex justify-between items-center mt-4">
            <span className="sp-footer" style={{ fontSize: 11, fontWeight: 400, color: '#A0B4CC', fontFamily: 'Arial, sans-serif' }}>جميع الحقوق محفوظة لشركة Pandara Tech</span>
            <span className="absolute left-1/2 -translate-x-1/2 sp-status" style={{ fontSize: 11, fontWeight: 500, color: '#7A8BA0', fontFamily: 'Arial, sans-serif', whiteSpace: 'nowrap' }}>{statusText}</span>
            <span className="sp-footer" style={{ fontSize: 11, fontWeight: 400, color: '#A0B4CC', fontFamily: 'Arial, sans-serif' }}>النسخة: v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
