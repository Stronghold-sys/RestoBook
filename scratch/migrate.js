/* eslint-disable */
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:%40Manna2018%401@db.dazsblmccvxtewtmaljf.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
});

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL successfully!');

  try {
    // 1. Add is_published to reviews table if it doesn't exist
    await client.query(`
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
    `);
    console.log('Added is_published column to reviews table successfully!');

    // 2. Add reviews, attendance, profiles, shifts tables to supabase_realtime publication if not already present
    try {
      await client.query(`
        ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
      `);
      console.log('Added reviews to supabase_realtime publication!');
    } catch (pubErr) {
      console.log('Reviews publication note:', pubErr.message);
    }

    try {
      await client.query(`
        ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
      `);
      console.log('Added attendance to supabase_realtime publication!');
    } catch (pubErr) {
      console.log('Attendance publication note:', pubErr.message);
    }

    try {
      await client.query(`
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
      `);
      console.log('Added profiles to supabase_realtime publication!');
    } catch (pubErr) {
      console.log('Profiles publication note:', pubErr.message);
    }

    try {
      await client.query(`
        ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
      `);
      console.log('Added shifts to supabase_realtime publication!');
    } catch (pubErr) {
      console.log('Shifts publication note:', pubErr.message);
    }

  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

main();
