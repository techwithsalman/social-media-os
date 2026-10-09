const fs = require('fs');

let code = fs.readFileSync('app/(dashboard)/dashboard/page.tsx', 'utf8');

// 1. Fix the Drafts col-span issue and general card visuals
code = code.replace(
  'className="col-span-2 sm:col-span-1 relative overflow-hidden',
  'className="relative overflow-hidden'
);

// 2. Add curvy swooshes to the stats cards by replacing the linear gradient overlays with a curved SVG-like border shape using CSS radial border
const addCurve = (color) => `
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-${color}/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-${color}/30 transition-all duration-500" />
            <div className="absolute -bottom-20 -right-20 w-[150%] h-[150%] border-t-[1.5px] border-${color}/20 rounded-[100%] pointer-events-none opacity-50 shadow-[0_-10px_20px_rgba(var(--color-${color}),0.1)]" />`;

code = code.replace(/<div className="absolute -bottom-8 -right-8 w-32 h-32 bg-red-600\/20[^>]+><\/div>\s*<div className="absolute bottom-0 right-0 w-full h-1\/2 bg-gradient-to-tl from-red-[^>]+><\/div>/g, 
  `<div className="absolute -bottom-8 -right-8 w-32 h-32 bg-red-500/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-red-500/30 transition-all duration-500" />
  <div className="absolute -bottom-[20px] -right-[10%] w-[120%] h-[100px] border-t-2 border-red-500/30 rounded-[100%] pointer-events-none opacity-60" />`
);

code = code.replace(/<div className="absolute -bottom-8 -right-8 w-32 h-32 bg-amber-500\/20[^>]+><\/div>\s*<div className="absolute bottom-0 right-0 w-full h-1\/2 bg-gradient-to-tl from-amber-[^>]+><\/div>/g, 
  `<div className="absolute -bottom-8 -right-8 w-32 h-32 bg-amber-500/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-amber-500/30 transition-all duration-500" />
  <div className="absolute -bottom-[20px] -right-[10%] w-[120%] h-[100px] border-t-2 border-amber-500/30 rounded-[100%] pointer-events-none opacity-60" />`
);

code = code.replace(/<div className="absolute -bottom-8 -right-8 w-32 h-32 bg-emerald-500\/20[^>]+><\/div>\s*<div className="absolute bottom-0 right-0 w-full h-1\/2 bg-gradient-to-tl from-emerald-[^>]+><\/div>/g, 
  `<div className="absolute -bottom-8 -right-8 w-32 h-32 bg-emerald-500/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-emerald-500/30 transition-all duration-500" />
  <div className="absolute -bottom-[20px] -right-[10%] w-[120%] h-[100px] border-t-2 border-emerald-500/30 rounded-[100%] pointer-events-none opacity-60" />`
);

code = code.replace(/<div className="absolute -bottom-8 -right-8 w-32 h-32 bg-neutral-600\/20[^>]+><\/div>\s*<div className="absolute bottom-0 right-0 w-full h-1\/2 bg-gradient-to-tl from-neutral-[^>]+><\/div>/g, 
  `<div className="absolute -bottom-8 -right-8 w-32 h-32 bg-neutral-500/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-neutral-500/30 transition-all duration-500" />
  <div className="absolute -bottom-[20px] -right-[10%] w-[120%] h-[100px] border-t-2 border-neutral-500/30 rounded-[100%] pointer-events-none opacity-60" />`
);

// Hero banner enhancements
const oldHero = `<div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-900/50 via-red-900/30 to-neutral-900/80 border border-red-500/25 p-8 md:p-12 mb-10 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold mb-4 shadow-sm">
              <Sparkles className="w-4 h-4 text-red-500" />
              <span>Unified Command Center</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Welcome back, {user.firstName}!
            </h1>
            <p className="text-neutral-300 text-base md:text-lg mt-3 leading-relaxed">
              <strong className="text-white font-bold">One Content → Every Platform.</strong> Compose once and effortlessly broadcast across Instagram, Facebook, TikTok, LinkedIn, YouTube, X, Pinterest, and Snapchat from a single operating system.
            </p>
          </div>`;

const newHero = `<div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#3e0b11] via-[#2a080c] to-[#0a0a0c] border border-red-500/30 p-8 md:p-12 mb-10 shadow-[0_0_50px_rgba(220,38,38,0.15)] backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[150%] h-[100%] border-t-[1px] border-red-500/20 rounded-[100%] pointer-events-none" />
        <div className="absolute bottom-0 right-[10%] w-[100px] h-[100px] bg-red-500/40 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/50 border border-red-500/20 text-red-400 text-sm font-bold mb-6 shadow-sm">
              <Sparkles className="w-4 h-4 text-red-500" />
              <span>Unified Command Center</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4">
              Welcome back, <span className="text-red-500">{user.firstName}!</span>
            </h1>
            <p className="text-neutral-300 text-base md:text-lg leading-relaxed max-w-2xl">
              <strong className="text-white font-bold">One Content → Every Platform.</strong> Compose once and effortlessly broadcast across Instagram, Facebook, TikTok, LinkedIn, YouTube, X, Pinterest, and Snapchat from a single operating system.
            </p>
          </div>`;

code = code.replace(oldHero, newHero);

fs.writeFileSync('app/(dashboard)/dashboard/page.tsx', code);
console.log('Visuals patched in dashboard');
