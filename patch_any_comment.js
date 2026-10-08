import fs from 'fs';

function updateUI() {
  const file = 'app/(dashboard)/instagram-auto-dm/create/page.tsx';
  let code = fs.readFileSync(file, 'utf8');

  // Validate function
  code = code.replace(
    /if \(!formData\.keyword\.trim\(\)\) newErrors\.keyword = "Trigger Keyword is required\.";/,
    `if (formData.matchType !== 'ANY_COMMENT' && !formData.keyword.trim()) newErrors.keyword = "Trigger Keyword is required.";`
  );

  // Submit payload
  code = code.replace(
    /const payload = \{ \.\.\.formData \};/,
    `const payload = { ...formData };
      if (payload.matchType === 'ANY_COMMENT') {
        payload.keyword = 'ANY';
      }`
  );

  // Insert trigger mode UI and hide keyword fields if ANY_COMMENT
  const keywordSectionRegex = /<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;
  
  const keywordUIReplacement = `<div className="pt-2 border-t border-zinc-800/60 mt-4 mb-4">
                    <label className="block text-sm font-medium text-zinc-300 mb-3">Trigger Mode</label>
                    <div className="flex bg-black p-1 rounded-lg border border-zinc-800 mb-6">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, matchType: 'EXACT' }))}
                        className={\`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors \${formData.matchType !== 'ANY_COMMENT' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}\`}
                      >
                        Keyword Match
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, matchType: 'ANY_COMMENT', keyword: 'ANY' }))}
                        className={\`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors \${formData.matchType === 'ANY_COMMENT' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}\`}
                      >
                        Any Comment
                      </button>
                    </div>
                  </div>

                  {formData.matchType === 'ANY_COMMENT' ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-2">
                      <p className="text-sm font-medium text-red-400 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Any comment on the selected post will trigger this automation.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Trigger Keyword</label>
                        <input
                          type="text"
                          name="keyword"
                          value={formData.keyword}
                          onChange={handleChange}
                          placeholder="e.g., LINK"
                          className={\`w-full bg-black border \${errors.keyword ? 'border-red-500' : 'border-zinc-800'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all\`}
                        />
                        {errors.keyword && <p className="text-red-500 text-xs mt-1.5">{errors.keyword}</p>}
                      </div>
    
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Match Type</label>
                        <select
                          name="matchType"
                          value={formData.matchType}
                          onChange={handleChange}
                          className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none"
                        >
                          <option value="EXACT">Exact Match</option>
                          <option value="CONTAINS">Contains Keyword</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>`;
              
  code = code.replace(keywordSectionRegex, keywordUIReplacement);

  // Update summary panel
  code = code.replace(
    /When someone comments <span className="text-white font-mono bg-zinc-800 px-1\.5 py-0\.5 rounded text-xs">\{formData\.keyword \|\| "\.\.\."\}<\/span>/,
    `{formData.matchType === 'ANY_COMMENT' ? (
                        <span>When someone comments <span className="text-white font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-xs">anything</span></span>
                      ) : (
                        <span>When someone comments <span className="text-white font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{formData.keyword || "..."}</span></span>
                      )}`
  );

  fs.writeFileSync(file, code);
}

function updateWebhook() {
  const file = 'app/api/webhooks/instagram/route.ts';
  let code = fs.readFileSync(file, 'utf8');

  const matchRegex = /const isMatch = rule\.matchType === 'EXACT'[\s\S]*?console\.log\('\[IG_WEBHOOK\] KEYWORD_MATCH=' \+ isMatch\);/;
  
  const matchReplacement = `const isMatch = rule.matchType === 'ANY_COMMENT'
      ? true
      : rule.matchType === 'EXACT'
        ? text.trim().toLowerCase() === rule.keyword.toLowerCase()
        : text.toLowerCase().includes(rule.keyword.toLowerCase());

    console.log('[IG_WEBHOOK] TRIGGER_MODE=' + rule.matchType);
    if (rule.matchType === 'ANY_COMMENT') {
      console.log('[IG_WEBHOOK] ANY_COMMENT_MATCH=true');
    } else {
      console.log('[IG_WEBHOOK] KEYWORD_MATCH=' + isMatch);
    }`;

  code = code.replace(matchRegex, matchReplacement);
  
  fs.writeFileSync(file, code);
}

updateUI();
updateWebhook();
