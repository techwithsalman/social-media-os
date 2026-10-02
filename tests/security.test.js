const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Security Posture Verification', () => {
  test('Super Admin endpoints strictly enforce requireSuperAdmin()', () => {
    const dir = path.join(__dirname, '../app/api/super-admin');
    const walk = (d) => {
      fs.readdirSync(d).forEach(f => {
        const full = path.join(d, f);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (f.endsWith('route.ts')) {
          const content = fs.readFileSync(full, 'utf8');
          assert.ok(content.includes('requireSuperAdmin()'), 'route is missing requireSuperAdmin()');
        }
      });
    };
    walk(dir);
  });

  test('Billing endpoints assert limits server-side', () => {
    const connectRoute = fs.readFileSync(path.join(__dirname, '../app/api/accounts/mock-connect/route.ts'), 'utf8');
    assert.ok(connectRoute.includes('assertCanConnectSocialAccount(') || connectRoute.includes('assertSessionMatchesRow'), 'Account connect is missing limit checks');
    
    const postRoute = fs.readFileSync(path.join(__dirname, '../app/api/posts/[id]/publish/route.ts'), 'utf8');
    assert.ok(postRoute.includes('assertCanCreateBillablePost('), 'Post publish is missing limit checks');
  });

  test('CSRF Utility is applied to state-changing routes', () => {
    const postRoute = fs.readFileSync(path.join(__dirname, '../app/api/posts/[id]/route.ts'), 'utf8');
    assert.ok(postRoute.includes('verifyCsrfOrigin'), 'Posts API missing CSRF check');
  });

  test('No fallback super admin email exists in auth.ts', () => {
    const authTs = fs.readFileSync(path.join(__dirname, '../lib/auth.ts'), 'utf8');
    assert.ok(!authTs.includes("'salmandesigner24@gmail.com'"), 'Fallback admin email still exists!');
  });
  
  test('OAuth providers enforce Session UserId bounds', () => {
    const ytoauth = fs.readFileSync(path.join(__dirname, '../lib/youtube-oauth.ts'), 'utf8');
    assert.ok(ytoauth.includes('stateRecord.userId !== session.userId'), 'YouTube OAuth lacks session bound');
    
    const xoauth = fs.readFileSync(path.join(__dirname, '../lib/x-oauth.ts'), 'utf8');
    assert.ok(xoauth.includes('row.userId !== session.userId'), 'X OAuth lacks session bound');
    
    const metaOauth = fs.readFileSync(path.join(__dirname, '../lib/meta-oauth.ts'), 'utf8');
    assert.ok(metaOauth.includes('assertSessionMatchesRow'), 'Meta OAuth lacks session bound');
    
    const tiktokCallback = fs.readFileSync(path.join(__dirname, '../app/tiktok/callback/route.ts'), 'utf8');
    assert.ok(tiktokCallback.includes('tokenResult.userId !== session.userId'), 'TikTok OAuth lacks session bound');
  });
});
