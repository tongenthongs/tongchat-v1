import React, { useState } from 'react';

export interface FormattedChatMessageProps {
  text?: string | null;
}

export const FormattedChatMessage: React.FC<FormattedChatMessageProps> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  if (!text) return null;

  // 1. Ekstraksi URL bersih untuk preview card & tombol copy (non-destruktif)
  const rawUrlMatch = text.match(/https?:\/\/[^\s`'"]+/);
  const cleanUrl = rawUrlMatch ? rawUrlMatch[0].replace(/^`+|`+$/g, '') : null;

  // 2. Parsing format teks non-destruktif (mempertahankan baris baru \n dan spasi asli)
  const renderFormattedText = (fullText: string) => {
    // Split berdasarkan URL atau format tebal *teks*
    const parts = fullText.split(/(https?:\/\/[^\s`'"]+|\*[^*]+\*)/g);
    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('http://') || part.startsWith('https://')) {
        const linkHref = part.replace(/^`+|`+$/g, '');
        return (
          <a
            key={idx}
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline break-all inline"
          >
            {linkHref}
          </a>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <strong key={idx} className="font-bold text-white">
            {part.slice(1, -1)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cleanUrl) return;
    navigator.clipboard.writeText(cleanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRoblox = cleanUrl && (cleanUrl.includes('roblox.com') || cleanUrl.includes('rbx.com'));
  const isFinalWarning = text.includes('PERINGATAN TERAKHIR');

  return (
    <div className="flex flex-col space-y-2.5 max-w-[340px] sm:max-w-[400px]">
      
      {/* KARTU PREVIEW ATAS (KHUSUS ROBLOX) */}
      {isRoblox && (
        <a
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 transition-all block group no-underline shadow-md"
        >
          <div className="p-3">
            <h4 className="text-sm font-bold text-emerald-400 leading-snug">
              Join Private Server
            </h4>
            <p className="text-xs text-neutral-300 mt-1 leading-relaxed line-clamp-2">
              Check out Drag Drive Simulator Private Server.
            </p>
            <span className="text-[11px] text-neutral-500 font-medium block pt-1">roblox.com</span>
          </div>
        </a>
      )}

      {/* SPECIAL FINAL WARNING BANNER CONTAINER */}
      {isFinalWarning ? (
        <div className="p-4 bg-gradient-to-br from-rose-950 via-red-950/90 to-amber-950/80 border-2 border-rose-500 rounded-2xl shadow-2xl shadow-rose-950/50 space-y-3">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-rose-500/40">
            <span className="text-xl animate-bounce">🚨</span>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-black text-rose-300 tracking-wider uppercase block">
                🚨 PERINGATAN TERAKHIR - BATAS WAKTU HARI INI
              </span>
              <span className="text-[10px] text-amber-300 font-semibold block mt-0.5">
                Batas Waktu Klaim Gift In-Game (Maksimal 2 Hari)
              </span>
            </div>
          </div>
          <div 
            className="text-xs text-rose-100 font-medium leading-relaxed"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '1.6'
            }}
          >
            {renderFormattedText(text)}
          </div>
        </div>
      ) : (
        /* TEKS PESAN REGULER DENGAN PRESERVASI TOTAL BARIS BARU & PARAGRAF */
        <div 
          className="text-sm text-slate-100 font-normal"
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: '1.6'
          }}
        >
          {renderFormattedText(text)}
        </div>
      )}

      {/* KOTAK SALIN URL MURNI */}
      {cleanUrl && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs">
          <span className="text-neutral-400 shrink-0">🔗</span>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 break-all text-blue-400 hover:underline leading-snug select-all line-clamp-1"
          >
            {cleanUrl}
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors shrink-0"
            title="Salin Link"
          >
            {copied ? (
              <span className="text-[10px] text-emerald-400 font-bold">Disalin</span>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      )}

    </div>
  );
};

export const ChatMessageRenderer = FormattedChatMessage;
export type ChatMessageRendererProps = FormattedChatMessageProps;


