import re

with open('src/modules/approvals/views/ApprovalsView.tsx', 'r') as f:
    app_text = f.read()

with open('src/modules/settings/views/SettingsView.tsx', 'r') as f:
    set_text = f.read()

# 1. Update Approvals Header
app_header_old = """      <header className="px-4 mb-6 mt-2 flex items-start justify-between">
        <div className="flex gap-3">
           <button className="material-symbols-outlined text-orange-500">menu</button>
           <div>
             <h1 className="text-xl font-headline font-extrabold text-zinc-900 dark:text-white uppercase tracking-tight leading-none pt-0.5">APPROVALS<br/>CENTER</h1>
             <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500 mt-1 block">DECISION LAYER</span>
           </div>
        </div>
        <RoleGuard permission="canApproveExpense">
          <button
            onClick={() => runApprovalAction(() => approveAllMutation.mutateAsync(), {
                successMessage: 'All pending requests approved.',
                loadingKey: 'approve-all',
                loadingMessage: 'Approving all pending requests...',
                errorMessage: 'Bulk approval failed.',
            })}
            className="bg-[#FF9B69] text-black px-4 py-3 rounded-xl text-xs font-bold disabled:opacity-50 tracking-wider shadow-lg shadow-orange-500/20"
            disabled={!activeProjectId || actionablePending.length === 0 || activeAction !== null}
           >
            Approve<br/>All
          </button>
        </RoleGuard>
      </header>"""

app_header_new = """      <header className="px-3 mb-6 mt-2">
        <div className="flex items-center justify-between overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
          <div>
            <span className="page-kicker text-orange-500">Decision Layer</span>
            <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white tracking-tight leading-none">Approvals Center</h1>
          </div>
          <RoleGuard permission="canApproveExpense">
            <button
              onClick={() => runApprovalAction(() => approveAllMutation.mutateAsync(), {
                  successMessage: 'All pending requests approved.',
                  loadingKey: 'approve-all',
                  loadingMessage: 'Approving all pending requests...',
                  errorMessage: 'Bulk approval failed.',
              })}
              className="bg-orange-500 text-white px-4 py-3 rounded-xl text-xs font-bold disabled:opacity-50 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 tracking-wider shadow-md active:scale-95 transition-transform text-center"
              disabled={!activeProjectId || actionablePending.length === 0 || activeAction !== null}
             >
              Approve<br/>All
            </button>
          </RoleGuard>
        </div>
      </header>"""

app_text = app_text.replace(app_header_old, app_header_new)

# 2. Update Approvals Pipeline Cards
# The Arts ui card: bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-[140px] flex-shrink-0 flex flex-col justify-between snap-start
app_cards_old_p1 = 'className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-[140px] flex-shrink-0 flex flex-col justify-between snap-start"'
app_cards_old_p2 = 'className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-orange-500/30 dark:border-l-orange-500 p-4 rounded-xl shadow-md min-w-[140px] flex-shrink-0 flex flex-col justify-between snap-start"'
app_cards_new = 'className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-[140px] flex-shrink-0 flex flex-col justify-between snap-start"'

app_text = app_text.replace(app_cards_old_p2, app_cards_new)

# 3. Update Approvals Grey out disabled approve button
app_btn_old = 'className="flex-1 py-4.5 bg-[#FF9B69] text-black font-bold text-xs tracking-[0.2em] text-center uppercase active:bg-[#e0895c] transition-colors shadow-inner"'
app_btn_new = 'className="flex-1 py-4 bg-orange-500 text-white font-bold text-xs tracking-[0.2em] text-center uppercase active:bg-orange-600 transition-colors shadow-inner disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:shadow-none font-sans"'
app_text = app_text.replace(app_btn_old, app_btn_new)

app_deny_btn_old = 'className="flex-1 py-4.5 bg-zinc-100 dark:bg-[#262626] text-zinc-500 dark:text-zinc-400 font-bold text-xs tracking-[0.2em] text-center uppercase active:bg-zinc-200 dark:active:bg-[#333] transition-colors"'
app_deny_btn_new = 'className="flex-1 py-4 bg-transparent text-red-500 dark:text-red-400 font-bold text-xs tracking-[0.2em] text-center uppercase transition-colors disabled:opacity-50"'
app_text = app_text.replace(app_deny_btn_old, app_deny_btn_new)


# 4. Settings Header Replacement
set_header_old = """      <header className="flex items-center justify-between px-4 mt-2 mb-6">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
          <span className="bg-[#B5734A] text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-widest">EP CONTROL</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
           <span className="material-symbols-outlined text-[20px]">search</span>
           <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
             {user?.avatarUrl ? <img src={user.avatarUrl} alt="profile" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-sm m-1">person</span>}
           </div>
        </div>
      </header>"""

set_header_new = """      <header className="px-3 mb-6 mt-2">
        <div className="flex items-center justify-between overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
          <div>
            <span className="page-kicker text-orange-500">Project Configuration</span>
            <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white tracking-tight leading-none">Settings <span className="ml-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-widest align-middle">EP Control</span></h1>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 border-2 border-white dark:border-zinc-700 shadow-sm">
             {user?.avatarUrl ? <img src={user.avatarUrl} alt="profile" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-xl m-1.5 text-zinc-400">person</span>}
           </div>
        </div>
      </header>"""
set_text = set_text.replace(set_header_old, set_header_new)


# 5. Fix Settings cards UI identical to Arts
set_cards_old_p1 = 'className="bg-white dark:bg-[#1A1A1B] border border-zinc-200 dark:border-[#FF9B69]/40 dark:border-l-[#FF9B69] dark:border-l-[1.5px] p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between"'
set_cards_new_p1 = 'className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between"'
set_text = set_text.replace(set_cards_old_p1, set_cards_new_p1)

set_cards_old_p2 = 'className="bg-white dark:bg-[#1C1C1C] border border-zinc-200 dark:border-white/5 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between"'
set_text = set_text.replace(set_cards_old_p2, set_cards_new_p1)


# 6. Add isEditingBudget snippet and logic
# We need to insert `const [isEditingBudget, setIsEditingBudget] = useState(false)` inside `export function SettingsView() {`
set_export_func = "export function SettingsView() {\n  const queryClient = useQueryClient()"
set_export_func_new = "export function SettingsView() {\n  const [isEditingBudget, setIsEditingBudget] = useState(false)\n  const queryClient = useQueryClient()"
set_text = set_text.replace(set_export_func, set_export_func_new)

# Edit Budget UI Replacement
set_budget_ui_old = """             <div className="pt-5 pb-1 space-y-1.5">
               <div className="flex items-center justify-between">
                 <label className="text-[8px] text-zinc-500 dark:text-zinc-400 font-bold tracking-widest uppercase ml-1">Total Budget (INR)</label>
                 <button className="text-[8px] text-[#FF9B69] font-bold tracking-widest uppercase">EDIT</button>
               </div>
               <div className="flex items-center">
                 <div className="flex items-center">
                   <div className="text-2xl font-bold font-headline tracking-tight text-zinc-900 dark:text-white leading-none">{formatCurrency(budgetValue)}</div>
                 </div>
               </div>
             </div>"""

set_budget_ui_new = """             <div className="pt-5 pb-1 space-y-1.5">
               <div className="flex items-center justify-between">
                 <label className="text-[8px] text-zinc-500 dark:text-zinc-400 font-bold tracking-widest uppercase ml-1">Total Budget</label>
                 <button onClick={() => setIsEditingBudget(!isEditingBudget)} className="text-[9px] text-orange-500 font-bold tracking-widest uppercase">{isEditingBudget ? 'DONE' : 'EDIT'}</button>
               </div>
               <div className="flex items-center">
                 {isEditingBudget ? (
                   <div className="relative w-full">
                     <span className="absolute left-0 top-1 text-xl font-bold text-zinc-400">₹</span>
                     <input type="number" value={budget} onChange={e => setBudget(e.target.value)} disabled={!canEditProject} className="text-2xl font-bold font-headline tracking-tight text-zinc-900 dark:text-white leading-none bg-transparent border-b border-orange-500 outline-none w-full pl-6 pb-1" autoFocus />
                   </div>
                 ) : (
                   <div className="text-2xl font-bold font-headline tracking-tight text-zinc-900 dark:text-white leading-none">{formatCurrency(budgetValue)}</div>
                 )}
               </div>
             </div>"""
set_text = set_text.replace(set_budget_ui_old, set_budget_ui_new)

# 7. Normalize colors and background over classes (e.g. #111 -> zinc-900 etc)
# Let's clean up #1A1A1A to zinc-900 or zinc-950, and #FF9B69 to orange-500
app_text = app_text.replace('dark:bg-[#1C1C1C]', 'dark:bg-zinc-900')
app_text = app_text.replace('bg-[#1C1C1C]', 'bg-zinc-900')
app_text = app_text.replace('dark:bg-[#141414]', 'dark:bg-zinc-950')
app_text = app_text.replace('bg-[#141414]', 'bg-zinc-950')
app_text = app_text.replace('bg-[#FF9B69]', 'bg-orange-500')
app_text = app_text.replace('text-[#FF9B69]', 'text-orange-500')

set_text = set_text.replace('dark:bg-[#1A1A1A]', 'dark:bg-zinc-900')
set_text = set_text.replace('bg-[#1A1A1A]', 'bg-zinc-900')
set_text = set_text.replace('dark:bg-[#1A1A1B]', 'dark:bg-zinc-900')
set_text = set_text.replace('dark:bg-[#1C1C1C]', 'dark:bg-zinc-900')
set_text = set_text.replace('bg-[#1C1C1C]', 'bg-zinc-900')
set_text = set_text.replace('dark:bg-[#111]', 'dark:bg-zinc-950')
set_text = set_text.replace('bg-[#111]', 'bg-zinc-950')
set_text = set_text.replace('bg-[#FF9B69]', 'bg-orange-500')
set_text = set_text.replace('text-[#FF9B69]', 'text-orange-500')
set_text = set_text.replace('border-[#FF9B69]', 'border-orange-500')
set_text = set_text.replace('border-[#FF9B69]/30', 'border-orange-500/30')

# Also cleanup the "SAVE" button in settings
set_save_old = 'className="w-full bg-orange-500 text-black font-bold text-sm tracking-widest uppercase py-4 rounded-[20px] disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg shadow-orange-500/20"'
set_save_new = 'className="w-full bg-orange-500 text-white font-bold text-sm tracking-widest uppercase py-4 rounded-[20px] disabled:opacity-50 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 active:scale-[0.98] transition-transform shadow-lg shadow-orange-500/20"'
set_text = set_text.replace(set_save_old, set_save_new)

with open('src/modules/approvals/views/ApprovalsView.tsx', 'w') as f:
    f.write(app_text)

with open('src/modules/settings/views/SettingsView.tsx', 'w') as f:
    f.write(set_text)

print("Patch applied.")
