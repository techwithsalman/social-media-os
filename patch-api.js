const fs = require('fs');
const path = 'app/api/super-admin/users/[id]/route.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /revokeActivePlanOverrides,\n\s*setCurrentPostUsage,\n\s*\} from '@\/lib\/billing';/,
  `revokeActivePlanOverrides,
  setCurrentPostUsage,
  assignManualSubscription,
  renewManualSubscription,
  downgradeToFree,
} from '@/lib/billing';`
);

const assignLogic = `    } else if (body.action === 'assign_manual') {
      const result = await assignManualSubscription(workspaceId, body.planCode, admin.user.id);
      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'MANUAL_SUBSCRIPTION_ASSIGNED',
        details: \`\${admin.user.email} assigned \${result.plan.code} manually.\`,
      });
    } else if (body.action === 'renew_manual') {
      const result = await renewManualSubscription(workspaceId, admin.user.id);
      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'MANUAL_SUBSCRIPTION_RENEWED',
        details: \`\${admin.user.email} renewed \${result.plan.code} for 1 month.\`,
      });
    } else if (body.action === 'downgrade_free') {
      await downgradeToFree(workspaceId, admin.user.id);
      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'MANUAL_SUBSCRIPTION_DOWNGRADED',
        details: \`\${admin.user.email} downgraded to FREE.\`,
      });
    } else if (body.action === 'change_plan') {`;

content = content.replace(/    \} else if \(body\.action === 'change_plan'\) \{/, assignLogic);

fs.writeFileSync(path, content);
console.log('Patched route.ts');
