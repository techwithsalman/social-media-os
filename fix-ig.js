const fs = require('fs');
const path = 'integrations/instagram/index.ts';
let code = fs.readFileSync(path, 'utf8');

const replacement = `        if (!isReady) {
          console.log(\`[IG PUBLISH] STAGE C: Container still processing after 12s. Deferring to async status check.\`);
          return {
            success: true,
            status: 'PROCESSING',
            externalPostId: container.data.id,
            externalPostUrl: '',
            statusMessage: 'Instagram is processing your video. Publishing will complete automatically.',
          };
        }`;

// Using a robust regex to replace the exact block
const targetRegex = /        if \(!isReady\) \{\r?\n\s*console\.error\(`\[IG PUBLISH\] STAGE C FAILED: Container processing timed out\.`\);\r?\n\s*return \{\r?\n\s*success: false,\r?\n\s*errorCode: 'IG_CONTAINER_TIMEOUT',\r?\n\s*errorMessage: 'Instagram video processing timed out after 90 seconds\. Please try again\.',\r?\n\s*\};\r?\n\s*\}/;

if (targetRegex.test(code)) {
    code = code.replace(targetRegex, replacement);
    fs.writeFileSync(path, code);
    console.log("Successfully replaced timeout block.");
} else {
    console.log("Failed to match timeout block using regex.");
}
