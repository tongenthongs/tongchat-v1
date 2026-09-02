import re

with open('src/components/checkout/CheckoutModal.tsx', 'r') as f:
    content = f.read()

# Add step state
if "const [step, setStep]" not in content:
    content = re.sub(
        r'const \[otherPaymentSubtype, setOtherPaymentSubtype\] = useState<\'QRIS\' \| \'DANA\'>\(\'QRIS\'\);',
        "const [otherPaymentSubtype, setOtherPaymentSubtype] = useState<'QRIS' | 'DANA'>('QRIS');\n  const [step, setStep] = useState<'INFO' | 'PAYMENT'>('INFO');",
        content
    )

new_return = '''
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pt-16 pb-28 md:py-10 overflow-y-auto bg-black/85 backdrop-blur-md">
      <div className={`w-full max-w-xl max-h-[85vh] ${step === 'INFO' ? 'bg-[#FFF0F5] border-pink-300' : 'bg-[#111b21] border-blue-500/40'} border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col relative transition-colors duration-500`}>
        
        {/* Modal Header */}
        <div className={`${step === 'INFO' ? 'bg-[#FFE4E1] border-pink-200 text-pink-700' : 'bg-[#202c33] border-slate-700 text-slate-100'} p-4 border-b flex items-center justify-between sticky top-0 z-10 transition-colors duration-500`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${step === 'INFO' ? 'font-sans' : ''}`}>
            {step === 'INFO' ? (
              <span className="text-pink-600 font-extrabold text-base tracking-wide flex items-center gap-2">
                 📝 Informasi Pesanan
              </span>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 text-[#00E676]" />
                Keranjang Belanja & Pembayaran
              </>
            )}
          </h3>
          <button 
             type="button" 
             onClick={onClose} 
             className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition cursor-pointer ${step === 'INFO' ? 'bg-pink-200 text-pink-600 hover:bg-pink-300 hover:text-pink-800' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'}`}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleFormSubmitInternal} className="flex-1 overflow-y-auto">
          {step === 'INFO' && (
            <div className="p-5 space-y-4 text-slate-700 bg-[#FFF0F5]">
              
              {/* Username Roblox Checker */}
              <div>
                <label className="block text-xs font-bold text-pink-700 mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" />
                  Username Roblox <span className="text-rose-500">*Wajib</span>
                </label>
                <div className="relative">
                  {robloxProfile && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                       <img src={robloxProfile.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full border border-pink-300" />
                    </div>
                  )}
                  {!robloxProfile && (
                    <UserCheck className="w-5 h-5 text-pink-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  )}
                  <input
                    type="text"
                    required
                    value={gameUsername}
                    onChange={e => setGameUsername(e.target.value)}
                    placeholder="Ketik username Roblox (tanpa @)..."
                    className="w-full pl-11 pr-10 py-3 bg-white border border-pink-200 rounded-2xl text-sm text-slate-800 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all shadow-sm"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingRoblox ? (
                      <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
                    ) : robloxProfile ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : robloxError ? (
                      <X className="w-5 h-5 text-rose-500" title={robloxError} />
                    ) : null}
                  </div>
                </div>
                {robloxError && !isCheckingRoblox && (
                  <p className="mt-1 text-[10px] text-rose-500 font-bold">{robloxError}</p>
                )}
                {robloxProfile && !isCheckingRoblox && (
                  <p className="mt-1 text-[10px] text-emerald-600 font-bold">Ditemukan: {robloxProfile.displayName}</p>
                )}
              </div>

              {/* Joki Specific Extra Fields (if any) */}
              {hasJoko && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-pink-700 mb-1 flex items-center gap-1.5">
                       <ShieldCheck className="w-4 h-4" />
                       Password Roblox Target <span className="text-rose-500">*Wajib</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={gamePassword}
                        onChange={e => setGamePassword(e.target.value)}
                        placeholder="Masukkan Password Roblox Target"
                        className="w-full pl-4 pr-10 py-3 bg-white border border-pink-200 rounded-2xl text-sm text-slate-800 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-300 hover:text-pink-500 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-pink-700 mb-1 flex items-center gap-1.5">
                       <Coins className="w-4 h-4" />
                       Uang / Cash Awal di Game <span className="text-rose-500">*Wajib</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={initialGameMoney}
                      onChange={e => setInitialGameMoney(e.target.value)}
                      placeholder="Contoh: 1,500,000 Money"
                      className="w-full px-4 py-3 bg-white border border-pink-200 rounded-2xl text-sm text-slate-800 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all shadow-sm"
                    />
                  </div>
                </>
              )}

              {/* Nomor Telepon */}
              <div>
                <label className="block text-xs font-bold text-pink-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  Nomor Telepon (WhatsApp) <span className="text-rose-500">*Wajib</span>
                </label>
                <div className="flex relative shadow-sm rounded-2xl overflow-hidden bg-white border border-pink-200 focus-within:border-pink-400 focus-within:ring-2 focus-within:ring-pink-200 transition-all">
                  <div className="flex items-center justify-center bg-pink-50 px-3 py-3 border-r border-pink-200 text-sm font-bold text-pink-800">
                    🇮🇩 +62
                  </div>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="81234567890"
                    className="flex-1 px-3 py-3 w-full text-sm text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email Notifikasi */}
              <div>
                <label className="block text-xs font-bold text-pink-700 mb-1 flex items-center gap-1.5">
                  <span className="text-sm">✉️</span>
                  Email Notifikasi (Opsional)
                </label>
                <input
                  type="email"
                  value={customerEmail || ''}
                  onChange={e => setCustomerEmail && setCustomerEmail(e.target.value)}
                  placeholder="Contoh: user@email.com"
                  className="w-full px-4 py-3 bg-white border border-pink-200 rounded-2xl text-sm text-slate-800 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all shadow-sm"
                />
              </div>

              {/* Kotak Catatan Banner */}
              <div className="p-4 bg-pink-100/80 border border-pink-300/60 rounded-2xl text-xs text-pink-800 shadow-sm relative overflow-hidden">
                <div className="flex gap-3 relative z-10">
                  <div className="text-3xl shrink-0">🌸</div>
                  <div className="space-y-1.5 leading-relaxed font-medium">
                    <p><strong>Jajan item gamepass di Mayoblox sangat mudah!</strong></p>
                    <p>Setelah pembayaran, langsung klik tombol <strong className="text-pink-600">Request Pengiriman Sekarang</strong>. Kamu akan diarahkan admin untuk ketemuan di game, dan item langsung di gift ke akunmu!</p>
                    <ul className="list-disc list-inside text-[11px] pt-1">
                      <li>Proses pengiriman memakan waktu 3-6 jam.</li>
                      <li>Pengiriman tersedia jam 10 pagi s/d 10 malam.</li>
                      <li>Kecuali saat sedang restock, akan diinformasikan kembali lewat chat.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Button Lanjut */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={!robloxProfile || !customerPhone.trim() || (hasJoko && (!gamePassword.trim() || !initialGameMoney.trim()))}
                  onClick={() => setStep('PAYMENT')}
                  className="w-full py-3.5 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white font-black rounded-2xl text-sm shadow-xl shadow-pink-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  Lanjut Pembayaran <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'PAYMENT' && (
            <div className="p-5 space-y-5">
              {/* Existing Payment UI logic slightly wrapped */}
              <button
                  type="button"
                  onClick={() => setStep('INFO')}
                  className="text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1 mb-2"
                >
                  ← Kembali ke Informasi
              </button>
              
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">Rincian Paket Game Dalam Keranjang</label>
                {cart.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-[#202c33] rounded-xl text-center">Keranjang Anda masih kosong.</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((entry, idx) => (
                      <div key={`${entry.item.id}-${idx}`} className="flex items-center justify-between p-3 bg-[#182234] border border-slate-700/60 rounded-xl">
                        <div className="flex-1 space-y-0.5 min-w-0 pr-3">
                          <div className="text-[10px] text-slate-400 truncate">{entry.item.game_name || 'Game'}</div>
                          <div className="text-slate-200">{entry.item.package_name}</div>
                          <div className="text-emerald-400 font-semibold">Rp {(entry?.item?.price ?? 0)?.toLocaleString?.('id-ID')} / unit</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center border border-slate-600 rounded-lg overflow-hidden bg-[#111b21]">
                            <button
                              type="button"
                              onClick={() => updateCartQty(entry.item.id, -1)}
                              className="px-2 py-1 text-slate-300 hover:bg-slate-700 font-bold"
                            >
                              -
                            </button>
                            <span className="px-2.5 text-xs font-bold text-slate-100">{entry.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(entry.item.id, 1)}
                              className="px-2 py-1 text-slate-300 hover:bg-slate-700 font-bold"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(entry.item.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 bg-[#005C4B]/30 border border-[#00E676]/30 rounded-xl flex items-center justify-between font-bold text-xs">
                      <span className="text-slate-200">Total Biaya Pesanan:</span>
                      <span className="text-base text-emerald-400 font-mono">Rp {(cartTotalPrice ?? 0)?.toLocaleString?.('id-ID')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* PAYMENT OPTIONS */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5 mb-1">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <label className="block text-xs font-bold text-slate-300">Metode Pembayaran</label>
                </div>
                {/* TONGCOINS */}
                <div 
                  onClick={() => setPaymentMethod('TC')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    paymentMethod === 'TC' 
                      ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/10' 
                      : 'bg-[#182234] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center">
                      {paymentMethod === 'TC' && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span className="font-extrabold text-xs text-amber-100">Bayar dengan TongCoins (TC)</span>
                      </div>
                      <span className="font-mono text-amber-400 font-bold text-xs">{userTc.toLocaleString('id-ID')} TC</span>
                    </div>
                  </div>
                </div>

                {/* METODE LAIN */}
                <div 
                  onClick={() => {
                    if (paymentMethod === 'TC') {
                      setPaymentMethod(otherPaymentSubtype);
                      setPaymentProof('');
                    }
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    paymentMethod !== 'TC' 
                      ? 'bg-blue-950/20 border-blue-500/80 ring-1 ring-blue-500/40 shadow-lg shadow-blue-500/10' 
                      : 'bg-[#182234] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center">
                      {paymentMethod !== 'TC' && <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-100">Metode Lain</span>
                        <span className="text-[10px] text-slate-400 font-medium">QRIS & Transfer DANA</span>
                      </div>
                    </div>
                  </div>
                  {paymentMethod !== 'TC' && (
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOtherPaymentSubtype('QRIS');
                            setPaymentMethod('QRIS');
                          }}
                          className={`p-2 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                            paymentMethod === 'QRIS'
                              ? 'bg-[#005C4B]/40 border-[#00E676] text-white'
                              : 'bg-[#111b21] border-slate-700 text-slate-400'
                          }`}
                        >
                          <QrCode className="w-4 h-4 text-[#00E676]" />
                          <span>QRIS All Payment</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOtherPaymentSubtype('DANA');
                            setPaymentMethod('DANA');
                          }}
                          className={`p-2 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                            paymentMethod === 'DANA'
                              ? 'bg-[#005C4B]/40 border-[#00E676] text-white'
                              : 'bg-[#111b21] border-slate-700 text-slate-400'
                          }`}
                        >
                          <CreditCard className="w-4 h-4 text-blue-400" />
                          <span>Transfer DANA</span>
                        </button>
                      </div>

                      <div className="p-4 bg-[#111b21] border border-slate-700/50 rounded-xl space-y-4">
                        {paymentMethod === 'QRIS' ? (
                          <div className="text-center space-y-2">
                            <span className="inline-block px-3 py-1 bg-[#00E676]/20 text-[#00E676] text-[10px] font-black rounded-lg">SCAN QRIS INI (All Payment)</span>
                            <div className="bg-white p-2 rounded-xl inline-block border-2 border-slate-600">
                              <SafeImage src={qrisImageUrl || "https://dummyimage.com/200x200/fff/000.png&text=QRIS"} alt="QRIS" className="w-40 h-40 object-cover" />
                            </div>
                          </div>
                        ) : (
                          <div className="text-center space-y-2">
                            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded-lg">TRANSFER KE AKUN DANA</span>
                            <div className="bg-[#182234] border border-slate-700 p-3 rounded-xl flex items-center justify-between">
                              <div className="text-left">
                                <div className="text-[10px] text-slate-400 uppercase tracking-widest">{danaName || 'ADMIN'}</div>
                                <div className="text-sm font-mono text-white font-bold">{danaNumber || '-'}</div>
                              </div>
                              <button
                                type="button"
                                onClick={handleCopyDana}
                                className="p-2 bg-[#202c33] hover:bg-slate-700 rounded-lg text-blue-400 transition"
                              >
                                {copiedDana ? <Check className="w-4 h-4 text-[#00E676]" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        )}
                        <label className={`block w-full text-center py-3 px-4 bg-[#111b21] hover:bg-slate-800 text-slate-200 font-bold rounded-xl text-xs cursor-pointer border ${!paymentProof ? 'border-dashed border-rose-500/80 bg-rose-950/10' : 'border-emerald-500 bg-emerald-950/20'} transition-all`}>
                          <Upload className={`w-4 h-4 mx-auto mb-1 ${!paymentProof ? 'text-rose-400' : 'text-[#00E676]'}`} />
                          {paymentProof ? '✓ Bukti Transfer Terupload' : 'Pilih Foto Bukti Transfer (WAJIB DILAMPIRKAN)'}
                          <input
                            type="file"
                            accept="image/*"
                            required={paymentMethod !== 'TC'}
                            className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const compressed = await compressImageFile(file);
                                  setPaymentProof(compressed);
                                } catch (err) {
                                  console.error('Error compressing image:', err);
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setPaymentProof(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }
                            }}
                          />
                        </label>
                        {paymentProof && (
                          <div className="mt-2 text-center">
                            <SafeImage src={paymentProof} alt="Bukti Transfer" className="h-24 max-w-xs mx-auto rounded-lg border border-slate-700 shadow" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SUMMARY & PAY BUTTON */}
              <div className="space-y-2 pt-3 border-t border-slate-800 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal Pesanan</span>
                  <span className="font-mono text-slate-200">Rp {cartTotalPrice.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                  <span>Total Bayar</span>
                  <span className="font-mono text-emerald-400 text-base">
                    Rp {cartTotalPrice.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || isSubmittingOrder || !gameUsername.trim() || (!paymentProof && paymentMethod !== 'TC') || (paymentMethod === 'TC' && !isTcEnough) || (hasJoko && !gamePassword.trim())}
                    className={`flex-1 py-3.5 font-black rounded-2xl text-sm shadow-xl transition-all flex items-center justify-center gap-1.5 ${
                      (isSubmitting || isSubmittingOrder || !gameUsername.trim() || (!paymentProof && paymentMethod !== 'TC') || (paymentMethod === 'TC' && !isTcEnough) || (hasJoko && !gamePassword.trim()))
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50 shadow-none'
                        : 'bg-[#00E676] hover:bg-[#00c853] text-[#111b21] shadow-[#00E676]/20 cursor-pointer active:scale-95'
                    }`}
                  >
                    {(isSubmitting || isSubmittingOrder) 
                      ? 'Sedang Memproses...'
                      : !gameUsername.trim() 
                        ? '⚠️ Lengkapi Info Dulu'
                        : (paymentMethod === 'TC' && !isTcEnough)
                          ? '⚠️ Saldo TC Kurang'
                          : (!paymentProof && paymentMethod !== 'TC')
                            ? '⚠️ Upload Bukti Bayar Dulu'
                            : `✓ Bayar Sekarang (Rp ${(cartTotalPrice ?? 0)?.toLocaleString?.('id-ID')})`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* RULES AGREEMENT POPUP MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#151b22] border border-emerald-500/50 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-[#00E676] flex items-center gap-2">
                <FileText className="w-4 h-4" /> Syarat & Ketentuan (Rules) Joko Roblox
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
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
                  checked={agreedToRules}
                  onChange={(e) => setAgreedToRules(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#00E676] rounded cursor-pointer"
                />
                <span>
                  Saya telah membaca, memahami, dan menyetujui seluruh Syarat & Ketentuan (Rules) di atas. Saya paham risiko dan aturan joko Roblox Entong Store.
                </span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!agreedToRules}
                  onClick={(e) => {
                    if (!agreedToRules) return;
                    setShowRulesModal(false);
                    const fakeEv = { preventDefault: () => {} } as React.FormEvent;
                    handleFormSubmitInternal(fakeEv);
                  }}
                  className={`flex-1 py-3 font-black rounded-xl text-xs transition shadow-lg ${
                    !agreedToRules 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                      : 'bg-[#00E676] hover:bg-[#00c853] text-[#111b21] cursor-pointer'
                  }`}
                >
                  ✓ Setuju & Lanjutkan Pesanan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFF-HOURS GIFT CONFIRMATION MODAL */}
      {showOffHoursModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#151b22] border border-amber-500/50 rounded-2xl p-6 shadow-2xl flex flex-col text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-400">Pemberitahuan Jam Proses Gift In-Game</h3>
                <p className="text-[11px] text-slate-400">Jam Operasional: 13.00 – 20.45 WIB</p>
              </div>
            </div>
            <div className="bg-black/40 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
              {`Layanan pengiriman Gift In-Game beroperasi setiap hari pukul 13.00 – 20.45 WIB.\n\nKamu tetap bisa memesan dan membayar sekarang. Pesananmu akan otomatis masuk antrean dan langsung diproses saat jam operasional buka kembali (13.00 WIB).`}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowOffHoursModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal / Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOffHoursModal(false);
                  setConfirmedOffHours(true);
                  const fakeEv = { preventDefault: () => {} } as React.FormEvent;
                  handleFormSubmitInternal(fakeEv);
                }}
                className="flex-1 py-3 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-black rounded-xl text-xs shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                Mengerti, Lanjutkan Pesanan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
'''

start_idx = content.find('  return (')
content = content[:start_idx] + new_return

with open('src/components/checkout/CheckoutModal.tsx', 'w') as f:
    f.write(content)
