const fs = require('fs');

let pageContent = fs.readFileSync('app/(dashboard)/instagram-auto-dm/page.tsx', 'utf8');
pageContent = pageContent.replace(
  /if\s*\(\s*searchParams\.get\("success"\)\s*===\s*"1"\s*\)\s*\{\s*setSuccessMsg\("Automation created successfully\."\);\s*setTimeout\(\(\)\s*=>\s*setSuccessMsg\(""\),\s*5000\);\s*\}/g,
  `if (searchParams.get("success") === "1") {
      setSuccessMsg("Automation created successfully.");
      setTimeout(() => setSuccessMsg(""), 5000);
    } else if (searchParams.get("success") === "reconnected") {
      setSuccessMsg("Instagram Auto DM connected successfully.");
      setTimeout(() => setSuccessMsg(""), 5000);
    }`
);
fs.writeFileSync('app/(dashboard)/instagram-auto-dm/page.tsx', pageContent);

let createContent = fs.readFileSync('app/(dashboard)/instagram-auto-dm/create/page.tsx', 'utf8');

const replacement = `
                            {formData.socialAccountId === acc.id && (
                              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500"></div>
                            )}
                          </div>
                          
                          {formData.socialAccountId === acc.id && (
                            <div className="col-span-1 sm:col-span-2 mt-2 flex justify-end">
                              {!acc.hasAutoDmToken ? (
                                <button 
                                  onClick={(e) => { e.preventDefault(); window.location.href='/api/oauth/instagram-auto-dm/connect'; }}
                                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2"
                                >
                                  <Instagram className="w-3 h-3" />
                                  Connect Auto DM
                                </button>
                              ) : (
                                <button 
                                  onClick={(e) => { e.preventDefault(); window.location.href='/api/oauth/instagram-auto-dm/connect'; }}
                                  className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2"
                                >
                                  <Instagram className="w-3 h-3" />
                                  Reconnect Auto DM
                                </button>
                              )}
                            </div>
                          )}
`;

createContent = createContent.replace(
  /\{\s*formData\.socialAccountId\s*===\s*acc\.id\s*&&\s*\(\s*<div\s+className="absolute\s+top-2\s+right-2\s+w-2\s+h-2\s+rounded-full\s+bg-red-500"><\/div>\s*\)\s*\}\s*<\/div>/g,
  replacement
);

fs.writeFileSync('app/(dashboard)/instagram-auto-dm/create/page.tsx', createContent);
