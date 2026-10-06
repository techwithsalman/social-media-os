const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/create-post/page.tsx', 'utf8');

code = code.replace(
  /\} catch \(err: any\) \{\n\s*console\.error\('Upload error:', err\);\n\s*setDiagnosticError\(err\.message \|\| 'Failed to upload media', 'MEDIA_DIRECT_UPLOAD'\);\n\s*\} finally \{/,
  `} catch (err: any) {
      console.error('Upload error:', err);
      let errMsg = err.message || 'Failed to upload media';
      if (errMsg === 'Failed to fetch') {
        errMsg = 'Media upload failed. Please try again.';
        console.error('[CORS/Network Error] Direct media upload blocked by storage CORS policy.');
      }
      setDiagnosticError(errMsg, 'MEDIA_DIRECT_UPLOAD');
    } finally {`
);

fs.writeFileSync('app/(dashboard)/create-post/page.tsx', code, 'utf8');
console.log('Error message patched.');
