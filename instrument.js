const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/create-post/page.tsx', 'utf8');

// 1. Add errorSource state
code = code.replace(
  /const \[errorMessage, setErrorMessage\] = useState\(''\);/,
  `const [errorMessage, setErrorMessage] = useState('');
  const [errorSource, setErrorSource] = useState('');`
);

// 2. Add setDiagnosticError and fetchWithDiagnostics at the top of the component
code = code.replace(
  /const \[errorMessage, setErrorMessage\] = useState\(''\);\s*const \[errorSource, setErrorSource\] = useState\(''\);/,
  `const [errorMessage, setErrorMessage] = useState('');
  const [errorSource, setErrorSource] = useState('');

  const setDiagnosticError = (msg: string, source: string) => {
    console.error('[CREATE_POST_ERROR_SOURCE]', { source, message: msg });
    setErrorMessage(msg);
    setErrorSource(source);
  };

  const fetchWithDiagnostics = async (name: string, endpoint: string, options: RequestInit = {}) => {
    console.log('[CREATE_POST_FETCH_START]', { name, method: options.method || 'GET', endpoint });
    try {
      const res = await fetch(endpoint, options);
      console.log('[CREATE_POST_FETCH_END]', { name, status: res.status, ok: res.ok });
      return res;
    } catch (err: any) {
      console.error('[CREATE_POST_FETCH_ERROR]', { name, errorName: err.name, errorMessage: err.message });
      throw err;
    }
  };

  // Add global diagnostic listeners
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[CREATE_POST_UNHANDLED_REJECTION]', {
        message: event.reason?.message || String(event.reason),
        reasonName: event.reason?.name,
        stack: event.reason?.stack?.split('\\n')[1]?.trim()
      });
    };
    const handleWindowError = (event: ErrorEvent) => {
      console.error('[CREATE_POST_WINDOW_ERROR]', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleWindowError);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleWindowError);
    };
  }, []);
`
);

// 3. Update error banner UI
code = code.replace(
  /\{errorMessage && \([\s\S]*?<AlertCircle className="w-5 h-5 shrink-0" \/>\s*<span>\{errorMessage\}<\/span>\s*<\/div>\s*<button onClick=\{\(\) => setErrorMessage\(''\)\} className="p-1 hover:text-white">\s*<X className="w-4 h-4" \/>\s*<\/button>\s*<\/div>\s*\)\}/,
  `{errorMessage && (
    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold flex items-start sm:items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
        {errorSource && <div className="text-[10px] opacity-70 ml-8 font-mono text-red-300">Source: {errorSource}</div>}
      </div>
      <button onClick={() => { setErrorMessage(''); setErrorSource(''); }} className="p-1 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  )}`
);

// 4. Replace setErrorMessage calls with setDiagnosticError
code = code.replace(/setErrorMessage\((err\.message \|\| 'Failed to load post for editing.')\)/g, `setDiagnosticError($1, 'EDIT_POST_FETCH')`);

code = code.replace(/setErrorMessage\((err\.message \|\| 'Failed to load post for duplication.')\)/g, `setDiagnosticError($1, 'DUPLICATE_POST_FETCH')`);

code = code.replace(/setErrorMessage\('File is too large\. Maximum size is 50 MB\.'\)/g, `setDiagnosticError('File is too large. Maximum size is 50 MB.', 'FORM_VALIDATION')`);

code = code.replace(/setErrorMessage\((err\.message \|\| 'Failed to upload media')\)/g, `setDiagnosticError($1, 'MEDIA_DIRECT_UPLOAD')`);

code = code.replace(/setErrorMessage\('Please enter a caption or select accounts to save draft\.'\)/g, `setDiagnosticError('Please enter a caption or select accounts to save draft.', 'FORM_VALIDATION')`);
code = code.replace(/setErrorMessage\((e\.message \|\| 'Failed to save draft')\)/g, `setDiagnosticError($1, 'SAVE_DRAFT')`);

code = code.replace(/setErrorMessage\('Please select at least one connected account\.'\)/g, `setDiagnosticError('Please select at least one connected account.', 'FORM_VALIDATION')`);
code = code.replace(/setErrorMessage\(ytError\)/g, `setDiagnosticError(ytError, 'FORM_VALIDATION')`);

code = code.replace(/setErrorMessage\((err\.message \|\| 'Error publishing post')\)/g, `setDiagnosticError($1, 'PUBLISH_POST')`);

// 5. Replace fetch() calls
code = code.replace(/const res = await fetch\('\/api\/accounts'\);/g, `const res = await fetchWithDiagnostics('LOAD_ACCOUNTS', '/api/accounts');`);

code = code.replace(/fetch\(\`\/api\/posts\/\$\{postIdToEdit\}\`\)/g, `fetchWithDiagnostics('EDIT_POST_FETCH', \`/api/posts/\${postIdToEdit}\`)`);

code = code.replace(/fetch\(\`\/api\/posts\/\$\{duplicatePostId\}\`\)/g, `fetchWithDiagnostics('DUPLICATE_POST_FETCH', \`/api/posts/\${duplicatePostId}\`)`);

code = code.replace(/const presignedRes = await fetch\('\/api\/upload\/presigned'/g, `const presignedRes = await fetchWithDiagnostics('MEDIA_PRESIGN', '/api/upload/presigned'`);

code = code.replace(/const r2Res = await fetch\(presignedData\.uploadUrl/g, `const r2Res = await fetchWithDiagnostics('MEDIA_DIRECT_UPLOAD', presignedData.uploadUrl`);

code = code.replace(/const finalizeRes = await fetch\('\/api\/upload\/finalize'/g, `const finalizeRes = await fetchWithDiagnostics('MEDIA_FINALIZE', '/api/upload/finalize'`);

code = code.replace(/const res = await fetch\(endpoint, \{/g, `const res = await fetchWithDiagnostics('PUBLISH_OR_SCHEDULE', endpoint, {`);

fs.writeFileSync('app/(dashboard)/create-post/page.tsx', code, 'utf8');
console.log('Instrumentation complete.');
