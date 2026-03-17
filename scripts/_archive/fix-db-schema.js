require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const postgres = require('postgres');

async function fix() {
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('Dropping problematic columns to allow type change...');
    await sql`ALTER TABLE users DROP COLUMN IF EXISTS created_at`;
    await sql`ALTER TABLE users DROP COLUMN IF EXISTS last_login_at`;
    
    // Also cleaning up others that were text in the old schema but timestamp in the new one
    await sql`ALTER TABLE learning_episodes DROP COLUMN IF EXISTS created_at`;
    await sql`ALTER TABLE learning_episodes DROP COLUMN IF EXISTS updated_at`;
    
    console.log('Columns dropped successfully.');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await sql.end();
  }
}

fix();
