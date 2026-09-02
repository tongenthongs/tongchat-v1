const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminPortal.tsx', 'utf8');

const sIdx = content.indexOf('                  {/* Header with Back Button (3 Baris Compact untuk Mobile) */}');
const eIdx = content.indexOf('                  {/* Chat Bubbles */}');

if (sIdx > -1 && eIdx > -1) {
  const replacementStr = `                  {/* Header with Back Button (3 Baris Compact untuk Mobile) */}
                  <div className="flex flex-col gap-2 p-3 bg-slate-900/95 border-b border-slate-800 rounded-t-2xl w-full text-xs shrink-0 z-10 flex-none transition-all duration-300">
                    {/* Collapsed View (Always visible top bar) */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMobileChatView('LIST')}
                          className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold rounded-lg text-xs shrink-0 border border-slate-700 flex items-center justify-center shadow"
                          title="Kembali"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2" onClick={() => setShowMobileTopbar(!showMobileTopbar)}>
                          <div className="w-8 h-8 rounded-full bg-[#005C4B] text-white font-bold flex items-center justify-center relative shrink-0 text-xs shadow-inner cursor-pointer">
                            {String(activeOrder?.customer_name || 'C')?.charAt?.(0)?.toUpperCase?.()}
                            {isMutedActive && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border border-slate-900 flex items-center justify-center text-[8px]" title="Muted">🚫</span>
                            )}
                          </div>
                          <div className="flex flex-col cursor-pointer">
                            <div className="flex items-center gap-1">
                              <h3 className="text-xs font-bold text-slate-100">{displayHeaderUsername}</h3>
                              {showMobileTopbar ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                            </div>
                            <div className="text-[10px] text-emerald-400 truncate max-w-[150px]">
                              {activeOrder.game_name}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Compact Quick Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(() => {
                          const matchingOrder = orders.find(o => o.id === selectedOrderId || o.customer_id === activeCustId);
                          const targetOrderForProof = foundOrder || matchingOrder || activeOrder;
                          return (
                            <>
                              {targetOrderForProof.status === 'BATAL' || targetOrderForProof.status === 'CANCEL' || (targetOrderForProof as any).orderStatus === 'CANCEL' ? (
                                <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-extrabold rounded-lg flex items-center shadow-sm">Batal</span>
                              ) : (targetOrderForProof as any).paymentStatus === 'PAID' || ['BOOKING', 'PROSES PUSH', 'PROSES_WORKER', 'SELESAI'].includes(targetOrderForProof.status) ? (
                                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold rounded-lg flex items-center shadow-sm">Lunas</span>
                              ) : (
                                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-extrabold rounded-lg flex items-center shadow-sm animate-pulse">Wait</span>
                              )}
                            </>
                          );
                        })()}
                        {isOwner && (
                           <button
                             type="button"
                             onClick={() => setShowMobileTopbar(!showMobileTopbar)}
                             className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 shadow"
                           >
                             <Settings className="w-4 h-4" />
                           </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded View */}
                    {showMobileTopbar && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 animate-in fade-in slide-in-from-top-2">
                        {/* Baris 1: Tombol Navigasi & Aksi / Badge */}
                        <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap">
                          {isOwner ? (
                            <>
                              <select
                                value={
                                  activeOrder.status === 'BELUM_ORDER' ? 'NEW' :
                                  activeOrder.status === 'PROSES_WORKER' ? 'PROSES PUSH' :
                                  activeOrder.status === 'BATAL' ? 'CANCEL' :
                                  (activeOrder.status || 'NEW')
                                }
                                onChange={e => handleStatusChange(activeOrder.id, e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-[10px] text-[#00E676] rounded-lg px-2 py-1.5 font-bold shadow cursor-pointer max-w-[110px] truncate focus:outline-none"
                              >
                                <option value="NEW">NEW</option>
                                <option value="BOOKING">BOOKING</option>
                                <option value="PROSES PUSH">PROSES PUSH</option>
                                <option value="SELESAI">SELESAI</option>
                                <option value="CANCEL">CANCEL</option>
                              </select>
                              <button
                                type="button"
                                onClick={handleRequestReview}
                                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-white rounded-lg border border-amber-500/30 transition-colors text-[10px] font-bold shadow flex items-center gap-1"
                                title="Minta Ulasan"
                              >
                                ⭐ Ulasan
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChat(activeOrder.id)}
                                className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg border border-red-500/30 transition-colors text-[10px] font-bold shadow flex items-center gap-1"
                                title="Hapus Chat"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-end w-full">
                              <span className="px-2 py-1 bg-slate-800 text-[#00E676] rounded-lg text-[10px] font-bold border border-slate-700 shadow w-full text-center">
                                Status: {activeOrder.status}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Cek Bukti Pembayaran */}
                        {(() => {
                           const matchingOrder = orders.find(o => o.id === selectedOrderId || o.customer_id === activeCustId);
                           const proofUrl = activeOrder.proofOfPayment || activeOrder.payment_proof || matchingOrder?.proofOfPayment || matchingOrder?.payment_proof;
                           const targetOrderForProof = foundOrder || matchingOrder || activeOrder;
                           if (proofUrl) {
                             return (
                               <button
                                 type="button"
                                 onClick={() => setViewingProofOrder(targetOrderForProof as GameOrder)}
                                 className="w-full py-1.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition-transform active:scale-95 mt-1"
                               >
                                 💳 Cek Bukti Pembayaran
                               </button>
                             );
                           }
                           return null;
                        })()}

                        {/* Baris 3: Catatan Pelanggan Compact */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                          <span className="shrink-0 text-amber-400 text-[11px] font-bold" title="Catatan Pelanggan">📝 Catatan:</span>
                          <input
                            type="text"
                            value={currentChatNoteInput}
                            onChange={e => setCurrentChatNoteInput(e.target.value)}
                            placeholder="Tulis catatan..."
                            className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-[#00E676] placeholder-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              saveChatNote(selectedOrderId, currentChatNoteInput);
                              alert('Catatan pelanggan berhasil disimpan!');
                            }}
                            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold text-[10px] rounded-lg border border-amber-500/30 shadow transition-all shrink-0"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
`;
  content = content.substring(0, sIdx) + replacementStr + content.substring(eIdx);
  fs.writeFileSync('src/components/admin/AdminPortal.tsx', content, 'utf8');
  console.log("Successfully replaced mobile topbar in AdminPortal.tsx");
} else {
  console.log("Could not find start or end index");
}
