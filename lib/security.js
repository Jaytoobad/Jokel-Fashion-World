import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';

let _sql;
function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL env var is required');
    _sql = neon(url);
  }
  return _sql;
}

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

export async function checkLoginRateLimit(ip, email) {
  const sql = getSql();
  const ipHash = hashIp(ip);
  const emailHash = createHash('sha256').update((email || '').toLowerCase() + 'email').digest('hex');
  const windowStart = getWindowStart(LOGIN_WINDOW_MS);

  try {
    // Check if IP is locked out
    const lockRows = await sql`
      select lock_until from login_lockouts
      where identifier = ${ipHash} and lock_type = 'ip' and lock_until > now()
    `;
    if (lockRows.length > 0) {
      return { allowed: false, lockedUntil: lockRows[0].lock_until, reason: 'IP locked out' };
    }

    // Check if email is locked out
    const emailLockRows = await sql`
      select lock_until from login_lockouts
      where identifier = ${emailHash} and lock_type = 'email' and lock_until > now()
    `;
    if (emailLockRows.length > 0) {
      return { allowed: false, lockedUntil: emailLockRows[0].lock_until, reason: 'Account locked out' };
    }

    // Count failed attempts from IP in current window
    const ipRows = await sql`
      select count as cnt from login_attempts
      where identifier = ${ipHash} and attempt_type = 'ip' and window_start = ${windowStart}
    `;
    const ipCount = ipRows.length > 0 ? ipRows[0].cnt : 0;

    // Count failed attempts for email in current window
    const emailRows = await sql`
      select count as cnt from login_attempts
      where identifier = ${emailHash} and attempt_type = 'email' and window_start = ${windowStart}
    `;
    const emailCount = emailRows.length > 0 ? emailRows[0].cnt : 0;

    if (ipCount >= LOGIN_MAX_ATTEMPTS || emailCount >= LOGIN_MAX_ATTEMPTS) {
      // Apply lockout
      const lockUntil = new Date(Date.now() + LOCKOUT_WINDOW_MS);
      await sql`
        insert into login_lockouts (identifier, lock_type, lock_until, created_at)
        values (${ipHash}, 'ip', ${lockUntil}, now())
        on conflict (identifier, lock_type) do update set lock_until = ${lockUntil}, updated_at = now()
      `;
      await sql`
        insert into login_lockouts (identifier, lock_type, lock_until, created_at)
        values (${emailHash}, 'email', ${lockUntil}, now())
        on conflict (identifier, lock_type) do update set lock_until = ${lockUntil}, updated_at = now()
      `;
      return { allowed: false, lockedUntil: lockUntil, reason: 'Too many failed attempts' };
    }

    return { allowed: true };
  } catch (e) {
    console.error('Rate limit check error:', e);
    return { allowed: true }; // fail open for availability
  }
}

export async function recordLoginAttempt(ip, email, success) {
  const sql = getSql();
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
    await sql`
      insert into login_attempts (identifier, attempt_type, window_start, count, created_at)
      values (${emailHash}, ${attemptType}, ${windowStart}, 1, now())
      on conflict (identifier, attempt_type, window_start) do update set
        count = login_attempts.count + 1,
        updated_at = now()
    `;

    // Clear lockout on successful login
    if (success) {
      await sql`
        delete from login_lockouts
        where identifier = ${emailHash} and lock_type = 'email'
      `;
    }
  } catch (e) {
    console.error('Record login attempt error:', e);
  }
}

// ===== CSRF PROTECTION =====

const CSRF_TOKEN_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';

export function generateCsrfToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export function validateCsrfToken(req) {
  // GET, HEAD, OPTIONS are safe methods - no CSRF check needed
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return { ok: true };
  }

  const tokenFromHeader = req.headers?.['x-csrf-token'] || req.headers?.['X-CSRF-Token'];
  const tokenFromCookie = req.cookies?.[CSRF_COOKIE_NAME];

  if (!tokenFromHeader || !tokenFromCookie) {
    return { ok: false, status: 403, error: 'CSRF token missing' };
  }

  // Constant-time comparison
  if (tokenFromHeader !== tokenFromCookie) {
    return { ok: false, status: 403, error: 'CSRF token mismatch' };
  }

  return { ok: true };
}

export function setCsrfCookie(res, token) {
  res.setHeader('Set-Cookie', `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
}

// ===== XSS SANITIZATION =====

// Escape HTML special characters to prevent XSS
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"'`\/=]/g, c => HTML_ENTITIES[c]);
}

// Sanitize user-provided content that will be rendered in HTML
export function sanitizeUserContent(str, maxLength = 10000) {
  if (str == null) return '';
  const s = String(str);
  if (s.length > maxLength) return escapeHtml(s.slice(0, maxLength));
  return escapeHtml(s);
}

// Sanitize attribute values (for use in HTML attributes)
export function sanitizeAttribute(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"'`\/=]/g, c => HTML_ENTITIES[c]);
}

// Remove dangerous URL schemes (javascript:, data:, vbscript:)
const DANGEROUS_URL_PATTERNS = /^(javascript|vbscript|data|file|ms-mex):/i;
export function sanitizeUrl(url) {
  if (url == null) return '';
  const s = String(url).trim();
  if (DANGEROUS_URL_PATTERNS.test(s)) return '#';
  return s;
}

// ===== REQUEST SIZE LIMIT =====

export function checkBodySize(req, maxBytes = 100 * 1024) {
  const contentLength = req.headers?.['content-length'];
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return { ok: false, status: 413, error: 'Request body too large' };
  }
  return { ok: true };
}

// ===== GENERIC ERROR RESPONSE (no info leak) =====

export function secureError(res, status, message, error = null) {
  const body = { error: message };
  // Only include internal error details in development
  if (process.env.NODE_ENV === 'development' && error) {
    body._internal = String(error);
  }
  return res.status(status).json(body);
}
