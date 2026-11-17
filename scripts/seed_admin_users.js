import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';

const sql = neon(process.env.DATABASE_URL);
const BCRYPT_ROUNDS = 12;

async function seed() {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    console.log('No ADMIN_EMAILS set, skipping seed');
    return;
  }

  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!';

  for (const email of adminEmails) {
    const passwordHash = await bcrypt.hash(defaultPassword, BCRYPT_ROUNDS);
    try {
      const result = await sql`
        insert into admin_users (email, password_hash, name, is_active)
        values (${email}, ${passwordHash}, ${email.split('@')[0]}, true)
        on conflict (email) do update set
          password_hash = ${passwordHash},
          is_active = true,
          updated_at = now()
        returning id, email
      `;
      console.log('Seeded admin:', result[0].email);
    } catch (e) {
      console.error('Failed to seed', email, e.message);
    }
  }
  console.log('Done. Default password for all:', defaultPassword);
}

seed().catch(e => { console.error(e); process.exit(1); });