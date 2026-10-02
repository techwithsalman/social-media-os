const fs = require('fs');
const path = 'lib/auth.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /if \(!user\) \{\s*try \{\s*cookies\(\)\.delete\(AUTH_COOKIE_NAME\);\s*\} catch \(e\) \{\}\s*return null;\s*\}/m;

const replacement = `if (!user) {
      try {
        cookies().delete(AUTH_COOKIE_NAME);
      } catch (e) {}
      return null;
    }

    const targetSuperAdmin = process.env.SUPER_ADMIN_EMAIL || 'salmandesigner24@gmail.com';
    if (user.email === targetSuperAdmin && user.systemRole !== 'SUPER_ADMIN') {
      await prisma.user.update({
        where: { id: user.id },
        data: { systemRole: 'SUPER_ADMIN' }
      });
      user.systemRole = 'SUPER_ADMIN';
    }`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched getCurrentUser for auto-promotion');
} else {
  console.log('Could not find injection point');
}
