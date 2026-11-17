import { authenticateAdmin, createToken, getSql } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const user = await authenticateAdmin(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = await createToken({ sub: user.id, email: user.email, name: user.name });
    return res.status(200).json({ success: true, token, email: user.email, name: user.name, id: user.id });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Login failed' });
  }
}