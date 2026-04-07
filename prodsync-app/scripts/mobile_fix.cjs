const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // 1. Rename default useState to 'home' and the old home identifier
    let oldHomeTab = filePath.includes('CameraView') ? 'assets' : 'dashboard';
    
    content = content.replace(new RegExp(`useState<'${oldHomeTab}'( \\| '[^']+')*>`,"g"), match => match.replace(`'${oldHomeTab}'`, "'home'"));
    content = content.replace(new RegExp(`useState<([^>]+)>\\('${oldHomeTab}'\\)`,"g"), `useState<$1>('home')`);

    // Extract the mobile hidden block
    const mobileStartStr = '<div className="md:hidden';
    const mobileStart = content.indexOf(mobileStartStr);
    const mobileEnd = content.indexOf('</div>\n    </div>\n  )\n}') > -1 ? content.indexOf('</div>\n    </div>\n  )\n}') + 6 : content.lastIndexOf('</div>');

    if (mobileStart === -1) return;

    let preContent = content.substring(0, mobileStart);
    let mobileContent = content.substring(mobileStart, mobileEnd);
    let postContent = content.substring(mobileEnd);

    // Apply tailwind dynamic dark/light changes to mobileContent ONLY
    const themeReplaces = [
        [/text-white/g, 'text-zinc-900 dark:text-white'],
        [/text-black/g, 'text-zinc-900 dark:text-zinc-950'],
        [/bg-zinc-900/g, 'bg-white dark:bg-zinc-900'],
        [/border-zinc-800/g, 'border-zinc-200 dark:border-zinc-800'],
        [/border-zinc-700/g, 'border-zinc-200 dark:border-zinc-700'],
        [/bg-zinc-950\/95/g, 'bg-white/95 dark:bg-zinc-950/95'],
        [/bg-zinc-800/g, 'bg-zinc-100 dark:bg-zinc-800'],
        [/text-zinc-400/g, 'text-zinc-500 dark:text-zinc-400'],
        [/text-zinc-600/g, 'text-zinc-400 dark:text-zinc-600']
    ];

    for (let [regex, rep] of themeReplaces) {
        mobileContent = mobileContent.replace(regex, rep);
    }
    // Cleanup double replacements just in case
    mobileContent = mobileContent.replace(/text-zinc-900 dark:text-zinc-900 dark:text-white/g, 'text-zinc-900 dark:text-white');
    mobileContent = mobileContent.replace(/bg-white dark:bg-white dark:bg-zinc-900/g, 'bg-white dark:bg-zinc-900');
    // Important: we leave gradient stuff alone since it uses specific orange colors. 
    mobileContent = mobileContent.replace(/text-zinc-900 dark:text-zinc-950 font-black uppercase text-\[11px\]/g, 'text-black font-black uppercase text-[11px]');
    mobileContent = mobileContent.replace(/text-zinc-900 dark:text-zinc-950 py-4/g, 'text-black py-4');
    mobileContent = mobileContent.replace(/text-zinc-900 dark:text-zinc-950 py-2/g, 'text-black py-2');

    // Extract all views and labels
    const viewRegex = /\{activeMobileTab === '([^']+)' && \(\s*(<div[^>]*>[\s\S]*?)<\/div>\s*\)\s*\}/gm;
    let views = {};
    let match;
    while ((match = viewRegex.exec(mobileContent)) !== null) {
        views[match[1]] = match[2];
    }

    // Identify Navbar tab items
    mobileContent = mobileContent.replace(`{ id: '${oldHomeTab}'`, "{ id: 'home'");
    mobileContent = mobileContent.replace(`'${oldHomeTab}', icon:`, "'home', icon:");
    mobileContent = mobileContent.replace(`label: '${oldHomeTab === 'assets' ? 'Assets' : 'Dashboard'}'`, "label: 'Home'");
    mobileContent = mobileContent.replace(`icon: 'dashboard'`, "icon: 'home'");
    mobileContent = mobileContent.replace(`icon: 'camera_roll'`, "icon: 'home'");

    // Build the mega home block depending on the file
    let megaBlockCore = '';
    if (filePath.includes('CameraView')) {
        let alerts = views['alerts'] || '';
        let statsAndBottom = views[oldHomeTab] || '';
        let reports = views['reports'] || '';
        let activity = views['activity'] || '';
        let wishlist = views['wishlist'] || '';

        // Extract stats row
        let topStats = '';
        const statsMatch = statsAndBottom.match(/<section className="flex overflow-x-auto.*?>[\s\S]*?<\/section>/);
        if (statsMatch) topStats = statsMatch[0];

        // Extract bottom buttons
        let bottomButtons = '';
        const bottomMatch = statsAndBottom.match(/<div className="mt-8 px-2 grid grid-cols-2 gap-3 pb-8">[\s\S]*?<\/div>/) || statsAndBottom.match(/<div className="mt-[^>]* px-2 grid grid-cols-2 gap-3 pb-8">[\s\S]*?<\/div>/);
        if (bottomMatch) bottomButtons = bottomMatch[0];

        megaBlockCore = `
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
          ${alerts !== '' ? `\n          {/** Alerts Area **/}
          ${alerts.replace(/<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3">([\s\S]*?)<\/div>/, '$1')}` : ''}

          {/** Stats Area **/}
          ${topStats}

          {/** Activity Area **/}
          ${activity.replace(/<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3">([\s\S]*?)<\/div>/, '$1').replace(/(<h2[^>]*>)Movement Log(<\/h2>)/, '$1Movement Log$2')}

          {/** Wishlist Area **/}
          ${wishlist.replace(/<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3">([\s\S]*?)<\/div>/, '$1')}

          {/** Reports Area **/}
          ${reports.replace(/<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 pb-8">([\s\S]*?)<\/div>/, '$1')}

          {/** Bottom Actions Area **/}
          ${bottomButtons.replace(/mt-8/, 'mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6')}
        </div>
        `;
    } else { // ExpensesView
        let alerts = views['alerts'] || '';
        let dashboard = views[oldHomeTab] || '';
        let expenses = views['expenses'] || '';
        let props = views['props'] || '';
        let sets = views['sets'] || '';

         megaBlockCore = `
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-40">
          ${dashboard.replace(/<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">([\s\S]*?)<\/div>/, '$1')}

          ${expenses.replace(/<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 pb-8">([\s\S]*?)<\/div>/, '$1')}

          ${props.replace(/<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 pb-8">([\s\S]*?)<\/div>/, '$1')}

          ${sets.replace(/<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 pb-8">([\s\S]*?)<\/div>/, '$1')}
        </div>
        `;
    }
    
    // Replace the old activeMobileTab block with the mega home block
    mobileContent = mobileContent.replace(new RegExp(`{activeMobileTab === '${oldHomeTab}' && \\(\\s*<div[^>]*>[\\s\\S]*?<\\/div>\\s*\\)\\}`), `{activeMobileTab === 'home' && (\n${megaBlockCore}\n        )}`);

    fs.writeFileSync(filePath, preContent + mobileContent + postContent);
}

processFile('/Users/rashelshah/Desktop/codes/React/ProdSync 2.0/prodsync-app/src/modules/camera/views/CameraView.tsx');
processFile('/Users/rashelshah/Desktop/codes/React/ProdSync 2.0/prodsync-app/src/modules/expenses/views/ExpensesView.tsx');
console.log('Mobile UI Mega-Tab fixed successfully.');
