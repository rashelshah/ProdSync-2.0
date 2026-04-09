import re

with open('src/modules/approvals/views/ApprovalsView.tsx', 'r') as f:
    text = f.read()

# Fix space between sections
text = text.replace('className="px-4 space-y-8"', 'className="px-3 space-y-6"')

# Fix scrollable pipeline
old_pipeline = """           <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar">
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-[140px] flex-shrink-0 flex flex-col justify-between snap-start">
               <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">TOTAL PENDING</span>
               <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '2rem' }}>{kpis?.totalPending ?? 0}</div>
             </div>
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-[140px] flex-shrink-0 flex flex-col justify-between snap-start">
               <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">PENDING VALUE</span>
               <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '2rem' }}>{formatCurrency(kpis?.pendingValueINR ?? 0)}</div>
             </div>
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-[140px] flex-shrink-0 flex flex-col justify-between snap-start">
               <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">AVG ACTION TIME</span>
               <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '2rem' }}>{kpis?.avgActionTimeMinutes ?? 0}m</div>
             </div>
           </div>"""

new_pipeline = """           <div className="grid grid-cols-3 gap-2">
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
               <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest">PENDING</span>
               <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '1.25rem' }}>{kpis?.totalPending ?? 0}</div>
             </div>
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
               <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest">VALUE</span>
               <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '1.25rem' }}>{formatCurrency(kpis?.pendingValueINR ?? 0)}</div>
             </div>
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
               <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest">TIME</span>
               <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '1.25rem' }}>{kpis?.avgActionTimeMinutes ?? 0}m</div>
             </div>
           </div>"""
text = text.replace(old_pipeline, new_pipeline)

# Fix Large UIs
text = text.replace('text-2xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight', 'text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight')
text = text.replace('text-xl font-bold text-zinc-900 dark:text-white leading-none', 'text-lg font-bold text-zinc-900 dark:text-white leading-none')
text = text.replace('className="p-5 pb-4"', 'className="p-4"')
text = text.replace('py-4.5 bg-zinc', 'py-3.5 bg-zinc')
text = text.replace('py-4 bg-transparent', 'py-3.5 bg-transparent')
text = text.replace('py-4 bg-orange', 'py-3.5 bg-orange')
text = text.replace('py-4.5 bg-[#FF9B69]', 'py-3.5 bg-[#FF9B69]')

with open('src/modules/approvals/views/ApprovalsView.tsx', 'w') as f:
    f.write(text)
print("Approvals fixed")
