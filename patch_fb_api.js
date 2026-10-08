const fs = require('fs');

let content = fs.readFileSync('app/api/facebook-auto-dm/route.ts', 'utf8');

const oldCheck = `    const { name, socialAccountId, postId, keyword, matchType, message } = body;

    if (!name || !socialAccountId || !keyword || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }`;

const newCheck = `    const { name, socialAccountId, postId, keyword, matchType, message, buttonLabel, destinationUrl, enabled } = body;

    if (!name || !socialAccountId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    if (matchType !== 'ANY_COMMENT' && !keyword) {
      return NextResponse.json({ error: 'Keyword is required for this match type' }, { status: 400 });
    }`;

content = content.replace(oldCheck, newCheck);

const oldCreate = `      data: {
        workspaceId: session.workspaceId,
        socialAccountId,
        pageId: socialAccount.platformAccountId,
        postId: postId || 'ANY',
        name,
        keyword,
        matchType: matchType || 'EXACT',
        message,
        enabled: true,
      },`;

const newCreate = `      data: {
        workspaceId: session.workspaceId,
        socialAccountId,
        pageId: socialAccount.platformAccountId,
        postId: postId || 'ANY',
        name,
        keyword: keyword || 'ANY',
        matchType: matchType || 'EXACT',
        message,
        buttonLabel,
        destinationUrl,
        enabled: enabled !== undefined ? enabled : true,
      },`;

content = content.replace(oldCreate, newCreate);

fs.writeFileSync('app/api/facebook-auto-dm/route.ts', content);
console.log('Fixed API validation');
