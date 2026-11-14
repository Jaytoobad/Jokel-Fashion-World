import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';

const sql = neon(process.env.DATABASE_URL);
const RATE_LIMIT_SALT = process.env.RATE_LIMIT_SALT;
if (!RATE_LIMIT_SALT) throw new Error('RATE_LIMIT_SALT env var is required');

const RULES = {
  enquiry: { windowMs: 60_000, max: 5 },
  application: { windowMs: 60_000, max: 3 },
};

function hashIp(ip) {
  return createHash('sha256').update(ip + RATE_LIMIT_SALT).digest('hex');
}

function getWindowStart(windowMs) {
  const now = Date.now();
  return new Date(now - (now % windowMs));
}

export async function checkRateLimit(ip, route) {
  const rule = RULES[route];
  if (!rule) return { allowed: true };

  const ipHash = hashIp(ip);
  const windowStart = getWindowStart(rule.windowMs);

  try {
    const rows = await sql`
      select count from rate_limits
      where ip_hash = ${ipHash} and route = ${route} and window_start = ${windowStart}
    `;

    let count = rows.length > 0 ? rows[0].count : 0;
    if (count >= rule.max) {
      return { allowed: false, retryAfterMs: rule.windowMs - (Date.now() - windowStart.getTime()) };
    }

    count++;
    if (rows.length > 0) {
      await sql`
        update rate_limits set count = ${count}
        where ip_hash = ${ipHash} and route = ${route} and window_start = ${windowStart}
      `;
    } else {
      await sql`
        insert into rate_limits (ip_hash, route, window_start, count)
        values (${ipHash}, ${route}, ${windowStart}, ${count})
      `;
    }
    return { allowed: true };
  } catch (e) {
    console.error('Rate limit check error:', e);
    return { allowed: true };
  }
}

export async function logAudit(adminEmail, targetTable, targetId, fieldChanged, oldValue, newValue) {
  try {
    await sql`
      insert into audit_log (admin_email, target_table, target_id, field_changed, old_value, new_value)
      values (${adminEmail}, ${targetTable}, ${targetId}, ${fieldChanged}, ${oldValue}, ${newValue})
    `;
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function trimAndLimit(str, max) {
  if (!str) return '';
  const trimmed = str.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}