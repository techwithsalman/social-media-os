const fs = require('fs');
const path = 'app/(dashboard)/create-post/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/<div className="sticky bottom-6 z-20[\s\S]*?gap-4">/, '<div className="sticky bottom-4 md:bottom-6 z-20 p-4 md:p-6 rounded-3xl bg-[#080d18]/95 backdrop-blur-xl border border-slate-800 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">');
code = code.replace(/<div className="flex items-center gap-3">/, '<div>');
code = code.replace(/<div className="flex items-center gap-3.5">/, '<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3.5 w-full sm:w-auto">');
code = code.replace(/className="flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl bg-slate-800[\s\S]*?disabled:opacity-50"/, 'className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 w-full sm:w-auto"');
code = code.replace(/className="flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl bg-indigo-950[\s\S]*?disabled:opacity-50"/, 'className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl bg-indigo-950/70 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-500/40 transition-colors disabled:opacity-50 w-full sm:w-auto"');
code = code.replace(/className="flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-2xl bg-gradient-to-r[\s\S]*?disabled:scale-100"/, 'className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 w-full sm:w-auto"');

fs.writeFileSync(path, code);
console.log('Action bar classes replaced successfully.');
