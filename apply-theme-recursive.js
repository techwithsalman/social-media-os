const fs = require('fs');
const path = require('path');

function replaceColors(content) {
  return content
    // Specific surfaces
    .replace(/bg-\[#0c1220\]/g, 'bg-[#0a0505]') // Sidebar main
    .replace(/bg-\[#080d18\]/g, 'bg-[#050202]') // Sidebar header
    .replace(/bg-\[#0a0f1c\]/g, 'bg-[#080303]') // Workspace switcher
    .replace(/bg-\[#0b101d\]/g, 'bg-[#0a0505]') // Dashboard main bg
    .replace(/bg-\[#050811\]/g, 'bg-[#000000]') // Header bg
    .replace(/bg-slate-900\/90/g, 'bg-[#100606]/90') // Card surfaces
    .replace(/bg-slate-900\/50/g, 'bg-[#100606]/50')
    .replace(/bg-slate-800\/50/g, 'bg-red-900\/20')
    // Indigos to Reds
    .replace(/from-indigo-600/g, 'from-red-700')
    .replace(/via-indigo-500/g, 'via-red-600')
    .replace(/to-purple-500/g, 'to-red-500')
    .replace(/to-purple-600/g, 'to-red-600')
    .replace(/from-indigo-500/g, 'from-red-600')
    .replace(/bg-indigo-950/g, 'bg-red-950')
    .replace(/bg-indigo-900/g, 'bg-red-900')
    .replace(/bg-indigo-600/g, 'bg-red-600')
    .replace(/bg-indigo-500/g, 'bg-red-500')
    .replace(/text-indigo-400/g, 'text-red-500')
    .replace(/text-indigo-300/g, 'text-red-400')
    .replace(/text-indigo-500/g, 'text-red-500')
    .replace(/border-indigo-500/g, 'border-red-500')
    .replace(/border-indigo-400/g, 'border-red-400')
    .replace(/shadow-indigo-500/g, 'shadow-red-500')
    .replace(/shadow-indigo-600/g, 'shadow-red-600')
    .replace(/hover:bg-indigo-50/g, 'hover:bg-red-50')
    .replace(/hover:bg-indigo-600/g, 'hover:bg-red-600')
    .replace(/hover:bg-indigo-500/g, 'hover:bg-red-500')
    .replace(/hover:bg-indigo-900/g, 'hover:bg-red-900')
    .replace(/hover:from-indigo-500/g, 'hover:from-red-600')
    .replace(/hover:to-purple-500/g, 'hover:to-red-500')
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
    .replace(/border-purple-500/g, 'border-red-500');
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const newContent = replaceColors(content);
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log(`Processed ${fullPath}`);
      }
    }
  }
}

processDirectory('app/(dashboard)');
processDirectory('components/layout');

// Sidebar branding is already fixed by previous run.
