const fs = require('fs');
const path = 'app/(dashboard)/create-post/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add states
if (!content.includes('const [pinterestBoards')) {
  content = content.replace(
    /const \[activeTab, setActiveTab\] = useState<string>\('ALL'\);/,
    `const [activeTab, setActiveTab] = useState<string>('ALL');
  const [pinterestBoards, setPinterestBoards] = useState<any[]>([]);
  const [fetchingBoards, setFetchingBoards] = useState(false);`
  );
}

// 2. Add useEffect to fetch boards
if (!content.includes('fetch(\'/api/pinterest/boards\')')) {
  content = content.replace(
    /useEffect\(\(\) => \{\n\s*async function loadAccounts\(\) \{/,
    `useEffect(() => {
    async function loadPinterestBoards() {
      try {
        setFetchingBoards(true);
        const res = await fetch('/api/pinterest/boards');
        if (res.ok) {
          const data = await res.json();
          setPinterestBoards(data.boards || []);
        }
      } catch (e) {} finally {
        setFetchingBoards(false);
      }
    }
    loadPinterestBoards();
  }, []);

  useEffect(() => {
    async function loadAccounts() {`
  );
}

// 3. Update UI to use select for boards
if (!content.includes('select\n                          value={platformSettings.PINTEREST?.boardName || \'\'}')) {
  content = content.replace(
    /<input\s*type="text"\s*value=\{platformSettings\.PINTEREST\?\.boardName \|\| ''\}\s*onChange=\{\(e\) => updatePlatformSetting\('PINTEREST', 'boardName', e\.target\.value\)\}\s*placeholder=""\s*className="[^"]*"\s*\/>/,
    `<select
                          value={platformSettings.PINTEREST?.boardName || ''}
                          onChange={(e) => updatePlatformSetting('PINTEREST', 'boardName', e.target.value)}
                          className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">-- Select a Board --</option>
                          {pinterestBoards.map(b => (
                             <option key={b.id} value={b.id}>{b.name} ({b.accountName})</option>
                          ))}
                        </select>
                        {fetchingBoards && <p className="text-xs text-indigo-400 mt-1">Loading boards...</p>}`
  );
}

fs.writeFileSync(path, content);
console.log('Patched Pinterest Board UI');
