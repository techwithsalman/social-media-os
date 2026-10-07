'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import { SUPPORTED_PLATFORM_CONFIGS } from '@/lib/platforms';
import {
  ChevronLeft,
  Share2,
  Check,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Sparkles,
  LogOut,
  Plus,
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
          dotClass: 'bg-red-500',
          pillClass: 'bg-red-500/10 text-red-400 border border-red-500/20',
      };
    default:
      return {
        label: 'Disconnected',
          dotClass: 'bg-red-500/70',
          pillClass: 'bg-[#18181f] text-neutral-400 border border-[#33333e]',
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
    account_exists: 'This account is already connected to your workspace.',
    account_not_found: 'Account not found. You may have logged into a different account.',
    social_account_limit_reached: 'You have reached your connected account limit for your current plan.',
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


  const getAddButtonText = (platId: string, platName: string) => {
    switch(platId) {
      case 'INSTAGRAM': return 'Add Instagram Account';
      case 'FACEBOOK': return 'Add Facebook Page';
      case 'TIKTOK': return 'Add TikTok Account';
      case 'YOUTUBE': return 'Add YouTube Channel';
      case 'LINKEDIN': return 'Add LinkedIn Account';
      case 'X': return 'Add X Account';
      case 'SNAPCHAT': return 'Add Snapchat Account';
      default: return `Add ${platName}`;
    }
  };

export default function ConnectedAccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [requirements, setRequirements] = useState<Record<string, PlatformReq>>({});
  const [entitlements, setEntitlements] = useState<any>(null);
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
          setEntitlements(data.entitlements || null);
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
    const handleMessage = (event: MessageEvent) => {
      const expectedOrigin = process.env.NODE_ENV === 'production' 
        ? 'https://app.techwithsalman.online' 
        : window.location.origin;
      
      if (event.origin !== expectedOrigin) return;

      if (event.data?.type === 'SOCIAL_ACCOUNT_CONNECTED') {
        fetchAccounts();
        setOauthNotice({ type: 'success', message: 'Account connected successfully.' });
        setActionLoadingPlatform(null);
      } else if (event.data?.type === 'SOCIAL_ACCOUNT_ERROR') {
        setOauthNotice({ type: 'error', message: 'Connection failed: ' + event.data.error });
        setActionLoadingPlatform(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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

  const openOAuthPopup = (url: string) => {
    const popup = window.open(url, 'oauth_popup', 'width=600,height=700');
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setActionLoadingPlatform(null);
        }
      }, 500);
    }
  };

  const handleConnect = async (platform: string, intentMode: 'add' | 'reconnect' = 'add') => {
    if (entitlements && entitlements.limits.maxSocialAccounts !== null && accounts.length >= entitlements.limits.maxSocialAccounts) {
      alert(`You've reached your ${entitlements.plan.name} plan limit of ${entitlements.limits.maxSocialAccounts} connected social accounts.`);
      return;
    }
    if (platform === 'LINKEDIN') { openOAuthPopup('/api/oauth/linkedin/connect'); return; }
    if (platform === 'X') {
      window.open('https://developer.x.com/', '_blank', 'noopener,noreferrer');
      return;
    }
    if (platform === 'SNAPCHAT') {
      window.open('https://developers.snap.com/', '_blank', 'noopener,noreferrer');
      return;
    }
    if (platform === 'TIKTOK' && mode.realTikTokConfigured) {
      setActionLoadingPlatform(platform);
      openOAuthPopup(`/api/oauth/tiktok/connect`);
      return;
    }

    if (mode.realApiMode && platform === 'INSTAGRAM') {
      setActionLoadingPlatform(platform);
      openOAuthPopup(`/api/oauth/instagram/connect?mode=${intentMode}`);
      return;
    }

    if (mode.realApiMode && platform === 'FACEBOOK') {
      setActionLoadingPlatform(platform);
      openOAuthPopup(`/api/oauth/meta/connect?platform=FACEBOOK`);
      return;
    }

    if (platform === 'YOUTUBE') {
      setActionLoadingPlatform(platform);
      openOAuthPopup(`/api/oauth/youtube/connect`);
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
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => window.history.back()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-neutral-400 hover:text-white transition-colors border border-[#22222a] rounded-lg bg-[#0e0e12]">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-black text-white tracking-tight">Connected Social Channels</h1>
      </div>

      {/* Hero Banner */}
      <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-r from-[#170505] via-[#3a0508] to-[#120202] border border-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.1)] relative overflow-hidden mb-12 group">
        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-red-600/15 to-transparent pointer-events-none blur-[50px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        
        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md mb-2">Connected Channels ({accounts.length} / {entitlements ? (entitlements.limits.maxSocialAccounts === null ? '∞' : entitlements.limits.maxSocialAccounts) : '?'})</h2>
          <p className="text-base md:text-lg text-neutral-300 font-medium">Connect your official social media accounts to manage and schedule content.</p>
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
          const platformAccounts = accounts.filter((a) => a.platform === plat.id);
          const isActing = actionLoadingPlatform === plat.id;
          const hasAnyConnected = platformAccounts.length > 0;

          return (
            <div
              key={plat.id}
              className={hasAnyConnected
                  ? 'rounded-3xl border p-7 md:p-8 flex flex-col justify-between transition-all min-h-[260px] bg-[#0e0e12] border-[#22222a] hover:border-[#33333e] shadow-md'
                  : 'rounded-3xl border p-7 md:p-8 flex flex-col justify-between transition-all min-h-[260px] bg-[#0e0e12]/70 border-[#22222a]/70 hover:border-[#33333e]/80'}
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
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${statusDisplay.pillClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDisplay.dotClass}`} />
                              <span>{statusDisplay.label}</span>
                            </span>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#33333e]/50">
                            {!isConnected && (
                              <button
                                onClick={() => handleConnect(plat.id, 'reconnect')}
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
                                <RefreshCw className={`w-3.5 h-3.5 ${isActing ? 'animate-spin' : ''}`} />
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
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl ${hasAnyConnected ? 'bg-[#18181f] hover:bg-[#2a1010] text-white border border-[#33333e]' : 'bg-red-600 hover:bg-red-500 text-white'} text-sm font-bold transition-all disabled:opacity-50`}
                  >
                    {isActing ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>{hasAnyConnected ? getAddButtonText(plat.id, plat.name) : 'Connect'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}</div>
    </AppLayout>
  );
}





