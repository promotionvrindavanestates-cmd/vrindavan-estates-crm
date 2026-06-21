process.env.SUPABASE_URL = '';
const DB = require('./db');
const assert = require('assert');

async function testPhase5() {
  console.log('=== STARTING PHASE 5 AUTOMATED BACKEND TESTS ===');

  try {
    // 1. Verify Parity / Fallback Initializer
    console.log('1. Checking local JSON DB fallback load...');
    const isCloud = DB.isCloud();
    console.log(`- Running in ${isCloud ? 'Cloud (Supabase)' : 'Local JSON File'} mode.`);

    // 2. Inventory blocking and lazy release
    console.log('2. Testing inventory blocking & lazy-release...');
    const projectList = await DB.getProjects();
    let projectId = null;
    if (projectList.length === 0) {
      const proj = await DB.createProject({ name: 'Phase 5 Test Project', location: 'Vrindavan' });
      projectId = proj.id;
    } else {
      projectId = projectList[0].id;
    }

    const unit = await DB.createInventory({
      project_id: projectId,
      unit_number: `Test-U-${Date.now()}`,
      status: 'Available',
      price: 1000000
    });
    assert.strictEqual(unit.status, 'Available');
    console.log('- Created test unit in Available status.');

    // Block unit for 1 hour
    const blockedUnit = await DB.blockInventoryUnit(unit.id, 1);
    assert.strictEqual(blockedUnit.status, 'Blocked');
    assert.ok(blockedUnit.blocked_until);
    console.log('- Unit successfully blocked for 1 hour.');

    // Manually set blocked_until to the past to test lazy release
    if (!isCloud) {
      const fs = require('fs');
      const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
      const idx = db.inventory.findIndex(i => i.id === unit.id);
      if (idx !== -1) {
        const pastDate = new Date();
        pastDate.setHours(pastDate.getHours() - 2);
        db.inventory[idx].blocked_until = pastDate.toISOString();
        fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
      }
      console.log('- (Local) Manually backdated block timer to the past.');
    } else {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);
      await supabase.from('inventory').update({ blocked_until: pastDate.toISOString() }).eq('id', unit.id);
      console.log('- (Cloud) Manually backdated block timer to the past.');
    }

    // Call getInventory and verify lazy release works
    const inventory = await DB.getInventory(projectId);
    const queriedUnit = inventory.find(i => i.id === unit.id);
    assert.strictEqual(queriedUnit.status, 'Available');
    assert.strictEqual(queriedUnit.blocked_until, null);
    console.log('- Lazy-release successfully unlocked expired block to Available.');

    // 3. Booking Milestone Seeding
    console.log('3. Testing Booking creation & payment milestone seeding (Plan: 40:30:30)...');
    
    let lead = null;
    if (!isCloud) {
      const fs = require('fs');
      const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
      lead = db.leads[0];
    } else {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      const { data } = await supabase.from('leads').select('*').limit(1);
      lead = data[0];
    }
    if (!lead) {
      lead = await DB.createLead({
        name: 'Phase5 Test Customer',
        phone1: '9999900000',
        email: 'p5@test.com',
        status: 'Hot'
      });
    }

    // Create booking
    const bookingResult = await DB.createBooking({
      lead_id: lead.id,
      project_id: projectId,
      inventory_id: unit.id,
      unit_number: unit.unit_number,
      total_cost: 1000000,
      token_amount: 100000,
      booking_amount: 150000,
      booking_date: new Date().toISOString().split('T')[0],
      payment_plan_type: '40:30:30'
    }, 'admin-id-1');

    console.log('- Booking record created successfully.');
    
    // Check milestones
    const milestones = await DB.getBookingMilestones(bookingResult.booking.id);
    assert.strictEqual(milestones.length, 3);
    console.log(`- Seeded ${milestones.length} milestones successfully.`);

    // 40% of 10L = 400k. Upfront paid is 250k. So M1 should be Partial with 250k paid.
    assert.strictEqual(milestones[0].amount, 400000);
    assert.strictEqual(milestones[0].amount_paid, 250000);
    assert.strictEqual(milestones[0].status, 'Partial');
    assert.strictEqual(milestones[1].amount, 300000);
    assert.strictEqual(milestones[1].amount_paid, 0);
    assert.strictEqual(milestones[2].amount, 300000);
    assert.strictEqual(milestones[2].amount_paid, 0);
    console.log('- Milestone allocations are mathematically correct.');

    // 4. Payment installment allocation
    console.log('4. Testing installment allocation to milestones...');
    const payment = await DB.getPaymentById(bookingResult.payment.id);
    const paymentInstallmentResult = await DB.createPaymentInstallment(payment.id, 250000, 'UPI', 'Installment payment 2');
    
    const updatedMilestones = await DB.getBookingMilestones(bookingResult.booking.id);
    assert.strictEqual(updatedMilestones[0].status, 'Paid');
    assert.strictEqual(updatedMilestones[0].amount_paid, 400000);
    assert.strictEqual(updatedMilestones[1].status, 'Partial');
    assert.strictEqual(updatedMilestones[1].amount_paid, 100000);
    assert.strictEqual(updatedMilestones[2].amount_paid, 0);
    console.log('- Chronological milestone installment distribution passes assertions.');

    // 5. Collections analytics
    console.log('5. Testing collections analytics calculations...');
    const analytics = await DB.getCollectionAnalytics();
    assert.ok(analytics.totalCollection >= 1000000);
    assert.ok(analytics.receivedCollection >= 500000);
    console.log('- Collections metrics and breakdown calculated successfully.');

    // Cleanup
    console.log('6. Cleaning up test data...');
    if (!isCloud) {
      const fs = require('fs');
      const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
      db.inventory = db.inventory.filter(i => i.id !== unit.id);
      db.bookings = db.bookings.filter(b => b.id !== bookingResult.booking.id);
      db.payments = db.payments.filter(p => p.id !== bookingResult.payment.id);
      db.payment_installments = db.payment_installments.filter(pi => pi.payment_id !== bookingResult.payment.id);
      db.booking_milestones = db.booking_milestones.filter(m => m.booking_id !== bookingResult.booking.id);
      fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
    } else {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      await supabase.from('inventory').delete().eq('id', unit.id);
      await supabase.from('bookings').delete().eq('id', bookingResult.booking.id);
    }
    console.log('=== ALL PHASE 5 BACKEND TESTS PASSED SUCCESSFULLY! ===');
    process.exit(0);

  } catch (err) {
    console.error('=== TEST FAILED ===');
    console.error(err);
    process.exit(1);
  }
}

testPhase5();
