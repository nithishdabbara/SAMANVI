const localtunnel = require('localtunnel');
const fs = require('fs');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 5000 });
    const url = tunnel.url + '/api';
    console.log('TUNNEL_URL:', url);
    fs.writeFileSync('tunnel_url.txt', url);
  } catch (err) {
    console.error('Tunnel error:', err);
  }
})();
