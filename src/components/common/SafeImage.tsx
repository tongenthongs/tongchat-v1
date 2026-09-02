import React, { useState } from 'react';

// Komponen Image Anti-Blackscreen
export const SafeImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-800 text-slate-500 rounded-lg p-4 border border-slate-700 ${className || ''}`}>
        <i className="fa-solid fa-image-slash text-2xl mb-2"></i>
        <span className="text-[10px] font-bold text-center">Gambar tidak tersedia / rusak</span>
      </div>
    );
  }

  return (
    <div className={`relative bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center ${className || ''}`}>
      {!isLoaded && <i className="fa-solid fa-spinner fa-spin absolute text-emerald-500 text-xl"></i>}
      <img
        src={src}
        alt={alt}
        className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};
