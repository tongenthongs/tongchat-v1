import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { 
  InteractiveBotType, 
  sendCustomerBubble, 
  sendBotBubble 
} from '../../services/botChatService';
import StrictOrderValidatedForm from './StrictOrderValidatedForm';

interface InteractiveBotBubbleProps {
  type: InteractiveBotType;
  roomId: string;
  currentUser?: UserProfile | null;
  messageId?: string;
  isAnswered?: boolean;
  onOpenCatalog?: (category: 'gift' | 'joki') => void;
}

export const InteractiveBotBubble: React.FC<InteractiveBotBubbleProps> = ({
  type,
  roomId,
  currentUser,
  messageId,
  isAnswered = false,
  onOpenCatalog
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [answeredLocally, setAnsweredLocally] = useState(false);

  const disabled = isProcessing || isAnswered || answeredLocally;

  // 1. SVG Ikon WhatsApp
  const WhatsAppIcon = () => (
    <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 flex items-center justify-center shrink-0 shadow-md">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02 0 1.19.87 2.34.99 2.5.12.16 1.7 2.6 4.12 3.65.58.25 1.02.4 1.38.52.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28s-1.44-.71-1.66-.82-.39-.16-.55.16-.64.82-.78.98-.29.18-.53.06c-.24-.12-1.01-.37-1.93-1.19-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.01-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.41-.41-.56-.42h-.48z"/>
      </svg>
    </div>
  );

  // 2. SVG Ikon Bot
  const BotAvatarIcon = () => (
    <div className="w-8 h-8 rounded-full bg-slate-900 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0 shadow-md">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5" />
      </svg>
    </div>
  );

  // 1. OPSI SAMBUTAN UTAMA
  const handleWelcomeChoice = async (choice: 'BELUM' | 'SUDAH') => {
    if (disabled || !roomId) return;
    setIsProcessing(true);
    setAnsweredLocally(true);

    try {
      if (choice === 'BELUM') {
        await sendCustomerBubble(roomId, 'Belum pernah jajan di Entong Store', currentUser);
        await sendBotBubble(
          roomId,
          'Sip, makasih ya udah pilih! ✨ Di Entong Store tersedia layanan utama. Silakan pilih di bawah untuk membuka katalog produk:',
          'NOT_YET_SERVICES'
        );
      } else {
        await sendCustomerBubble(roomId, 'Sudah jajan dari WA', currentUser);
        await sendBotBubble(
          roomId,
          'Halo Kak! Pilih kategori pesanan WA yang mau dilaporkan atau diisi form-nya ya:',
          'CHOOSE_CATEGORY'
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. OPSI BELUM PERNAH (KATALOG DIRECT LAUNCHER)
  const handleNotYetChoice = async (service: 'GIFT' | 'JOKI') => {
    if (disabled || !roomId) return;
    setIsProcessing(true);
    setAnsweredLocally(true);

    try {
      if (service === 'GIFT') {
        await sendCustomerBubble(roomId, 'Gift Ingame', currentUser);
        await sendBotBubble(
          roomId,
          'Mimin bantu bukain katalog Gift Ingame yaa!',
          'NONE',
          {
            type: "OPEN_CATALOG_MODAL",
            targetCategory: "GIFT",
            title: "Katalog Gift In Game",
            description: "Buka katalog untuk melihat pilihan gamepass & item game terlengkap di Entong Store.",
            buttonLabel: "Buka Katalog Gift In Game",
            routePath: "/catalog?cat=gift"
          }
        );
        if (onOpenCatalog) {
          onOpenCatalog('gift');
        }
      } else {
        await sendCustomerBubble(roomId, 'Joki Game', currentUser);
        await sendBotBubble(
          roomId,
          'Mimin bantu bukain katalog Joki Game yaa!',
          'NONE',
          {
            type: "OPEN_CATALOG_MODAL",
            targetCategory: "JOKI",
            title: "Katalog Joki Game",
            description: "Buka katalog untuk melihat layanan joki leveling, stats, & quest terlengkap di Entong Store.",
            buttonLabel: "Buka Katalog Joki Game",
            routePath: "/catalog?cat=joki"
          }
        );
        if (onOpenCatalog) {
          onOpenCatalog('joki');
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. OPSI SUDAH JAJAN DARI WA (PILIH KATEGORI FORM)
  const handleChooseCategory = async (cat: 'GIFT' | 'JOKI') => {
    if (disabled || !roomId) return;
    setIsProcessing(true);
    setAnsweredLocally(true);

    try {
      if (cat === 'GIFT') {
        await sendCustomerBubble(roomId, '1. Form Gift In Game (WA)', currentUser);
        await sendBotBubble(
          roomId,
          'Silakan lengkapi formulir Gift In Game berikut:',
          'FILL_GIFT_FORM'
        );
      } else {
        await sendCustomerBubble(roomId, '2. Form Joki (WA)', currentUser);
        await sendBotBubble(
          roomId,
          'Silakan lengkapi formulir Joki berikut:',
          'FILL_JOKI_FORM'
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. OPSI FEEDBACK MENUNGGU
  const handleFeedback = async (feedback: 'SABAR' | 'LAMA') => {
    if (disabled || !roomId) return;
    setIsProcessing(true);
    setAnsweredLocally(true);

    try {
      if (feedback === 'SABAR') {
        await sendCustomerBubble(roomId, '1. Oke min aku sabar nunggu', currentUser);
        await sendBotBubble(
          roomId,
          'Wihh terimakasih ya kak udah mau nunggu, nanti pasti di info lagi',
          'FINISHED'
        );
      } else {
        await sendCustomerBubble(roomId, '2. Kok lama banget min!', currentUser);
        await sendBotBubble(
          roomId,
          'Maaf ya kak prosesnya lama, karena yang beli ada ratusan orang, bukan cuma kamu aja. Jadi di proses sesuai urutan order ya!',
          'FINISHED'
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (type === 'NONE' || type === 'FINISHED' || type === 'WELCOME' || disabled) return null;

  return (
    <div className="w-full flex flex-col items-start mt-2">
      {/* WELCOME buttons are now handled exclusively by BotWelcomeOptions */}

      {/* 2. NOT_YET_SERVICES (DIRECT PRODUCT CATALOG LAUNCHER) */}
      {type === 'NOT_YET_SERVICES' && (
        <div className="flex flex-col gap-1.5 max-w-[260px]">
          <div className="flex items-center gap-2">
            <BotAvatarIcon />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleNotYetChoice('GIFT')}
              className="bg-slate-900/95 hover:bg-slate-800 text-sky-400 font-bold text-[10.5px] px-3 py-1.5 rounded-full border border-sky-500/40 shadow-sm transition-all active:scale-95 text-left flex items-center gap-1.5 cursor-pointer"
            >
              🎁 Gift Ingame
            </button>
          </div>
          <div className="flex items-center gap-2">
            <BotAvatarIcon />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleNotYetChoice('JOKI')}
              className="bg-slate-900/95 hover:bg-slate-800 text-cyan-400 font-bold text-[10.5px] px-3 py-1.5 rounded-full border border-cyan-500/40 shadow-sm transition-all active:scale-95 text-left flex items-center gap-1.5 cursor-pointer"
            >
              ⚡ Joki Game
            </button>
          </div>
        </div>
      )}

      {/* 3. CHOOSE_CATEGORY (TAHAP 2: SUB-MENU KATEGORI WA) */}
      {type === 'CHOOSE_CATEGORY' && (
        <div className="flex flex-col items-start gap-1.5 mt-1.5 max-w-[260px] select-none animate-in fade-in duration-150">
          {/* Opsi 1: Gift In Game (Gamepass) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleChooseCategory('GIFT')}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 hover:bg-slate-800/90 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-[10.5px] font-bold transition-all text-left shadow-sm active:scale-95 cursor-pointer"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-[9px] shrink-0">
              🎁
            </span>
            <span className="truncate">1. Gift In Game (Gamepass)</span>
          </button>

          {/* Opsi 2: Joki Roblox */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleChooseCategory('JOKI')}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 hover:bg-slate-800/90 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-[10.5px] font-bold transition-all text-left shadow-sm active:scale-95 cursor-pointer"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-[9px] shrink-0">
              ⚡
            </span>
            <span className="truncate">2. Joki Roblox</span>
          </button>
        </div>
      )}

      {/* 4A. FILL_GIFT_FORM WITH STRICT VALIDATION */}
      {type === 'FILL_GIFT_FORM' && (
        <StrictOrderValidatedForm
          chatId={roomId}
          formType="GIFT"
          onOpenProductModal={(cat) => onOpenCatalog && onOpenCatalog(cat === 'GIFT' ? 'gift' : 'joki')}
          onSuccessSubmitted={() => setAnsweredLocally(true)}
        />
      )}

      {/* 4B. FILL_JOKI_FORM WITH STRICT VALIDATION */}
      {type === 'FILL_JOKI_FORM' && (
        <StrictOrderValidatedForm
          chatId={roomId}
          formType="JOKI"
          onOpenProductModal={(cat) => onOpenCatalog && onOpenCatalog(cat === 'GIFT' ? 'gift' : 'joki')}
          onSuccessSubmitted={() => setAnsweredLocally(true)}
        />
      )}

      {/* 5. WAITING_FEEDBACK */}
      {type === 'WAITING_FEEDBACK' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <BotAvatarIcon />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleFeedback('SABAR')}
              className="bg-slate-900/90 hover:bg-slate-800 text-sky-400 font-medium text-xs md:text-sm px-4 py-2.5 rounded-full border border-sky-500/30 shadow-sm transition-all hover:scale-[1.02] active:scale-95 text-left flex items-center gap-2 cursor-pointer"
            >
              1. Oke min aku sabar nunggu
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <BotAvatarIcon />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleFeedback('LAMA')}
              className="bg-slate-900/90 hover:bg-slate-800 text-cyan-400 font-medium text-xs md:text-sm px-4 py-2.5 rounded-full border border-cyan-500/30 shadow-sm transition-all hover:scale-[1.02] active:scale-95 text-left flex items-center gap-2 cursor-pointer"
            >
              2. Kok lama banget min!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
