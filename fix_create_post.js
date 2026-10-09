const fs = require('fs');

const path = 'app/(dashboard)/create-post/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the grid class layout to use the proper Tailwind arbitrary values for columns
content = content.replace(
  'className="grid grid-cols-1 lg:grid-[minmax(0,2fr)_minmax(340px,1fr)] gap-6"',
  'className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)] gap-6 lg:gap-8 items-start"'
);

// We should also restore the engagement mock UI at the bottom of the Live Preview Card
const engagementMockUI = `
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-900/50">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      <span className="text-xs font-medium">248 Likes</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <span className="text-xs font-medium">32 Comments</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M16 10l-4-4-4 4M12 6v14"/></svg>
                      <span className="text-xs font-medium">18 Shares</span>
                    </div>
                  </div>
`;

content = content.replace(
  '                      </div>\n                    )}\n                  </div>\n                </div>\n  \n              </div>\n  \n              <div className="mt-4 text-center text-xs text-neutral-500 font-medium">',
  '                      </div>\n                    )}\n                  </div>\n' + engagementMockUI + '\n                </div>\n  \n              </div>\n  \n              <div className="mt-4 text-center text-xs text-neutral-500 font-medium">'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed Create Post layout');
