const fs = require('fs');

function patchDashboard() {
  const file = 'app/(dashboard)/instagram-auto-dm/page.tsx';
  let code = fs.readFileSync(file, 'utf8');

  // Replace fetchAutomations definition
  code = code.replace(
    /const fetchAutomations = async \(\) => \{\s*try \{\s*const res = await fetch\("\/api\/instagram-auto-dm"\);/,
    `const fetchAutomations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/instagram-auto-dm");`
  );

  // Replace finally block
  code = code.replace(
    /\} catch \(error\) \{\s*console\.error\("Failed to fetch automations", error\);\s*\} finally \{\s*setLoading\(false\);\s*\}/,
    `} catch (error) {
      console.error("Failed to fetch automations", error);
    } finally {
      if (!silent) setLoading(false);
    }`
  );

  // Replace useEffect fetchAutomations call
  code = code.replace(
    /fetchAutomations\(\);\s*\}, \[searchParams\]\);/,
    `fetchAutomations();
    
    // Add lightweight client-side polling every 5s
    const interval = setInterval(() => {
      fetchAutomations(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [searchParams]);`
  );

  fs.writeFileSync(file, code);
}

function patchActivity() {
  const file = 'app/(dashboard)/instagram-auto-dm/activity/page.tsx';
  let code = fs.readFileSync(file, 'utf8');

  // Replace fetchActivities definition
  code = code.replace(
    /const fetchActivities = async \(\) => \{\s*setLoading\(true\);/,
    `const fetchActivities = async (silent = false) => {
    if (!silent) setLoading(true);`
  );

  // Replace finally block
  code = code.replace(
    /\} finally \{\s*setLoading\(false\);\s*\}/,
    `} finally {
      if (!silent) setLoading(false);
    }`
  );

  // Replace useEffect
  code = code.replace(
    /useEffect\(\(\) => \{\s*fetchActivities\(\);\s*\}, \[\]\);/,
    `useEffect(() => {
    fetchActivities();
    
    const interval = setInterval(() => {
      fetchActivities(true);
    }, 5000);

    return () => clearInterval(interval);
  }, []);`
  );

  fs.writeFileSync(file, code);
}

patchDashboard();
patchActivity();
