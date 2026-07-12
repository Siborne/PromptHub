export interface CloudUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  accountStatus?: string;
  isDisabled?: boolean;
}

export interface CloudAuthState {
  authenticated: boolean;
  unavailable?: boolean;
  user: CloudUser | null;
  baseUrl: string | null;
  errorCode?: string;
}

export interface CloudSession {
  id: string;
  clientPlatform: string;
  clientVersion: string | null;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface CloudNotification {
  id: string;
  type: string;
  payload: Record<string, string | number | boolean | null>;
  readAt: string | null;
  createdAt: string;
}

export interface CloudExportJob {
  id: string;
  status: string;
  format: string;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  errorCode: string | null;
}

export interface CloudDeletionRequest {
  id: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  executeAfter: string;
  cancelledAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
}

export interface CloudAccountOverview {
  account: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    status: string;
    emailVerified: boolean;
    emailVerifiedAt: string | null;
    deletionRequest: CloudDeletionRequest | null;
    sessionCount: number;
    identities: Array<{ type: string; provider: string; linkedAt?: string }>;
  };
  exportJobs: CloudExportJob[];
  notifications: CloudNotification[];
  subscription: Record<string, unknown> | null;
}

export interface CloudEntitlementSnapshot {
  effectivePlan: "free" | "pro" | "team";
  source: "free" | "subscription" | "plan_grant";
  cloudBackupEnabled: boolean;
  maxSyncDevices: number;
  maxCloudStorageBytes: number;
  officialAiEnabled: boolean;
  includedTextTokensMonthly: number;
  includedImageGenerationsMonthly: number;
  activeSubscription: { plan: "pro" | "team"; status: string } | null;
  activePlanGrant: { plan: "pro" | "team"; expiresAt: string | null } | null;
}

export interface CloudStoreListing {
  id: string;
  sourceType: string;
  sourceId: string;
  slug: string;
  title: string;
  summary: string | null;
  tags?: string[];
  coverImageUrl?: string | null;
  updatedAt?: string;
  publishedAt?: string;
}

export interface CloudStoreMetrics {
  likeCount: number;
  favoriteCount: number;
  installCount: number;
  downloadCount: number;
  viewCount: number;
}

export interface CloudStoreViewerState {
  liked: boolean;
  favorited: boolean;
}

export interface CloudStoreListingDetails {
  listing: CloudStoreListing;
  metrics: CloudStoreMetrics;
  viewerState: CloudStoreViewerState;
}

export type CloudStoreReportReason =
  | "security"
  | "copyright"
  | "misleading"
  | "spam"
  | "other";

export interface CloudStorePackageFile {
  path: string;
  content: string;
}

export interface CloudStorePackage {
  schemaVersion: string;
  version: string | null;
  metadata: Record<string, unknown>;
  files: CloudStorePackageFile[];
  compatibility: string[];
  environment: string[];
  permissions: string[];
}

export interface CloudStoreDiff {
  added: string[];
  removed: string[];
  modified: string[];
  metadataChanged: boolean;
  compatibilityChanged: boolean;
  environmentChanged: boolean;
  permissionsChanged: boolean;
}

export interface CloudStoreRelease {
  id: string;
  packageVersionId: string;
  versionLabel: string | null;
  sourceRevision: string | null;
  fingerprintAlgorithm: string;
  contentFingerprint: string;
  diff: CloudStoreDiff;
  publishedAt: string | null;
}

export type CloudStoreCheckStatus = "running" | "passed" | "blocked" | "failed" | "not_available";

export interface CloudStoreChecks {
  status: CloudStoreCheckStatus;
  checkerVersion: string | null;
  warningCount: number;
  blockingCount: number;
}

export interface CloudStorePackageResponse {
  listing: CloudStoreListing;
  updateStatus: "install_available" | "update_available" | "up_to_date";
  release: CloudStoreRelease;
  package: CloudStorePackage;
  checks: CloudStoreChecks;
}

export interface CloudInstallRecord {
  id: string;
  listingId: string;
  releaseId: string;
  packageVersionId: string;
  operation: "install" | "update";
  status: "requested" | "started" | "succeeded" | "failed";
  clientPlatform: string;
  clientVersion: string;
  target: string;
  failureCode: string | null;
  failureSummary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  listingTitle?: string | null;
  versionLabel?: string | null;
  releasePublishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CloudStoreInstallIntentInput {
  listingId: string;
  operation: "install" | "update";
  idempotencyKey: string;
  expectedReleaseId: string;
  expectedFingerprint: string;
  currentFingerprint?: string;
  target: string;
}

export interface CloudStoreInstallStatusInput {
  status: "started" | "succeeded" | "failed";
  failureCode?: string;
  failureSummary?: string;
}
