import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { ROBLOX_JOKI_RULES } from '../../utils/rulesConstants';

interface RulesAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
  title?: string;
}

export const RulesAgreementModal: React.FC<RulesAgreementModalProps> = ({
  isOpen,
  onClose,
  onAgree,
  title = "Syarat & Ketentuan (Rules) Joko Entong Store"
}) => {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#151b22] border border-emerald-500/50 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-black text-[#00E676] flex items-center gap-2">
            <FileText className="w-4 h-4" /> {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-black/40 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono mb-4">
          {ROBLOX_JOKI_RULES}
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-800">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-200 font-medium select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#00E676] rounded cursor-pointer"
            />
            <span>
              Saya telah membaca, memahami, dan menyetujui seluruh Syarat & Ketentuan (Rules) di atas. Saya paham risiko dan aturan joko Roblox Entong Store.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!agreed}
              onClick={() => {
                if (!agreed) return;
                setAgreed(false);
                onAgree();
              }}
              className={`flex-1 py-3 font-black rounded-xl text-xs transition shadow-lg ${
                !agreed 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                  : 'bg-[#00E676] hover:bg-[#00c853] text-[#111b21] cursor-pointer'
              }`}
            >
              ✓ Setuju & Lanjutkan Pembayaran
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
