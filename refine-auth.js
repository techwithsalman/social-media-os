const fs = require('fs');

function refinePage(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update logo container and image src
  content = content.replace(
    /<div className="w-24 h-24 mb-6 relative overflow-hidden rounded-full shadow-\[0_0_50px_rgba\(220,38,38,0\.5\)\] border border-red-500\/40 bg-black\/50 p-2">[\s]*<img src="\/icon\.svg" alt="Tech With Salman" className="w-full h-full object-contain" \/>[\s]*<\/div>/m,
    `<div className="w-28 h-28 mb-4 relative drop-shadow-[0_0_25px_rgba(220,38,38,0.4)] hover:scale-105 transition-transform duration-500">
          <img src="/favicon.ico" alt="Tech With Salman" className="w-full h-full object-contain" />
        </div>`
  );

  // 2. Refine Secondary Label (Social Media OS)
  content = content.replace(
    /<h2 className="mt-1 text-base font-bold text-slate-100">[\s]*Social Media <span className="text-red-600">OS<\/span>[\s]*<\/h2>/m,
    `<h2 className="mt-0.5 text-sm font-medium tracking-widest text-slate-300 uppercase">
          Social Media <span className="text-red-500 font-bold">OS</span>
        </h2>`
  );

  // 3. Subdue background orbit lines and glow
  content = content.replace(
    /border-red-600\/10/g,
    'border-red-600/5'
  );
  content = content.replace(
    /border-red-500\/30/g,
    'border-red-500/10'
  );
  content = content.replace(
    /shadow-\[0_0_120px_rgba\(220,38,38,0\.15\)\]/g,
    'shadow-[0_0_120px_rgba(220,38,38,0.05)]'
  );
  content = content.replace(
    /bg-red-900\/20 rounded-full blur-\[120px\]/g,
    'bg-red-900/10 rounded-full blur-[150px]'
  );
  content = content.replace(
    /className="absolute inset-0 opacity-10 pointer-events-none"/g,
    'className="absolute inset-0 opacity-[0.03] pointer-events-none"'
  );
  
  // Make the grid itself a bit more subtle just in case
  content = content.replace(
    /rgba\(220,38,38,0\.3\)/g,
    'rgba(220,38,38,0.2)'
  );

  fs.writeFileSync(filePath, content);
  console.log(`Refined ${filePath}`);
}

refinePage('app/(auth)/login/page.tsx');
refinePage('app/(auth)/signup/page.tsx');
