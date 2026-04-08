const fs = require('fs');

let content = fs.readFileSync('src/modules/wardrobe/views/WardrobeView.tsx', 'utf-8');

// 1. Header spacing and title
content = content.replace(
  /<header className="px-3">/g,
  '<header className="px-3 mb-6">'
);

// Fix heading if needed, "names in the names" -> perhaps Wardrobe & Makeup spacing
content = content.replace(
  /<h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white">Wardrobe &amp; Makeup<\/h1>/g,
  '<h1 className="page-title page-title-compact mt-2 mb-1 text-zinc-900 dark:text-white leading-tight">Wardrobe &amp; Makeup</h1>'
);

// 2. Padding improvements, remove the general pb-[140px]
content = content.replace(
  /<div className="md:hidden mt-2 px-1 pb-\[140px\]">/,
  '<div className="md:hidden mt-2 px-1 pb-[100px]">'
);

// 3. Dark/Light mode class replacements for the mobile sections
const darkRegex = /bg-zinc-900 border border-zinc-800/g;
content = content.replace(darkRegex, 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm');

// More dark mode related replacements
content = content.replace(/text-white/g, 'text-zinc-900 dark:text-white');
content = content.replace(/bg-black\/40/g, 'bg-zinc-100 dark:bg-black/40');
// Be careful not to break text-white for text inside orange buttons, but wait, those have custom text classes usually.
// Let's re-replace `text-zinc-900 dark:text-white` inside buttons later if needed.

// Fix specific known instances:
content = content.replace(/text-zinc-900 dark:text-zinc-900 dark:text-white/g, 'text-zinc-900 dark:text-white');

// 4. Move floating actions (Laundry, Accessory, Costume) to Home tab
// In the current file (lines 1128-1154), there is a Floating Action Container:
const floatingActionRegex = /\{\/\* Floating Action Container \*\/\}\s*<div className="fixed bottom-24 left-0 w-full z-40 px-5 pointer-events-none">\s*<div className="flex flex-col gap-3 pointer-events-auto">\s*\{canManage && \(\s*<>\s*<button onClick=\{\(\) => setContinuityModalOpen\(true\)\} className="w-full h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-black font-black font-headline rounded-xl shadow-2xl flex items-center justify-center gap-2 active:scale-95 duration-200">\s*<span className="material-symbols-outlined font-bold">upload_file<\/span>\s*Upload Continuity\s*<\/button>\s*<div className="grid grid-cols-3 gap-3">\s*<button onClick=\{\(\) => setLaundryModalOpen\(true\)\} className="h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-white font-bold text-\[10px\] rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 duration-200 uppercase tracking-tighter shadow-lg">\s*<span className="material-symbols-outlined text-orange-500 text-base">local_laundry_service<\/span>\s*Laundry\s*<\/button>\s*<button onClick=\{\(\) => setAccessoryModalOpen\(true\)\} className="h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-white font-bold text-\[10px\] rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 duration-200 uppercase tracking-tighter shadow-lg">\s*<span className="material-symbols-outlined text-orange-500 text-base">diamond<\/span>\s*Accessory\s*<\/button>\s*<button onClick=\{\(\) => setInventoryModalOpen\(true\)\} className="h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-white font-bold text-\[10px\] rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 duration-200 uppercase tracking-tighter shadow-lg">\s*<span className="material-symbols-outlined text-orange-500 text-base">checkroom<\/span>\s*Costume\s*<\/button>\s*<\/div>\s*<\/>\s*\)\}\s*<\/div>\s*<\/div>/g;

content = content.replace(floatingActionRegex, ''); // Remove from global scope

// And inset it at the end of the `dashboard` tab
const endOfDashboard = /<\/section>\s*<\/div>\s*\)\}/g;
const actionButtonsHTML = `</section>
             
             {canManage && (
               <div className="pt-4 pb-12 sticky bottom-4 z-30">
                 <div className="flex flex-col gap-3">
                   <button onClick={() => setContinuityModalOpen(true)} className="w-full h-[56px] rounded-[16px] bg-orange-500 text-black font-bold flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                     <span className="material-symbols-outlined font-bold">upload_file</span>
                     Upload Continuity
                   </button>
                   <div className="grid grid-cols-3 gap-3">
                     <button onClick={() => setLaundryModalOpen(true)} className="h-[64px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold text-[10px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 duration-200 uppercase shadow-sm">
                       <span className="material-symbols-outlined text-orange-500 text-[22px]">local_laundry_service</span>
                       Laundry
                     </button>
                     <button onClick={() => setAccessoryModalOpen(true)} className="h-[64px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold text-[10px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 duration-200 uppercase shadow-sm">
                       <span className="material-symbols-outlined text-orange-500 text-[22px]">diamond</span>
                       Accessory
                     </button>
                     <button onClick={() => setInventoryModalOpen(true)} className="h-[64px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold text-[10px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 duration-200 uppercase shadow-sm">
                       <span className="material-symbols-outlined text-orange-500 text-[22px]">checkroom</span>
                       Costume
                     </button>
                   </div>
                 </div>
               </div>
             )}
           </div>
        )}`;

content = content.replace(endOfDashboard, actionButtonsHTML.replace(/\$/g, '$$$$'));

// Fix buttons at the bottoms of other tabs:
// Inventory:
const inventoryBtnRegex = /<button onClick=\{\(\) => setInventoryModalOpen\(true\)\} className="w-full h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-white font-bold text-sm rounded-\[16px\] flex items-center justify-center gap-2 active:scale-95 duration-200">/g;
content = content.replace(inventoryBtnRegex, '<button onClick={() => setInventoryModalOpen(true)} className="w-full h-[56px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-orange-500 font-bold text-sm rounded-[16px] flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-wide shadow-sm">');

// Continuity:
const continuityBtnRegex = /<button onClick=\{\(\) => setContinuityModalOpen\(true\)\} className="w-full h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-white font-bold text-sm rounded-\[16px\] flex items-center justify-center gap-2 active:scale-95 duration-200">/g;
content = content.replace(continuityBtnRegex, '<button onClick={() => setContinuityModalOpen(true)} className="w-full h-[56px] rounded-[16px] bg-orange-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-wide shadow-lg">');

// Laundry:
const laundryBtnRegex = /<button onClick=\{\(\) => setLaundryModalOpen\(true\)\} className="w-full h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-white font-bold text-sm rounded-\[16px\] flex items-center justify-center gap-2 active:scale-95 duration-200">/g;
content = content.replace(laundryBtnRegex, '<button onClick={() => setLaundryModalOpen(true)} className="w-full h-[56px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-orange-500 font-bold text-sm rounded-[16px] flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-wide shadow-sm">');

// Accessory:
const accessoryBtnRegex = /<button onClick=\{\(\) => setAccessoryModalOpen\(true\)\} className="w-full h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-white font-bold text-sm rounded-\[16px\] flex items-center justify-center gap-2 active:scale-95 duration-200">/g;
content = content.replace(accessoryBtnRegex, '<button onClick={() => setAccessoryModalOpen(true)} className="w-full h-[56px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-orange-500 font-bold text-sm rounded-[16px] flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-wide shadow-sm">');

fs.writeFileSync('src/modules/wardrobe/views/WardrobeView.tsx', content);

