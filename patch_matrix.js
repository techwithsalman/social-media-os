const fs = require('fs');

let content = fs.readFileSync('app/(dashboard)/bulk-upload/page.tsx', 'utf-8');

// 1. Add missing states
content = content.replace(
  /const \[successBanner, setSuccessBanner\] = useState\(false\);/,
  `const [successBanner, setSuccessBanner] = useState(false);
  const [scheduleGenerated, setScheduleGenerated] = useState(false);
  const [generateError, setGenerateError] = useState('');`
);

// 2. Add default time slots helper
content = content.replace(
  /const \[postsPerDay, setPostsPerDay\] = useState\(3\);/,
  `const [postsPerDay, setPostsPerDay] = useState(3);
  const defaultTimeSlotsForCount = (count: number) => {
    switch (count) {
      case 1: return ['09:00'];
      case 2: return ['09:00', '15:00'];
      case 3: return ['09:00', '12:00', '15:00'];
      case 4: return ['09:00', '12:00', '15:00', '18:00'];
      case 5: return ['09:00', '11:00', '13:00', '15:00', '18:00'];
      case 6: return ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
      default: return Array.from({ length: count }, (_, i) => \`\${String(9 + i).padStart(2, '0')}:00\`);
    }
  };
  
  const handlePostsPerDayChange = (newCount: number) => {
    setPostsPerDay(newCount);
    setTimeSlots(prev => {
      const defaults = defaultTimeSlotsForCount(newCount);
      const newSlots = [];
      for (let i = 0; i < newCount; i++) {
        newSlots.push(prev[i] || defaults[i] || '12:00');
      }
      return newSlots;
    });
    setScheduleGenerated(false);
  };
  `
);

// 3. Update handleGenerateSchedule
content = content.replace(
  /const handleGenerateSchedule = \(\) => \{[\s\S]*?\}\);[\s]*\};/,
  `const handleGenerateSchedule = () => {
    setGenerateError('');
    if (items.length === 0) {
      setGenerateError('Upload at least one media file.');
      return;
    }
    if (selectedAccountIds.length === 0) {
      setGenerateError('Select at least one social account.');
      return;
    }
    if (!startDate) {
      setGenerateError('Choose a starting date.');
      return;
    }
    if (timeSlots.slice(0, postsPerDay).some((t) => !t)) {
      setGenerateError(\`Set all \${postsPerDay} posting times.\`);
      return;
    }

    const slotsToUse = timeSlots.slice(0, postsPerDay);
    const parts = startDate.split('-');
    const yyyyStart = parseInt(parts[0], 10);
    const mmStart = parseInt(parts[1], 10) - 1;
    const ddStart = parseInt(parts[2], 10);

    setItems((prev) =>
      prev.map((item, idx) => {
        const dayOffset = Math.floor(idx / postsPerDay);
        const slotIdx = idx % postsPerDay;
        const targetDate = new Date(yyyyStart, mmStart, ddStart);
        targetDate.setDate(targetDate.getDate() + dayOffset);

        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');

        return {
          ...item,
          scheduledDate: \`\${yyyy}-\${mm}-\${dd}\`,
          scheduledTime: slotsToUse[slotIdx],
          selectedAccountIds: applyToAllVideos ? [...selectedAccountIds] : item.selectedAccountIds,
        };
      })
    );
    setScheduleGenerated(true);
  };`
);

// 4. Update the "Confirm & Schedule All" button logic
content = content.replace(
  /disabled=\{saving \|\| items\.length === 0\}/,
  `disabled={saving || items.length === 0 || !scheduleGenerated || items.some(i => i.status !== 'UPLOADED' && i.status !== 'ERROR')}`
);


// 5. Replace the UI block for left column
// We will replace everything from `<div className="flex items-center gap-3 pb-4 border-b border-[#22222a]">` down to `<button onClick={handleGenerateSchedule}`
const matrixUIPart1 = `          <div className="flex items-center gap-3 pb-4 border-b border-[#22222a]">
            <Sliders className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Automatic Matrix Config
            </h3>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-1.5">
              Posts Per Day
            </label>
            <select
              value={postsPerDay}
              onChange={(e) => handlePostsPerDayChange(parseInt(e.target.value, 10))}
              className="w-full p-3 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white"
            >
              <option value="1">1 Post / Day</option>
              <option value="2">2 Posts / Day</option>
              <option value="3">3 Posts / Day</option>
              <option value="4">4 Posts / Day</option>
              <option value="5">5 Posts / Day</option>
              <option value="6">6 Posts / Day</option>
            </select>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-1.5">
              Starting Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setScheduleGenerated(false); }}
              className="w-full p-3 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white"
            />
          </div>
          
          <div>
            <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-1.5">
              Posting Times
            </label>
            <div className="space-y-2">
              {timeSlots.slice(0, postsPerDay).map((time, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-6 text-xs text-neutral-500 font-bold text-right">{idx + 1}.</div>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => {
                      const newSlots = [...timeSlots];
                      newSlots[idx] = e.target.value;
                      setTimeSlots(newSlots);
                      setScheduleGenerated(false);
                    }}
                    className="flex-1 p-2 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-1.5">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); setScheduleGenerated(false); }}
              className="w-full p-3 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white"
            >
              <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-2.5">
              Target Networks
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto">
              {loadingAccounts ? (
                 <span className="text-neutral-500 text-sm">Loading...</span>
              ) : accounts.length === 0 ? (
                 <span className="text-neutral-500 text-sm">No accounts connected</span>
              ) : accounts.map((acc) => {
                const isChecked = selectedAccountIds.includes(acc.id);
                return (
                  <label
                    key={acc.id}
                    className={\`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs md:text-sm font-semibold cursor-pointer \${
                      isChecked
                        ? 'bg-red-950/40 border-red-500/50 text-white'
                        : 'bg-[#0e0e12]/40 border-[#22222a] text-neutral-400'
                    }\`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedAccountIds((prev) =>
                          prev.includes(acc.id) ? prev.filter((p) => p !== acc.id) : [...prev, acc.id]
                        );
                        setScheduleGenerated(false);
                      }}
                      className="rounded border-[#33333e] bg-[#0e0e12] text-red-600 w-4 h-4"
                    />
                    <PlatformIcon platform={acc.platform} size={16} className="w-4 h-4 rounded" />
                    <span className="truncate">{acc.username || acc.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          
          {generateError && (
             <div className="text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
               {generateError}
             </div>
          )}

          <button`;

const startIdx = content.indexOf('<div className="flex items-center gap-3 pb-4 border-b border-[#22222a]">');
const endIdx = content.indexOf('<button\n            onClick={handleGenerateSchedule}');
if (startIdx !== -1 && endIdx !== -1) {
  content = content.slice(0, startIdx) + matrixUIPart1 + content.slice(endIdx + 7);
}

// 6. Update Queue UI Summary
const summaryBlock = `
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#22222a]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-red-500" />
              <h3 className="text-lg md:text-xl font-bold text-white">
                Queued Content Items ({items.length})
              </h3>
            </div>
            {scheduleGenerated && items.length > 0 && (
              <div className="text-xs font-semibold text-neutral-400">
                {items.length} videos • {postsPerDay} posts/day • {Math.ceil(items.length / postsPerDay)} publishing days<br/>
                Starts {items[0]?.scheduledDate} • Timezone: {timezone}
              </div>
            )}
          </div>
`;

content = content.replace(
  /<div className="flex items-center justify-between mb-6 pb-4 border-b border-\[#22222a\]">\s*<div className="flex items-center gap-3">\s*<Layers className="w-5 h-5 text-red-500" \/>\s*<h3 className="text-lg md:text-xl font-bold text-white">\s*Queued Content Items \(\{items\.length\}\)\s*<\/h3>\s*<\/div>/,
  summaryBlock
);

// 7. Visibly show schedule date in Queued Items List
// Replace <div className="flex items-center gap-3.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#22222a]">
const queueDateTimeBlock = `
              <div className="flex flex-col md:items-end justify-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#22222a]">
                {scheduleGenerated ? (
                  <div className="flex flex-col items-start md:items-end mr-3">
                    <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      {item.scheduledDate} at {item.scheduledTime}
                    </span>
                    <span className="text-xs text-neutral-500 mt-1 font-semibold">{timezone}</span>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-1 rounded-lg mr-3">
                    Needs Schedule Matrix
                  </span>
                )}

                <div className="flex items-center gap-2.5">
`;

// It looks like there's an input for scheduledDate/Time in each row. The user wants the generate matrix to work and visible feedback.
// I will just replace the existing input elements so they are only displayed/rendered explicitly as generated text, or kept as inputs but clearly indicating generation.
// The user prompt: "Each Queued Content Item row MUST visibly show: generated date, generated time, timezone, selected account. Do not require the user to guess."
// The current code renders:
/*
              {/* Schedule time controls & delete *\/}
              <div className="flex items-center gap-3.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#22222a]">
                <div className="flex items-center gap-2.5">
                  <input type="date" ... />
                  <input type="time" ... />
                </div>
                <button onClick={...}><Trash2 /></button>
              </div>
*/

const replaceRegex = /\{\/\* Schedule time controls & delete \*\/\}[\s\S]*?<\/button>\s*<\/div>/g;

content = content.replace(replaceRegex, `
              {/* Schedule time controls & delete */}
              <div className="flex flex-col items-start md:items-end justify-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#22222a]">
                {scheduleGenerated ? (
                  <div className="flex flex-col items-start md:items-end mb-1">
                    <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      {item.scheduledDate} at {item.scheduledTime}
                    </span>
                    <span className="text-[10px] text-neutral-500 mt-1 font-semibold uppercase">{timezone}</span>
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-lg mb-1 border border-red-500/20">
                    Needs Schedule Matrix
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                    className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
`);

fs.writeFileSync('app/(dashboard)/bulk-upload/page.tsx', content);
