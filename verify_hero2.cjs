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
  // Check if hero image exists
  const ownerImg = await request('/images/owner.jpg');
  console.log('owner.jpg status:', ownerImg.status, 'length:', ownerImg.body.length);
  
  const heroImg = await request('/images/hero.jpg');
  console.log('hero.jpg status:', heroImg.status, 'length:', heroImg.body.length);
  
  // Check full HTML to see hero section
  const html = await request('/');
  console.log('\nHTML length:', html.body.length);
  console.log('Has ph hero:', html.body.includes('ph("hero"'));
  console.log('Has owner.jpg:', html.body.includes('owner.jpg'));
  
  console.log('\nDone.');
}

run().catch(e => console.error('Error:', e.message));
