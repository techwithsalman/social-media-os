const fs = require('fs');

let content = fs.readFileSync('app/api/posts/bulk/route.ts', 'utf-8');

// The code has:
// status: 'SCHEDULED',
// scheduledFor: new Date(scheduledFor),
// errorMessage: null,

content = content.replace(
  /status:\s*'SCHEDULED',\s*scheduledFor:\s*new\s*Date\(scheduledFor\),\s*errorMessage:\s*null,/g,
  `status: 'SCHEDULED',`
);

// We should also check for workspace ownership of the social accounts and media assets.
// Let's add that validation before the transaction.
const validationBlock = `
    // Validate that all accounts belong to the workspace
    const accountIds = new Set(items.flatMap(i => i.platformSettings.map(p => p.socialAccountId)));
    const accounts = await prisma.socialAccount.findMany({
      where: {
        id: { in: Array.from(accountIds) },
        workspaceId: session.workspaceId
      }
    });

    if (accounts.length !== accountIds.size) {
      return NextResponse.json({ error: 'One or more selected social accounts are invalid or do not belong to this workspace.' }, { status: 400 });
    }

    // Validate that all media assets belong to the workspace
    const mediaIds = Array.from(new Set(items.map(i => i.mediaAssetId).filter(Boolean)));
    if (mediaIds.length > 0) {
      const media = await prisma.mediaAsset.findMany({
        where: {
          id: { in: mediaIds },
          workspaceId: session.workspaceId
        }
      });
      if (media.length !== mediaIds.length) {
        return NextResponse.json({ error: 'One or more media assets are invalid or do not belong to this workspace.' }, { status: 400 });
      }
    }
`;

// Insert the validation block right after checking if items is array.
content = content.replace(
  /if \(\!Array\.isArray\(items\) \|\| items\.length === 0\) \{\s*return NextResponse\.json\(\{ error: 'No items provided' \}, \{ status: 400 \}\);\s*\}/,
  `if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }
${validationBlock}`
);

fs.writeFileSync('app/api/posts/bulk/route.ts', content);
