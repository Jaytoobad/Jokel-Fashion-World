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
  const js = await request(jsPath);
  
  console.log('JS length:', js.body.length);
  console.log('Has hero image:', js.body.includes('design-07.jpg'));
  console.log('Has owner.jpg:', js.body.includes('owner.jpg'));
  console.log('Has ph("hero":', js.body.includes('ph("hero"'));
  
  // Check admin routes
  console.log('\nAdmin routes:');
  console.log('  Has applications:', js.body.includes('applications'));
  console.log('  Has enquiries:', js.body.includes('enquiries'));
  console.log('  Has content:', js.body.includes('content'));
  console.log('  Has audit:', js.body.includes('audit'));
  
  console.log('\nDone.');
}

run().catch(e => console.error('Error:', e.message));
