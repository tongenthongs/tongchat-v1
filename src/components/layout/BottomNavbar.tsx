import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function BottomNavbar() {
  const navigate = useNavigate();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full z-[100] bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 px-1 py-1.5 flex items-center justify-around shadow-2xl">
      <button onClick={() => navigate('/')} className="flex-1 py-2 text-slate-400 hover:text-white flex flex-col items-center">
        <span className="text-[10px] font-bold">Home</span>
      </button>
      <button onClick={() => navigate('/gpdragdrivesim')} className="flex-1 py-2 text-slate-400 hover:text-white flex flex-col items-center">
        <span className="text-[10px] font-bold">Katalog</span>
      </button>
    </nav>
  );
}
