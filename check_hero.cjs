const https = require('https');

function request(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://jokel-fashion-world-sigma.vercel.app${path}`, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject);
  });
}

async function run() {
  const html = await request('/');
  const jsMatch = html.body.match(/<script[^>]*src="([^"]*main[^"]*\.js)"[^>]*>/);
  if (!jsMatch) return;
  const jsPath = jsMatch[0].match(/src="([^"]*)"/)[1];
  const js = await request(jsPath);
  
  console.log('JS length:', js.body.length);
  console.log('Has hero image:', js.body.includes('design-07.jpg'));
  console.log('Has ph hero:', js.body.includes('ph("hero"'));
  
  // Show context around design-07
  const idx = js.body.indexOf('design-07');
  if (idx >= 0) {
    console.log('\nContext around design-07:');
    console.log(js.body.substring(Math.max(0, idx-100), idx+100));
  }
}

run().catch(e => console.error('Error:', e.message));
