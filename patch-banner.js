const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/create-post/page.tsx', 'utf8');

code = code.replace(
  /\{errorMessage && \(\s*<div className="mb-8 p-5 rounded-2xl bg-red-500\/10 border border-red-500\/30 text-red-400 text-sm font-semibold flex items-center justify-between shadow-md">\s*<div className="flex items-center gap-3">\s*<AlertCircle className="w-5 h-5 shrink-0" \/>\s*<span>\{errorMessage\}<\/span>\s*<\/div>\s*<button onClick=\{\(\) => setErrorMessage\(''\)\} className="p-1 hover:text-white">\s*<X className="w-5 h-5" \/>\s*<\/button>\s*<\/div>\s*\)\}/,
  `{errorMessage && (
    <div className="mb-8 p-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold flex items-start sm:items-center justify-between shadow-md gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
        {errorSource && <div className="text-[10px] opacity-70 ml-8 font-mono text-red-300">Source: {errorSource}</div>}
      </div>
      <button onClick={() => { setErrorMessage(''); setErrorSource(''); }} className="p-1 hover:text-white shrink-0">
        <X className="w-5 h-5" />
      </button>
    </div>
  )}`
);

fs.writeFileSync('app/(dashboard)/create-post/page.tsx', code, 'utf8');
console.log('Banner patched.');
