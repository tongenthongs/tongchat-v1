import React, { useMemo } from "react";
import { isStrictGiftBookingOrder } from "../../utils/orderCategoryValidator";

interface Props {
  orderType?: "GIFT" | "JOKI" | string;
  packageName?: string;
  status?: string; 
  statusCode?: string;
  orderStatus?: string;
  category?: string;
  itemGift?: string;
  orderData?: any;
}

export function OrderProgressStepper({
  orderType,
  packageName = "",
  status = "BOOKING",
  statusCode,
  orderStatus,
  category,
  itemGift,
  orderData
}: Props) {
  const currentStatus = String(
    statusCode || status || orderStatus || orderData?.statusCode || orderData?.status || orderData?.orderStatus || "BOOKING"
  ).toUpperCase();

  const activePackageName = packageName || orderData?.packageName || orderData?.package_name || "";
  const activeOrderType = orderType || orderData?.type || orderData?.orderType || category || orderData?.category || "";
  const activeItemGift = itemGift || orderData?.itemGift || "";

  // 1. Deteksi Tipe Order (Gift vs Joki)
  const isJoki = useMemo(() => {
    // Check if it's explicitly a Gift first
    const isGiftExplicit =
      isStrictGiftBookingOrder(orderData || { category, type: orderType, packageName: activePackageName, itemGift: activeItemGift }) ||
      activeOrderType.toUpperCase() === "GIFT" ||
      (activePackageName && activePackageName.toLowerCase().includes("pass")) ||
      Boolean(activeItemGift && activeItemGift.trim().length > 0);

    if (isGiftExplicit) return false;

    return (
      activeOrderType.toUpperCase() === "JOKI" ||
      activePackageName.toLowerCase().includes("joki") ||
      activePackageName.toLowerCase().includes("cash") ||
      ["READY", "DIPROSES", "LOGUL", "PENDING", "BATAL", "SIAP_LOGIN", "BUTUH_VERIFIKASI"].includes(currentStatus)
    );
  }, [orderData, category, orderType, activePackageName, activeItemGift, activeOrderType, currentStatus]);

  // 2. Tahapan Gift In-Game
  const giftSteps = [
    { key: "BOOKING", label: "1. Booking", sub: "Pesanan Dibuat", icon: "🕒" },
    { key: "DIORDER", label: "2. Diorder", sub: "Dikonfirmasi Admin", icon: "👤" },
    { key: "PROSES", label: "3. Proses", sub: "Pengiriman Gift", icon: "⚡" },
    { key: "SELESAI", label: "4. Selesai", sub: "Pesanan Selesai", icon: "✓" },
  ];

  // 3. Tahapan Joki Roblox (SESUAI REQUEST TERBARU)
  const jokiSteps = [
    { key: "BOOKING", label: "1. Booking", sub: "Antrian Akun", icon: "🕒" },
    { key: "READY", label: "2. Ready", sub: "Cek Kredensial", icon: "👤" },
    { key: "DIPROSES", label: "3. Diproses", sub: "Sedang Dimainkan", icon: "⚡" },
    { key: "SELESAI", label: "4. Selesai", sub: "Akun Siap Dimainkan", icon: "✓" },
  ];

  // 4. Hitung Index Tahapan Aktif
  const activeIndex = useMemo(() => {
    if (isJoki) {
      if (currentStatus === "BOOKING" || currentStatus === "WAITING") return 0;
      if (currentStatus === "READY" || currentStatus === "SIAP_LOGIN" || currentStatus === "DIORDER") return 1;
      if (currentStatus === "DIPROSES" || currentStatus === "PROSES" || currentStatus === "LOGUL" || currentStatus === "PENDING" || currentStatus === "BUTUH_VERIFIKASI") return 2;
      if (currentStatus === "SELESAI" || currentStatus === "DONE") return 3;
      return 0; // fallback to 0
    } else {
      if (currentStatus === "BOOKING" || currentStatus === "WAITING") return 0;
      if (currentStatus === "DIORDER") return 1;
      if (currentStatus === "PROSES" || currentStatus === "DIPROSES") return 2;
      if (currentStatus === "SELESAI" || currentStatus === "DONE") return 3;
      return 0; // fallback to 0
    }
  }, [isJoki, currentStatus]);

  const activeSteps = isJoki ? jokiSteps : giftSteps;
  const isFailed = currentStatus === "BATAL" || currentStatus === "HANGUS";

  return (
    <div className="bg-[#0b1120] border border-slate-800/90 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl">
      {/* Header Info Tahapan */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
          <h3 className="text-sm md:text-base font-extrabold text-white">
            {isJoki ? "Alur Pengerjaan Joki Roblox" : "Alur Pengerjaan Gift In-Game"}
          </h3>
        </div>

        {/* Badge Status Kanan Atas */}
        <span
          className={`text-[10px] md:text-xs font-black px-3 py-1 rounded-full border shadow-sm ${
            isFailed
              ? "bg-rose-950/80 text-rose-400 border-rose-500/40"
              : currentStatus === "SELESAI" || currentStatus === "DONE"
              ? "bg-emerald-950 text-emerald-400 border-emerald-500/40"
              : "bg-blue-950/80 text-blue-400 border-blue-500/40"
          }`}
        >
          {isFailed ? "❌ Dibatalkan" : currentStatus === "SELESAI" || currentStatus === "DONE" ? "✅ Selesai" : "● Sedang Berjalan"}
        </span>
      </div>

      <div className="border-t border-slate-800/80 my-2"></div>

      {/* Bar Stepper Visual 4 Langkah */}
      <div className="grid grid-cols-4 gap-2 md:gap-4 pt-2">
        {activeSteps.map((step, idx) => {
          const isPassed = !isFailed && idx <= activeIndex;
          const isCurrent = !isFailed && idx === activeIndex;

          return (
            <div key={step.key} className="flex flex-col items-center text-center space-y-2 relative">
              {/* Lingkaran Step Berwarna / Glowing */}
              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base transition-all shadow-md ${
                  isFailed
                    ? "bg-slate-950 border border-slate-800 text-slate-600"
                    : isCurrent
                    ? "bg-purple-950/80 border-2 border-purple-500 text-purple-300 ring-4 ring-purple-500/20 scale-105"
                    : isPassed
                    ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-400"
                    : "bg-slate-950 border border-slate-800 text-slate-500"
                }`}
              >
                <span>{step.icon}</span>
              </div>

              {/* Teks Label Judul & Subtitle */}
              <div className="min-w-0">
                <p
                  className={`text-[11px] md:text-xs font-bold truncate ${
                    isCurrent ? "text-purple-300" : isPassed ? "text-white" : "text-slate-500"
                  }`}
                >
                  {step.label}
                </p>
                <p
                  className={`text-[9px] md:text-[10px] truncate ${
                    isCurrent ? "text-purple-400/80" : "text-slate-500"
                  }`}
                >
                  {step.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OrderProgressStepper;
