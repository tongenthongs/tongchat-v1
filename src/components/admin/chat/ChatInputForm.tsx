import React, { useState } from 'react';

export interface ChatInputFormProps {
  onSendMessage: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInputForm: React.FC<ChatInputFormProps> = React.memo(({ 
  onSendMessage, 
  disabled,
  placeholder = "Ketik balasan untuk customer..."
}) => {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSendMessage(cleanText);
      setText("");
    } catch (err) {
      console.error("Gagal kirim pesan:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
      <input
        type="text"
        value={text}
        disabled={disabled || isSending}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
      />
      <button
        type="submit"
        disabled={!text.trim() || isSending || disabled}
        className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSending ? "..." : "Kirim"}
      </button>
    </form>
  );
});

ChatInputForm.displayName = 'ChatInputForm';
