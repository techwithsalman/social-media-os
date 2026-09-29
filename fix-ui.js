const fs = require('fs');
const file = 'app/(dashboard)/accounts/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `{isConnected ? (
                      <>
                        <button
                          onClick={() => handleRefreshAccount(connected.id, plat.id)}
                          disabled={isActing}
                          title="Refresh Profile"
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
                        >
                          <RefreshCw className={\`w-4 h-4 \${isActing ? 'animate-spin' : ''}\`} />
                        </button>
                        <button
                          onClick={() => handleDisconnect(connected.id, plat.name)}
                          disabled={isActing}
                          title="Disconnect"
                          className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold border border-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(plat.id)}
                        disabled={isActing}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {isActing ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Share2 className="w-4 h-4" />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                    )}`;

const replacement = `{connected ? (
                      <>
                        {!isConnected && (
                          <button
                            onClick={() => handleConnect(plat.id)}
                            disabled={isActing}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-sm font-bold transition-all disabled:opacity-50"
                          >
                            {isActing ? (
                              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4" />
                                <span>Reconnect</span>
                              </>
                            )}
                          </button>
                        )}
                        {isConnected && (
                          <button
                            onClick={() => handleRefreshAccount(connected.id, plat.id)}
                            disabled={isActing}
                            title="Refresh Profile"
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
                          >
                            <RefreshCw className={\`w-4 h-4 \${isActing ? 'animate-spin' : ''}\`} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnect(connected.id, plat.name)}
                          disabled={isActing}
                          title="Disconnect"
                          className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold border border-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(plat.id)}
                        disabled={isActing}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {isActing ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Share2 className="w-4 h-4" />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                    )}`;

if (content.includes(target)) {
  fs.writeFileSync(file, content.replace(target, replacement));
  console.log('Replaced successfully by exact string match');
} else {
  // Regex fallback
  const regex = /{isConnected \?\s*\(\s*<>\s*<button[\s\S]*?onClick=\{\(\) => handleRefreshAccount[\s\S]*?<\/button>\s*<button[\s\S]*?onClick=\{\(\) => handleDisconnect[\s\S]*?<\/button>\s*<\/>\s*\)\s*:\s*\(\s*<button[\s\S]*?onClick=\{\(\) => handleConnect[\s\S]*?<\/button>\s*\)}/;
  if (regex.test(content)) {
    fs.writeFileSync(file, content.replace(regex, replacement));
    console.log('Replaced successfully by regex');
  } else {
    console.error('Target not found!');
  }
}
