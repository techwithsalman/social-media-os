const fs = require('fs');

function patchFile(path, regex, replacement) {
  let code = fs.readFileSync(path, 'utf8');
  code = code.replace(regex, replacement);
  fs.writeFileSync(path, code);
}

// 1. Patch instagram-oauth.ts
const igReplacement = `  if (existing) {
    await prisma.socialAccount.update({
      where: { id: existing.id },
      data: {
        name: profile.username,
        username: profile.username,
        status: 'CONNECTED',
        token: {
          update: {
            accessToken: encryptToken(profile.accessToken),
            expiresAt: profile.expiresAt ? new Date(profile.expiresAt) : null,
          }
        }
      }
    });
    return;
  }`;

patchFile(
  'lib/instagram-oauth.ts',
  /if \(existing\) \{[\s\S]*?throw new InstagramOAuthError\('ACCOUNT_EXISTS'[\s\S]*?\}\n/,
  igReplacement + "\n"
);

// 2. Patch youtube-oauth.ts
const ytReplacement = `  if (existing) {
    await prisma.socialAccount.update({
      where: { id: existing.id },
      data: {
        name: channelInfo.title,
        username: channelInfo.customUrl || channelInfo.title,
        profileImageUrl: channelInfo.thumbnailUrl,
        status: 'CONNECTED',
        token: {
          update: {
            accessToken: encryptToken(tokenData.accessToken),
            refreshToken: tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : undefined,
            expiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
          }
        }
      }
    });
    return;
  }`;

patchFile(
  'lib/youtube-oauth.ts',
  /if \(existing\) \{[\s\S]*?throw new YouTubeOAuthError\('ACCOUNT_EXISTS'[\s\S]*?\}\n/,
  ytReplacement + "\n"
);
