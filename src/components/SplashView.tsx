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
      { delay: 400, text: 'جاري فحص ترخيص التشغيل المحلي...' },
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
      className="fixed inset-0 flex items-center justify-center z-50 bg-office-bg"
    >
      <div
        dir="rtl"
        className="flex flex-col items-center justify-center"
        style={{
          opacity,
          transition: 'opacity 0.6s ease-in-out',
          maxWidth: 480,
          width: '100%',
          padding: 40,
        }}
      >
        {/* Logo */}
        <div className="mb-8">
          <img src="./logo.png" alt="مرشد" className="w-[100px] h-[100px] object-contain" />
        </div>

        {/* Title */}
        <h1 className="text-[40px] font-bold text-main mb-3">
          مرشد
        </h1>
        <p className="text-sm text-muted mb-12 text-center leading-relaxed max-w-[360px]">
          برنامج مكتبي ذكي مصمم لمساعدة المرشد التربوي في إدارة الطلبة، السجلات الإرشادية والوثائق المدرسية الرسمية.
        </p>

        {/* Progress */}
        <div className="w-full max-w-[360px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-primary">{progress}%</span>
          </div>
          <div className="w-full h-1 bg-border-color overflow-hidden rounded-sm">
            <div
              className="h-full bg-primary"
              style={{
                width: `${progress}%`,
                transition: 'width 30ms linear',
              }}
            />
          </div>
          <p className="text-xs text-muted mt-4 text-center">{statusText}</p>
        </div>

        {/* Footer */}
        <div className="mt-16 text-[10px] text-muted text-center">
          جميع الحقوق محفوظة &mdash; النسخة: v1.1.2
        </div>
      </div>
    </div>
  );
}
