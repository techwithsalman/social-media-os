'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import {
  TIMEZONE_OPTIONS,
  WORKSPACE_TIMEZONE,
  formatDateKeyForDisplay,
  formatTimeInputForDisplay,
  formatTimeInputInTimeZone,
  getDateKeyInTimeZone,
  getTimezoneLabel,
  getTodayDateKey,
  zonedDateTimeToUtcIso,
} from '@/lib/timezone';
import { SUPPORTED_PLATFORM_IDS } from '@/lib/platforms';
import {
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  X,
  RefreshCw,
  RotateCcw,
  Copy,
  Clock,
  Send,
  Save,
  Check,
  AlertCircle,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface SocialAccount {
  id: string;
  platform: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  status: string;
  isMock: boolean;
}

interface PlatformSettingsState {
  caption: string;
  hashtags: string;
  contentType: string;
  visibility: string;
  allowComments: boolean;
  hideLikes: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  linkUrl: string;
  boardName?: string;
  youtubeTitle: string;
  categoryId: string;
  audience: string;
}

interface MediaFileState {
  id: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  size: number;
  mimeType: string;
}

interface ComposerDraftState {
  selectedAccountIds: string[];
  masterCaption: string;
  syncCaptions: boolean;
  platformSettings: Record<string, PlatformSettingsState>;
  mediaFile: MediaFileState | null;
  activeTab: string;
  previewPlatform: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
}

interface EditablePostResponse {
  id: string;
  masterCaption: string;
  scheduledFor: string | null;
  timezone: string | null;
  mediaAsset?: {
    id: string;
    url: string;
    thumbnailUrl?: string | null;
    originalName: string;
    size: number;
    mimeType: string;
  } | null;
  platformPosts: Array<{
    id: string;
    socialAccountId: string;
    platform: string;
    customCaption?: string | null;
    hashtags?: string | null;
    contentType?: string | null;
    visibility?: string | null;
    metadata?: string | null;
  }>;
}

const COMPOSER_DRAFT_KEY = 'smos:create-post-composer';

const DEFAULT_PLATFORM_SETTINGS: Record<string, PlatformSettingsState> = {
  INSTAGRAM: {
    caption: '',
    hashtags: '#viral #trending #content',
    contentType: 'POST',
    visibility: 'PUBLIC',
    allowComments: true,
    hideLikes: false,
    allowDuet: true,
    allowStitch: true,
    linkUrl: '',
    youtubeTitle: '',
    categoryId: '22',
    audience: 'PUBLIC',
  },
  FACEBOOK: {
    caption: '',
    hashtags: '',
    contentType: 'POST',
    visibility: 'PUBLIC',
    allowComments: true,
    hideLikes: false,
    allowDuet: true,
    allowStitch: true,
    linkUrl: '',
    youtubeTitle: '',
    categoryId: '22',
    audience: 'PUBLIC',
  },
  TIKTOK: {
    caption: '',
    hashtags: '#fyp #trending #viral',
    contentType: 'VIDEO',
    visibility: 'PUBLIC_TO_EVERYONE',
    allowComments: true,
    hideLikes: false,
    allowDuet: true,
    allowStitch: true,
    linkUrl: '',
    youtubeTitle: '',
    categoryId: '22',
    audience: 'PUBLIC',
  },
  LINKEDIN: {
    caption: '',
    hashtags: '#business #growth #leadership',
    contentType: 'POST',
    visibility: 'PUBLIC',
    allowComments: true,
    hideLikes: false,
    allowDuet: true,
    allowStitch: true,
    linkUrl: '',
    youtubeTitle: '',
    categoryId: '22',
    audience: 'PUBLIC',
  },
  YOUTUBE: {
    caption: '',
    hashtags: '#shorts #viral #video',
    contentType: 'VIDEO',
    visibility: 'PUBLIC',
    allowComments: true,
    hideLikes: false,
    allowDuet: true,
    allowStitch: true,
    linkUrl: '',
    youtubeTitle: 'Exclusive Product Showcase 2026',
    categoryId: '22',
    audience: 'PUBLIC',
  },
  X: {
    caption: '',
    hashtags: '',
    contentType: 'POST',
    visibility: 'PUBLIC',
    allowComments: true,
    hideLikes: false,
    allowDuet: true,
    allowStitch: true,
    linkUrl: '',
    youtubeTitle: '',
    categoryId: '22',
    audience: 'PUBLIC',
  },
  PINTEREST: {
    caption: '',
    hashtags: '',
    contentType: 'PIN',
    visibility: 'PUBLIC',
    allowComments: true,
    hideLikes: false,
    allowDuet: true,
    allowStitch: true,
    linkUrl: '',
    boardName: 'Brand Studio',
    youtubeTitle: '',
    categoryId: '22',
    audience: 'PUBLIC',
  },
  SNAPCHAT: {
    caption: '',
    hashtags: '',
    contentType: 'STORY',
    visibility: 'PUBLIC',
    allowComments: true,
    hideLikes: false,
    allowDuet: true,
    allowStitch: true,
    linkUrl: '',
    youtubeTitle: '',
    categoryId: '22',
    audience: 'PUBLIC',
  },
};

const createDefaultPlatformSettings = () =>
  Object.fromEntries(
    Object.entries(DEFAULT_PLATFORM_SETTINGS).map(([platform, settings]) => [
      platform,
      { ...settings },
    ])
  ) as Record<string, PlatformSettingsState>;

const mergePlatformSettings = (settings?: Record<string, Partial<PlatformSettingsState>>) => {
  const defaults = createDefaultPlatformSettings();

  Object.entries(settings || {}).forEach(([platform, value]) => {
    defaults[platform] = {
      ...(defaults[platform] || DEFAULT_PLATFORM_SETTINGS[platform]),
      ...value,
    } as PlatformSettingsState;
  });

  return defaults;
};

export default function CreatePostPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scheduleDateInputRef = useRef<HTMLInputElement>(null);
  const scheduleTimeInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Content states
  const [masterCaption, setMasterCaption] = useState('');
  const [syncCaptions, setSyncCaptions] = useState(true);
  const [platformSettings, setPlatformSettings] = useState<Record<string, PlatformSettingsState>>(
    createDefaultPlatformSettings
  );

  // Media state
  const [mediaFile, setMediaFile] = useState<MediaFileState | null>(null);
  const [uploading, setUploading] = useState(false);

  // UI tabs & views
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [previewPlatform, setPreviewPlatform] = useState<string>('INSTAGRAM');

  // Modals
  const [showSyncWarningModal, setShowSyncWarningModal] = useState(false);
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleStep, setScheduleStep] = useState<'FORM' | 'CONFIRM'>('FORM');

  // Scheduling inputs
  const [scheduledDate, setScheduledDate] = useState(() => getTodayDateKey(WORKSPACE_TIMEZONE));
  const [scheduledTime, setScheduledTime] = useState('');
  const [timezone, setTimezone] = useState(WORKSPACE_TIMEZONE);

  // Actions loading & status
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [composerHydrated, setComposerHydrated] = useState(false);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const hasStoredComposerRef = useRef(false);
  const editingPostRef = useRef(false);

  const resetComposerToBlank = (availableAccounts?: SocialAccount[]) => {
    setMasterCaption('');
    setSyncCaptions(true);
    setPlatformSettings(createDefaultPlatformSettings());
    setMediaFile(null);
    setActiveTab('ALL');
    setPreviewPlatform('INSTAGRAM');
    setScheduledDate(getTodayDateKey(WORKSPACE_TIMEZONE));
    setScheduledTime('');
    setTimezone(WORKSPACE_TIMEZONE);
    setPublishSuccess(null);
    setErrorMessage('');
    setScheduleError('');
    setEditPostId(null);
    setIsDuplicating(false);
    editingPostRef.current = false;
    hasStoredComposerRef.current = false;

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
        window.localStorage.removeItem(COMPOSER_DRAFT_KEY);
      } catch {
        // ignore
      }
    }

    const accs = availableAccounts || accounts;
    if (accs.length > 0) {
      setSelectedAccountIds(
        accs.filter((a) => a.status === 'CONNECTED').map((a) => a.id)
      );
    }
  };

  const handleResetForm = () => {
    const hasUnsavedContent = masterCaption.trim().length > 0 || mediaFile !== null;
    if (hasUnsavedContent) {
      setShowClearConfirmModal(true);
    } else {
      resetComposerToBlank();
    }
  };

  const confirmResetForm = () => {
    setShowClearConfirmModal(false);
    resetComposerToBlank();
    if (typeof window !== 'undefined' && window.location.search) {
      router.replace('/create-post');
    }
  };

  useEffect(() => {
    const applyEditablePost = (post: EditablePostResponse) => {
      const postTimezone = post.timezone || WORKSPACE_TIMEZONE;
      const nextSettings = createDefaultPlatformSettings();

      post.platformPosts.forEach((platformPost) => {
        let metadata: Partial<PlatformSettingsState> = {};
        try {
          metadata = platformPost.metadata ? JSON.parse(platformPost.metadata) : {};
        } catch {
          metadata = {};
        }

        nextSettings[platformPost.platform] = {
          ...(nextSettings[platformPost.platform] || DEFAULT_PLATFORM_SETTINGS[platformPost.platform]),
          ...metadata,
          caption: platformPost.customCaption || post.masterCaption,
          hashtags:
            platformPost.hashtags ||
            nextSettings[platformPost.platform]?.hashtags ||
            '',
          contentType:
            platformPost.contentType ||
            nextSettings[platformPost.platform]?.contentType ||
            'POST',
          visibility:
            platformPost.visibility ||
            nextSettings[platformPost.platform]?.visibility ||
            'PUBLIC',
        };
      });

      const allPlatformCaptionsMatchMaster = post.platformPosts.every(
        (platformPost) =>
          !platformPost.customCaption || platformPost.customCaption === post.masterCaption
      );

      setMasterCaption(post.masterCaption);
      setSyncCaptions(allPlatformCaptionsMatchMaster);
      setPlatformSettings(nextSettings);
      setSelectedAccountIds(post.platformPosts.map((platformPost) => platformPost.socialAccountId));
      setTimezone(postTimezone);

      if (post.scheduledFor) {
        setScheduledDate(getDateKeyInTimeZone(post.scheduledFor, postTimezone));
        setScheduledTime(formatTimeInputInTimeZone(post.scheduledFor, postTimezone));
      }

      setMediaFile(
        post.mediaAsset
          ? {
              id: post.mediaAsset.id,
              url: post.mediaAsset.url,
              thumbnailUrl: post.mediaAsset.thumbnailUrl || post.mediaAsset.url,
              name: post.mediaAsset.originalName,
              size: post.mediaAsset.size,
              mimeType: post.mediaAsset.mimeType,
            }
          : null
      );
    };

    const params = new URLSearchParams(window.location.search);
    const postIdToEdit = params.get('edit');
    const duplicatePostId = params.get('duplicate');

    if (postIdToEdit) {
      setEditPostId(postIdToEdit);
      setIsDuplicating(false);
      editingPostRef.current = true;

      fetch(`/api/posts/${postIdToEdit}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to load post for editing.');
          applyEditablePost(data.post);
        })
        .catch((err: any) => {
          setErrorMessage(err.message || 'Failed to load post for editing.');
        })
        .finally(() => {
          setComposerHydrated(true);
        });
      return;
    }

    if (duplicatePostId) {
      setEditPostId(null);
      setIsDuplicating(true);
      editingPostRef.current = false;

      fetch(`/api/posts/${duplicatePostId}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to load post for duplication.');
          applyEditablePost(data.post);
        })
        .catch((err: any) => {
          setErrorMessage(err.message || 'Failed to load post for duplication.');
        })
        .finally(() => {
          setComposerHydrated(true);
        });
      return;
    }

    // New Post flow: always start blank and clear any stale storage
    resetComposerToBlank();
    setComposerHydrated(true);
  }, []);

  useEffect(() => {
    if (!composerHydrated || editingPostRef.current || isDuplicating) return;

    // Only persist if user has started composing non-empty content
    if (!masterCaption && !mediaFile && selectedAccountIds.length === 0) {
      try {
        window.sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
      } catch {
        // ignore
      }
      return;
    }

    const draft: ComposerDraftState = {
      selectedAccountIds,
      masterCaption,
      syncCaptions,
      platformSettings,
      mediaFile,
      activeTab,
      previewPlatform,
      scheduledDate,
      scheduledTime,
      timezone,
    };

    try {
      window.sessionStorage.setItem(COMPOSER_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    activeTab,
    composerHydrated,
    isDuplicating,
    masterCaption,
    mediaFile,
    platformSettings,
    previewPlatform,
    scheduledDate,
    scheduledTime,
    selectedAccountIds,
    syncCaptions,
    timezone,
  ]);

  // Fetch connected accounts on load
  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoadingAccounts(true);
        const res = await fetch('/api/accounts');
        if (res.ok) {
          const data = await res.json();
          const fetchedAccounts = (data.accounts || []) as SocialAccount[];
          const validAccountIds = new Set(fetchedAccounts.map((account) => account.id));

          setAccounts(fetchedAccounts);
          setSelectedAccountIds((prev) => {
            if (!hasStoredComposerRef.current && !editingPostRef.current) {
              return fetchedAccounts
                .filter((account) => account.status === 'CONNECTED')
                .map((account) => account.id);
            }

            return Array.from(new Set(prev)).filter((accountId) =>
              validAccountIds.has(accountId)
            );
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadAccounts();
  }, []);

  // Handle Master Caption change with sync logic
  const handleMasterCaptionChange = (text: string) => {
    setMasterCaption(text);
    if (syncCaptions) {
      setPlatformSettings((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((plat) => {
          next[plat] = {
            ...next[plat],
            caption: text,
          };
        });
        return next;
      });
    }
  };

  // Toggle Sync with confirmation if custom edits exist
  const handleToggleSync = () => {
    if (!syncCaptions) {
      const hasCustomEdits = Object.values(platformSettings).some(
        (s) => s.caption && s.caption !== masterCaption
      );

      if (hasCustomEdits) {
        setShowSyncWarningModal(true);
        return;
      }

      setSyncCaptions(true);
      handleMasterCaptionChange(masterCaption);
    } else {
      setSyncCaptions(false);
    }
  };

  const confirmReSync = () => {
    setSyncCaptions(true);
    setPlatformSettings((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((plat) => {
        next[plat] = {
          ...next[plat],
          caption: masterCaption,
        };
      });
      return next;
    });
    setShowSyncWarningModal(false);
  };

  const updatePlatformSetting = (
    platform: string,
    key: keyof PlatformSettingsState,
    value: any
  ) => {
    setPlatformSettings((prev) => ({
      ...prev,
      [platform]: {
        ...(prev[platform] || DEFAULT_PLATFORM_SETTINGS[platform]),
        [key]: value,
      },
    }));
  };

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : Array.from(new Set([...prev, accountId]))
    );
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setMediaFile({
        id: data.media.id,
        url: data.media.url,
        thumbnailUrl: data.media.thumbnailUrl || data.media.url,
        name: data.media.originalName,
        size: data.media.size,
        mimeType: data.media.mimeType,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload media');
    } finally {
      setUploading(false);
    }
  };

  const buildSelectedPlatformPayload = () =>
    accounts
      .filter((a) => selectedAccountIds.includes(a.id))
      .map((a) => {
        const platSet = platformSettings[a.platform] || DEFAULT_PLATFORM_SETTINGS[a.platform];
        return {
          socialAccountId: a.id,
          platform: a.platform,
          customCaption: platSet.caption || masterCaption,
          hashtags: platSet.hashtags,
          contentType: platSet.contentType,
          visibility: platSet.visibility,
          metadata: platSet,
        };
      });

  const submitContentPost = async (payload: Record<string, any>) => {
    const endpoint = editPostId ? `/api/posts/${editPostId}` : '/api/posts';
    const method = editPostId ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        masterCaption,
        mediaAssetId: mediaFile?.id,
        platformSettings: buildSelectedPlatformPayload(),
        ...payload,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Content action failed');

    return data;
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setScheduleStep('FORM');
    setScheduleError('');
  };

  const getScheduleInputValues = () => ({
    date: scheduleDateInputRef.current
      ? scheduleDateInputRef.current.value
      : scheduledDate,
    time: scheduleTimeInputRef.current
      ? scheduleTimeInputRef.current.value
      : scheduledTime,
  });

  const handleReviewSchedule = () => {
    setErrorMessage('');
    setScheduleError('');
    const scheduleValues = getScheduleInputValues();

    if (selectedAccounts.length === 0) {
      setScheduleError('Please select at least one account to schedule.');
      return;
    }

    if (!scheduleValues.date) {
      setScheduleError('Publish Date is required.');
      return;
    }

    if (!scheduleValues.time) {
      setScheduleError('Publish Time is required.');
      return;
    }

    setScheduledDate(scheduleValues.date);
    setScheduledTime(scheduleValues.time);
    setScheduleStep('CONFIRM');
  };

  const handleSaveDraft = async () => {
    if (!masterCaption && selectedAccountIds.length === 0) {
      setErrorMessage('Please enter a caption or select accounts to save draft.');
      return;
    }

    try {
      setPublishing(true);
      await submitContentPost({
        publishNow: false,
        status: 'DRAFT',
        scheduledFor: null,
        timezone,
      });

      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
          window.localStorage.removeItem(COMPOSER_DRAFT_KEY);
        } catch {
          // ignore
        }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to save draft');
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishNow = async () => {
    if (selectedAccounts.length === 0) {
      setErrorMessage('Please select at least one connected account.');
      return;
    }

    setShowPublishConfirmModal(false);
    setPublishing(true);
    setErrorMessage('');

    try {
      const data = await submitContentPost({
        publishNow: true,
        status: 'PROCESSING',
        timezone,
      });

      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
          window.localStorage.removeItem(COMPOSER_DRAFT_KEY);
        } catch {
          // ignore
        }
      }

      // Reset the form fields underneath the success banner
      setMasterCaption('');
      setMediaFile(null);
      setPlatformSettings(createDefaultPlatformSettings());
      setSyncCaptions(true);
      setPublishSuccess(data.publishResult);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error publishing post');
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedulePost = async () => {
    setScheduleError('');
    const scheduleValues = getScheduleInputValues();

    if (selectedAccounts.length === 0) {
      setScheduleError('Please select at least one account to schedule.');
      return;
    }

    if (!scheduleValues.date) {
      setScheduleError('Publish Date is required.');
      return;
    }

    if (!scheduleValues.time) {
      setScheduleError('Publish Time is required.');
      return;
    }

    setPublishing(true);

    try {
      const scheduledFor = zonedDateTimeToUtcIso(scheduleValues.date, scheduleValues.time, timezone);
      await submitContentPost({
        scheduledFor,
        timezone,
        publishNow: false,
        status: 'SCHEDULED',
      });

      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
          window.localStorage.removeItem(COMPOSER_DRAFT_KEY);
        } catch {
          // ignore
        }
      }

      closeScheduleModal();
      router.push(`/calendar?date=${scheduleValues.date}`);
      router.refresh();
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to schedule post');
    } finally {
      setPublishing(false);
    }
  };

  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));

  const currentPreviewPlatform = previewPlatform;
  const currentPreviewText =
    platformSettings[currentPreviewPlatform]?.caption || masterCaption || 'Your caption preview will appear here in high fidelity...';
  const currentPreviewHashtags = platformSettings[currentPreviewPlatform]?.hashtags || '';
  const scheduleDateLabel = scheduledDate ? formatDateKeyForDisplay(scheduledDate) : '';
  const scheduleTimeLabel = scheduledTime ? formatTimeInputForDisplay(scheduledTime) : '';
  const scheduleTimezoneLabel = getTimezoneLabel(timezone);
  const renderPlatformMediaPreview = () => (
    <div>
      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
        Media Preview
      </label>
      <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
        {mediaFile ? (
          mediaFile.mimeType.startsWith('video/') ? (
            <video src={mediaFile.url} controls className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaFile.thumbnailUrl || mediaFile.url}
              alt="Media preview"
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <div className="text-center p-5">
            <ImageIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-500">No media attached</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AppLayout title={editPostId ? 'Edit Scheduled Post' : isDuplicating ? 'Duplicate Post' : 'Create & Schedule Post'}>
      {/* Duplicating Post Notice */}
      {isDuplicating && (
        <div className="mb-8 p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <Copy className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>Duplicating post — content and media pre-filled. Publishing will create a brand new post.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsDuplicating(false);
              resetComposerToBlank();
              router.replace('/create-post');
            }}
            className="text-xs font-bold text-indigo-400 hover:text-white underline shrink-0"
          >
            Start Blank Instead
          </button>
        </div>
      )}

      {/* Top Banner Alert / Error */}
      {errorMessage && (
        <div className="mb-8 p-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="p-1 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Publishing Result Status Banner */}
      {publishSuccess && (
        <div
          className={`mb-8 p-6 md:p-8 rounded-3xl border text-white shadow-2xl ${
            publishSuccess.overallStatus === 'FAILED'
              ? 'bg-red-950/60 border-red-500/50'
              : publishSuccess.overallStatus === 'PARTIALLY_FAILED'
              ? 'bg-amber-950/60 border-amber-500/50'
              : publishSuccess.overallStatus === 'PROCESSING'
              ? 'bg-indigo-950/60 border-indigo-500/50'
              : 'bg-emerald-950/50 border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {publishSuccess.overallStatus === 'FAILED' ? (
                <AlertCircle className="w-6 h-6 text-red-400" />
              ) : publishSuccess.overallStatus === 'PARTIALLY_FAILED' ? (
                <AlertCircle className="w-6 h-6 text-amber-400" />
              ) : publishSuccess.overallStatus === 'PROCESSING' ? (
                <Clock className="w-6 h-6 text-indigo-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              )}
              <h4 className="text-lg font-bold">
                {publishSuccess.overallStatus === 'FAILED'
                  ? 'Publishing Failed'
                  : publishSuccess.overallStatus === 'PARTIALLY_FAILED'
                  ? 'Publishing Partially Failed'
                  : publishSuccess.overallStatus === 'PROCESSING'
                  ? 'Uploaded to Creator Inbox / Processing'
                  : 'Publishing Completed'}
              </h4>
            </div>
            <button
              onClick={() => {
                setPublishSuccess(null);
                router.push('/published');
              }}
              className={`text-sm hover:underline font-bold ${
                publishSuccess.overallStatus === 'FAILED'
                  ? 'text-red-300'
                  : publishSuccess.overallStatus === 'PARTIALLY_FAILED'
                  ? 'text-amber-300'
                  : publishSuccess.overallStatus === 'PROCESSING'
                  ? 'text-indigo-300'
                  : 'text-emerald-300'
              }`}
            >
              View in Published Posts &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {publishSuccess.platformResults?.map((res: any) => (
              <div
                key={res.platformPostId}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <PlatformIcon platform={res.platform} size={20} className="w-5 h-5 rounded" />
                  <span className="font-bold">{res.platform}</span>
                </div>
                <div className="flex flex-col sm:items-end gap-1">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
                      res.status === 'PUBLISHED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : res.status === 'PROCESSING' || res.status === 'INBOX_DRAFT'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {res.status === 'INBOX_DRAFT' ? 'CREATOR INBOX DRAFT' : res.status}
                  </span>
                  {(res.statusMessage || res.errorMessage) && (
                    <span
                      className={`text-xs max-w-xl leading-relaxed ${
                        res.status === 'FAILED' ? 'text-red-300' : 'text-indigo-300'
                      }`}
                    >
                      {res.statusMessage || res.errorMessage}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
        {/* Left Composer Panel (7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* STEP 1: SELECT ACCOUNTS */}
          <div className="p-6 md:p-8 rounded-3xl bg-[#0d1322] border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm md:text-base font-bold text-slate-200 uppercase tracking-wider flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-md">
                    1
                  </span>
                  <span>Select Target Channels</span>
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  title="Clear all inputs and start a fresh blank post"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Form</span>
                </button>
                <button
                  onClick={() =>
                    setSelectedAccountIds(
                      selectedAccounts.length === accounts.length
                        ? []
                        : accounts.map((a) => a.id)
                    )
                  }
                  className="text-sm text-indigo-400 hover:text-indigo-300 font-bold"
                >
                  {selectedAccounts.length === accounts.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {loadingAccounts ? (
              <div className="py-8 text-center text-sm text-slate-400">
                Loading connected accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center">
                <p className="text-sm text-slate-300">No social accounts connected yet.</p>
                <button
                  onClick={() => router.push('/accounts')}
                  className="mt-3 text-sm font-bold text-indigo-400 hover:underline"
                >
                  Connect Channels &rarr;
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {accounts.map((acc) => {
                  const isSelected = selectedAccountIds.includes(acc.id);
                  return (
                    <div
                      key={acc.id}
                      data-account-card="true"
                      data-account-platform={acc.platform}
                      data-account-id={acc.id}
                      onClick={() => toggleAccountSelection(acc.id)}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-center gap-3.5 ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md'
                          : 'bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded-md border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
                      />
                      <PlatformIcon platform={acc.platform} size={24} className="w-6 h-6 rounded-lg shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">
                          {acc.name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          @{acc.username}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 2: MEDIA UPLOAD */}
          <div className="p-6 md:p-8 rounded-3xl bg-[#0d1322] border border-slate-800 shadow-md">
            <h3 className="text-sm md:text-base font-bold text-slate-200 uppercase tracking-wider mb-5 flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-md">
                2
              </span>
              <span>Upload Media</span>
            </h3>

            {!mediaFile ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-700 hover:border-indigo-500/80 rounded-3xl p-10 text-center bg-slate-900/40 hover:bg-slate-900/70 transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  }}
                  className="hidden"
                />

                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3.5" />
                    <p className="text-sm font-bold text-slate-200">
                      Uploading & Optimizing Media...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
                      <Upload className="w-7 h-7" />
                    </div>
                    <p className="text-base md:text-lg font-bold text-white">
                      Drop your content here
                    </p>
                    <p className="text-sm text-slate-400 mt-1.5">
                      or <span className="text-indigo-400 font-bold underline">Browse Files</span> from your device
                    </p>
                    <p className="text-xs text-slate-400 mt-3">
                      Supports JPG, JPEG, PNG, WEBP, MP4, MOV (up to 50MB)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-5 shadow-sm">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-20 h-20 rounded-2xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                    {mediaFile.url ? (
                      mediaFile.mimeType.startsWith('video/') ? (
                        <video src={mediaFile.url} className="w-full h-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaFile.url} alt="" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <ImageIcon className="w-8 h-8 text-amber-400" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm md:text-base font-bold text-white truncate">
                      {mediaFile.name}
                    </p>
                    <p className="text-xs md:text-sm text-slate-400 mt-1">
                      {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB •{' '}
                      {mediaFile.mimeType.split('/')[1]?.toUpperCase()}
                    </p>
                    {mediaFile.url ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-bold mt-1.5">
                        <Check className="w-3.5 h-3.5" /> Ready for multi-broadcast
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-bold mt-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> Invalid storage URL (Please re-upload)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
                    title="Replace media"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                  <button
                    onClick={() => setMediaFile(null)}
                    className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold border border-red-500/20 transition-colors"
                    title="Remove media"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: MASTER CAPTION & SYNC */}
          <div className="p-6 md:p-8 rounded-3xl bg-[#0d1322] border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm md:text-base font-bold text-slate-200 uppercase tracking-wider flex items-center gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-md">
                  3
                </span>
                <span>Master Caption</span>
              </h3>

              <div className="text-sm font-semibold text-slate-400">
                {masterCaption.length} characters
              </div>
            </div>

            <div className="relative">
              <textarea
                rows={5}
                value={masterCaption}
                onChange={(e) => handleMasterCaptionChange(e.target.value)}
                placeholder="Write the main caption for your content..."
                className="w-full p-4 text-base bg-slate-900/90 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-y leading-relaxed"
              />
            </div>

            {/* Sync Switch */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={syncCaptions}
                  onChange={handleToggleSync}
                  className="rounded-md border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
                />
                <span className="text-sm font-bold text-slate-200">
                  Apply this caption to all selected platforms
                </span>
              </label>

              {!syncCaptions && (
                <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                  Custom Platform Overrides Enabled
                </span>
              )}
            </div>
          </div>

          {/* STEP 4: PLATFORM-SPECIFIC TABS & EXPANDABLE FIELDS */}
          <div className="p-6 md:p-8 rounded-3xl bg-[#0d1322] border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm md:text-base font-bold text-slate-200 uppercase tracking-wider flex items-center gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-md">
                  4
                </span>
                <span>Platform Customizations</span>
              </h3>
            </div>

            {/* Tabs */}
            <div className="max-w-full flex flex-nowrap xl:flex-wrap items-center gap-2 overflow-x-auto xl:overflow-visible px-1 pb-3 mb-6 border-b border-slate-800">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
                  activeTab === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white'
                }`}
              >
                All Cards
              </button>
              {SUPPORTED_PLATFORM_IDS.map((plat) => (
                <button
                  key={plat}
                  onClick={() => {
                    setActiveTab(plat);
                    setPreviewPlatform(plat);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
                    activeTab === plat
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <PlatformIcon platform={plat} size={16} className="w-4 h-4 rounded" />
                  <span>{plat}</span>
                </button>
              ))}
            </div>

            {/* Platform Fields Cards */}
            <div className="space-y-6">
              {/* INSTAGRAM */}
              {(activeTab === 'ALL' || activeTab === 'INSTAGRAM') && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform="INSTAGRAM" size={22} className="w-5.5 h-5.5 rounded-lg" />
                      <span className="text-base font-bold text-white">Instagram Settings</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {platformSettings.INSTAGRAM?.caption?.length || 0} / 2,200 chars
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                      Caption
                    </label>
                    <textarea
                      rows={3}
                      disabled={syncCaptions}
                      value={platformSettings.INSTAGRAM?.caption}
                      onChange={(e) => updatePlatformSetting('INSTAGRAM', 'caption', e.target.value)}
                      placeholder="Custom Instagram caption..."
                      className="w-full p-3.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Content Type
                      </label>
                      <select
                        value={platformSettings.INSTAGRAM?.contentType}
                        onChange={(e) => updatePlatformSetting('INSTAGRAM', 'contentType', e.target.value)}
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="POST">Feed Post</option>
                        <option value="REEL">Instagram Reel</option>
                        <option value="CAROUSEL">Carousel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Hashtags
                      </label>
                      <input
                        type="text"
                        value={platformSettings.INSTAGRAM?.hashtags}
                        onChange={(e) => updatePlatformSetting('INSTAGRAM', 'hashtags', e.target.value)}
                        placeholder="#branding #launch"
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-slate-300">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platformSettings.INSTAGRAM?.allowComments}
                        onChange={(e) => updatePlatformSetting('INSTAGRAM', 'allowComments', e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 w-4 h-4"
                      />
                      <span>Allow Comments</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platformSettings.INSTAGRAM?.hideLikes}
                        onChange={(e) => updatePlatformSetting('INSTAGRAM', 'hideLikes', e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 w-4 h-4"
                      />
                      <span>Hide Like Counts</span>
                    </label>
                  </div>
                </div>
              )}

              {/* FACEBOOK */}
              {(activeTab === 'ALL' || activeTab === 'FACEBOOK') && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform="FACEBOOK" size={22} className="w-5.5 h-5.5 rounded-lg" />
                      <span className="text-base font-bold text-white">Facebook Settings</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {platformSettings.FACEBOOK?.caption?.length || 0} chars
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                      Caption
                    </label>
                    <textarea
                      rows={3}
                      disabled={syncCaptions}
                      value={platformSettings.FACEBOOK?.caption}
                      onChange={(e) => updatePlatformSetting('FACEBOOK', 'caption', e.target.value)}
                      placeholder="Custom Facebook caption..."
                      className="w-full p-3.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Post Type
                      </label>
                      <select
                        value={platformSettings.FACEBOOK?.contentType}
                        onChange={(e) => updatePlatformSetting('FACEBOOK', 'contentType', e.target.value)}
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="POST">Page Post</option>
                        <option value="VIDEO">Page Video</option>
                        <option value="REEL">Facebook Reel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Optional Link URL
                      </label>
                      <input
                        type="url"
                        value={platformSettings.FACEBOOK?.linkUrl}
                        onChange={(e) => updatePlatformSetting('FACEBOOK', 'linkUrl', e.target.value)}
                        placeholder="https://yourwebsite.com"
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TIKTOK */}
              {(activeTab === 'ALL' || activeTab === 'TIKTOK') && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform="TIKTOK" size={22} className="w-5.5 h-5.5 rounded-lg" />
                      <span className="text-base font-bold text-white">TikTok Settings</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {platformSettings.TIKTOK?.caption?.length || 0} / 4,000 chars
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                      Caption & Title
                    </label>
                    <textarea
                      rows={3}
                      disabled={syncCaptions}
                      value={platformSettings.TIKTOK?.caption}
                      onChange={(e) => updatePlatformSetting('TIKTOK', 'caption', e.target.value)}
                      placeholder="Custom TikTok caption..."
                      className="w-full p-3.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Publishing Method
                      </label>
                      <select
                        value={platformSettings.TIKTOK?.contentType || 'VIDEO'}
                        onChange={(e) => updatePlatformSetting('TIKTOK', 'contentType', e.target.value)}
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      >
                        <option value="VIDEO">Direct Post (video.publish - Production)</option>
                        <option value="INBOX_DRAFT">Creator Inbox (video.upload - Sandbox Demo)</option>
                      </select>
                      {platformSettings.TIKTOK?.contentType === 'INBOX_DRAFT' && (
                        <p className="text-[11px] text-indigo-400 mt-1 font-medium">
                          ✓ Supported for Sandbox testing & recording App Review demo video.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Privacy Level
                      </label>
                      <select
                        value={platformSettings.TIKTOK?.visibility}
                        onChange={(e) => updatePlatformSetting('TIKTOK', 'visibility', e.target.value)}
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="PUBLIC_TO_EVERYONE">Public to Everyone</option>
                        <option value="MUTUAL_FOLLOW_FRIENDS">Friends Only</option>
                        <option value="SELF_ONLY">Private (Self Only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Hashtags
                      </label>
                      <input
                        type="text"
                        value={platformSettings.TIKTOK?.hashtags}
                        onChange={(e) => updatePlatformSetting('TIKTOK', 'hashtags', e.target.value)}
                        placeholder="#fyp #viral"
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-slate-300">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platformSettings.TIKTOK?.allowComments}
                        onChange={(e) => updatePlatformSetting('TIKTOK', 'allowComments', e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 w-4 h-4"
                      />
                      <span>Allow Comments</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platformSettings.TIKTOK?.allowDuet}
                        onChange={(e) => updatePlatformSetting('TIKTOK', 'allowDuet', e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 w-4 h-4"
                      />
                      <span>Allow Duet</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platformSettings.TIKTOK?.allowStitch}
                        onChange={(e) => updatePlatformSetting('TIKTOK', 'allowStitch', e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 w-4 h-4"
                      />
                      <span>Allow Stitch</span>
                    </label>
                  </div>
                </div>
              )}

              {/* YOUTUBE */}
              {(activeTab === 'ALL' || activeTab === 'YOUTUBE') && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform="YOUTUBE" size={22} className="w-5.5 h-5.5 rounded-lg" />
                      <span className="text-base font-bold text-white">YouTube Settings</span>
                    </div>
                    <span className="text-xs text-amber-300 font-bold bg-amber-500/15 px-2.5 py-1 rounded-md border border-amber-500/30">
                      Independent Video Title
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                      Video Title (Required for YouTube)
                    </label>
                    <input
                      type="text"
                      value={platformSettings.YOUTUBE?.youtubeTitle}
                      onChange={(e) => updatePlatformSetting('YOUTUBE', 'youtubeTitle', e.target.value)}
                      placeholder="Enter YouTube Video Title..."
                      className="w-full p-3.5 text-base bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                      Description (Synced with Master Caption)
                    </label>
                    <textarea
                      rows={3}
                      disabled={syncCaptions}
                      value={platformSettings.YOUTUBE?.caption}
                      onChange={(e) => updatePlatformSetting('YOUTUBE', 'caption', e.target.value)}
                      placeholder="YouTube description..."
                      className="w-full p-3.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Visibility
                      </label>
                      <select
                        value={platformSettings.YOUTUBE?.visibility}
                        onChange={(e) => updatePlatformSetting('YOUTUBE', 'visibility', e.target.value)}
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="UNLISTED">Unlisted</option>
                        <option value="PRIVATE">Private</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Tags
                      </label>
                      <input
                        type="text"
                        value={platformSettings.YOUTUBE?.hashtags}
                        onChange={(e) => updatePlatformSetting('YOUTUBE', 'hashtags', e.target.value)}
                        placeholder="tech, saas, growth"
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* LINKEDIN */}
              {(activeTab === 'ALL' || activeTab === 'LINKEDIN') && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform="LINKEDIN" size={22} className="w-5.5 h-5.5 rounded-lg" />
                      <span className="text-base font-bold text-white">LinkedIn Settings</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {platformSettings.LINKEDIN?.caption?.length || 0} / 3,000 chars
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                      Post Text
                    </label>
                    <textarea
                      rows={3}
                      disabled={syncCaptions}
                      value={platformSettings.LINKEDIN?.caption}
                      onChange={(e) => updatePlatformSetting('LINKEDIN', 'caption', e.target.value)}
                      placeholder="Custom LinkedIn post text..."
                      className="w-full p-3.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Audience Target
                      </label>
                      <select
                        value={platformSettings.LINKEDIN?.visibility}
                        onChange={(e) => updatePlatformSetting('LINKEDIN', 'visibility', e.target.value)}
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="PUBLIC">Anyone (Public)</option>
                        <option value="CONNECTIONS_ONLY">Connections Only</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Hashtags
                      </label>
                      <input
                        type="text"
                        value={platformSettings.LINKEDIN?.hashtags}
                        onChange={(e) => updatePlatformSetting('LINKEDIN', 'hashtags', e.target.value)}
                        placeholder="#business #growth"
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* X / TWITTER */}
              {(activeTab === 'ALL' || activeTab === 'X') && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform="X" size={22} className="w-5.5 h-5.5 rounded-lg" />
                      <span className="text-base font-bold text-white">X / Twitter Settings</span>
                    </div>
                    <span
                      className={`text-xs font-black ${
                        (platformSettings.X?.caption?.length || 0) > 280
                          ? 'text-red-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {platformSettings.X?.caption?.length || 0} / 280 chars
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                      Tweet Text
                    </label>
                    <textarea
                      rows={3}
                      disabled={syncCaptions}
                      value={platformSettings.X?.caption}
                      onChange={(e) => updatePlatformSetting('X', 'caption', e.target.value)}
                      placeholder="What is happening?!"
                      className={`w-full p-3.5 text-sm bg-slate-950 border rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 disabled:opacity-60 leading-relaxed ${
                        (platformSettings.X?.caption?.length || 0) > 280
                          ? 'border-red-500/80 focus:ring-red-500'
                          : 'border-slate-800 focus:ring-indigo-500'
                      }`}
                    />
                  </div>

                  {(platformSettings.X?.caption?.length || 0) > 280 && (
                    <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Character limit exceeded by{' '}
                      {(platformSettings.X?.caption?.length || 0) - 280} characters.
                    </p>
                  )}
                </div>
              )}

              {/* PINTEREST */}
              {(activeTab === 'ALL' || activeTab === 'PINTEREST') && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform="PINTEREST" size={22} className="w-5.5 h-5.5 rounded-lg" />
                      <span className="text-base font-bold text-white">Pinterest Settings</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {platformSettings.PINTEREST?.caption?.length || 0} / 500 chars
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                      Caption / Description
                    </label>
                    <textarea
                      rows={3}
                      disabled={syncCaptions}
                      value={platformSettings.PINTEREST?.caption}
                      onChange={(e) => updatePlatformSetting('PINTEREST', 'caption', e.target.value)}
                      placeholder="Custom Pinterest description..."
                      className="w-full p-3.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Board
                      </label>
                      <input
                        type="text"
                        value={platformSettings.PINTEREST?.boardName || ''}
                        onChange={(e) => updatePlatformSetting('PINTEREST', 'boardName', e.target.value)}
                        placeholder="Brand Studio"
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        Optional Link
                      </label>
                      <input
                        type="url"
                        value={platformSettings.PINTEREST?.linkUrl}
                        onChange={(e) => updatePlatformSetting('PINTEREST', 'linkUrl', e.target.value)}
                        placeholder="https://yourwebsite.com"
                        className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {renderPlatformMediaPreview()}
                </div>
              )}

              {/* SNAPCHAT */}
              {(activeTab === 'ALL' || activeTab === 'SNAPCHAT') && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform="SNAPCHAT" size={22} className="w-5.5 h-5.5 rounded-lg" />
                      <span className="text-base font-bold text-white">Snapchat Settings</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {platformSettings.SNAPCHAT?.caption?.length || 0} / 250 chars
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                      Caption
                    </label>
                    <textarea
                      rows={3}
                      disabled={syncCaptions}
                      value={platformSettings.SNAPCHAT?.caption}
                      onChange={(e) => updatePlatformSetting('SNAPCHAT', 'caption', e.target.value)}
                      placeholder="Custom Snapchat caption..."
                      className="w-full p-3.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
                    />
                  </div>

                  {renderPlatformMediaPreview()}
                </div>
              )}
            </div>
          </div>

          {/* PUBLISHING ACTIONS BAR */}
          <div className="sticky bottom-6 z-20 p-5 md:p-6 rounded-3xl bg-[#080d18]/95 backdrop-blur-xl border border-slate-800 shadow-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={publishing}
                className="flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-slate-400" />
                <span>Save Draft</span>
              </button>
            </div>

            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => {
                  setScheduleStep('FORM');
                  setShowScheduleModal(true);
                }}
                disabled={publishing || selectedAccounts.length === 0}
                className="flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl bg-indigo-950/70 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-500/40 transition-colors disabled:opacity-50"
              >
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Schedule Post</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPublishConfirmModal(true)}
                disabled={publishing || selectedAccounts.length === 0}
                className="flex items-center gap-2.5 px-6 py-3 text-sm font-black rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {publishing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Post Now ({selectedAccounts.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Live Preview Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-28 p-6 md:p-8 rounded-3xl bg-[#0d1322] border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <Eye className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Live Platform Preview
                </h3>
              </div>

              {/* Platform Switcher Buttons */}
              <div className="flex items-center gap-1.5">
                {SUPPORTED_PLATFORM_IDS.map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setPreviewPlatform(plat)}
                    title={`Preview on ${plat}`}
                    className={`p-2 rounded-xl transition-all ${
                      previewPlatform === plat
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-900/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <PlatformIcon platform={plat} size={16} className="w-4 h-4 rounded" />
                  </button>
                ))}
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 min-h-[460px] flex flex-col justify-between shadow-inner">
              <div>
                {/* Simulated Platform Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-900 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      B
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Brand Studio</span>
                        <PlatformIcon platform={previewPlatform} size={14} className="w-3.5 h-3.5 rounded" />
                      </p>
                      <p className="text-xs text-slate-500">
                        {previewPlatform === 'YOUTUBE' ? '@AlexRiveraOfficial' : '@brandstudio'} • Just now
                      </p>
                    </div>
                  </div>

                  <span className="text-slate-600 font-bold text-sm">•••</span>
                </div>

                {/* YouTube Video Title if applicable */}
                {previewPlatform === 'YOUTUBE' && (
                  <div className="mb-3">
                    <h4 className="text-sm md:text-base font-bold text-white line-clamp-2">
                      {platformSettings.YOUTUBE?.youtubeTitle || 'Untitled YouTube Video'}
                    </h4>
                  </div>
                )}

                {/* Caption / Description Preview */}
                <div className="text-sm md:text-base text-slate-200 mb-4 whitespace-pre-wrap leading-relaxed">
                  {currentPreviewText}
                  {currentPreviewHashtags && (
                    <span className="text-indigo-400 font-bold ml-2">
                      {currentPreviewHashtags}
                    </span>
                  )}
                </div>

                {/* Media Preview Box */}
                <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video flex items-center justify-center relative shadow-sm">
                  {mediaFile ? (
                    !mediaFile.url ? (
                      <div className="text-center p-6">
                        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-amber-300">Media file unavailable</p>
                        <p className="text-[11px] text-slate-500 mt-1">Invalid storage URL. Please re-upload video.</p>
                      </div>
                    ) : mediaFile.mimeType.startsWith('video/') ? (
                      <video
                        src={mediaFile.url}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaFile.url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="text-center p-6">
                      <ImageIcon className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-500">No media attached</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Simulated Action Bar */}
              <div className="pt-4 mt-4 border-t border-slate-900 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>❤️ 248 Likes</span>
                <span>💬 32 Comments</span>
                <span>↗ 18 Shares</span>
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-slate-500 font-medium">
              Interactive preview rendering simulation for {previewPlatform}
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRM RE-SYNC MODAL */}
      {showSyncWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-[#0d1322] border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <h4 className="text-base font-bold text-white mb-2">
              Replace platform-specific captions with the Master Caption?
            </h4>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
              Enabling synchronization will overwrite custom edits on all platform cards with your current Master Caption.
            </p>
            <div className="flex items-center justify-end gap-3.5">
              <button
                onClick={() => setShowSyncWarningModal(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReSync}
                className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-md"
              >
                Replace & Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST NOW CONFIRMATION MODAL */}
      {showPublishConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-[#0d1322] border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <h4 className="text-base font-bold text-white mb-2">
              Publish this content to {selectedAccounts.length} account(s)?
            </h4>
            <p className="text-sm text-slate-400 mb-5">
              Your post will immediately be broadcast across:
            </p>

            <div className="space-y-2.5 mb-8">
              {selectedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  data-publish-confirm-account="true"
                  data-account-platform={acc.platform}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-sm"
                >
                  <PlatformIcon platform={acc.platform} size={20} className="w-5 h-5 rounded" />
                  <span className="font-bold text-white">{acc.name}</span>
                  <span className="text-xs text-slate-400">(@{acc.username})</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3.5">
              <button
                onClick={() => setShowPublishConfirmModal(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishNow}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Publish Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULING MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-[#0d1322] border border-slate-800 rounded-3xl p-8 shadow-2xl">
            {scheduleStep === 'FORM' ? (
              <>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                  <Clock className="w-6 h-6 text-indigo-400" />
                  <h4 className="text-base font-bold text-white">Schedule Content Broadcast</h4>
                </div>

                {scheduleError && (
                  <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-semibold flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{scheduleError}</span>
                  </div>
                )}

                <div className="space-y-5 mb-8">
                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">
                      Publish Date
                    </label>
                    <input
                      ref={scheduleDateInputRef}
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">
                      Publish Time
                    </label>
                    <input
                      ref={scheduleTimeInputRef}
                      type="time"
                      required
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">
                      Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {TIMEZONE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3.5">
                  <button
                    onClick={closeScheduleModal}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReviewSchedule}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/30"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Review Schedule</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
                  <button
                    type="button"
                    onClick={() => setScheduleStep('FORM')}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <h4 className="text-base font-bold text-white">Schedule Post</h4>
                </div>

                {scheduleError && (
                  <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-semibold flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{scheduleError}</span>
                  </div>
                )}

                <div className="space-y-5 mb-8">
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Scheduled for
                    </span>
                    <p className="text-lg font-black text-white mt-1.5">
                      {scheduleDateLabel} at {scheduleTimeLabel}
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Timezone
                    </span>
                    <p className="text-base font-bold text-indigo-300 mt-1.5">
                      {scheduleTimezoneLabel}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Platforms
                    </span>
                    <div className="space-y-2.5 mt-2.5">
                      {selectedAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          data-schedule-review-account="true"
                          data-account-platform={acc.platform}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-sm"
                        >
                          <PlatformIcon platform={acc.platform} size={20} className="w-5 h-5 rounded" />
                          <span className="font-bold text-white">{acc.platform}</span>
                          <span className="text-xs text-slate-400">(@{acc.username})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3.5">
                  <button
                    onClick={closeScheduleModal}
                    disabled={publishing}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSchedulePost}
                    disabled={publishing}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                  >
                    {publishing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                    <span>Confirm Schedule</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Confirm Clear / Discard Form */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <AlertCircle className="w-6 h-6" />
              <h4 className="text-lg font-bold text-white">Discard In-Progress Post?</h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              You have unsaved content in the composer. Starting a fresh post will clear your caption, media, and platform customizations.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded-xl"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={confirmResetForm}
                className="px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md transition-all"
              >
                Clear Form
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
