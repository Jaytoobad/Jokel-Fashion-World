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
  const cssMatch = html.body.match(/<link[^>]*href="([^"]*main[^"]*\.css)"[^>]*>/);
  if (!cssMatch) {
    console.log('No CSS file found');
    return;
  }
  const cssPath = cssMatch[1].match(/href="([^"]*)"/)[1];
  console.log('CSS file:', cssPath);
  
  const css = await request(cssPath);
  
  console.log('\nHero image CSS checks:');
  console.log('  .ph background-image:', css.body.includes('.ph{background-image:'));
  console.log('  .ph background-size:', css.body.includes('.ph{background-size:cover'));
  console.log('  .hero .ph opacity .85:', css.body.includes('.hero .ph{position:absolute;inset:-6% 0;opacity:.85'));
  
  console.log('\nDone.');
}

run().catch(e => console.error('Error:', e.message));
