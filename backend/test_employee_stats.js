require('dotenv').config();
const DB = require('./db');

async function test() {
  console.log('Testing getEmployeePerformanceStats inside backend...');
  try {
    const employees = await DB.getAllEmployees();
    console.log('Available employees:', employees.map(e => ({ id: e.id, name: e.full_name })));
    
    if (employees.length > 0) {
      const empId = employees[0].id;
      console.log(`Querying stats for employee: ${empId} (${employees[0].full_name})...`);
      const stats = await DB.getEmployeePerformanceStats(empId);
      console.log('Success! Stats keys:', Object.keys(stats));
      console.log('Profile:', stats.profile);
      console.log('Metrics:', stats.metrics);
    } else {
      console.log('No employees found.');
    }
  } catch (err) {
    console.error('FAILED with error:');
    console.error(err);
  }
  process.exit(0);
}

test();
