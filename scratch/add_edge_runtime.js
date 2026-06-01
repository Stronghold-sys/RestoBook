const fs = require('fs');
const path = require('path');

// Files that need edge runtime added
// From the error log + the page.tsx file
const routeFiles = [
  'src/app/api/EXPRESS_MIGRATE/route.ts',
  'src/app/api/admin/create-employee/route.ts',
  'src/app/api/admin/customers/appeal/route.ts',
  'src/app/api/admin/customers/bulk/route.ts',
  'src/app/api/admin/customers/points/route.ts',
  'src/app/api/admin/customers/suspend/route.ts',
  'src/app/api/admin/customers/update/route.ts',
  'src/app/api/admin/customers/warning/route.ts',
  'src/app/api/admin/delete-employee/route.ts',
  'src/app/api/admin/get-all-shifts/route.ts',
  'src/app/api/admin/reset-employee-password/route.ts',
  'src/app/api/admin/resign-action/route.ts',
  'src/app/api/admin/reviews/route.ts',
  'src/app/api/admin/rewards/redemptions/route.ts',
  'src/app/api/admin/rewards/route.ts',
  'src/app/api/admin/send-payslip/route.ts',
  'src/app/api/admin/settings/points/route.ts',
  'src/app/api/admin/vouchers/route.ts',
  'src/app/api/attendance/leave/route.ts',
  'src/app/api/attendance/route.ts',
  'src/app/api/attendance/status/route.ts',
  'src/app/api/auth/callback/route.ts',
  'src/app/api/auth/logout/route.ts',
  'src/app/api/cashier/active-shift/route.ts',
  'src/app/api/cashier/lock-status/route.ts',
  'src/app/api/create-admin/route.ts',
  'src/app/api/customer/claim-welcome-points/route.ts',
  'src/app/api/customer/points/route.ts',
  'src/app/api/customer/rewards/claim-cashback/route.ts',
  'src/app/api/customer/rewards/redeem/route.ts',
  'src/app/api/customer/rewards/route.ts',
  'src/app/api/customer/vouchers/apply/route.ts',
  'src/app/api/customer/vouchers/route.ts',
  'src/app/api/customer/wallet/pin/route.ts',
  'src/app/api/customer/wallet/route.ts',
  'src/app/api/customer/wallet/topup/route.ts',
  'src/app/api/debug-schema/route.ts',
  'src/app/api/debug-shifts/route.ts',
  'src/app/api/fix-rls/route.ts',
  'src/app/api/migrate/route.ts',
  'src/app/api/orders/merge/route.ts',
  'src/app/api/orders/route.ts',
  'src/app/api/orders/split/route.ts',
  'src/app/api/payment/callback/route.ts',
  'src/app/api/payment/check-status/route.ts',
  'src/app/api/payment/create-invoice/route.ts',
  'src/app/api/payment/debug/route.ts',
  'src/app/api/payment/methods/route.ts',
  'src/app/api/profile/change-password/route.ts',
  'src/app/api/profile/delete/route.ts',
  'src/app/api/profile/route.ts',
  'src/app/api/profile/send-otp/route.ts',
  'src/app/api/profiles/block/route.ts',
  'src/app/api/register/route.ts',
  'src/app/api/reset-password/route.ts',
  'src/app/api/restobot/route.ts',
  'src/app/api/reviews/publish/route.ts',
  'src/app/api/reviews/route.ts',
  'src/app/api/seed/route.ts',
  'src/app/api/send-notification/route.ts',
  'src/app/api/send-otp/route.ts',
  'src/app/api/send-receipt/route.ts',
  'src/app/api/upload/route.ts',
  'src/app/api/verify-otp/route.ts',
  'src/app/customer/orders/[id]/page.tsx',
];

const EDGE_RUNTIME_LINE = "export const runtime = 'edge';";

let modified = 0;
let skipped = 0;
let errors = 0;

for (const relPath of routeFiles) {
  const filePath = path.resolve(relPath);
  
  if (!fs.existsSync(filePath)) {
    console.log(`[NOT FOUND] ${relPath}`);
    errors++;
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if already has runtime = 'edge'
  if (content.includes("runtime = 'edge'") || content.includes('runtime = "edge"')) {
    console.log(`[SKIP] ${relPath} - already has edge runtime`);
    skipped++;
    continue;
  }
  
  // Find the best place to insert: after 'use client' if present, else at top
  // For route files, we insert right at the start (or after any 'use server'/'use client' directives)
  const useClientMatch = content.match(/^('use client'|"use client"|'use server'|"use server");?\s*\n/m);
  
  if (useClientMatch && content.indexOf(useClientMatch[0]) === 0) {
    // Insert after the directive
    content = useClientMatch[0] + `\n${EDGE_RUNTIME_LINE}\n` + content.slice(useClientMatch[0].length);
  } else {
    // Insert at the very beginning
    content = `${EDGE_RUNTIME_LINE}\n\n` + content;
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[ADDED] ${relPath}`);
  modified++;
}

console.log(`\nDone! Modified: ${modified}, Skipped: ${skipped}, Errors: ${errors}`);
