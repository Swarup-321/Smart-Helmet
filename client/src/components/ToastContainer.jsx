import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => {
        const isCritical = toast.type === 'critical' || toast.type === 'danger';
        const isWarning = toast.type === 'warning';
        const isSuccess = toast.type === 'success';

        const borderLeftClass = isCritical
          ? 'border-l-4 border-l-[#F06548]'
          : isWarning
          ? 'border-l-4 border-l-[#F7B84B]'
          : isSuccess
          ? 'border-l-4 border-l-[#0AB39C]'
          : 'border-l-4 border-l-[#176B87]';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 bg-white rounded-md border border-[#E9EBEC] ${borderLeftClass} shadow-dropdown flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200`}
          >
            <div className="flex items-start space-x-2.5">
              <div className="mt-0.5 flex-shrink-0">
                {isCritical && <ShieldAlert className="h-4 w-4 text-[#F06548]" />}
                {isWarning && <AlertTriangle className="h-4 w-4 text-[#F7B84B]" />}
                {isSuccess && <CheckCircle2 className="h-4 w-4 text-[#0AB39C]" />}
                {!isCritical && !isWarning && !isSuccess && <Info className="h-4 w-4 text-[#176B87]" />}
              </div>
              <div>
                <h5 className="font-semibold text-xs text-[#212529]">{toast.title}</h5>
                <p className="text-xs text-[#878A99] mt-0.5 leading-relaxed">{toast.message}</p>
              </div>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded text-[#878A99] hover:text-[#212529] transition-colors flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
