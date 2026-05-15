import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/send-whatsapp',
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://github.io',
    'Access-Control-Request-Method': 'POST'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
