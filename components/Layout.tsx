
import React from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 bg-ago-cream">
      <header className="w-full max-w-2xl mb-12 text-center flex flex-col items-center">
        <h1 className="text-4xl font-light text-stone-800 tracking-tight mb-2">
          ago natura
        </h1>
        <div className="h-px w-12 bg-ago-green/30 mb-4 mx-auto"></div>
        <p className="text-stone-500 font-light tracking-wide italic">Rapportage assistent</p>
      </header>
      <main className="w-full max-w-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[40px] p-8 sm:p-12 relative border border-stone-100/50">
        {children}
      </main>
      <footer className="mt-12 text-stone-400 text-[10px] font-light uppercase tracking-widest flex flex-col items-center gap-2">
        <a href="https://agonatura.nl" target="_blank" rel="noopener noreferrer" className="hover:text-ago-green transition-colors">
          agonatura.nl
        </a>
        <span>© {new Date().getFullYear()} — Slimmer rapporteren</span>
      </footer>
    </div>
  );
};
