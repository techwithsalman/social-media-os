const fs = require('fs');

const igCode = fs.readFileSync('app/(dashboard)/instagram-auto-dm/create/page.tsx', 'utf8');

// Replace standard terms
let fbCode = igCode
  .replace(/CreateInstagramAutoDmPage/g, 'CreateFacebookAutoDmPage')
  .replace(/instagram-auto-dm/g, 'facebook-auto-dm')
  .replace(/Instagram/g, 'Facebook')
  .replace(/INSTAGRAM/g, 'FACEBOOK')
  .replace(/IG/g, 'FB')
  .replace(/mediaId/g, 'postId')
  .replace(/media_id/g, 'post_id')
  .replace(/media_url/g, 'media_url')
  .replace(/thumbnail_url/g, 'thumbnail_url')
  .replace(/media_type/g, 'media_type');

// Inject the Warning Box right after the <div className="border-b ..."> header block
const headerEnd = `</p>
              </div>
            </div>`;
            
const warningBox = `
            <div className="hidden sm:flex items-center gap-3">
              <Link 
                href="/facebook-auto-dm" 
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg shadow-red-900/20 hover:from-red-500 hover:to-red-400 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loading ? "Saving..." : "Save Automation"}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-500 font-medium text-sm">Testing / Meta App Review Required</h3>
              <p className="text-yellow-500/80 text-xs mt-1">
                Private Replies for Facebook require <b>pages_messaging</b> and <b>pages_read_engagement</b> Advanced Access. Ensure your Meta App is configured and approved.
              </p>
            </div>
          </div>`;

// Wait, I will just do a simpler search and replace for the warning box.
fbCode = fbCode.replace('lucide-react";', 'lucide-react";\nimport { AlertTriangle } from "lucide-react";');

fbCode = fbCode.replace(
  '<div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">',
  `<div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-500 font-medium text-sm">Testing / Meta App Review Required</h3>
              <p className="text-yellow-500/80 text-xs mt-1">
                Private Replies for Facebook require <b>pages_messaging</b> and <b>pages_read_engagement</b> Advanced Access. Ensure your Meta App is configured and approved.
              </p>
            </div>
          </div>`
);

// One API payload difference: fb Auto Dm Rule needs `pageId` populated. We can extract it from socialAccountId in API, or we can just send it from the UI.
// Wait, `pageId` in schema is just the `platformAccountId`.
// Let's modify handleSubmit to include `pageId`
const handleSub = `const payload = { ...formData };`;
const handleSubNew = `const payload = { ...formData };
      const selectedAccountFull = accounts.find(a => a.id === formData.socialAccountId);
      if (selectedAccountFull) {
         payload.pageId = selectedAccountFull.platformAccountId;
      }`;
fbCode = fbCode.replace(handleSub, handleSubNew);

fs.writeFileSync('app/(dashboard)/facebook-auto-dm/create/page.tsx', fbCode);
console.log('Migrated Facebook create page UX');
