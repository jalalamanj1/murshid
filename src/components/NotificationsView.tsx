/**
 * Notifications tab: repository additions, sync failures and other notices.
 */

import { Bell, BellOff, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

export interface AppNotification {
  id: string;
  text: string;
  at: number;
  level: 'info' | 'error';
  quiet?: boolean;
}

interface NotificationsViewProps {
  notifications: AppNotification[];
  onClear: () => void;
}

function timeLabel(at: number): string {
  return new Date(at).toLocaleString('ar-IQ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function NotificationsView({ notifications, onClear }: NotificationsViewProps) {
  return (
    <div className="flex flex-col gap-5" dir="rtl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">آخر المستجدات</p>
          <h1 className="mt-1.5 text-[24px] font-black leading-tight text-main">التنبيهات</h1>
          <p className="mt-1 text-[11px] font-semibold text-muted">
            الملفات الجديدة تظهر أيضاً كإشارة على تبويبها الخاص، وتُسجَّل هنا للمراجعة.
          </p>
        </div>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="btn-secondary flex items-center gap-1.5 !px-3 !py-2 !text-[11px]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            مسح الكل
          </button>
        )}
      </header>

      {notifications.length === 0 ? (
        <div className="rounded-[14px] border border-border-color bg-card px-6 py-16 text-center shadow-xs">
          <BellOff className="mx-auto mb-3 h-8 w-8 text-muted" />
          <p className="text-[12px] font-black text-main">لا توجد تنبيهات جديدة</p>
          <p className="mt-1 text-[10.5px] text-muted">
            ستظهر هنا الملفات المضافة وتنبيهات المزامنة.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-border-color bg-card shadow-xs">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className="flex items-start gap-3 border-b border-divider-color px-4 py-3 last:border-0"
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  notification.level === 'error'
                    ? 'bg-danger-bg text-danger'
                    : 'bg-primary-bg text-primary'
                }`}
              >
                {notification.level === 'error' ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold leading-relaxed text-main">{notification.text}</p>
                <p className="mt-0.5 text-[9.5px] text-muted">{timeLabel(notification.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-1.5 text-[9.5px] text-muted">
        <Bell className="h-3 w-3" />
        تُحدَّث مكتبات الملفات والمخاطبات والأغلفة تلقائياً كل 5 ثوانٍ.
      </p>
    </div>
  );
}
