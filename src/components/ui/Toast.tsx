// Small dismissible notification shown at the bottom-right of the screen.
import { Icon } from "@/components/ui/Icon";

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <button onClick={onDismiss} className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-xs font-medium text-white shadow-xl shadow-slate-900/20" aria-label="Dismiss notification">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600"><Icon name="activity" size={13} /></span>
      <span>{message}</span>
      <Icon name="close" size={14} className="ml-2 text-slate-400" />
    </button>
  );
}
