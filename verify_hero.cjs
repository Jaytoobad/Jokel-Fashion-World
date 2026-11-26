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
  if (!jsMatch) {
    console.log('No JS file found');
    return;
  }
  const jsPath = jsMatch[0].match(/src="([^"]*)"/)[1];
  console.log('JS file:', jsPath);
  
  const js = await request(jsPath);
  
  console.log('JS length:', js.body.length);
  console.log('Has owner.jpg:', js.body.includes('owner.jpg'));
  console.log('Has owner.jpg img tag:', js.body.includes('<img src="/images/owner.jpg"'));
  console.log('Has ph("hero":', js.body.includes('ph("hero"'));
  
  // Show context around owner.jpg
  const idx = js.body.indexOf('owner.jpg');
  if (idx >= 0) {
    console.log('\nContext around owner.jpg:');
    console.log(js.body.substring(Math.max(0, idx-200), idx+100));
  }
}

run().catch(e => console.error('Error:', e.message));
