import { createClerkClient } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing or invalid Authorization header' };
  }
  const token = authHeader.slice(7);

  try {
    const session = await clerkClient.verifyToken(token);
    if (!session) {
      return { ok: false, status: 401, error: 'Invalid or expired token' };
    }

    const user = await clerkClient.users.getUser(session.sub);
    const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (!email || !ADMIN_EMAILS.includes(email)) {
      return { ok: false, status: 403, error: 'Access denied: email not authorized' };
    }

    return { ok: true, adminEmail: email };
  } catch (e) {
    console.error('Auth verification error:', e);
    return { ok: false, status: 401, error: 'Authentication failed' };
  }
}

export { sql };