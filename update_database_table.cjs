const fs = require('fs');
const content = fs.readFileSync('src/components/admin/AdminPortal.tsx', 'utf8');

const sIdx = content.indexOf('            <div className="bg-[#111b21] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">');
const eIdx = content.indexOf('          </div>', sIdx) + 16;

const replacement = `            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-140px)]">
              <div className="overflow-x-auto overflow-y-auto custom-scrollbar h-full">
                <table className="w-full text-left text-xs min-w-max border-collapse">
                  <thead className="bg-[#202c33] text-slate-300 border-b border-slate-700 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">ID Order</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Cloud #</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Customer</th>
                      <th className="py-2.5 px-3 font-semibold">Game & Paket</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Harga</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Bukti Bayar</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Status (Admin)</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {adminLiveOrders.filter(o => o.status !== 'BELUM_ORDER').map(ord => (
                      <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-[#00E676] font-bold">
                              #{ord.id.replace('ord-', '')}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(ord.id);
                                alert('Copied ID: ' + ord.id);
                              }}
                              className="text-slate-400 hover:text-[#00E676] active:scale-95 transition-transform"
                              title="Copy ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => {
                              const val = prompt('Ubah Nomor Cloud untuk Order #' + ord.id, ord.cloud_number || '');
                              if (val !== null) {
                                updateOrder({ ...ord, cloud_number: val.trim() });
                              }
                            }}
                            className="px-2 py-1 bg-sky-950/80 hover:bg-sky-900 border border-sky-500/40 rounded flex items-center gap-1 shadow-sm transition-colors text-[10px] font-mono font-extrabold text-sky-300 whitespace-nowrap"
                            title="Edit Cloud Number"
                          >
                            ☁️ {ord.cloud_number || 'No Cloud'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="max-w-[150px] truncate flex flex-col leading-tight">
                            <span className="font-semibold text-slate-100 truncate">{ord.customer_name}</span>
                            {ord.game_username && (
                              <span className="text-[10px] text-slate-400 truncate font-mono">@{ord.game_username}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="max-w-[260px] cursor-help" title={ord.game_name + ' - ' + ord.package_name}>
                            <div className="text-slate-200 font-semibold line-clamp-1 leading-tight">{ord.game_name}</div>
                            <div className="text-slate-400 text-[10px] line-clamp-1 leading-tight mt-0.5">{ord.package_name}</div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-emerald-400 font-bold whitespace-nowrap">
                            Rp {(ord?.price ?? 0)?.toLocaleString?.('id-ID')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {ord.payment_proof ? (
                            <button
                              onClick={() => setViewingProofOrder(ord)}
                              className="px-2 py-1 bg-[#005C4B]/40 hover:bg-[#005C4B] text-[#00E676] rounded border border-[#00E676]/40 flex items-center gap-1.5 text-[10px] font-bold shadow whitespace-nowrap transition-colors"
                            >
                              <FileText className="w-3 h-3" /> Cek Bukti
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic whitespace-nowrap">Tanpa Foto</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isAdmin ? (
                            <select
                              value={ord.status}
                              onChange={e => updateOrderStatus(ord.id, e.target.value as OrderStatus)}
                              className="bg-[#202c33] border border-slate-700 text-[11px] text-[#00E676] rounded-lg px-2.5 py-1 font-bold shadow cursor-pointer focus:outline-none focus:border-[#00E676] whitespace-nowrap max-w-[120px] truncate"
                            >
                              <option value="BOOKING">⏳ BOOKING</option>
                              <option value="ANTRIAN_LOGIN">🕒 ANTRIAN LOGIN</option>
                              <option value="PROSES_WORKER">⚡ PROSES WORKER</option>
                              <option value="BUTUH_LOGIN_ULANG">⚠️ BUTUH LOGIN ULANG</option>
                              <option value="SELESAI">✓ SELESAI</option>
                              <option value="BATAL">✕ BATAL</option>
                            </select>
                          ) : (
                            <div className="scale-90 origin-left">
                              {renderStatusBadge(ord.status)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedOrderForAccount(ord)}
                              className="p-1.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 rounded shadow-sm transition-colors flex items-center gap-1"
                              title="Data Akun"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold hidden xl:inline">Akun</span>
                            </button>
                            <button
                              onClick={() => {
                                const targetRoom = ord.customer_id ? (ord.customer_id.startsWith('guest_') || ord.customer_id.startsWith('room_') ? ord.customer_id : \`room_\${ord.customer_id}\`)
                                                   : (ord.id.startsWith('room_') ? ord.id : \`room_\${ord.id}\`);
                                setSelectedOrderId(targetRoom.startsWith('room_') ? targetRoom : \`room_\${targetRoom}\`);
                                setActiveMenu('chat');
                              }}
                              className="p-1.5 bg-[#005C4B] hover:bg-[#004d40] text-[#00E676] rounded border border-[#00E676]/40 shadow-sm transition-colors flex items-center gap-1"
                              title="Chat Pelanggan"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold hidden xl:inline">Chat</span>
                            </button>
                            <button
                              onClick={() => {
                                setEditingOrder(ord);
                                setShowOrderModal(true);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded shadow-sm transition-colors flex items-center"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  if (confirm('Hapus order ini?')) deleteOrder(ord.id);
                                }}
                                className="p-1.5 bg-red-950/50 hover:bg-red-900 border border-red-900/50 text-red-400 rounded shadow-sm transition-colors flex items-center"
                                title="Hapus Order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>`;

if (sIdx > -1) {
    fs.writeFileSync('src/components/admin/AdminPortal.tsx', content.substring(0, sIdx) + replacement + content.substring(eIdx));
    console.log("Success");
} else {
    console.log("Not found");
}
