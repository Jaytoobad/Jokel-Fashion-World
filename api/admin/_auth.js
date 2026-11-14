import { createClerkClient, verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

let _sql;
let _clerk;

export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL env var is required');
    _sql = neon(url);
  }
  return _sql;
}

function getClerk() {
  if (!_clerk) {
    const key = process.env.CLERK_SECRET_KEY;
    if (!key) throw new Error('CLERK_SECRET_KEY env var is required');
    _clerk = createClerkClient({ secretKey: key });
  }
  return _clerk;
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

export async function verifyAdmin(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing or invalid Authorization header' };
  }
  const token = authHeader.slice(7);

  try {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error('CLERK_SECRET_KEY env var is required');

    const verified = await verifyToken(token, { secretKey });
    if (!verified?.sub) {
      return { ok: false, status: 401, error: 'Invalid or expired token' };
    }

    const clerkClient = getClerk();
    const user = await clerkClient.users.getUser(verified.sub);
    const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (!email || !getAdminEmails().includes(email)) {
      return { ok: false, status: 403, error: 'Access denied: email not authorized' };
    }

    return { ok: true, adminEmail: email };
  } catch (e) {
    console.error('Auth verification error:', e);
    return { ok: false, status: 401, error: 'Authentication failed' };
  }
}

// Backward-compatible tagged-template export for existing admin handlers.
export const sql = (strings, ...values) => getSql()(strings, ...values);
