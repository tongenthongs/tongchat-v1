const fs = require('fs');
let content = fs.readFileSync('src/components/customer/ReviewsSection.tsx', 'utf8');

// We need to change the rendering of the review card. Let's find the return inside displayedReviews.map
const matchStart = content.indexOf('const hasLiked = helpfulClicked.includes(rev.id);');
const matchEnd = content.indexOf('</button>\n                  </div>\n                </div>\n              );');

if (matchStart !== -1 && matchEnd !== -1) {
    let replacedPart = `const hasLiked = helpfulClicked.includes(rev.id);
              const isAnon = (rev as any).isAnonymous === true;
              const displayName = isAnon 
                ? maskNameUtil(rev.userName || rev.customerName || 'Pelanggan')
                : maskNameUtil(rev.userName || rev.customerName || 'Pelanggan'); // Always mask now as per prompt
              
              return (
                <div 
                  key={rev.id ? \`rev-\${rev.id}-\${rIdx}\` : \`rev-\${rIdx}\`} 
                  className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800/90 rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-all group duration-200"
                >
                  <div>
                    {/* CARD HEADER */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 border border-blue-500/30 flex items-center justify-center text-sm font-black text-white shadow-md shrink-0 uppercase">
                          {getAvatarInitial(displayName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-100 truncate">{displayName}</h4>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[9px] font-extrabold text-emerald-400 uppercase">
                              <ShieldCheck className="w-3 h-3" /> VERIFIED
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 mt-1">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className="w-3.5 h-3.5 fill-[#FFD700] text-[#FFD700]" 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-slate-400 font-medium">
                          {formatReviewDate(rev.createdAt || (rev as any).createdAtMillis)}
                        </p>
                      </div>
                    </div>

                    {/* Comment Body */}
                    <div className="mb-4">
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium italic break-words">
                        "{rev.comment}"
                      </p>
                    </div>
                  </div>

                  {/* CARD FOOTER - Product Info & Helpful */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 border-t border-slate-800/80 mt-auto">
                    {/* Product Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center overflow-hidden shrink-0">
                        {rev.productImage || (rev as any).itemImage ? (
                          <img src={rev.productImage || (rev as any).itemImage} alt={rev.productName || 'Product'} className="w-full h-full object-cover" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="text-[11px] font-bold text-white truncate">{rev.productName || 'Layanan Game'}</h5>
                        <p className="text-[10px] text-slate-400 truncate">{rev.gameTitle || 'Entong Store'}</p>
                      </div>
                    </div>

                    {/* Helpful Button */}
                    <button
                      onClick={() => handleHelpful(rev.id)}
                      disabled={hasLiked}
                      className={\`px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all shadow shrink-0 border cursor-pointer \${
                        hasLiked 
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-not-allowed'
                          : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200 active:scale-95'
                      }\`}
                    >
                      <ThumbsUp className={\`w-3.5 h-3.5 \${hasLiked ? 'fill-blue-400 text-blue-400' : ''}\`} />
                      <span>Membantu?</span>
                      {rev.helpfulCount > 0 && (
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded-md font-extrabold text-[9px] text-blue-400">
                          {rev.helpfulCount}
                        </span>
                      )}`;

    const fullStr = content.substring(matchStart, matchEnd + 9);
    content = content.replace(fullStr, replacedPart);
    fs.writeFileSync('src/components/customer/ReviewsSection.tsx', content);
    console.log("Success");
} else {
    console.log("Failed to match");
}
