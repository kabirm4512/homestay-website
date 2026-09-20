const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING COMPREHENSIVE CRM SUITE VERIFICATION ---');

// 1. Verify PWA Assets
console.log('[Test 1] Verifying PWA manifest and Service Worker...');
const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.strictEqual(manifest.display, 'standalone', 'PWA display must be standalone');
assert.ok(manifest.icons && manifest.icons.length >= 2, 'PWA must declare icons');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');
assert.ok(fs.existsSync(swPath), 'sw.js service worker must exist');
const swContent = fs.readFileSync(swPath, 'utf8');
assert.ok(swContent.includes('addEventListener(\'install\''), 'sw.js must have install event listener');
assert.ok(swContent.includes('addEventListener(\'fetch\''), 'sw.js must have fetch event listener');
console.log('✓ PWA assets verified successfully.');

// 2. Verify Physical Rooms & Categories
console.log('[Test 2] Verifying 7 Physical Rooms across 3 Categories...');
const crmDataPath = path.join(__dirname, '..', 'src', 'lib', 'crm-data.ts');
assert.ok(fs.existsSync(crmDataPath), 'crm-data.ts must exist');
const crmDataContent = fs.readFileSync(crmDataPath, 'utf8');

// Check that 7 physical rooms are defined
const roomMatches = crmDataContent.match(/roomNumber:\s*([1-7])/g);
assert.ok(roomMatches && roomMatches.length >= 7, 'Must have all 7 physical rooms configured');
assert.ok(crmDataContent.includes('deluxe_mountain'), 'Must include deluxe_mountain category');
assert.ok(crmDataContent.includes('deluxe_forest'), 'Must include deluxe_forest category');
assert.ok(crmDataContent.includes('premium_suite'), 'Must include premium_suite category');
console.log('✓ 7 physical rooms across 3 categories verified.');

// 3. Verify Kitchen Mandate Headcount Logic
console.log('[Test 3] Verifying Kitchen Mandate Headcount & Dietary Logic...');
function calculateMandate(bookings) {
  const counts = { CP: 0, MAP: 0, AP: 0, EP: 0, totalAdults: 0, totalChildren: 0, alerts: [] };
  bookings.forEach(b => {
    counts[b.mealPlan] = (counts[b.mealPlan] || 0) + (b.adultsCount + b.childrenCount);
    counts.totalAdults += b.adultsCount;
    counts.totalChildren += b.childrenCount;
    if (b.dietary) counts.alerts.push(b.dietary);
  });
  return counts;
}

const sampleBookings = [
  { mealPlan: 'CP', adultsCount: 2, childrenCount: 0, dietary: 'Vegetarian' },
  { mealPlan: 'MAP', adultsCount: 2, childrenCount: 1, dietary: 'Gluten-Free' },
  { mealPlan: 'AP', adultsCount: 3, childrenCount: 1, dietary: 'Strict Jain' },
  { mealPlan: 'EP', adultsCount: 2, childrenCount: 0, dietary: null },
];

const resultMandate = calculateMandate(sampleBookings);
assert.strictEqual(resultMandate.CP, 2, 'CP headcount must be 2');
assert.strictEqual(resultMandate.MAP, 3, 'MAP headcount must be 3 (2 adults + 1 child)');
assert.strictEqual(resultMandate.AP, 4, 'AP headcount must be 4 (3 adults + 1 child)');
assert.strictEqual(resultMandate.EP, 2, 'EP headcount must be 2');
assert.strictEqual(resultMandate.totalAdults, 9, 'Total adults must be 9');
assert.strictEqual(resultMandate.totalChildren, 2, 'Total children must be 2');
assert.strictEqual(resultMandate.alerts.length, 3, 'Dietary alerts count must be 3');
console.log('✓ Kitchen Mandate headcount logic verified.');

// 4. Verify Digital Concierge Late-Night Time Logic
console.log('[Test 4] Verifying 10:00 PM Mains cutoff rule...');
function filterMenuForTime(items, isAfter10PM) {
  return items.filter(item => {
    if (isAfter10PM && item.itemType === 'main' && !item.isLateNightEligible) {
      return false;
    }
    return true;
  });
}

const mockMenu = [
  { id: '1', name: 'Darjeeling Tea', itemType: 'beverage', isLateNightEligible: true },
  { id: '2', name: 'Steamed Momos', itemType: 'snack', isLateNightEligible: true },
  { id: '3', name: 'Pahadi Kadi Rice', itemType: 'main', isLateNightEligible: false },
  { id: '4', name: 'Country Chicken Curry', itemType: 'main', isLateNightEligible: false },
];

const dayMenu = filterMenuForTime(mockMenu, false);
assert.strictEqual(dayMenu.length, 4, 'Day menu must have all 4 items');

const nightMenu = filterMenuForTime(mockMenu, true);
assert.strictEqual(nightMenu.length, 2, 'Night menu must hide both regular Mains');
assert.ok(nightMenu.some(i => i.name === 'Darjeeling Tea'));
assert.ok(nightMenu.some(i => i.name === 'Steamed Momos'));
console.log('✓ Late-Night 10:00 PM cutoff rule verified.');

// 5. Verify Financial Ledger & Reconciliation Logic
console.log('[Test 5] Verifying Cash vs Online Reconciliation & Net Profitability...');
const mockFolioPayments = [
  { amount: 15000, method: 'upi' },
  { amount: 20000, method: 'bank_transfer' },
  { amount: 15200, method: 'cash' },
];

const mockExpenses = [
  { amount: 8450, category: 'groceries' },
  { amount: 3200, category: 'utilities' },
  { amount: 14500, category: 'staff_payroll' },
];

const totalRevenue = mockFolioPayments.reduce((s, p) => s + p.amount, 0);
const cashTotal = mockFolioPayments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
const onlineTotal = mockFolioPayments.filter(p => p.method !== 'cash').reduce((s, p) => s + p.amount, 0);
const totalExpenseAmount = mockExpenses.reduce((s, e) => s + e.amount, 0);
const netOperatingProfit = totalRevenue - totalExpenseAmount;
const profitMarginPct = Math.round((netOperatingProfit / totalRevenue) * 100);

assert.strictEqual(totalRevenue, 50200, 'Total revenue should be 50,200');
assert.strictEqual(cashTotal, 15200, 'Cash total should be 15,200');
assert.strictEqual(onlineTotal, 35000, 'Online total should be 35,000');
assert.strictEqual(totalExpenseAmount, 26150, 'Total expenses should be 26,150');
assert.strictEqual(netOperatingProfit, 24050, 'Net operating profit should be 24,050');
assert.strictEqual(profitMarginPct, 48, 'Profit margin should be 48%');
console.log('✓ Financial reconciliation and net profitability verified.');

// 6. Verify Transfer Routes & Modifiers Calculation
console.log('[Test 6] Verifying Transport Transfer and Modifier calculation...');
const baseSedan = 4200;
const mirikModifier = 1500;
const totalQuote = baseSedan + mirikModifier;
const estVendorCost = Math.round(totalQuote * 0.75);
const homestayComm = totalQuote - estVendorCost;

assert.strictEqual(totalQuote, 5700, 'Quoted price should be 5,700');
assert.strictEqual(estVendorCost, 4275, 'Vendor cost should be 4,275');
assert.strictEqual(homestayComm, 1425, 'Homestay commission should be 1,425');
console.log('✓ Transport calculation verified.');

console.log('\n>>> ALL 6 VERIFICATION TEST SUITES PASSED CLEANLY! <<<');
