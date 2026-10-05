const fs = require('fs');
const path = require('path');

function applyThemeDashboard() {
  const filePath = 'app/(dashboard)/dashboard/page.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  // Hero Card replacement
  content = content.replace(
    /<div className="p-8 md:p-10 rounded-3xl bg-gradient-to-tr from-\[#140808\] via-\[#1a0a0a\] to-\[#1f0c0c\] border border-\[#2a1010\] shadow-xl relative overflow-hidden mb-8">[\s\S]*?{connectedAccountsCount \+ scheduledPostsCount === 0 && \(/m,
    `<div className="p-8 md:p-10 rounded-[32px] bg-gradient-to-r from-[#170505] via-[#4d070b] to-[#120202] border border-red-500/20 shadow-[0_0_40px_rgba(220,38,38,0.15)] relative overflow-hidden mb-8 group">
        
        {/* Decorative Abstract Glow Shapes */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-red-600/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="absolute top-0 right-0 w-3/4 h-full bg-gradient-to-l from-red-600/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-6 shadow-inner">
              <Sparkles className="w-3.5 h-3.5" />
              Unified Command Center
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 drop-shadow-lg leading-tight">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-400 drop-shadow-md">{userFirstName}!</span>
            </h1>
            
            <p className="text-base md:text-lg text-neutral-300 font-medium leading-relaxed drop-shadow">
              <span className="text-white font-bold">One Content &rarr; Every Platform.</span> Compose once and effortlessly broadcast across Instagram, Facebook, TikTok, LinkedIn, YouTube, X, Pinterest, and Snapchat from a single operating system.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 shrink-0 mt-4 md:mt-0">
            <Link
              href="/create-post"
              className="flex items-center gap-2.5 px-6 py-3.5 text-sm font-black rounded-2xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              <span>Compose Post</span>
            </Link>
            <Link
              href="/bulk-upload"
              className="flex items-center gap-2 px-6 py-3.5 text-sm font-bold rounded-2xl bg-[#140808]/80 hover:bg-[#1a0a0a] text-neutral-300 hover:text-white border border-[#2a1010] shadow-lg backdrop-blur-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Layers className="w-5 h-5 text-red-500" />
              <span>Bulk Upload</span>
            </Link>
          </div>
        </div>
      </div>

      {connectedAccountsCount + scheduledPostsCount === 0 && (`
  );

  // Stat Cards replacement
  const statsRegex = new RegExp('<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 md:gap-6 mb-12">[\\s\\S]*?\\{\\/\\* Connected Accounts Section \\*\\/\\}', 'm');
  const newStats = `<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5 mb-12">
        
        {/* Connected Card */}
        <div className="relative overflow-hidden p-5 md:p-6 rounded-2xl bg-[#0e0e12] border border-[#22222a] shadow-lg hover:border-[#33333e] transition-all flex flex-col justify-between min-h-[140px] group">
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-red-600/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-red-600/30 transition-all duration-500" />
          <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-tl from-red-500/10 to-transparent opacity-50 pointer-events-none rounded-br-2xl" />
          <div className="relative z-10 flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 shadow-inner">
              <Share2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
              Connected
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-3xl md:text-4xl font-black text-white drop-shadow-md">
              {connectedAccountsCount}
            </p>
            <p className="text-xs text-neutral-500 mt-1 font-medium">Active channels</p>
          </div>
        </div>

        {/* Scheduled Card */}
        <div className="relative overflow-hidden p-5 md:p-6 rounded-2xl bg-[#0e0e12] border border-[#22222a] shadow-lg hover:border-[#33333e] transition-all flex flex-col justify-between min-h-[140px] group">
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-amber-500/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-amber-500/30 transition-all duration-500" />
          <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-tl from-amber-500/10 to-transparent opacity-50 pointer-events-none rounded-br-2xl" />
          <div className="relative z-10 flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
              Scheduled
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-3xl md:text-4xl font-black text-white drop-shadow-md">
              {scheduledPostsCount}
            </p>
            <p className="text-xs text-neutral-500 mt-1 font-medium">Ready in queue</p>
          </div>
        </div>

        {/* Published Card */}
        <div className="relative overflow-hidden p-5 md:p-6 rounded-2xl bg-[#0e0e12] border border-[#22222a] shadow-lg hover:border-[#33333e] transition-all flex flex-col justify-between min-h-[140px] group">
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-emerald-500/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-emerald-500/30 transition-all duration-500" />
          <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-tl from-emerald-500/10 to-transparent opacity-50 pointer-events-none rounded-br-2xl" />
          <div className="relative z-10 flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-inner">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
              Published
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-3xl md:text-4xl font-black text-white drop-shadow-md">
              {publishedPostsCount}
            </p>
            <p className="text-xs text-neutral-500 mt-1 font-medium">Live broadcasts</p>
          </div>
        </div>

        {/* Failed Card */}
        <div className="relative overflow-hidden p-5 md:p-6 rounded-2xl bg-[#0e0e12] border border-[#22222a] shadow-lg hover:border-[#33333e] transition-all flex flex-col justify-between min-h-[140px] group">
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-red-600/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-red-600/30 transition-all duration-500" />
          <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-tl from-red-600/10 to-transparent opacity-50 pointer-events-none rounded-br-2xl" />
          <div className="relative z-10 flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 shadow-inner">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
              Failed
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-3xl md:text-4xl font-black text-white drop-shadow-md">
              {failedPostsCount}
            </p>
            <p className="text-xs text-neutral-500 mt-1 font-medium">Needs attention</p>
          </div>
        </div>

        {/* Drafts Card */}
        <div className="col-span-2 sm:col-span-1 relative overflow-hidden p-5 md:p-6 rounded-2xl bg-[#0e0e12] border border-[#22222a] shadow-lg hover:border-[#33333e] transition-all flex flex-col justify-between min-h-[140px] group">
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-neutral-600/20 blur-[30px] rounded-full pointer-events-none group-hover:bg-neutral-600/30 transition-all duration-500" />
          <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-tl from-neutral-600/10 to-transparent opacity-50 pointer-events-none rounded-br-2xl" />
          <div className="relative z-10 flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-neutral-700/30 text-neutral-300 border border-neutral-600/30 shadow-inner">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
              Drafts
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-3xl md:text-4xl font-black text-white drop-shadow-md">
              {draftsCount}
            </p>
            <p className="text-xs text-neutral-500 mt-1 font-medium">Unpublished ideas</p>
          </div>
        </div>
      </div>

      {/* Connected Accounts Section */}`;

  content = content.replace(statsRegex, newStats);

  // Connected accounts section restyle
  content = content.replace(
    /className={\`p-6 rounded-2xl border transition-all flex flex-col justify-between min-h-\[160px\] \${[\s\S]*?isConnected[\s\S]*?\? 'bg-\[#0a0404\] border-\[#2a1010\] hover:border-\[#3a1515\] shadow-md'[\s\S]*?: 'bg-\[#080303\]\/70 border-\[#2a1010\]\/70 opacity-80'[\s\S]*?}\`}/g,
    `className={\`p-6 rounded-2xl border transition-all flex flex-col justify-between min-h-[160px] \${
                  isConnected
                    ? 'bg-[#0e0e12] border-[#22222a] hover:border-[#33333e] hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] shadow-md'
                    : 'bg-[#09090b] border-[#1a1a20] opacity-80'
                }\`}`
  );
  content = content.replace(
    /border-t border-\[#2a1010\]\/80 flex items-center justify-between text-xs text-neutral-400/g,
    'border-t border-[#22222a] flex items-center justify-between text-xs text-neutral-400'
  );

  fs.writeFileSync(filePath, content);
  console.log('Updated dashboard page');
}

function applyThemeSidebar() {
  const filePath = 'components/layout/Sidebar.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  // Sidebar background
  content = content.replace(/bg-\[#0a0505\]/g, 'bg-[#0a0a0c]');
  content = content.replace(/bg-\[#050202\]/g, 'bg-[#0a0a0c]');
  
  // Workspace Switcher
  content = content.replace(/bg-\[#080303\]/g, 'bg-[#0f0f13]');
  content = content.replace(/border-red-950\/80/g, 'border-[#1a1a20]');
  content = content.replace(/bg-\[#18181f\]/g, 'bg-[#18181f]');
  
  // Active pill
  content = content.replace(
    /const isActive = pathname === item.href;[\s\S]*?return \([\s\S]*?<Link/m,
    `const isActive = pathname === item.href;
              return (
                <Link`
  );
  
  content = content.replace(
    /className={\`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group \${[\s\S]*?isActive[\s\S]*?\? 'bg-red-600 text-white shadow-lg shadow-red-600\/30 font-bold'[\s\S]*?: 'text-neutral-400 hover:bg-\[#1a1a20\] hover:text-white font-medium'[\s\S]*?}\`}/g,
    `className={\`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group \${
                  isActive
                    ? 'bg-gradient-to-r from-red-950/80 to-[#1f0a0a] border border-red-500/30 text-white shadow-[0_0_15px_rgba(220,38,38,0.15)] font-bold'
                    : 'text-neutral-400 hover:bg-[#1a1a20] hover:text-neutral-200 font-medium border border-transparent'
                }\`}`
  );

  fs.writeFileSync(filePath, content);
  console.log('Updated Sidebar');
}

function applyThemeHeader() {
  const filePath = 'components/layout/Header.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/bg-\[#0a0505\]/g, 'bg-[#0a0a0c]');
  content = content.replace(/bg-\[#000000\]/g, 'bg-[#0a0a0c]');
  content = content.replace(/border-red-950\/80/g, 'border-[#1a1a20]');
  
  // Header create post button
  content = content.replace(
    /className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 text-white text-sm font-bold shadow-lg shadow-red-500\/30 transition-all hover:scale-\[1.02\] active:scale-\[0.98\]"/g,
    `className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-sm font-bold shadow-[0_0_20px_rgba(220,38,38,0.25)] transition-all hover:scale-[1.02] active:scale-[0.98]"`
  );

  fs.writeFileSync(filePath, content);
  console.log('Updated Header');
}

function applyGlobalBackground() {
  const filePath = 'components/layout/AppLayout.tsx';
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/bg-\[#0a0505\]/g, 'bg-[#060608]');
    content = content.replace(/bg-\[#050202\]/g, 'bg-[#060608]');
    fs.writeFileSync(filePath, content);
  }
}

applyThemeDashboard();
applyThemeSidebar();
applyThemeHeader();
applyGlobalBackground();

// Update Inner Pages cards to `#0e0e12` instead of `#0a0404` or `#0f0505` to match dashboard glass cards.
function updateInnerPages() {
  const dirs = ['app/(dashboard)'];
  while(dirs.length > 0) {
    const dir = dirs.pop();
    const files = fs.readdirSync(dir);
    for(const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        dirs.push(fullPath);
      } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = content;
        
        // Inner pages panels
        modified = modified.replace(/bg-\[#0a0404\]/g, 'bg-[#0e0e12]');
        modified = modified.replace(/bg-\[#0f0505\]/g, 'bg-[#0e0e12]');
        modified = modified.replace(/bg-\[#050202\]/g, 'bg-[#0e0e12]');
        modified = modified.replace(/bg-\[#080303\]/g, 'bg-[#0e0e12]');
        modified = modified.replace(/bg-\[#0c0505\]/g, 'bg-[#0a0a0e]');
        modified = modified.replace(/border-\[#2a1010\]/g, 'border-[#22222a]');
        modified = modified.replace(/border-\[#3a1515\]/g, 'border-[#33333e]');
        modified = modified.replace(/bg-\[#1a0a0a\]/g, 'bg-[#18181f]');
        modified = modified.replace(/bg-\[#140808\]/g, 'bg-[#121216]');
        modified = modified.replace(/bg-\[#1a0a0a\]\/80/g, 'bg-[#18181f]/80');
        
        // Remove empty state old dark styles
        modified = modified.replace(/border-red-950\/60/g, 'border-[#22222a]');
        modified = modified.replace(/border-red-950\/80/g, 'border-[#33333e]');
        modified = modified.replace(/border-red-900\/50/g, 'border-[#22222a]');
        
        if (content !== modified) {
          fs.writeFileSync(fullPath, modified);
          console.log('Updated cards in', fullPath);
        }
      }
    }
  }
}

updateInnerPages();
