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
  const jsMatch = html.body.match(/<script[^>]*src="([^"]*main[^"]*\.js)"[^>]*>/);
  
  console.log('HTML length:', html.body.length);
  console.log('CSS file:', cssMatch ? cssMatch[1] : 'not found');
  console.log('JS file:', jsMatch ? jsMatch[1] : 'not found');
  
  if (cssMatch) {
    const css = await request(cssMatch[1]);
    console.log('\nCSS checks:');
    console.log('  .cur present:', css.body.includes('.cur'));
    console.log('  .rip present:', css.body.includes('.rip'));
    console.log('  @keyframes rip present:', css.body.includes('@keyframes rip'));
    console.log('  @keyframes up present:', css.body.includes('@keyframes up'));
    console.log('  @keyframes fade present:', css.body.includes('@keyframes fade'));
    console.log('  @keyframes pulse present:', css.body.includes('@keyframes pulse'));
  }
  
  if (jsMatch) {
    const js = await request(jsMatch[1]);
    console.log('\nJS checks:');
    console.log('  .cur present:', js.body.includes('.cur'));
    console.log('  .rip present:', js.body.includes('.rip'));
    console.log('  Where Creativity Meets Craftsmanship:', js.body.includes('Where Creativity Meets Craftsmanship'));
    console.log('  Begin your creative journey:', js.body.includes('Begin your creative journey'));
    console.log('  Verified entries will appear here:', js.body.includes('Verified entries will appear here'));
    console.log('  Timeless Elegance:', js.body.includes('Timeless Elegance'));
  }
  
  console.log('\nDone.');
}

run().catch(e => console.error('Error:', e.message));
