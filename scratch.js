import pool from './dist/db.js';

async function run() {
  try {
    const res = await pool.query("SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'courses'");
    console.log("Constraints:", res.rows);
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'courses'");
    console.log("Columns:", cols.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
