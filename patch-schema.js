const fs = require('fs');

const path = 'prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf8');

if (!schema.includes('InstagramAutoDmRule')) {
  // Append models
  schema += `

model InstagramAutoDmRule {
  id               String    @id @default(cuid())
  workspaceId      String
  socialAccountId  String
  name             String
  mediaId          String    // The Instagram Post/Reel ID
  keyword          String
  matchType        String    @default("EXACT") // EXACT or CONTAINS
  message          String
  buttonLabel      String?
  destinationUrl   String?
  enabled          Boolean   @default(true)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  workspace        Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  socialAccount    SocialAccount @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)
  executions       InstagramAutoDmExecution[]

  @@index([workspaceId])
  @@index([socialAccountId, mediaId, enabled])
}

model InstagramAutoDmExecution {
  id               String    @id @default(cuid())
  ruleId           String
  workspaceId      String
  socialAccountId  String
  commentId        String
  commenterId      String    // Instagram username or ID of the commenter
  commentText      String
  status           String    @default("SENT") // SENT, FAILED, SKIPPED
  error            String?
  createdAt        DateTime  @default(now())
  sentAt           DateTime?

  rule             InstagramAutoDmRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  workspace        Workspace           @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  socialAccount    SocialAccount       @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)

  @@unique([ruleId, commentId])
  @@index([workspaceId])
}
`;

  // Add relations to Workspace
  schema = schema.replace(
    'paymentTransactions PaymentTransaction[]\n}',
    'paymentTransactions PaymentTransaction[]\n  instagramAutoDmRules InstagramAutoDmRule[]\n  instagramAutoDmExecutions InstagramAutoDmExecution[]\n}'
  );

  // Add relations to SocialAccount
  schema = schema.replace(
    'platformPosts     PlatformPost[]\n',
    'platformPosts     PlatformPost[]\n  instagramAutoDmRules InstagramAutoDmRule[]\n  instagramAutoDmExecutions InstagramAutoDmExecution[]\n'
  );

  fs.writeFileSync(path, schema, 'utf8');
  console.log('Schema updated.');
} else {
  console.log('Schema already updated.');
}
