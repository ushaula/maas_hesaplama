// Test API endpoint
export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS request için
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Basit test response
  return res.status(200).json({
    success: true,
    message: 'API çalışıyor!',
    timestamp: new Date().toISOString(),
    method: req.method,
    body: req.body
  });
}