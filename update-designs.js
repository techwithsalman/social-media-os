const fs = require('fs');

function redesignCalendar() {
  const file = 'app/(dashboard)/calendar/page.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Insert Header and Hero Banner
  const heroReplacement = `    <AppLayout title="Content Calendar">
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-neutral-400 hover:text-white transition-colors border border-[#22222a] rounded-lg bg-[#0e0e12]">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-black text-white tracking-tight">Content Calendar</h1>
      </div>

      {/* Hero Banner */}
      <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-r from-[#170505] via-[#3a0508] to-[#120202] border border-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.1)] relative overflow-hidden mb-8 group">
        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-red-600/15 to-transparent pointer-events-none blur-[50px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-red-600/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-950/50 shrink-0 border border-red-400/20">
            <CalendarIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md">Content Calendar</h2>
            <p className="text-sm md:text-base text-neutral-300 font-medium mt-1">Plan, <span className="text-red-400">manage</span>, and schedule your content across all connected platforms.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">`;
  
  content = content.replace(/<AppLayout title="Content Calendar">\s*<div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">/, heroReplacement);

  // Calendar Controls styling fix
  content = content.replace(/border-\[#22222a\]/g, 'border-red-500/10');
  content = content.replace(/border-\[#33333e\]/g, 'border-red-500/20');
  content = content.replace(/bg-\[#0e0e12\]/g, 'bg-[#0a0a0c]');
  
  // Actually, wait, calendar cells have `#0e0e12` as their background.
  // The user wants the grid to have "Dark cards/cells, Thin red borders and glow, active date in red"
  content = content.replace(
    /className={`min-h-\[140px\] bg-\[#0e0e12\] p-3 flex flex-col justify-between text-left hover:bg-\[#0e0e12\]\/70 transition-colors border-t border-\[#22222a\]\/50 \${[\s\S]*?isSelected[\s\S]*?hasPosts[\s\S]*?isToday[\s\S]*?}`/g,
    `className={\`min-h-[140px] p-3 flex flex-col justify-between text-left transition-all border border-red-500/10 rounded-2xl m-0.5 \${
                    isToday ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.15)] ring-1 ring-red-500/50' 
                    : isSelected ? 'bg-[#180505] border-red-500/30 ring-1 ring-red-500/30'
                    : 'bg-[#0f0f13] hover:bg-[#15151a]'
                  }\`}`
  );
  
  // Date numbers styling
  content = content.replace(
    /className={\`text-sm font-bold \${[\s\S]*?isToday[\s\S]*?w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md[\s\S]*?isSelected[\s\S]*?text-neutral-400[\s\S]*?}\`}/g,
    `className={\`text-sm font-bold \${
                        isToday
                          ? 'w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-900/50'
                          : isSelected
                          ? 'text-red-400'
                          : 'text-neutral-400'
                      }\`}`
  );

  // The grid bg fix
  content = content.replace(/<div className="grid grid-cols-7 auto-rows-fr bg-\[#070b14\] gap-\[1px\]">/, '<div className="grid grid-cols-7 auto-rows-fr gap-1 bg-transparent p-2">');
  // Column Headers bg fix
  content = content.replace(/<div className="grid grid-cols-7 border-b border-red-500\/10 bg-\[#0a0a0c\] text-xs md:text-sm font-bold text-neutral-400 text-center py-3.5">/, '<div className="grid grid-cols-7 text-xs md:text-sm font-bold text-neutral-400 text-center py-4 px-2">');
  
  // Main calendar container bg
  content = content.replace(/<div className="bg-\[#0a0a0c\] border border-red-500\/10 rounded-3xl overflow-hidden shadow-md">/, '<div className="bg-[#0b0c10]/40 border border-red-500/10 rounded-[32px] overflow-hidden shadow-md backdrop-blur-sm">');
  
  // Replace empty cells
  content = content.replace(/className="min-h-\[140px\] bg-\[#0a0a0c\]\/40 p-3 opacity-40"/g, 'className="min-h-[140px] p-3 opacity-40 bg-[#0b0c10]/20 rounded-2xl m-0.5"');

  fs.writeFileSync(file, content);
  console.log('Calendar redesigned');
}

function redesignBulkUpload() {
  const file = 'app/(dashboard)/bulk-upload/page.tsx';
  let content = fs.readFileSync(file, 'utf8');

  const heroReplacement = `    <AppLayout title="Bulk Upload">
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-neutral-400 hover:text-white transition-colors border border-[#22222a] rounded-lg bg-[#0e0e12]">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-black text-white tracking-tight">Bulk Upload & Automatic Schedule Generator</h1>
      </div>

      {/* Hero Banner */}
      <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-r from-[#170505] via-[#3a0508] to-[#120202] border border-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.1)] relative overflow-hidden mb-8 group">
        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-red-600/15 to-transparent pointer-events-none blur-[50px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-red-600/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-950/50 shrink-0 border border-red-400/20">
            <Zap className="w-8 h-8 text-white fill-white/20" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md">Batch Media Uploader & <span className="text-red-500">Schedule Matrix</span></h2>
            <p className="text-sm md:text-base text-neutral-300 font-medium mt-1">Upload up to 50 videos simultaneously and generate multi-day posting schedules automatically.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">`;
      
  content = content.replace(/<AppLayout title="Bulk Upload">\s*<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">/, heroReplacement);

  // Ensure Zap icon is imported from lucide-react if not already
  if (!content.includes('Zap,')) {
    content = content.replace(/import {/, 'import { Zap,');
  }

  // Automatic Matrix Config card styling
  content = content.replace(/<div className="p-6 md:p-8 rounded-3xl bg-\[#0e0e12\] border border-\[#22222a\] shadow-md">/g, '<div className="p-6 md:p-8 rounded-[32px] bg-[#0c0c10] border border-red-500/10 shadow-lg shadow-black/50">');
  content = content.replace(/<h3 className="text-sm md:text-base font-bold text-neutral-200 uppercase tracking-wider mb-5 flex items-center justify-between">/g, '<h3 className="text-sm md:text-base font-bold text-white uppercase tracking-wider mb-5 flex items-center justify-between">');
  
  // Platform selectable checkboxes (make them premium cards)
  content = content.replace(
    /className={`cursor-pointer p-3 md:p-4 rounded-2xl border transition-all flex items-center gap-3 \${[\s\S]*?isSelected[\s\S]*?\? 'bg-red-950\/40 border-red-500\/60 shadow-md'[\s\S]*?: 'bg-\[#0e0e12\]\/40 border-\[#22222a\] opacity-60 hover:opacity-100'[\s\S]*?}`/g,
    `className={\`cursor-pointer p-3 rounded-2xl border transition-all flex items-center gap-3 \${
                          isSelected
                            ? 'bg-red-950/30 border-red-500/50 shadow-md shadow-red-900/20 ring-1 ring-red-500/20'
                            : 'bg-[#18181f]/50 border-red-500/10 opacity-70 hover:opacity-100 hover:border-red-500/30'
                        }\`}`
  );
  
  // Right side panels
  content = content.replace(/<div className="p-6 rounded-3xl bg-\[#0e0e12\] border border-\[#22222a\] shadow-md mb-6">/g, '<div className="p-6 rounded-[32px] bg-[#0c0c10] border border-red-500/10 shadow-lg shadow-black/50 mb-6 relative overflow-hidden group">');
  
  // Dropzone
  content = content.replace(
    /className="cursor-pointer border-2 border-dashed border-\[#33333e\] hover:border-red-500\/80 rounded-3xl p-8 text-center bg-\[#0e0e12\]\/80 hover:bg-\[#0e0e12\] transition-all group"/g,
    'className="cursor-pointer border-2 border-dashed border-red-500/30 hover:border-red-500/80 rounded-[32px] p-10 text-center bg-[#0c0c10] hover:bg-[#121216] transition-all group shadow-inner"'
  );

  fs.writeFileSync(file, content);
  console.log('Bulk Upload redesigned');
}

function redesignAccounts() {
  const file = 'app/(dashboard)/accounts/page.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Insert Header and Hero Banner
  const heroReplacement = `    <AppLayout title="Connected Accounts">
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-neutral-400 hover:text-white transition-colors border border-[#22222a] rounded-lg bg-[#0e0e12]">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-black text-white tracking-tight">Connected Social Channels</h1>
      </div>

      {/* Hero Banner */}
      <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-r from-[#170505] via-[#3a0508] to-[#120202] border border-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.1)] relative overflow-hidden mb-12 group">
        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-red-600/15 to-transparent pointer-events-none blur-[50px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md mb-2">Connected Channels ({connectedPlatformCount} / {supportedPlatforms.length})</h2>
          <p className="text-base md:text-lg text-neutral-300 font-medium">Connect your official social media accounts to manage and schedule content.</p>
        </div>
      </div>

      <div className="max-w-7xl">`;

  content = content.replace(/<AppLayout title="Connected Accounts">\s*<div className="max-w-7xl">\s*<div className="mb-10">\s*<div className="flex items-center gap-4 mb-2">[\s\S]*?<\/div>\s*<p className="text-sm md:text-base text-neutral-400 mt-1.5">[\s\S]*?<\/p>\s*<\/div>/, heroReplacement);
  
  if (!content.includes('ChevronLeft')) {
    content = content.replace(/import {/, 'import { ChevronLeft,');
  }

  // Account card styling to match the premium neon design
  // Give each platform card a glowing colored background specific to it
  content = content.replace(
    /className={`rounded-3xl border p-7 md:p-8 flex flex-col justify-between transition-all min-h-\[260px\] \${[\s\S]*?connected[\s\S]*?\? 'bg-\[#0e0e12\] border-\[#22222a\] hover:border-\[#33333e\] shadow-md'[\s\S]*?: 'bg-\[#0e0e12\]\/70 border-\[#22222a\]\/70 hover:border-\[#33333e\]\/80'[\s\S]*?}`/g,
    `className={\`relative overflow-hidden rounded-[32px] border p-7 md:p-8 flex flex-col justify-between transition-all min-h-[260px] group \${
                  connected
                    ? 'bg-[#0f0f13] border-red-500/20 hover:border-red-500/40 shadow-lg shadow-black/50'
                    : 'bg-[#0f0f13]/80 border-[#22222a] hover:border-red-500/20'
                }\`}
              >
                {/* Platform-specific dynamic glow */}
                <div className={\`absolute -bottom-12 -right-12 w-48 h-48 blur-[50px] rounded-full pointer-events-none opacity-40 \${
                  plat.id === 'INSTAGRAM' ? 'bg-pink-600' :
                  plat.id === 'FACEBOOK' ? 'bg-blue-600' :
                  plat.id === 'LINKEDIN' ? 'bg-sky-600' :
                  plat.id === 'YOUTUBE' ? 'bg-red-600' :
                  plat.id === 'TIKTOK' ? 'bg-white/40' :
                  plat.id === 'PINTEREST' ? 'bg-red-500' :
                  plat.id === 'SNAPCHAT' ? 'bg-yellow-500' :
                  'bg-neutral-600'
                }\`} />
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/40 pointer-events-none" />
                <div className="relative z-10 h-full flex flex-col justify-between"`
  );

  // Close the extra div I just injected inside the card
  content = content.replace(
    /className="flex items-center justify-between mt-6 pt-5 border-t border-\[#22222a\]">/g,
    `className="flex items-center justify-between mt-6 pt-5 border-t border-[#22222a]/50">`
  );
  content = content.replace(/<\/div>\s*<\/div>\s*\)\s*}/g, '</div></div></div>)}');

  // Red neon connect button
  content = content.replace(
    /className="px-5 py-2.5 rounded-xl bg-red-600\/10 hover:bg-red-600\/20 text-red-500 text-sm font-bold border border-red-500\/20 transition-all flex items-center gap-2"/g,
    `className="px-6 py-2.5 rounded-[14px] bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white text-sm font-bold shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all flex items-center gap-2 border border-red-400/30"`
  );
  
  // Unlinked pill
  content = content.replace(
    /pillClass: 'bg-\[#18181f\] text-neutral-400 border border-\[#33333e\]'/g,
    `pillClass: 'bg-red-950/30 text-red-200/50 border border-red-900/30'`
  );

  fs.writeFileSync(file, content);
  console.log('Accounts redesigned');
}

redesignBulkUpload();

