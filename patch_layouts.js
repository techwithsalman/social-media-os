const fs = require('fs');

function processPage(filepath, newTitle) {
  if (!fs.existsSync(filepath)) return;
  let code = fs.readFileSync(filepath, 'utf8');

  // Fix AppLayout title
  // It could have props spread or different formats.
  if (newTitle) {
    // If it's a simple string:
    if (newTitle === 'Create & Schedule Post') {
      code = code.replace(
        `'Create & Schedule Post / Compose, schedule and publish to multiple platforms'`,
        `'Create & Schedule Post'`
      );
    } else {
      code = code.replace(/<AppLayout[^>]*title="[^"]*"[^>]*>/, (match) => {
        return match.replace(/title="[^"]*"/, `title="${newTitle}"`);
      });
      // Handle missing title
      if (!code.match(/<AppLayout[^>]*title=/)) {
        code = code.replace('<AppLayout', `<AppLayout title="${newTitle}"`);
      }
    }
  }

  // Inject wrapper right after <AppLayout ... >
  if (!code.includes('className="max-w-[1440px] w-full mx-auto"')) {
    code = code.replace(/(<AppLayout[^>]*>)/, `$1\n      <div className="max-w-[1440px] w-full mx-auto">`);
    code = code.replace(/(<\/AppLayout>)/, `      </div>\n    $1`);
  }

  fs.writeFileSync(filepath, code, 'utf8');
  console.log(`Processed ${filepath}`);
}

processPage('app/(dashboard)/create-post/page.tsx', 'Create & Schedule Post');
processPage('app/(dashboard)/bulk-upload/page.tsx', 'Bulk Upload & Automatic Schedule Generator');
processPage('app/(dashboard)/calendar/page.tsx', 'Content Calendar');
processPage('app/(dashboard)/scheduled/page.tsx', 'Scheduled Posts');
processPage('app/(dashboard)/published/page.tsx', 'Published Posts History');
processPage('app/(dashboard)/accounts/page.tsx', 'Connected Social Channels');
processPage('app/(dashboard)/analytics/page.tsx', 'Performance & Analytics');
