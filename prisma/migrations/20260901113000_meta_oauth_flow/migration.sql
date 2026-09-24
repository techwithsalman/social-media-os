CREATE TABLE IF NOT EXISTS "MetaOAuthState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "stateHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  "consumedAt" DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS "MetaOAuthState_stateHash_key" ON "MetaOAuthState"("stateHash");
CREATE INDEX IF NOT EXISTS "MetaOAuthState_userId_workspaceId_idx" ON "MetaOAuthState"("userId", "workspaceId");
CREATE INDEX IF NOT EXISTS "MetaOAuthState_expiresAt_idx" ON "MetaOAuthState"("expiresAt");

CREATE TABLE IF NOT EXISTS "MetaOAuthSelection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "selectionTokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "accountsJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  "consumedAt" DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS "MetaOAuthSelection_selectionTokenHash_key" ON "MetaOAuthSelection"("selectionTokenHash");
CREATE INDEX IF NOT EXISTS "MetaOAuthSelection_userId_workspaceId_idx" ON "MetaOAuthSelection"("userId", "workspaceId");
CREATE INDEX IF NOT EXISTS "MetaOAuthSelection_expiresAt_idx" ON "MetaOAuthSelection"("expiresAt");
