import React from 'react';

// 🚀 ABSOLUTE HIGHLIGHT ENGINE Multi-Word dengan Safe-Null Guard
export const HighlightText = ({ text, highlight, fallback = 'Chat dimulai' }: { text?: string | number | null; highlight?: string | number | null; fallback?: string }) => {
  const rawStr = (text !== null && text !== undefined) ? String(text).trim() : '';
  const safeText = rawStr ? rawStr : fallback;

  if (!highlight || !String(highlight).trim() || !safeText) {
    return <>{safeText}</>;
  }

  // Pecah input pencarian menjadi array kata (misal: "min joki" -> ["min", "joki"])
  const keywords = String(highlight).trim().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return <>{safeText}</>;

  try {
    // Buat pola Regex gabungan: (min|joki)
    const regexPattern = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${regexPattern})`, 'gi');

    const parts = safeText.split(regex);

    return (
      <>
        {parts.map((part, index) => {
          const isMatch = keywords.some(kw => kw.toLowerCase() === part.toLowerCase());

          return isMatch ? (
            <span key={index} className="bg-emerald-500 text-slate-900 font-extrabold px-0.5 rounded">
              {part}
            </span>
          ) : (
            <span key={index}>{part}</span>
          );
        })}
      </>
    );
  } catch (e) {
    return <>{safeText}</>;
  }
};


