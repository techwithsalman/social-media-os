const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/billing/page.tsx', 'utf8');

const oldFunc = `function getPlanFeatures(plan: BillingPlan) {
  const code = plan.code;
  let accounts = 4;
  let autoDm = 3;
  let bulkVideos = 20;
  let posts = 100;
  let team = 1;

  if (code === 'STARTER') { accounts = 15; autoDm = 20; bulkVideos = 100; posts = 500; team = 2; }
  else if (code === 'PRO') { accounts = 30; autoDm = 75; bulkVideos = 500; posts = 1500; team = 5; }
  else if (code === 'AGENCY') { accounts = 100; autoDm = 250; bulkVideos = 2000; posts = 5000; team = 20; }

  return [
    { text: \`Connected Accounts (\` + accounts + \`)\`, enabled: true },
    { text: \`Instagram Auto DM posts (\` + autoDm + \`)\`, enabled: true },
    { text: \`Bulk Upload videos per month (\` + bulkVideos + \`)\`, enabled: true },
    { text: \`Scheduled/published posts per month (\` + posts + \`)\`, enabled: true },
    { text: \`Team members (\` + team + \`)\`, enabled: true },
  ];
}`;

const newFunc = `function getPlanFeatures(plan: BillingPlan) {
  const code = plan.code;
  
  if (code === 'STARTER') {
    return [
      { text: 'Up to 15 connected social accounts', enabled: true },
      { text: '500 scheduled/published posts per month', enabled: true },
      { text: 'Instagram Auto DM: Up to 20 posts', enabled: true },
      { text: 'Bulk video uploads: 100/month', enabled: true },
      { text: 'Up to 2 team members', enabled: true },
      { text: '2 GB storage', enabled: true },
      { text: 'Analytics: Enabled', enabled: true },
      { text: 'Advanced analytics: Disabled', enabled: false },
      { text: 'Scheduling: Enabled', enabled: true },
      { text: 'Custom captions: Enabled', enabled: true },
      { text: 'Priority support: Disabled', enabled: false },
    ];
  } else if (code === 'PRO') {
    return [
      { text: 'Up to 30 connected social accounts', enabled: true },
      { text: '1,500 scheduled/published posts per month', enabled: true },
      { text: 'Instagram Auto DM: Up to 75 posts', enabled: true },
      { text: 'Bulk video uploads: 500/month', enabled: true },
      { text: 'Up to 5 team members', enabled: true },
      { text: '10 GB storage', enabled: true },
      { text: 'Analytics: Enabled', enabled: true },
      { text: 'Advanced analytics: Enabled', enabled: true },
      { text: 'Scheduling: Enabled', enabled: true },
      { text: 'Custom captions: Enabled', enabled: true },
      { text: 'Priority support: Enabled', enabled: true },
    ];
  } else if (code === 'AGENCY') {
    return [
      { text: 'Up to 100 connected social accounts', enabled: true },
      { text: '5,000 scheduled/published posts per month', enabled: true },
      { text: 'Instagram Auto DM: Up to 250 posts', enabled: true },
      { text: 'Bulk video uploads: 2,000/month', enabled: true },
      { text: 'Up to 20 team members', enabled: true },
      { text: '50 GB storage', enabled: true },
      { text: 'Analytics: Enabled', enabled: true },
      { text: 'Advanced analytics: Enabled', enabled: true },
      { text: 'Scheduling: Enabled', enabled: true },
      { text: 'Custom captions: Enabled', enabled: true },
      { text: 'Priority support: Enabled', enabled: true },
    ];
  }
  
  // FREE
  return [
    { text: 'Up to 4 connected social accounts', enabled: true },
    { text: '100 scheduled/published posts per month', enabled: true },
    { text: 'Instagram Auto DM: Up to 3 posts', enabled: true },
    { text: 'Bulk video uploads: 20/month', enabled: true },
    { text: 'Up to 1 team member', enabled: true },
    { text: '500 MB storage', enabled: true },
    { text: 'Analytics: Enabled', enabled: true },
    { text: 'Advanced analytics: Disabled', enabled: false },
    { text: 'Scheduling: Enabled', enabled: true },
    { text: 'Custom captions: Enabled', enabled: true },
    { text: 'Priority support: Disabled', enabled: false },
  ];
}`;

code = code.replace(oldFunc, newFunc);

// Remove the old feature mapping in UI if it exists.
// Wait, the subagent probably rendered both `getPlanFeatures(plan)` and the old FEATURE_FIELDS logic?
// Let's check how `features` is mapped.
fs.writeFileSync('app/(dashboard)/billing/page.tsx', code);
console.log('Patched billing ui plan features');
