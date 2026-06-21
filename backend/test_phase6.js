process.env.SUPABASE_URL = '';
const DB = require('./db');
const assert = require('assert');

async function testPhase6() {
  console.log('=== STARTING PHASE 6 AUTOMATED BACKEND TESTS ===');

  try {
    const isCloud = DB.isCloud();
    console.log(`- Running database checks in ${isCloud ? 'Cloud (Supabase)' : 'Local JSON File'} mode.`);

    // 1. Seed dummy user/employee if not present
    let testEmployee = null;
    if (!isCloud) {
      const fs = require('fs');
      const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
      testEmployee = db.users.find(u => u.role === 'employee');
    } else {
      const emps = await DB.getAllEmployees();
      testEmployee = emps[0];
    }

    if (!testEmployee) {
      console.log('- Creating test employee account...');
      testEmployee = await DB.createUser(
        `test_agent_${Date.now()}`,
        'hash123',
        'employee',
        'Test Analytics Executive',
        '7777777777'
      );
    }
    console.log(`- Test Executive: ${testEmployee.full_name} (${testEmployee.id})`);

    // 2. Seed project if not present
    const projects = await DB.getProjects();
    let testProject = projects[0];
    if (!testProject) {
      testProject = await DB.createProject({ name: 'Phase 6 Test Project', location: 'Vrindavan' });
    }

    // 3. Create leads with specific sources to check ROI calculations
    console.log('3. Seeding leads with target sources (Facebook, Google)...');
    
    const leadFb = await DB.createLead({
      name: 'Facebook Customer',
      phone1: '9000000001',
      project: testProject.name,
      lead_source: 'Facebook',
      status: 'Hot',
      assigned_employee_id: testEmployee.id
    });

    const leadGoogle = await DB.createLead({
      name: 'Google Customer',
      phone1: '9000000002',
      project: testProject.name,
      lead_source: 'Google',
      status: 'Negotiation',
      assigned_employee_id: testEmployee.id
    });

    const leadRef = await DB.createLead({
      name: 'Referral Customer',
      phone1: '9000000003',
      project: testProject.name,
      lead_source: 'Referral',
      status: 'Warm',
      assigned_employee_id: testEmployee.id
    });

    // 4. Create confirmed booking for Facebook lead to verify conversion rate
    console.log('4. Seeding booking for Facebook lead...');
    const booking = await DB.createBooking({
      lead_id: leadFb.id,
      project_id: testProject.id,
      unit_number: `FB-U-${Date.now()}`,
      total_cost: 3000000,
      token_amount: 150000,
      booking_amount: 350000,
      booking_date: new Date().toISOString().split('T')[0],
      executive_id: testEmployee.id,
      status: 'Booked'
    });

    // 5. Verify Source ROI dashboard data
    console.log('5. Verifying getSourceRoiStats() outputs...');
    const roiStats = await DB.getSourceRoiStats();
    
    const fbStats = roiStats.find(s => s.source === 'Facebook');
    const googleStats = roiStats.find(s => s.source === 'Google');
    
    assert.ok(fbStats, 'Facebook stats must exist');
    assert.ok(googleStats, 'Google stats must exist');
    
    assert.ok(fbStats.leads >= 1, 'Facebook leads count must be logged');
    assert.ok(fbStats.bookings >= 1, 'Facebook bookings count must be logged');
    assert.strictEqual(fbStats.revenue >= 500000, true, 'Revenue must accumulate booking costs');
    assert.strictEqual(fbStats.conversion > 0, true, 'Conversion rate must be calculated');
    console.log('- Facebook ROI metrics verified successfully.');

    // 6. Verify Conversion Funnel analytics
    console.log('6. Verifying getFunnelStats() outputs...');
    const funnelStats = await DB.getFunnelStats(testEmployee.id);
    assert.ok(funnelStats.leads >= 3, 'Leads stage count must capture all seeded leads');
    assert.ok(funnelStats.booking >= 1, 'Booking stage must register the confirmed booking');
    assert.strictEqual(funnelStats.revenue >= 500000, true, 'Revenue value must match');
    console.log('- Funnel metrics verified successfully.');

    // 7. Verify Employee Performance reports
    console.log('7. Verifying getEmployeePerformanceReports() outputs...');
    const reports = await DB.getEmployeePerformanceReports();
    const empReport = reports.find(r => r.employee_id === testEmployee.id);
    assert.ok(empReport, 'Performance record must exist for the test employee');
    assert.ok(empReport.leads_count >= 3, 'Assigned leads count must match');
    assert.ok(empReport.bookings >= 1, 'Confirmed bookings count must match');
    assert.ok(empReport.conversion > 0, 'Conversion percentage must calculate');
    console.log('- Performance reports verified successfully.');

    // 8. Verify Incentive Calculator logic
    console.log('8. Verifying getIncentivesData() outputs...');
    const incentives = await DB.getIncentivesData(testEmployee.id);
    assert.ok(incentives.bookings.length >= 1, 'Confirm bookings exist in calculator list');
    const empBooking = incentives.bookings.find(b => b.lead_id === leadFb.id);
    assert.ok(empBooking, 'Facebook booking must be parsed');
    assert.strictEqual(empBooking.booking_value, 500000, 'Calculated booking value must match sum');
    assert.strictEqual(empBooking.incentive_amount, (500000 * empBooking.commission_rate) / 100, 'Calculated commission incentive must match');
    console.log('- Incentive calculator variables verified successfully.');

    console.log('\n=== ALL PHASE 6 BACKEND TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('\n❌ PHASE 6 TESTS FAILED:', err);
    process.exit(1);
  }
}

testPhase6();
