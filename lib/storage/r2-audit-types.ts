export type R2ObjectClassification =
  | 'PUBLISHED'
  | 'PROTECTED_YOUTUBE'
  | 'SCHEDULED'
  | 'DRAFT'
  | 'IN_FLIGHT'
  | 'SHARED'
  | 'CANCELLED_POST_ONLY'
  | 'CONFIRMED_ORPHAN'
  | 'UNATTACHED_GRACE'
  | 'UNVERIFIED_UNKNOWN';

export interface R2AuditItem {
  key: string;
  sizeBytes: number;
  sizeFormatted: string;
  lastModified: string | null;
  classification: R2ObjectClassification;
  isEligibleForCleanup: boolean;
  reason: string;
  workspaceId: string | null;
  workspaceName: string | null;
  mediaAssetId: string | null;
  associatedPostIds: string[];
  associatedPostTitles: string[];
  protectedChannel: string | null;
}

export interface R2CategorySummary {
  classification: R2ObjectClassification;
  label: string;
  count: number;
  sizeBytes: number;
  sizeFormatted: string;
  isProtected: boolean;
  description: string;
}

export interface R2WorkspaceSummary {
  workspaceId: string;
  workspaceName: string;
  totalObjects: number;
  totalBytes: number;
  totalFormatted: string;
  eligibleObjects: number;
  eligibleBytes: number;
  eligibleFormatted: string;
  retainedObjects: number;
  retainedBytes: number;
  retainedFormatted: string;
}

export interface R2AuditReport {
  timestamp: string;
  isR2Configured: boolean;
  bucketName: string;
  totalBucketObjects: number;
  totalBucketBytes: number;
  totalBucketMB: number;
  totalBucketGB: number;

  eligibleCount: number;
  eligibleBytes: number;
  eligibleMB: number;
  eligibleGB: number;

  retainedCount: number;
  retainedBytes: number;
  retainedMB: number;
  retainedGB: number;

  categories: Record<R2ObjectClassification, R2CategorySummary>;
  workspaces: R2WorkspaceSummary[];
  eligibleItems: R2AuditItem[];
  retainedSample: R2AuditItem[];

  configurationNotice?: string;
}

export interface R2CleanupExecutionResult {
  success: boolean;
  dryRun: boolean;
  attemptedCount: number;
  deletedCount: number;
  failedCount: number;
  freedBytes: number;
  freedMB: number;
  freedGB: number;
  deletedKeys: Array<{
    key: string;
    sizeFormatted: string;
    status: 'DELETED' | 'FAILED' | 'SKIPPED';
    reason: string;
  }>;
  auditLogId?: string;
  timestamp: string;
  error?: string;
}

export interface R2CleanupLogItem {
  id: string;
  action: string;
  actorUserId: string | null;
  details: string | null;
  metadata: any;
  createdAt: string;
}
