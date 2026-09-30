const fs = require('fs');
const path = 'app/(dashboard)/create-post/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /\{\/\* PUBLISHING ACTIONS BAR \*\/\}[\s\S]*?Processing\.\.\.' : 'Post Now'\}<\/span>\n\s*<\/button>\n\s*<\/div>\n\s*<\/div>/;

const replacement = `{/* PUBLISHING ACTIONS BAR */}
            <div className="sticky bottom-4 md:bottom-6 z-20 p-4 md:p-6 rounded-3xl bg-[#080d18]/95 backdrop-blur-xl border border-slate-800 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={publishing}
                className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
              >
                <Save className="w-4 h-4 text-slate-400" />
                <span>Save Draft</span>
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setScheduleStep('FORM');
                    setShowScheduleModal(true);
                  }}
                  disabled={publishing || selectedAccounts.length === 0}
                  className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl bg-indigo-950/70 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-500/40 transition-colors disabled:opacity-50 w-full sm:w-auto"
                >
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Schedule Post</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPublishConfirmModal(true)}
                  disabled={publishing || selectedAccounts.length === 0}
                  className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 w-full sm:w-auto"
                >
                  {publishing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{publishing ? 'Processing...' : 'Post Now'}</span>
                </button>
              </div>
            </div>`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync(path, code);
    console.log('Successfully replaced create-post action bar.');
} else {
    console.log('Failed to match create-post action bar.');
}
