import { useEffect, useState, type FormEvent } from 'react';
import {
  ShieldCheck,
  Clock,
  Loader2,
  UserRound,
  Phone,
  MapPin,
  AlertCircle,
  CheckCircle2,
  BadgeCheck,
} from 'lucide-react';
import type { ActivationStatusResult } from '../lib/activationManager';

interface ActivationGateViewProps {
  activationStatus: ActivationStatusResult | null;
  onSubmit: (data: {
    fullName: string;
    phone: string;
    location: string;
    notes?: string;
  }) => Promise<void>;
}

function isValidPhone(value: string): boolean {
  return /^[+]?[0-9\s()\-]+$/.test(value) && value.length >= 7 && value.length <= 30;
}

function statusMessage(status: ActivationStatusResult | null): string | null {
  if (!status) return null;
  switch (status.status) {
    case 'none':
      return 'أرسل طلب التنشيط للحصول على ترخيص مُرْشِد. لن يعمل البرنامج قبل موافقة الإدارة.';
    case 'pending':
      return 'تم استلام طلبك وهو الآن بانتظار موافقة الإدارة. سيُفتح البرنامج تلقائياً بعد الاعتماد.';
    case 'approved':
      return 'تم اعتماد الترخيص. جاري فتح البرنامج…';
    case 'rejected':
      return `تم رفض طلب التنشيط.${status.rejectionReason ? ` السبب: ${status.rejectionReason}` : ''}`;
    case 'revoked':
      return 'تم إلغاء ترخيص مُرْشِد من قبل الإدارة. يرجى التواصل مع الإدارة أو إرسال طلب جديد.';
    case 'expired':
      return 'انتهت صلاحية ترخيص مُرْشِد. يرجى التواصل مع الإدارة لتجديد الترخيص.';
    case 'invalid':
      return 'حالة الترخيص غير صالحة. يرجى التواصل مع الإدارة.';
    case 'error':
      return status.error || 'تعذر التحقق من حالة الترخيص.';
    default:
      return null;
  }
}

export default function ActivationGateView({ activationStatus, onSubmit }: ActivationGateViewProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const awaitingApproval = activationStatus?.status === 'pending' || success;

  useEffect(() => {
    if (activationStatus?.status === 'pending') setSuccess(true);
    if (activationStatus?.status !== 'pending') setSuccess(false);
  }, [activationStatus?.status]);

  const message = statusMessage(activationStatus);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('يرجى إدخال الاسم الكامل.');
      return;
    }
    if (!phone.trim() || !isValidPhone(phone.trim())) {
      setError('يرجى إدخال رقم هاتف صالح.');
      return;
    }
    if (!location.trim() || location.trim().length < 2) {
      setError('يرجى إدخال الموقع أو المدينة.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        phone: phone.trim(),
        location: location.trim(),
        notes: notes.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال طلب التنشيط.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-office-bg p-6" dir="rtl">
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-lg">
          <div className="card overflow-hidden !p-0">
            {/* Header */}
            <div className="border-b border-border-color bg-card-elevated px-7 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-bg text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-main">تنشيط مُرْشِد</h1>
                  <p className="mt-0.5 text-xs font-medium text-muted">المرشد التربوي العراقي المتكامل</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-7">
              {message && (
                <div
                  className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-semibold leading-relaxed ${
                    activationStatus?.status === 'pending' || activationStatus?.status === 'approved'
                      ? 'border-primary-border bg-primary-bg text-primary'
                      : activationStatus?.status === 'rejected' ||
                        activationStatus?.status === 'revoked' ||
                        activationStatus?.status === 'invalid'
                      ? 'border-danger/30 bg-danger-bg text-danger'
                      : 'border-border-color bg-card-elevated text-secondary'
                  }`}
                >
                  {awaitingApproval ? (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{message}</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-xs font-bold text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && !error && (
                <div className="flex items-center gap-2 text-xs font-bold text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تم تسجيل الطلب. سيتم التحقق من الموافقة تلقائياً.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" aria-disabled={awaitingApproval}>
                <div>
                  <label className="form-label" htmlFor="activation-name">الاسم الكامل *</label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      id="activation-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="اسمك الكامل"
                      disabled={awaitingApproval}
                      className="form-input !pr-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="form-label" htmlFor="activation-phone">رقم الهاتف *</label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <input
                        id="activation-phone"
                        type="tel"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+964 770 123 4567"
                        disabled={awaitingApproval}
                        className="form-input !pr-10 text-right"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="activation-location">الموقع / المدينة *</label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <input
                        id="activation-location"
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="المحافظة أو المدينة"
                        disabled={awaitingApproval}
                        className="form-input !pr-10"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="form-label" htmlFor="activation-notes">ملاحظات (اختياري)</label>
                  <textarea
                    id="activation-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أي معلومات إضافية"
                    rows={2}
                    disabled={awaitingApproval}
                    className="form-input resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || awaitingApproval}
                  className="btn-primary flex w-full items-center justify-center gap-2 !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {awaitingApproval ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      بانتظار موافقة الإدارة…
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري الإرسال…
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="h-4 w-4" />
                      إرسال طلب التنشيط
                    </>
                  )}
                </button>

                {awaitingApproval && (
                  <p className="flex items-center justify-center gap-2 text-[11px] font-bold text-primary">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    يتم التحقق من الموافقة تلقائياً… لا حاجة لأي إجراء.
                  </p>
                )}

                <p className="text-center text-[10px] leading-relaxed text-muted">
                  لا يعمل البرنامج إلا بعد اعتماد الإدارة. يمكن للإدارة إلغاء الترخيص في أي وقت.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
