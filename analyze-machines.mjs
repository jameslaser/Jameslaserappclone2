import mysql from 'mysql2/promise';

const c = await mysql.createConnection(process.env.DATABASE_URL);

// Get all unique machine_name → RES_NAME → DEP_NAME → SER_NAME combinations
const [all] = await c.query(`
  SELECT DISTINCT 
    machine_name,
    JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.RES_NAME')) as res_name,
    JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.DEP_NAME')) as dep_name,
    JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.SER_NAME')) as ser_name,
    COUNT(*) as cnt
  FROM machine_appointments 
  GROUP BY machine_name, res_name, dep_name, ser_name
  ORDER BY machine_name, cnt DESC
`);

console.log('Machine Name → RES_NAME | DEP_NAME | SER_NAME | Count');
console.log('='.repeat(100));
for (const r of all) {
  console.log(`${r.machine_name} → ${r.res_name} | ${r.dep_name} | ${r.ser_name} | ${r.cnt}`);
}

// Summary by machine_name with total count
const [summary] = await c.query(`
  SELECT machine_name, COUNT(*) as cnt 
  FROM machine_appointments 
  GROUP BY machine_name 
  ORDER BY cnt DESC
`);
console.log('\n\nMachine Name Summary:');
for (const r of summary) {
  console.log(`  ${r.machine_name}: ${r.cnt} appointments`);
}

await c.end();
