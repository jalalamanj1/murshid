/**
 * Floating bar for selected records. Rendered only when something is selected.
 */

import { Trash2, X } from 'lucide-react';
import { toLatinDigits } from '../lib/format';

interface BulkDeleteBarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
}

export default function BulkDeleteBar({ count, onClear, onDelete }: BulkDeleteBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border-color bg-card px-4 py-2.5 shadow-2xl">
      <span className="text-[11px] font-black text-main">
        تم تحديد {toLatinDigits(count)}
      </span>
      <span className="h-4 w-px bg-divider-color" />
      <button
        type="button"
        onClick={onClear}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-bold text-sec transition-colors hover:bg-hover hover:text-main"
      >
        <X className="h-3 w-3" />
        إلغاء
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-1 rounded-lg bg-danger px-3 py-1.5 text-[10.5px] font-bold text-white transition-opacity hover:opacity-90"
      >
        <Trash2 className="h-3 w-3" />
        حذف المحدد
      </button>
    </div>
  );
}
