import http from 'http';

async function testLiveFlow() {
  console.log('==============================================');
  console.log('🌐 TESTING LIVE SOCIAL MEDIA OS ON LOCALHOST:3000');
  console.log('==============================================\n');

  const BASE_URL = 'http://localhost:3000';
  let cookie = '';

  // Helper fetch with cookies
  async function apiFetch(path: string, options: any = {}) {
    const headers = options.headers || {};
    if (cookie) headers['Cookie'] = cookie;
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      cookie = setCookie.split(';')[0];
    }

    let data;
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }
    return { status: res.status, ok: res.ok, data };
  }

  // 1. Sign Up Test
  console.log('1. Testing User Sign Up Flow (/api/auth/signup)...');
  const testUser = {
    firstName: 'Sarah',
    lastName: 'Connor',
    email: `sarah.${Date.now()}@skynet-studio.dev`,
    password: 'password123',
    confirmPassword: 'password123',
  };

  const signupRes = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(testUser),
  });

  if (!signupRes.ok) throw new Error(`Sign Up failed: ${JSON.stringify(signupRes.data)}`);
  console.log(`   ✅ User Registered: ${testUser.email} (Workspace ID: ${signupRes.data.workspace.id})`);
  console.log(`   ✅ Session Cookie captured: ${cookie.substring(0, 30)}...`);

  // 2. Login Flow
  console.log('\n2. Testing User Login Flow (/api/auth/login)...');
  const loginRes = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testUser.email,
      password: testUser.password,
      rememberMe: true,
    }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
  console.log(`   ✅ Logged in successfully as: ${loginRes.data.user.email}`);

  // 3. Connect Demo Social Accounts
  console.log('\n3. Testing Social Accounts Connection in MOCK_API_MODE (/api/accounts/mock-connect)...');
  const platforms = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'YOUTUBE', 'X'];
  const connectedAccounts: any[] = [];

  for (const plat of platforms) {
    const connRes = await apiFetch('/api/accounts/mock-connect', {
      method: 'POST',
      body: JSON.stringify({ platform: plat }),
    });
    if (!connRes.ok) throw new Error(`Connecting ${plat} failed: ${JSON.stringify(connRes.data)}`);
    connectedAccounts.push(connRes.data.account);
    console.log(`   ✅ Connected [${plat}]: @${connRes.data.account.username} (${connRes.data.account.name})`);
  }

  // 4. Test Media Upload
  console.log('\n4. Testing Media Upload (/api/upload)...');
  const sampleBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(sampleBase64Image, 'base64');
  const blob = new Blob([buffer], { type: 'image/png' });

  const formData = new FormData();
  formData.append('file', blob, 'brand-announcement.png');

  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: formData,
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
  console.log(`   ✅ Media Uploaded: ${uploadData.media.originalName} -> ${uploadData.media.url}`);

  // 5. Test Create Post with Caption Sync & Independent Customizations
  console.log('\n5. Testing Master Caption & Platform Customization (/api/posts)...');
  const masterCaption = 'Social Media OS is the ultimate command center for modern creators! 🚀';

  const platformSettings = connectedAccounts.map((acc) => {
    let customCaption = masterCaption;
    let hashtags = '#branding #creator #socialos';
    let contentType = 'POST';
    let metadata: any = {};

    if (acc.platform === 'YOUTUBE') {
      contentType = 'VIDEO';
      metadata = {
        youtubeTitle: 'Social Media OS Official Launch Walkthrough',
        visibility: 'PUBLIC',
      };
    } else if (acc.platform === 'INSTAGRAM') {
      contentType = 'REEL';
      hashtags = '#viral #reel #trending';
      metadata = { allowComments: true, hideLikes: false };
    } else if (acc.platform === 'TIKTOK') {
      contentType = 'VIDEO';
      metadata = { allowComments: true, allowDuet: true, allowStitch: true };
    } else if (acc.platform === 'X') {
      customCaption = `${masterCaption.slice(0, 200)} #socialos #launch`;
    }

    return {
      socialAccountId: acc.id,
      platform: acc.platform,
      customCaption,
      hashtags,
      contentType,
      visibility: 'PUBLIC',
      metadata,
    };
  });

  // Schedule for 3 days in future
  const scheduleDate = new Date();
  scheduleDate.setDate(scheduleDate.getDate() + 3);
  scheduleDate.setHours(19, 0, 0, 0);

  const schedulePostRes = await apiFetch('/api/posts', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Social Media OS Official Launch Walkthrough',
      masterCaption,
      mediaAssetId: uploadData.media.id,
      scheduledFor: scheduleDate.toISOString(),
      timezone: 'Asia/Karachi',
      publishNow: false,
      platformSettings,
    }),
  });

  if (!schedulePostRes.ok) throw new Error(`Schedule post failed: ${JSON.stringify(schedulePostRes.data)}`);
  const scheduledPost = schedulePostRes.data.post;
  console.log(`   ✅ Post Scheduled: "${scheduledPost.masterCaption}"`);
  console.log(`   ✅ Scheduled For: ${scheduledPost.scheduledFor} (${scheduledPost.timezone})`);
  console.log(`   ✅ Target Channels: ${scheduledPost.platformPosts.length} platforms`);

  // 6. Test Instant Publish Flow
  console.log('\n6. Testing Instant Broadcast Execution (/api/posts/[id]/publish)...');
  const publishRes = await apiFetch(`/api/posts/${scheduledPost.id}/publish`, {
    method: 'POST',
  });

  if (!publishRes.ok) throw new Error(`Publish failed: ${JSON.stringify(publishRes.data)}`);
  console.log(`   ✅ Overall Publish Status: ${publishRes.data.result.overallStatus}`);
  publishRes.data.result.platformResults.forEach((res: any) => {
    console.log(`      - [${res.platform}] Status: ${res.status} -> ${res.externalPostUrl}`);
  });

  // 7. Verify Calendar & Scheduled Posts Query
  console.log('\n7. Testing Feed & Calendar Queries (/api/posts)...');
  const allPostsRes = await apiFetch('/api/posts');
  if (!allPostsRes.ok) throw new Error(`Fetch posts failed: ${JSON.stringify(allPostsRes.data)}`);
  console.log(`   ✅ Content items in database: ${allPostsRes.data.posts.length}`);

  // 8. Test Demo Seed endpoint (/api/seed)
  console.log('\n8. Testing Fast Demo Data Seed Route (/api/seed)...');
  const seedRes = await apiFetch('/api/seed', { method: 'POST' });
  if (!seedRes.ok) throw new Error(`Seed failed: ${JSON.stringify(seedRes.data)}`);
  console.log(`   ✅ Demo Seed Response: ${seedRes.data.message}`);

  // 9. Verify Notifications
  console.log('\n9. Testing Notification System (/api/notifications)...');
  const notifRes = await apiFetch('/api/notifications');
  if (!notifRes.ok) throw new Error(`Notifications failed: ${JSON.stringify(notifRes.data)}`);
  console.log(`   ✅ In-App Notifications: ${notifRes.data.notifications.length} (Unread: ${notifRes.data.unreadCount})`);

  console.log('\n==============================================');
  console.log('🎉 LIVE LOCAL DEV SERVER FULL WORKFLOW VERIFIED!');
  console.log('==============================================\n');
}

testLiveFlow().catch((e) => {
  console.error('❌ Live Flow Verification Failed:', e);
  process.exit(1);
});
