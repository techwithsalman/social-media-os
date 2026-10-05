const fs = require('fs');

function updateLogo(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace the logo section
  const oldLogoRegex = /<div className="w-20 h-20 sm:w-28 sm:h-28 mb-4 relative drop-shadow-\[0_0_25px_rgba\(220,38,38,0\.4\)\] hover:scale-105 transition-transform duration-500">[\s]*<img src="\/Tech-With-Salman-TikTok-Icon-1024x1024\.png" alt="Tech With Salman" className="w-full h-full object-contain" \/>[\s]*<\/div>/g;
  
  const newLogo = `<div className="w-24 sm:w-[130px] h-auto mb-4 relative drop-shadow-[0_0_25px_rgba(220,38,38,0.4)] hover:scale-105 transition-transform duration-500">
          <img src="/tws-logo-transparent.png" alt="Tech With Salman" className="w-full h-auto object-contain" />
        </div>`;

  content = content.replace(oldLogoRegex, newLogo);
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

updateLogo('app/(auth)/login/page.tsx');
updateLogo('app/(auth)/signup/page.tsx');
