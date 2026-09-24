'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

type MetaPlatform = 'FACEBOOK' | 'INSTAGRAM';

interface SelectableMetaAccount {
  id: string;
  platform: MetaPlatform;
  platformAccountId: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  linkedFacebookPageId?: string;
  alreadyConnected: boolean;
}

interface SelectionResponse {
  accounts: SelectableMetaAccount[];
  expiresAt: string;
}

function getTokenFromLocation() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('token') || '';
}

function platformHeading(platform: MetaPlatform) {
  return platform === 'FACEBOOK' ? 'Facebook' : 'Instagram';
}

export default function MetaAccountSelectionPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [accounts, setAccounts] = useState<SelectableMetaAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const selectionToken = getTokenFromLocation();
    setToken(selectionToken);

    async function loadSelection() {
      if (!selectionToken) {
        setError('Meta account selection was not found.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/oauth/meta/selection?token=${encodeURIComponent(selectionToken)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Meta account selection expired.');
        }

        const selection = data as SelectionResponse;
        setAccounts(selection.accounts || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load Meta account selection.');
      } finally {
        setLoading(false);
      }
    }

    loadSelection();
  }, []);

  const groupedAccounts = useMemo(
    () => ({
      FACEBOOK: accounts.filter((account) => account.platform === 'FACEBOOK'),
      INSTAGRAM: accounts.filter((account) => account.platform === 'INSTAGRAM'),
    }),
    [accounts]
  );
  const selectableCount = accounts.filter((account) => !account.alreadyConnected).length;

  const toggleAccount = (account: SelectableMetaAccount) => {
    if (account.alreadyConnected) return;
    setSelectedIds((current) =>
      current.includes(account.id)
        ? current.filter((id) => id !== account.id)
        : [...current, account.id]
    );
  };

  const connectSelectedAccounts = async () => {
    if (selectedIds.length === 0) {
      setError('Choose at least one account to connect.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const res = await fetch('/api/oauth/meta/selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accountIds: selectedIds }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect selected Meta accounts.');
      }

      router.push('/accounts?meta_connected=1');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to connect selected Meta accounts.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Connected Social Channels">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-wider text-indigo-300">Meta OAuth</p>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
            Choose accounts to connect
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-2">
            Select the Facebook Pages and linked Instagram Professional accounts you want to add to this workspace.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl bg-[#0d1322] border border-slate-800 p-10 flex items-center justify-center gap-3 text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-300" />
            <span className="text-sm font-bold">Loading Meta accounts...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-3xl bg-[#0d1322] border border-slate-800 p-8 text-center">
            <p className="text-sm font-bold text-slate-300">No eligible Meta accounts were returned.</p>
            <button
              onClick={() => router.push('/accounts')}
              className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black"
            >
              Back to Accounts
            </button>
          </div>
        ) : (
          <div className="rounded-3xl bg-[#0d1322] border border-slate-800 p-6 md:p-8 shadow-md">
            <div className="space-y-8">
              {(['FACEBOOK', 'INSTAGRAM'] as MetaPlatform[]).map((platform) => (
                <section key={platform}>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">
                    {platformHeading(platform)}
                  </h2>
                  {groupedAccounts[platform].length === 0 ? (
                    <p className="text-sm text-slate-500">No {platformHeading(platform)} accounts found.</p>
                  ) : (
                    <div className="space-y-3">
                      {groupedAccounts[platform].map((account) => {
                        const selected = selectedIds.includes(account.id);

                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => toggleAccount(account)}
                            disabled={account.alreadyConnected}
                            className={`w-full flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                              selected
                                ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md'
                                : account.alreadyConnected
                                ? 'bg-slate-900/40 border-slate-800 opacity-60 cursor-not-allowed'
                                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                                {account.profileImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={account.profileImageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <PlatformIcon platform={account.platform} size={24} className="w-6 h-6 rounded-lg" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-white truncate">{account.name}</p>
                                <p className="text-xs text-slate-400 truncate">
                                  {account.platform === 'INSTAGRAM' ? `@${account.username}` : account.username}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {account.alreadyConnected && (
                                <span className="text-[10px] font-black text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                                  Already connected
                                </span>
                              )}
                              <span
                                className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                  selected
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-950 border-slate-700'
                                }`}
                              >
                                {selected && <Check className="w-3.5 h-3.5" />}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-800">
              <p className="text-xs text-slate-500">
                {selectableCount} available account{selectableCount === 1 ? '' : 's'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/accounts')}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={connectSelectedAccounts}
                  disabled={saving || selectedIds.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Connect Selected</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
