const fs = require('fs');

function patchAuthPage(path) {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');

  // Replace the icon and header HTML block
  const searchPattern = /<div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">[\s\S]*?<p className="mt-1\.5 text-xs text-slate-400">/m;
  const replacement = `<div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 via-red-500 to-rose-500 text-white shadow-xl shadow-red-500/25 mb-4 overflow-hidden">
          <img src="/tws-icon.svg" alt="Tech With Salman" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          Tech With Salman
        </h1>
        <h2 className="mt-1 text-sm font-semibold text-indigo-400">
          Social Media OS
        </h2>
        <p className="mt-1.5 text-xs text-slate-400">`;
        
  if (content.match(searchPattern)) {
    content = content.replace(searchPattern, replacement);
    fs.writeFileSync(path, content);
    console.log(`Patched ${path}`);
  } else {
    console.log(`Pattern not found in ${path}`);
  }
}

patchAuthPage('app/(auth)/login/page.tsx');
patchAuthPage('app/(auth)/signup/page.tsx');

// Patch layout title
const layoutPath = 'app/layout.tsx';
if (fs.existsSync(layoutPath)) {
  let layoutContent = fs.readFileSync(layoutPath, 'utf8');
  layoutContent = layoutContent.replace(
    /title: 'Social Media OS \| One Content.*'/,
    "title: 'Tech With Salman | Social Media OS'"
  );
  fs.writeFileSync(layoutPath, layoutContent);
  console.log(`Patched ${layoutPath}`);
}
