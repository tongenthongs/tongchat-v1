import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  return (
    <nav className="w-full bg-[#0b1120] border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white">E</div>
        <span className="font-black text-white tracking-wide">ENTONG STORE</span>
      </div>
    </nav>
  );
}
