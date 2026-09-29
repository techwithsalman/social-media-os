const fs = require('fs');
const file = 'app/(dashboard)/create-post/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/\s*Reset the form fields underneath the success banner\s*setMasterCaption\(''\);\s*setMediaFile\(null\);\s*setPlatformSettings\(createDefaultPlatformSettings\(\)\);\s*setSyncCaptions\(true\);\s*setPublishSuccess\(data\.publishResult\);/;

const replacement = `setPublishSuccess(data.publishResult);

        if (data.publishResult?.overallStatus !== 'FAILED') {
          // Reset the form fields underneath the success banner
          setMasterCaption('');
          setMediaFile(null);
          setPlatformSettings(createDefaultPlatformSettings());
          setSyncCaptions(true);
        }`;

if (regex.test(content)) {
  fs.writeFileSync(file, content.replace(regex, replacement));
  console.log('Replaced successfully');
} else {
  console.error('Target not found');
}
