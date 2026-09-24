'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import { SUPPORTED_PLATFORM_CONFIGS } from '@/lib/platforms';
import {
  Share2,
  Check,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface SocialAccount {
  id: string;
  platform: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  status: string;
  isMock: boolean;
  token?: {
    expiresAt?: string;
    scope?: string;
  };
}

interface PlatformReq {
  name: string;
  platform: string;
  developerPortalUrl: string;
  requiredScopes: string[];
  requiredCredentials: string[];
  notes: string;
}

interface AccountsMode {
  realApiMode: boolean;
  mockApiMode: boolean;
  metaOAuthConfigured: boolean;
  realTikTokConfigured?: boolean;
}

function isMetaPlatform(platform: string) {
  return platform === 'FACEBOOK' || platform === 'INSTAGRAM';
}

function getStatusDisplay(status?: string) {
  switch (status) {
    case 'CONNECTED':
      return {
        label: 'Connected',
        dotClass: 'bg-emerald-400',
        pillClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      };
    case 'EXPIRED':
      return {
        label: 'Expired',
        dotClass: 'bg-amber-400',
        pillClass: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
      };
    case 'NEEDS_RECONNECTION':
      return {
        label: 'Reconnect Required',
        dotClass: 'bg-red-400',
        pillClass: 'bg-red-500/10 text-red-300 border border-red-500/20',
      };
    case 'DISCONNECTED':
      return {
        label: 'Disconnected',
        dotClass: 'bg-slate-500',
        pillClass: 'bg-slate-800 text-slate-400 border border-slate-700',
      };
    default:
      return {
        label: 'Unlinked',
        dotClass: 'bg-slate-500',
        pillClass: 'bg-slate-800 text-slate-400 border border-slate-700',
      };
  }
}

function getOAuthNotice(search: string) {
  const params = new URLSearchParams(search);
  if (params.get('meta_connected')) {
    return {
      type: 'success' as const,
      message: 'Meta accounts connected successfully.',
    };
  }

  if (params.get('tiktok_connected')) {
    return {
      type: 'success' as const,
      message: 'Official TikTok account connected successfully via OAuth Login Kit.',
    };
  }

  const ttError = params.get('tiktok_error');
  const ttErrorDesc = params.get('tiktok_error_desc');
  if (ttError) {
    const ttMessages: Record<string, string> = {
      authorization_cancelled: 'TikTok login was cancelled before account was connected.',
      access_denied: 'TikTok authorization was denied or cancelled.',
      non_sandbox_target: 'TikTok Sandbox Error: Logged-in account is not an authorized Sandbox Target User in TikTok Developer Portal.',
      missing_client_key: 'TIKTOK_CLIENT_KEY is missing in environment variables (.env).',
      missing_credentials: 'TikTok API credentials are not configured in .env.',
      invalid_state: 'TikTok OAuth state security verification failed. Please try connecting again.',
      state_already_used: 'TikTok OAuth state was already used. Please initiate a fresh login.',
      state_expired: 'TikTok OAuth state expired (valid for 10 minutes). Please try connecting again.',
      missing_code: 'TikTok did not return an authorization code. Please verify app permissions and redirect URI.',
      missing_state: 'TikTok callback did not include the state security parameter.',
      invalid_callback_params: 'TikTok callback parameters were missing or invalid. Verify that the redirect URI matches the TikTok Developer Portal configuration exactly.',
      redirect_uri_mismatch: 'Redirect URI mismatch: The redirect URI sent does not match the URI registered in the TikTok Developer Portal.',
      invalid_scope: 'Requested TikTok OAuth scopes are invalid or not approved in the TikTok Developer Portal.',
      token_exchange_failed: 'TikTok token exchange failed. Check client key, secret, and redirect URI.',
      missing_access_token: 'TikTok token endpoint did not return a valid access token.',
      token_expired: 'TikTok access token is expired or invalid.',
      user_info_failed: 'Failed to retrieve TikTok profile info.',
      tiktok_oauth_failed: 'TikTok login failed. Please try again.',
    };

    const baseMessage = ttMessages[ttError] || `TikTok OAuth Error (${ttError})`;
    const fullMessage = ttErrorDesc ? `${baseMessage} [Details: ${ttErrorDesc}]` : baseMessage;

    return {
      type: 'error' as const,
      message: fullMessage,
    };
  }

  const error = params.get('meta_error');
  if (!error) return null;

  const messages: Record<string, string> = {
    authorization_cancelled: 'Meta login was cancelled before accounts were connected.',
    meta_config_missing: 'Meta OAuth is not configured yet. Fill the Meta values in .env and restart the app.',
    real_mode_disabled: 'Enable REAL_API_MODE and turn off MOCK_API_MODE before starting real Meta login.',
    no_meta_accounts: 'Meta did not return any eligible Facebook Pages or linked Instagram Professional accounts.',
    meta_state_invalid: 'Meta login state could not be verified. Please try connecting again.',
    meta_state_expired: 'Meta login state expired. Please try connecting again.',
    meta_selection_invalid: 'Meta account selection expired. Please start Meta login again.',
    meta_oauth_failed: 'Meta login failed. Please try again.',
    meta_api_error: 'Meta returned an API error while discovering accounts.',
    meta_token_exchange_failed: 'Meta token exchange failed. Check the app credentials and redirect URI.',
  };

  return {
    type: 'error' as const,
    message: messages[error] || 'Meta login failed. Please try again.',
  };
}

export default function ConnectedAccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [requirements, setRequirements] = useState<Record<string, PlatformReq>>({});
  const [mode, setMode] = useState<AccountsMode>({
    realApiMode: false,
    mockApiMode: true,
    metaOAuthConfigured: false,
    realTikTokConfigured: false,
  });
  const [oauthNotice, setOauthNotice] = useState<ReturnType<typeof getOAuthNotice>>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingPlatform, setActionLoadingPlatform] = useState<string | null>(null);
  const [activeDocPlatform, setActiveDocPlatform] = useState<string | null>(null);

  const supportedPlatforms = SUPPORTED_PLATFORM_CONFIGS;
  const connectedPlatformCount = supportedPlatforms.filter((platform) =>
    accounts.some((account) => account.platform === platform.id && account.status === 'CONNECTED')
  ).length;

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        setRequirements(data.platformRequirements || {});
        setMode(data.mode || { realApiMode: false, mockApiMode: true, metaOAuthConfigured: false, realTikTokConfigured: false });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    const notice = getOAuthNotice(window.location.search);
    if (notice && notice.type === 'success' && notice.message.includes('TikTok')) {
      const hasConnectedTikTok = accounts.some(
        (a) => a.platform === 'TIKTOK' && a.status === 'CONNECTED'
      );
      if (!loading && !hasConnectedTikTok) {
        setOauthNotice(null);
        return;
      }
    }
    setOauthNotice(notice);
  }, [accounts, loading]);

  const handleConnect = async (platform: string) => {
    if (platform === 'TIKTOK' && mode.realTikTokConfigured) {
      setActionLoadingPlatform(platform);
      window.location.href = `/api/oauth/tiktok/connect`;
      return;
    }

    if (mode.realApiMode && isMetaPlatform(platform)) {
      setActionLoadingPlatform(platform);
      window.location.href = `/api/oauth/meta/connect?platform=${encodeURIComponent(platform)}`;
      return;
    }

    try {
      setActionLoadingPlatform(platform);
      const res = await fetch('/api/accounts/mock-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      if (res.ok) {
        await fetchAccounts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoadingPlatform(null);
    }
  };

  const handleRefreshAccount = async (accountId: string, platform: string) => {
    try {
      setActionLoadingPlatform(platform);
      const res = await fetch('/api/accounts/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchAccounts();
      } else if (data.reauthRequired) {
        await fetchAccounts();
        setOauthNotice({
          type: 'error',
          message: `${platform} connection expired. Re-authorization is required.`,
        });
      } else {
        console.error('[Refresh Account Error]:', data.error);
      }
    } catch (e) {
      console.error('[Refresh Account Exception]:', e);
    } finally {
      setActionLoadingPlatform(null);
    }
  };

  const handleDisconnect = async (accountId: string, platform: string) => {
    if (!confirm(`Disconnect this ${platform} account?`)) return;
    try {
      setActionLoadingPlatform(platform);
      const res = await fetch(`/api/accounts?id=${accountId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchAccounts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoadingPlatform(null);
    }
  };

  return (
    <AppLayout title="Connected Social Channels">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Connected Channels ({connectedPlatformCount} / {supportedPlatforms.length})
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1.5">
            Connect official developer OAuth accounts or test instantly with simulated sandbox connections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs md:text-sm font-bold">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Development Simulation Ready</span>
          </div>
        </div>
      </div>

      {oauthNotice && (
        <div
          className={`mb-8 rounded-2xl px-5 py-4 text-sm font-bold flex items-center gap-3 border ${
            oauthNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-red-500/10 border-red-500/30 text-red-200'
          }`}
        >
          {oauthNotice.type === 'success' ? (
            <Check className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{oauthNotice.message}</span>
        </div>
      )}

      {/* Platform connection grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {supportedPlatforms.map((plat) => {
          const connected = accounts.find((a) => a.platform === plat.id && a.status === 'CONNECTED') || accounts.find((a) => a.platform === plat.id);
          const isConnected = connected?.status === 'CONNECTED';
          const isActing = actionLoadingPlatform === plat.id;
          const statusDisplay = getStatusDisplay(connected?.status);

          return (
            <div
              key={plat.id}
              className={`rounded-3xl border p-7 md:p-8 flex flex-col justify-between transition-all min-h-[260px] ${
                connected
                  ? 'bg-[#0d1322] border-slate-800 hover:border-slate-700 shadow-md'
                  : 'bg-[#090d16]/70 border-slate-800/70 hover:border-slate-700/80'
              }`}
            >
              <div>
                {/* Header & Logo */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-4">
                    <PlatformIcon platform={plat.id} size={42} className="w-11 h-11 rounded-2xl shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold text-white">{plat.name}</h3>
                      <p className="text-xs md:text-sm text-slate-400 mt-1 leading-relaxed">{plat.desc}</p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${statusDisplay.pillClass}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusDisplay.dotClass}`} />
                    <span>{statusDisplay.label}</span>
                  </span>
                </div>

                {/* Profile Card if connected */}
                {connected && (
                  <div className="mb-5 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
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
                        <p className="text-xs text-slate-400 truncate">
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
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <button
                  onClick={() =>
                    setActiveDocPlatform(activeDocPlatform === plat.id ? null : plat.id)
                  }
                  className="text-xs md:text-sm text-slate-400 hover:text-indigo-400 font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>API Specs</span>
                </button>

                <div className="flex items-center gap-2.5">
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => handleRefreshAccount(connected.id, plat.id)}
                        disabled={isActing}
                        title="Refresh Profile"
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 ${isActing ? 'animate-spin' : ''}`} />
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
                  )}
                </div>
              </div>

              {/* Developer Requirements Drawer */}
              {activeDocPlatform === plat.id && requirements[plat.id] && (
                <div className="mt-5 p-5 rounded-2xl bg-slate-950 border border-slate-800 text-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">OAuth & API Specs</span>
                    <a
                      href={requirements[plat.id].developerPortalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-1.5 text-xs font-bold"
                    >
                      <span>Developer Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase">Required Scopes:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {requirements[plat.id].requiredScopes.map((sc) => (
                        <span key={sc} className="px-2 py-0.5 rounded-md bg-slate-900 text-xs text-slate-300 font-mono">
                          {sc}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 italic leading-relaxed">
                    {requirements[plat.id].notes}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
