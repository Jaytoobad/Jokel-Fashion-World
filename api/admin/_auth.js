import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';

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

// ===== LOGIN RATE LIMITING & ACCOUNT LOCKOUT =====

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function hashIp(ip) {
  const salt = process.env.RATE_LIMIT_SALT || 'default-salt-change-in-production';
  return createHash('sha256').update(ip + salt).digest('hex');
}

function getWindowStart(windowMs) {
  const now = Date.now();
  return new Date(now - (now % windowMs));
}

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
  } catch (e) {
    console.error('JWT verify failed:', e.message);
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

async function checkLoginRateLimit(sql, ip, email) {
  try {
    const ipHash = hashIp(ip);
    const emailHash = createHash('sha256').update((email || '').toLowerCase() + 'email').digest('hex');
    const windowStart = getWindowStart(LOGIN_WINDOW_MS);

    try {
      const lockRows = await sql`
        select lock_until from login_lockouts
        where identifier = ${ipHash} and lock_type = 'ip' and lock_until > now()
      `;
      if (lockRows.length > 0) {
        return { allowed: false, lockedUntil: lockRows[0].lock_until, reason: 'IP locked out' };
      }
    } catch {
      return { allowed: true };
    }

    try {
      const emailLockRows = await sql`
        select lock_until from login_lockouts
        where identifier = ${emailHash} and lock_type = 'email' and lock_until > now()
      `;
      if (emailLockRows.length > 0) {
        return { allowed: false, lockedUntil: emailLockRows[0].lock_until, reason: 'Account locked out' };
      }
    } catch {
      return { allowed: true };
    }

    let ipCount = 0;
    try {
      const ipRows = await sql`
        select count as cnt from login_attempts
        where identifier = ${ipHash} and attempt_type = 'ip' and window_start = ${windowStart}
      `;
      ipCount = ipRows.length > 0 ? ipRows[0].cnt : 0;
    } catch {}

    let emailCount = 0;
    try {
      const emailRows = await sql`
        select count as cnt from login_attempts
        where identifier = ${emailHash} and attempt_type = 'email' and window_start = ${windowStart}
      `;
      emailCount = emailRows.length > 0 ? emailRows[0].cnt : 0;
    } catch {}

    if (ipCount >= LOGIN_MAX_ATTEMPTS || emailCount >= LOGIN_MAX_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_WINDOW_MS);
      try {
        await sql`
          insert into login_lockouts (identifier, lock_type, lock_until, created_at)
          values (${ipHash}, 'ip', ${lockUntil}, now())
          on conflict (identifier, lock_type) do update set lock_until = ${lockUntil}, updated_at = now()
        `;
      } catch {}
      try {
        await sql`
          insert into login_lockouts (identifier, lock_type, lock_until, created_at)
          values (${emailHash}, 'email', ${lockUntil}, now())
          on conflict (identifier, lock_type) do update set lock_until = ${lockUntil}, updated_at = now()
        `;
      } catch {}
      return { allowed: false, lockedUntil: lockUntil, reason: 'Too many failed attempts' };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

async function recordLoginAttempt(sql, ip, email, success) {
  try {
    const ipHash = hashIp(ip);
    const emailHash = createHash('sha256').update((email || '').toLowerCase() + 'email').digest('hex');
    const windowStart = getWindowStart(LOGIN_WINDOW_MS);
    const attemptType = success ? 'success' : 'failure';

    try {
      await sql`
        insert into login_attempts (identifier, attempt_type, window_start, count, created_at)
        values (${ipHash}, ${attemptType}, ${windowStart}, 1, now())
        on conflict (identifier, attempt_type, window_start) do update set
          count = login_attempts.count + 1,
          updated_at = now()
      `;
    } catch {}

    try {
      await sql`
        insert into login_attempts (identifier, attempt_type, window_start, count, created_at)
        values (${emailHash}, ${attemptType}, ${windowStart}, 1, now())
        on conflict (identifier, attempt_type, window_start) do update set
          count = login_attempts.count + 1,
          updated_at = now()
      `;
    } catch {}

    if (success) {
      try {
        await sql`
          delete from login_lockouts
          where identifier = ${emailHash} and lock_type = 'email'
        `;
      } catch {}
    }
  } catch {
    // fail silently
  }
}

export async function authenticateAdmin(email, password, clientIp = null) {
  const sql = getSql();

  // Check rate limit before allowing authentication (fail open on error)
  if (clientIp) {
    try {
      const rateLimit = await checkLoginRateLimit(sql, clientIp, email);
      if (!rateLimit.allowed) {
        return { ok: false, status: 429, error: rateLimit.reason || 'Too many login attempts', lockedUntil: rateLimit.lockedUntil };
      }
    } catch {
      // fail open: if rate limit check fails, allow login attempt
    }
  }

  try {
    const result = await sql`
      select id, email, password_hash, name, is_active
      from admin_users
      where email = ${email.toLowerCase()} and is_active = true
    `;
    if (result.length === 0) {
      if (clientIp) {
        try { await recordLoginAttempt(sql, clientIp, email, false); } catch {}
      }
      return { ok: false, status: 401, error: 'Invalid email or password' };
    }
    const user = result[0];
    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
      if (clientIp) {
        try { await recordLoginAttempt(sql, clientIp, email, false); } catch {}
      }
      return { ok: false, status: 401, error: 'Invalid email or password' };
    }

    if (clientIp) {
      try { await recordLoginAttempt(sql, clientIp, email, true); } catch {}
    }

    await sql`update admin_users set last_login_at = now() where id = ${user.id}`;
    return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
  } catch (e) {
    console.error('Auth error:', e);
    return { ok: false, status: 500, error: 'Authentication service error' };
  }
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
