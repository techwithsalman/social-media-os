const fs = require('fs');

let content = fs.readFileSync('app/(dashboard)/bulk-upload/page.tsx', 'utf-8');
content = content.replace(/\r\n/g, '\n'); // Normalize!

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

fs.writeFileSync('app/(dashboard)/bulk-upload/page.tsx', content);
