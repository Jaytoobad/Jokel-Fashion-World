import { authenticateAdmin, createToken } from './_auth.js';
import { getClientIp } from '../../lib/utils.js';
import { secureError, generateCsrfToken, setCsrfCookie } from '../../lib/security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (!body && req.headers?.['content-type']?.includes('application/json')) {
      try {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        await new Promise((resolve, reject) => {
          req.on('end', resolve);
          req.on('error', reject);
        });
        const text = Buffer.concat(chunks).toString();
        body = JSON.parse(text);
      } catch {}
    }
    const { email, password } = body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const clientIp = getClientIp(req);
    const result = await authenticateAdmin(email, password, clientIp);

    if (!result.ok) {
      const status = result.status || 401;
      return res.status(status).json({ error: result.error });
    }

    const token = await createToken({ sub: result.user.id, email: result.user.email, name: result.user.name });
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
    return res.status(200).json({ success: true, token, email: result.user.email, name: result.user.name, id: result.user.id });
  } catch (e) {
    console.error('Login error:', e);
    return secureError(res, 500, 'Login failed');
  }
}
