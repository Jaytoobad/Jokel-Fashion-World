const https = require('https');

function request(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://jokel-fashion-world-sigma.vercel.app${path}`, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║    FINAL CROSS-CHECK AFTER ALL FIXES                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Public pages
  console.log('─ PUBLIC PAGES ─');
  for (const path of ['/', '/about', '/academy', '/gallery', '/designs', '/contact']) {
    const r = await request(path);
    console.log(`GET ${path}: ${r.status} ${r.body.length} bytes`);
    // Check for AI-generated text
    if (r.body.includes('Where Creativity Meets Craftsmanship')) console.log('  ⚠️  AI tagline still present!');
    if (r.body.includes('Verified entries will appear here')) console.log('  ⚠️  Placeholder text still present!');
    if (r.body.includes('Begin your creative journey')) console.log('  ⚠️  AI CTA text still present!');
    if (r.body.includes('Timeless Elegance. Individual Expression. Exceptional Craftsmanship.')) console.log('  ⚠️  AI values text still present!');
    if (r.body.includes('class="cur"') || r.body.includes('.cur')) console.log('  ⚠️  Custom cursor still present!');
    if (r.body.includes('class="rip"') || r.body.includes('@keyframes rip')) console.log('  ⚠️  Ripple effect still present!');
  }

  // Security headers
  const r = await request('/');
  console.log('\n─ SECURITY HEADERS ─');
  console.log(`X-Frame-Options: ${r.headers['x-frame-options']}`);
  console.log(`Strict-Transport-Security: ${r.headers['strict-transport-security']?.slice(0,30)}...`);
  console.log(`X-Content-Type-Options: ${r.headers['x-content-type-options']}`);
  console.log(`Content-Security-Policy: ${r.headers['content-security-policy'] ? 'present' : 'missing'}`);

  // Admin login
  console.log('\n─ ADMIN AUTH ─');
  const login = await request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'jasonasare211@gmail.com', password: 'ChangeMe123!' }),
    headers: { 'Content-Type': 'application/json' }
  });
  console.log(`Login: ${login.status}`);
  if (login.status === 200) {
    const d = JSON.parse(login.body);
    console.log(`  Token: ${d.token ? 'present' : 'missing'}`);
    console.log(`  CSRF cookie: ${login.headers['set-cookie'] ? 'present' : 'missing'}`);
  }

  console.log('\n✓ FINAL CROSS-CHECK COMPLETE');
}

run().catch(e => console.error('Fatal:', e.message));
