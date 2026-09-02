import React from 'react';

interface Props {
  onClick?: () => void;
}

export default function FloatingChatButton({ onClick }: Props) {
  return (
    <button
      className="fixed z-[999] right-4 bottom-24 md:bottom-8 md:right-8 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl p-3.5 md:px-5 md:py-3.5 flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 border border-blue-400/40 cursor-pointer group"
      title="Buka Chat Admin"
      onClick={onClick}
    >
      <span className="font-bold text-xs">💬 Chat Admin</span>
    </button>
  );
}
