const fs = require('fs');

let create = fs.readFileSync('app/(dashboard)/instagram-auto-dm/create/page.tsx', 'utf8');

create = create.replace(
  "onClick={(e) => { e.preventDefault(); window.location.href='/api/oauth/instagram-auto-dm/connect'; }}",
  "onClick={(e) => { e.preventDefault(); window.location.href=`/api/oauth/instagram-auto-dm/connect?accountId=${acc.id}`; }}"
);

create = create.replace("Connect Auto DM", "Enable Auto DM");

const oldReconnectBtn = `                                <button 
                                  onClick={(e) => { e.preventDefault(); window.location.href='/api/oauth/instagram-auto-dm/connect'; }}
                                  className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2"
                                >
                                  <Instagram className="w-3 h-3" />
                                  Reconnect Auto DM
                                </button>`;

const newReconnectBtn = `                                <button 
                                  disabled
                                  className="bg-zinc-800 border border-green-500/30 text-green-400 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 cursor-default"
                                >
                                  <Instagram className="w-3 h-3" />
                                  Auto DM Enabled
                                </button>`;

create = create.replace(oldReconnectBtn, newReconnectBtn);

fs.writeFileSync('app/(dashboard)/instagram-auto-dm/create/page.tsx', create);
