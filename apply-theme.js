const fs = require('fs');
const path = require('path');

function replaceColors(content) {
  return content
    // Backgrounds
    .replace(/bg-\[#0c1220\]/g, 'bg-[#0a0505]') // Sidebar main
    .replace(/bg-\[#080d18\]/g, 'bg-[#050202]') // Sidebar header
    .replace(/bg-\[#0a0f1c\]/g, 'bg-[#080303]') // Workspace switcher
    .replace(/bg-\[#0b101d\]/g, 'bg-[#0a0505]') // Dashboard main bg
    .replace(/bg-\[#050811\]/g, 'bg-[#000000]') // Header bg
    .replace(/bg-slate-900\/90/g, 'bg-[#100606]/90') // Card surfaces
    .replace(/bg-slate-900\/50/g, 'bg-[#100606]/50')
    .replace(/bg-slate-900/g, 'bg-[#100606]')
    .replace(/bg-slate-800\/50/g, 'bg-red-900\/20')
    // Indigos to Reds
    .replace(/from-indigo-600/g, 'from-red-700')
    .replace(/via-indigo-500/g, 'via-red-600')
    .replace(/to-purple-500/g, 'to-red-500')
    .replace(/to-purple-600/g, 'to-red-600')
    .replace(/bg-indigo-600/g, 'bg-red-600')
    .replace(/bg-indigo-500/g, 'bg-red-500')
    .replace(/text-indigo-400/g, 'text-red-500')
    .replace(/text-indigo-300/g, 'text-red-400')
    .replace(/text-indigo-500/g, 'text-red-500')
    .replace(/border-indigo-500/g, 'border-red-500')
    .replace(/shadow-indigo-500/g, 'shadow-red-500')
    .replace(/shadow-indigo-600/g, 'shadow-red-600')
    .replace(/hover:bg-indigo-50/g, 'hover:bg-red-50')
    .replace(/hover:bg-indigo-600/g, 'hover:bg-red-600')
    .replace(/hover:text-indigo-300/g, 'hover:text-red-400')
    .replace(/hover:text-indigo-400/g, 'hover:text-red-400')
    .replace(/ring-indigo-500/g, 'ring-red-500')
    .replace(/ring-indigo-400/g, 'ring-red-400')
    .replace(/focus:ring-indigo-500/g, 'focus:ring-red-500')
    .replace(/focus:border-indigo-500/g, 'focus:border-red-500')
    // Purple to Red
    .replace(/bg-purple-600/g, 'bg-red-600')
    .replace(/bg-purple-500/g, 'bg-red-500')
    .replace(/text-purple-400/g, 'text-red-500')
    .replace(/border-purple-500/g, 'border-red-500')
    // Purples and indigos with opacity
    .replace(/indigo/g, 'red')
    .replace(/purple/g, 'red');
}

function processFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  content = replaceColors(content);
  fs.writeFileSync(filePath, content);
  console.log(`Processed colors in ${filePath}`);
}

const filesToProcess = [
  'app/(dashboard)/layout.tsx',
  'app/(dashboard)/dashboard/page.tsx',
  'app/(dashboard)/accounts/page.tsx',
  'components/layout/Sidebar.tsx',
  'components/layout/Header.tsx',
];

filesToProcess.forEach(processFile);

// Now specifically fix Sidebar Branding in Sidebar.tsx
let sidebarPath = 'components/layout/Sidebar.tsx';
if (fs.existsSync(sidebarPath)) {
  let sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  // Replace old brand header
  const oldBrandRegex = /<div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr[^<]*<Sparkles className="w-6 h-6" \/>[\s]*<\/div>[\s]*<div>[\s]*<h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">[\s]*Social Media <span className="text-red-400">OS<\/span>[\s]*<\/h1>[\s]*<p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">[\s]*Multi-Platform Suite[\s]*<\/p>[\s]*<\/div>/m;
  
  const newBrand = `<div className="flex items-center justify-center w-12 h-auto shrink-0 mb-1">
                <img src="/tws-logo-transparent.png" alt="Logo" className="w-full h-auto object-contain" />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-base font-black tracking-tight text-white uppercase leading-tight">
                  <span className="text-red-500">TECH</span> WITH <span className="text-red-500">SALMAN</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-tight">
                  Social Media <span className="text-red-500">OS</span>
                </p>
              </div>`;

  sidebarContent = sidebarContent.replace(oldBrandRegex, newBrand);
  fs.writeFileSync(sidebarPath, sidebarContent);
  console.log('Fixed Sidebar branding');
}

// Remove "Development Simulation" globally from specific files
const filesToStripDevBadge = [
  'app/(dashboard)/dashboard/page.tsx',
  'components/layout/Header.tsx',
  'app/(dashboard)/accounts/page.tsx'
];

filesToStripDevBadge.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Specifically remove from Header.tsx (badge with icon)
    content = content.replace(/<div className="hidden md:flex items-center gap-2 px-3 py-1\.5 rounded-lg bg-red-500\/10 border border-red-500\/20 text-red-400 text-xs font-semibold">[\s]*<Sparkles className="w-3\.5 h-3\.5" \/>[\s]*<span>Development Simulation<\/span>[\s]*<\/div>/g, '');
    
    // Specifically remove from dashboard page (badge near title)
    content = content.replace(/<div className="flex items-center gap-2 px-3 py-1\.5 rounded-lg bg-red-500\/10 border border-red-500\/20 text-red-400 text-xs font-semibold shadow-\[0_0_15px_rgba\(\d+,\d+,\d+,0\.1\)\]">[\s]*<Sparkles className="w-3\.5 h-3\.5" \/>[\s]*Development Simulation[\s]*<\/div>/g, '');
    
    // Specifically remove from accounts page
    content = content.replace(/<div className="flex items-center gap-2 px-3 py-1\.5 rounded-lg bg-red-500\/10 border border-red-500\/20 text-red-400 text-xs font-semibold shadow-sm">[\s]*<Sparkles className="w-4 h-4" \/>[\s]*<span>Development Simulation Ready<\/span>[\s]*<\/div>/g, '');

    fs.writeFileSync(filePath, content);
    console.log(`Stripped dev badge from ${filePath}`);
  }
});
