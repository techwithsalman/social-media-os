const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

if (!schema.includes('FacebookAutoDmRule')) {
  const newModels = "\nmodel FacebookAutoDmRule {\n  id              String   @id @default(cuid())\n  workspaceId     String\n  socialAccountId String\n  pageId          String\n  postId          String\n  name            String\n  keyword         String\n  matchType       String   @default(\"EXACT\")\n  message         String\n  buttonLabel     String?\n  destinationUrl  String?\n  enabled         Boolean  @default(true)\n  createdAt       DateTime @default(now())\n  updatedAt       DateTime @updatedAt\n\n  workspace       Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)\n  socialAccount   SocialAccount @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)\n  executions      FacebookAutoDmExecution[]\n\n  @@index([workspaceId])\n  @@index([socialAccountId, postId, enabled])\n}\n\nmodel FacebookAutoDmExecution {\n  id              String   @id @default(cuid())\n  ruleId          String\n  workspaceId     String\n  socialAccountId String\n  commentId       String\n  commenterId     String\n  commentText     String\n  status          String   @default(\"SENT\")\n  error           String?\n  createdAt       DateTime @default(now())\n  sentAt          DateTime?\n\n  rule            FacebookAutoDmRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)\n  workspace       Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)\n  socialAccount   SocialAccount      @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)\n\n  @@index([workspaceId])\n  @@unique([ruleId, commentId])\n}\n";
  
  schema += newModels;
  
  // Also need to add relations to Workspace and SocialAccount models
  schema = schema.replace(/instagramAutoDmExecutions InstagramAutoDmExecution\[\]/, 'instagramAutoDmExecutions InstagramAutoDmExecution[]\n  facebookAutoDmRules FacebookAutoDmRule[]\n  facebookAutoDmExecutions FacebookAutoDmExecution[]');
  
  schema = schema.replace(/instagramAutoDmExecutions InstagramAutoDmExecution\[\]/, 'instagramAutoDmExecutions InstagramAutoDmExecution[]\n  facebookAutoDmRules FacebookAutoDmRule[]\n  facebookAutoDmExecutions FacebookAutoDmExecution[]');
  
  fs.writeFileSync('prisma/schema.prisma', schema);
  console.log('Schema updated.');
}
