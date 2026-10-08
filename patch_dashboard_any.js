const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/instagram-auto-dm/page.tsx', 'utf8');

code = code.replace(
  /\{rule\.matchType === 'EXACT' \? 'Exact Match' : 'Contains Keyword'\}/g,
  `{rule.matchType === 'ANY_COMMENT' ? 'Any Comment' : rule.matchType === 'EXACT' ? 'Exact Match' : 'Contains Keyword'}`
);

code = code.replace(
  /<span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-0\.5 rounded border border-zinc-700">\s*\{rule\.keyword\}\s*<\/span>/,
  `<span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">
                              {rule.matchType === 'ANY_COMMENT' ? 'ANY' : rule.keyword}
                            </span>`
);

fs.writeFileSync('app/(dashboard)/instagram-auto-dm/page.tsx', code);
