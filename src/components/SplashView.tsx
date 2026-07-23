/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SplashView — Professional flat splash screen matching specification.
 * White background, logo left, text right, progress bar, footer.
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
    // Fade in
    const fadeInTimer = setTimeout(() => setOpacity(1), 50);

    // Status text updates
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

    // Progress bar
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          // Wait 500ms at 100%, then fade out
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
      style={{ backgroundColor: '#FFFFFF' }}
    >
      {/* Splash Window */}
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
        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Left Side — Logo */}
          <div className="w-[200px] flex items-center justify-center shrink-0">
            <img
              src="./logo.png"
              alt="مرشد"
              className="w-[120px] h-[120px] object-contain"
            />
          </div>

          {/* Right Side — Text */}
          <div className="flex-1 flex flex-col justify-center pr-8 pl-4">
            {/* Title */}
            <h1
              className="leading-none mb-2"
              style={{
                fontSize: 42,
                fontWeight: 900,
                color: '#0B1F3A',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              مرشد
            </h1>

            {/* Description */}
            <p
              className="leading-relaxed max-w-[320px]"
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: '#7A8BA0',
                fontFamily: 'Arial, sans-serif',
                lineHeight: '22px',
              }}
            >
              برنامج مكتبي ذكي مصمم لمساعدة المرشد التربوي في
              إدارة الطلبة، السجلات الإرشادية والوثائق المدرسية الرسمية.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6" style={{ borderTop: '1px solid #E8ECF0' }} />

        {/* Bottom Section */}
        <div className="px-6 pt-4 pb-3">
          {/* Percentage */}
          <div className="mb-1.5">
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#2D8CFF',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              {progress}%
            </span>
          </div>

          {/* Progress Bar */}
          <div
            className="w-full overflow-hidden"
            style={{
              height: 6,
              backgroundColor: '#F0F2F5',
              borderRadius: 3,
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#2D8CFF',
                borderRadius: 3,
                transition: 'width 30ms linear',
              }}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-4">
            {/* Left — Copyright */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: '#A0B4CC',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              جميع الحقوق محفوظة لشركة Pandara Tech
            </span>

            {/* Center — Loading text */}
            <span
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: '#7A8BA0',
                fontFamily: 'Arial, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              {statusText}
            </span>

            {/* Right — Version */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: '#A0B4CC',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              النسخة: v1.0.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
