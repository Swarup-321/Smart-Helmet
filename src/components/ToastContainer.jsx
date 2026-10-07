import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => {
        const isCritical = toast.type === 'critical' || toast.type === 'danger';
        const isWarning = toast.type === 'warning';
        const isSuccess = toast.type === 'success';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-card backdrop-blur-md flex items-start justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
              isCritical
                ? 'bg-rose-50/95 border-rose-300 text-rose-950'
                : isWarning
                ? 'bg-amber-50/95 border-amber-300 text-amber-950'
                : isSuccess
                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                : 'bg-white/95 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-start space-x-2.5">
              <div className="mt-0.5">
                {isCritical && <ShieldAlert className="h-5 w-5 text-rose-600 animate-pulse" />}
                {isWarning && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                {isSuccess && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                {!isCritical && !isWarning && !isSuccess && <Info className="h-5 w-5 text-blue-600" />}
              </div>
              <div>
                <h5 className="font-bold text-xs">{toast.title}</h5>
                <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{toast.message}</p>
              </div>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
