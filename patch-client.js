const fs = require('fs');

const path = 'app/super-admin/users/[id]/UserDetailClient.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add selectedPlan state
const stateInsertion = `  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>(plans[0]?.code || 'STARTER');`;
code = code.replace(/  const \[loadingAction, setLoadingAction\] = useState<string \| null>\(null\);\n  const \[message, setMessage\] = useState<\{ type: 'success' \| 'error', text: string \} \| null>\(null\);/, stateInsertion);

// 2. Replace the select and button
const oldSelectBlock = `<select 
                    id="planSelect"
                    className="flex-1 bg-[#0f0505] border border-[#3a1515] rounded-lg text-sm px-3 py-2 text-white"
                  >
                    {plans.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                  <button 
                    onClick={() => {
                      const sel = document.getElementById('planSelect') as HTMLSelectElement;
                      handleAction('change_plan', { planCode: sel.value });
                    }}
                    disabled={!!loadingAction}
                    className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg"
                  >
                    Assign
                  </button>`;

const newSelectBlock = `<select 
                    id="planSelect"
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="flex-1 bg-[#0f0505] border border-[#3a1515] rounded-lg text-sm px-3 py-2 text-white"
                  >
                    {plans.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                  <button 
                    onClick={() => handleAction('change_plan', { planCode: selectedPlan })}
                    disabled={!!loadingAction}
                    className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg"
                  >
                    Assign
                  </button>`;

// Some spaces might be different, let's use regex for replacement or simple split/join
const regex = /<select[\s\S]*?id="planSelect"[\s\S]*?<\/button>/;
code = code.replace(regex, newSelectBlock);

fs.writeFileSync(path, code, 'utf8');
console.log('UserDetailClient patched.');
