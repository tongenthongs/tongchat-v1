sed -i '/return (/i \
  if (standaloneCategory) {\
    return (\
      <div className="w-full min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between select-none pb-24 md:pb-8">\
        <header className="w-full sticky top-0 z-40 bg-[#070b14]">\
          <div className="bg-[#0b1120]/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-800/80">\
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = "/"}>\
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/20">\
                <img \
                  src={storeAvatarUrl || "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=120&h=120&fit=crop&q=80"} \
                  alt="Entong Store" \
                  className="w-full h-full object-cover rounded-full"\
                  referrerPolicy="no-referrer"\
                />\
              </div>\
              <h1 className="text-sm font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 tracking-wide uppercase">\
                ENTONG STORE\
              </h1>\
            </div>\
            <div className="flex items-center gap-3">\
              {currentUser ? (\
                <button \
                  onClick={() => handleRequestCheckout(true)}\
                  className="relative p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"\
                >\
                  <ShoppingCart className="w-4 h-4 text-slate-300" />\
                  {cartTotalItems > 0 && (\
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-md shadow-rose-950/50">\
                      {cartTotalItems}\
                    </span>\
                  )}\
                </button>\
              ) : (\
                <button onClick={() => setShowAuthModal(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md">Masuk</button>\
              )}\
            </div>\
          </div>\
          <StoreOperationalBanner/>\
        </header>\
\
        <main className="w-full max-w-7xl mx-auto flex-1">\
          <Catalog \
            onAddToCart={addToCart} \
            cart={cart} \
            onViewCart={() => handleRequestCheckout(true)}\
            onBuyNow={handleBuyNowItem}\
            standaloneCategory={standaloneCategory}\
          />\
        </main>\
        \
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0b1120]/95 backdrop-blur-xl border-t border-slate-800/80 px-2 sm:px-4 py-2 pb-safe md:hidden">\
          <div className="flex items-center justify-between max-w-md mx-auto">\
            <button onClick={() => window.location.href = "/"} className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors">\
              <HomeIcon className="w-5 h-5" />\
              <span className="text-[10px] font-bold">Home</span>\
            </button>\
            <button onClick={() => handleRequestCheckout(true)} className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors relative">\
              <ShoppingCart className="w-5 h-5" />\
              <span className="text-[10px] font-bold">Keranjang</span>\
              {cartTotalItems > 0 && (\
                <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">\
                  {cartTotalItems}\
                </span>\
              )}\
            </button>\
            <button onClick={() => { if (!currentUser) setShowAuthModal(true); else window.location.href = "/pesanan"; }} className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors">\
              <FileText className="w-5 h-5" />\
              <span className="text-[10px] font-bold">Pesanan</span>\
            </button>\
            <button onClick={() => { if (!currentUser) setShowAuthModal(true); else window.location.href = "/profil"; }} className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors">\
              <User className="w-5 h-5" />\
              <span className="text-[10px] font-bold">Profil</span>\
            </button>\
          </div>\
        </div>\
      </div>\
    );\
  }\
' src/components/customer/CustomerPortal.tsx
