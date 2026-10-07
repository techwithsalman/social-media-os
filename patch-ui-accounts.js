const fs = require('fs');

let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

// Replace the Hero Banner text to use entitlements if available
code = code.replace(
  /Connected Channels \(\{connectedPlatformCount\} \/ \{supportedPlatforms\.length\}\)/g,
  "Connected Channels ({accounts.length} / {entitlements?.limits?.maxSocialAccounts || 0})"
);

const renderBlockOriginal = `        {/* Platform connection grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {supportedPlatforms.map((plat) => {
            const connected = accounts.find((a) => a.platform === plat.id && a.status === 'CONNECTED') || accounts.find((a) => a.platform === plat.id);
            const isConnected = connected?.status === 'CONNECTED';
            const isActing = actionLoadingPlatform === plat.id;
            const statusDisplay = getStatusDisplay(connected?.status);`;

const renderBlockNew = `        {/* Platform connection grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {supportedPlatforms.map((plat) => {
            const platformAccounts = accounts.filter((a) => a.platform === plat.id);
            const isActing = actionLoadingPlatform === plat.id;
            const hasAnyConnected = platformAccounts.length > 0;`;

code = code.replace(renderBlockOriginal, renderBlockNew);

const cardContentOriginal = `              <div
                key={plat.id}
                className={\`rounded-3xl border p-7 md:p-8 flex flex-col justify-between transition-all min-h-[260px] \${
                  connected
                    ? 'bg-[#0e0e12] border-[#22222a] hover:border-[#33333e] shadow-md'
                    : 'bg-[#0e0e12]/70 border-[#22222a]/70 hover:border-[#33333e]/80'
                }\`}
              >
                <div>
                  {/* Header & Logo */}
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-4">
                      <PlatformIcon platform={plat.id} size={42} className="w-11 h-11 rounded-2xl shrink-0" />
                      <div>
                        <h3 className="text-lg font-bold text-white">{plat.name}</h3>
                        <p className="text-xs md:text-sm text-neutral-400 mt-1 leading-relaxed">{plat.desc}</p>
                      </div>
                    </div>

                    <span
                      className={\`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 \${statusDisplay.pillClass}\`}
                    >
                      <span className={\`w-2 h-2 rounded-full \${statusDisplay.dotClass}\`} />
                      <span>{statusDisplay.label}</span>
                    </span>
                  </div>

                  {/* Profile Card if connected */}
                  {connected && (
                    <div className="mb-5 p-4 rounded-2xl bg-[#100606]/90 border border-[#22222a] flex items-center justify-between">
                      <div className="flex items-center gap-3.5 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#18181f] shrink-0 border border-[#33333e]">
                          {connected.profileImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={connected.profileImageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-sm text-white">
                              {connected.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-white truncate">
                            {connected.name}
                          </p>
                          <p className="text-xs text-neutral-400 truncate">
                            @{connected.username}
                          </p>
                        </div>
                      </div>

                      {connected.isMock && (
                        <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          Sandbox
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-[#22222a]/80 flex items-center justify-between gap-3">
                  <button
                    onClick={() =>
                      setActiveDocPlatform(activeDocPlatform === plat.id ? null : plat.id)
                    }
                    className="text-xs md:text-sm text-neutral-400 hover:text-red-500 font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>API Specs</span>
                  </button>

                  <div className="flex items-center gap-2.5">
                    {connected ? (
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
                              className="px-3.5 py-2 rounded-xl bg-[#18181f] hover:bg-[#2a1010] text-neutral-200 text-sm font-semibold border border-[#33333e] transition-colors"
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
                            <LogOut className="w-4 h-4" />
                          </button>
                        </>
                    ) : (
                      <button
                        onClick={() => handleConnect(plat.id)}
                        disabled={isActing}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all disabled:opacity-50 disabled:hover:bg-red-600"
                      >
                        {isActing ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>`;

const cardContentNew = `              <div
                key={plat.id}
                className={\`rounded-3xl border p-7 md:p-8 flex flex-col justify-between transition-all min-h-[260px] \${
                  hasAnyConnected
                    ? 'bg-[#0e0e12] border-[#22222a] hover:border-[#33333e] shadow-md'
                    : 'bg-[#0e0e12]/70 border-[#22222a]/70 hover:border-[#33333e]/80'
                }\`}
              >
                <div>
                  {/* Header & Logo */}
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-4">
                      <PlatformIcon platform={plat.id} size={42} className="w-11 h-11 rounded-2xl shrink-0" />
                      <div>
                        <h3 className="text-lg font-bold text-white">{plat.name}</h3>
                        <p className="text-xs md:text-sm text-neutral-400 mt-1 leading-relaxed">{plat.desc}</p>
                      </div>
                    </div>
                  </div>

                  {/* Profile Cards if connected */}
                  {hasAnyConnected && (
                    <div className="space-y-3 mb-5">
                      {platformAccounts.map(account => {
                        const isConnected = account.status === 'CONNECTED';
                        const statusDisplay = getStatusDisplay(account.status);
                        
                        return (
                          <div key={account.id} className="p-4 rounded-2xl bg-[#100606]/90 border border-[#22222a] flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3.5 overflow-hidden">
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#18181f] shrink-0 border border-[#33333e]">
                                  {account.profileImageUrl ? (
                                    <img
                                      src={account.profileImageUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center font-bold text-sm text-white">
                                      {account.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-sm font-bold text-white truncate flex items-center gap-2">
                                    {account.name}
                                  </p>
                                  <p className="text-xs text-neutral-400 truncate">
                                    @{account.username}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={\`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 \${statusDisplay.pillClass}\`}
                              >
                                <span className={\`w-1.5 h-1.5 rounded-full \${statusDisplay.dotClass}\`} />
                                <span>{statusDisplay.label}</span>
                              </span>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#33333e]/50">
                              {!isConnected && (
                                <button
                                  onClick={() => handleConnect(plat.id)}
                                  disabled={isActing}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold transition-all disabled:opacity-50"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Reconnect</span>
                                </button>
                              )}
                              {isConnected && (
                                <button
                                  onClick={() => handleRefreshAccount(account.id, plat.id)}
                                  disabled={isActing}
                                  title="Refresh Profile"
                                  className="px-2.5 py-1.5 rounded-lg bg-[#18181f] hover:bg-[#2a1010] text-neutral-200 text-xs font-semibold border border-[#33333e] transition-colors"
                                >
                                  <RefreshCw className={\`w-3.5 h-3.5 \${isActing ? 'animate-spin' : ''}\`} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDisconnect(account.id, plat.name)}
                                disabled={isActing}
                                title="Disconnect"
                                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-[#22222a]/80 flex items-center justify-between gap-3">
                  <button
                    onClick={() =>
                      setActiveDocPlatform(activeDocPlatform === plat.id ? null : plat.id)
                    }
                    className="text-xs md:text-sm text-neutral-400 hover:text-red-500 font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>API Specs</span>
                  </button>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleConnect(plat.id)}
                      disabled={isActing}
                      className={\`flex items-center gap-2 px-5 py-2.5 rounded-xl \${hasAnyConnected ? 'bg-[#18181f] hover:bg-[#2a1010] text-white border border-[#33333e]' : 'bg-red-600 hover:bg-red-500 text-white'} text-sm font-bold transition-all disabled:opacity-50\`}
                    >
                      {isActing ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>{hasAnyConnected ? \`Add \${plat.name}\` : 'Connect'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>`;

code = code.replace(cardContentOriginal, cardContentNew);

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
console.log('UI updated');
