import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { checkLoginRateLimit, recordLoginAttempt } from '../lib/security.js';

let _sql;

export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL env var is required');
    _sql = neon(url);
  }
  return _sql;
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-in-production');
const JWT_EXPIRY = '8h';
const BCRYPT_ROUNDS = 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function createAdminUser(email, password, name = null) {
  const sql = getSql();
  const passwordHash = await hashPassword(password);
  const result = await sql`
    insert into admin_users (email, password_hash, name)
    values (${email.toLowerCase()}, ${passwordHash}, ${name})
    on conflict (email) do update set
      password_hash = ${passwordHash},
      name = ${name},
      is_active = true,
      updated_at = now()
    returning id, email, name, is_active, created_at
  `;
  return result[0];
}

export async function authenticateAdmin(email, password, clientIp = null) {
  const sql = getSql();

  // Check rate limit before allowing authentication
  if (clientIp) {
    const rateLimit = await checkLoginRateLimit(clientIp, email);
    if (!rateLimit.allowed) {
      return { ok: false, status: 429, error: rateLimit.reason || 'Too many login attempts', lockedUntil: rateLimit.lockedUntil };
    }
  }

  const result = await sql`
    select id, email, password_hash, name, is_active
    from admin_users
    where email = ${email.toLowerCase()} and is_active = true
  `;
  if (result.length === 0) {
    if (clientIp) {
      await recordLoginAttempt(clientIp, email, false);
    }
    return { ok: false, status: 401, error: 'Invalid email or password' };
  }
  const user = result[0];
  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    if (clientIp) {
      await recordLoginAttempt(clientIp, email, false);
    }
    return { ok: false, status: 401, error: 'Invalid email or password' };
  }

  // Record successful login
  if (clientIp) {
    await recordLoginAttempt(clientIp, email, true);
  }

  await sql`update admin_users set last_login_at = now() where id = ${user.id}`;
  return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
}

export async function verifyAdmin(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing or invalid Authorization header' };
  }
  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload || !payload.sub) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }
  const sql = getSql();
  const result = await sql`
    select id, email, name, is_active
    from admin_users
    where id = ${payload.sub} and is_active = true
  `;
  if (result.length === 0) {
    return { ok: false, status: 401, error: 'User not found or inactive' };
  }
  return { ok: true, adminEmail: result[0].email, adminId: result[0].id, adminName: result[0].name };
}

export const sql = (strings, ...values) => getSql()(strings, ...values);
