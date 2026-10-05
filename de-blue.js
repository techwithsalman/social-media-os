const fs = require('fs');
const path = require('path');

function neutralizeColors(content) {
  return content
    // Specific hardcoded navy/blue hexes
    .replace(/bg-\[#0d1322\]/g, 'bg-[#0a0404]')
    .replace(/bg-\[#090d16\]/g, 'bg-[#050202]')
    .replace(/bg-\[#0a0f1c\]/g, 'bg-[#080303]')
    .replace(/bg-\[#0b101d\]/g, 'bg-[#050202]')
    .replace(/bg-\[#080d18\]/g, 'bg-[#080303]')
    .replace(/bg-\[#0c1220\]/g, 'bg-[#0a0505]')
    .replace(/bg-\[#0f172a\]/g, 'bg-[#0c0505]')
    
    // Replace all slate with neutral everywhere to kill the blue cast completely.
    .replace(/slate-/g, 'neutral-')
    
    // Then specifically, we can make dark neutral into red-tinted black/maroons
    .replace(/bg-neutral-950/g, 'bg-[#050202]')
    .replace(/bg-neutral-900/g, 'bg-[#0f0505]')
    .replace(/bg-neutral-800/g, 'bg-[#1a0a0a]')
    .replace(/bg-neutral-800\/80/g, 'bg-[#1a0a0a]/80')
    .replace(/bg-neutral-800\/50/g, 'bg-[#1a0a0a]/50')
    
    .replace(/border-neutral-800/g, 'border-[#2a1010]')
    .replace(/border-neutral-700/g, 'border-[#3a1515]')
    .replace(/border-neutral-600/g, 'border-[#4a1a1a]')
    
    .replace(/divide-neutral-800/g, 'divide-[#2a1010]')
    .replace(/divide-neutral-700/g, 'divide-[#3a1515]')
    
    .replace(/hover:bg-neutral-800/g, 'hover:bg-[#1f0c0c]')
    .replace(/hover:bg-neutral-700/g, 'hover:bg-[#2a1010]')
    
    .replace(/hover:border-neutral-700/g, 'hover:border-[#3a1515]')
    .replace(/hover:border-neutral-600/g, 'hover:border-[#4a1a1a]')
    
    // Ensure any stray indigo/purple/cyan/sky are neutralized
    .replace(/indigo-600/g, 'red-600')
    .replace(/indigo-500/g, 'red-500')
    .replace(/indigo-400/g, 'red-400')
    .replace(/purple-600/g, 'red-600')
    .replace(/purple-500/g, 'red-500')
    .replace(/purple-400/g, 'red-400')
    .replace(/cyan-600/g, 'red-600')
    .replace(/cyan-500/g, 'red-500')
    .replace(/cyan-400/g, 'red-400')
    .replace(/sky-600/g, 'red-600')
    .replace(/sky-500/g, 'red-500')
    .replace(/sky-400/g, 'red-400')
    
    // Check shadow colors
    .replace(/shadow-neutral-900/g, 'shadow-black')
    
    // Ring colors
    .replace(/ring-neutral-800/g, 'ring-[#2a1010]')
    .replace(/ring-neutral-700/g, 'ring-[#3a1515]');
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const newContent = neutralizeColors(content);
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log(`De-blued ${fullPath}`);
      }
    }
  }
}

processDirectory('app/(dashboard)');
processDirectory('components');
processDirectory('app/super-admin'); // Also super-admin to be safe
