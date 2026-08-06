import pool from './config/database.js';

console.log('Testing database connection...\n');

async function testDatabase() {
  try {
    // Test 1: Basic connection
    console.log('[1/4] Testing basic connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL');
    console.log('   Server time:', result.rows[0].now);
    console.log();

    // Test 2: Check database
    console.log('[2/4] Checking database...');
    const dbResult = await pool.query('SELECT current_database()');
    console.log('✅ Database:', dbResult.rows[0].current_database);
    console.log();

    // Test 3: Check tables
    console.log('[3/4] Checking tables...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ No tables found!');
      console.log('   Run: npm run init-db');
    } else {
      console.log('✅ Found', tablesResult.rows.length, 'tables:');
      tablesResult.rows.forEach(row => {
        console.log('   -', row.table_name);
      });
    }
    console.log();

    // Test 4: Test scheduling_sessions table
    console.log('[4/4] Testing scheduling_sessions table...');
    try {
      const sessionsResult = await pool.query('SELECT COUNT(*) FROM scheduling_sessions');
      console.log('✅ scheduling_sessions table exists');
      console.log('   Sessions count:', sessionsResult.rows[0].count);
    } catch (err) {
      console.log('❌ scheduling_sessions table does not exist!');
      console.log('   Run: npm run init-db');
    }
    console.log();

    console.log('========================================');
    console.log('  Database Status: READY ✅');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database Error:', error.message);
    console.log();
    console.log('Common issues:');
    console.log('1. PostgreSQL is not running');
    console.log('2. Database "exam_scheduler" does not exist');
    console.log('3. Wrong password in .env file');
    console.log('4. Wrong host/port in .env file');
    console.log();
    console.log('Current configuration (.env):');
    console.log('  DB_HOST:', process.env.DB_HOST);
    console.log('  DB_PORT:', process.env.DB_PORT);
    console.log('  DB_NAME:', process.env.DB_NAME);
    console.log('  DB_USER:', process.env.DB_USER);
    console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : '(not set)');
    console.log();
    
    process.exit(1);
  }
}

testDatabase();

