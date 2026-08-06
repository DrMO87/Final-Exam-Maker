import pg from 'pg';
import sqliteDb from './database-sqlite.js';

let dbPool;

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (connectionString) {
  console.log('⚡ Connected to Supabase Cloud PostgreSQL database!');
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  dbPool = {
    query: async (text, params = []) => {
      let paramIndex = 1;
      // Convert SQLite style ? placeholders to PostgreSQL $1, $2, $3...
      const pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
      const res = await pool.query(pgText, params);
      return res;
    },
    connect: async () => {
      const client = await pool.connect();
      return {
        query: async (text, params = []) => {
          let paramIndex = 1;
          const pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
          const res = await client.query(pgText, params);
          return res;
        },
        release: () => client.release()
      };
    }
  };
} else {
  console.log('✅ Using local SQLite database (no DATABASE_URL provided)');
  dbPool = sqliteDb;
}

export default dbPool;
