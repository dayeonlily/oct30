// 개발·테스트용 가짜 Pixabay API. 키는 환경변수 PIXABAY_API_KEY 와 비교한다.
//   실행: node mock/mock-pixabay.mjs   (포트 5191)  →  서버 실행 시 PIXABAY_API_URL=http://127.0.0.1:5191/api/
import http from 'node:http';
// 회색 1x1 PNG (테스트용)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/img/')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
  if (u.pathname === '/api/') {
    if (!process.env.PIXABAY_API_KEY || u.searchParams.get('key') !== process.env.PIXABAY_API_KEY) {
      res.writeHead(400, { 'content-type': 'text/plain' }); return res.end('[ERROR 400] Invalid API key');
    }
    const q = u.searchParams.get('q') || '';
    console.log('[mock-pixabay] q=' + q);   // 키는 출력하지 않는다
    const hits = q === 'nohit' ? [] : [{ id: 1000 + [...q].reduce((a, c) => a + c.charCodeAt(0), 0) % 9000, user: 'tester', pageURL: 'https://pixabay.com/photos/test-1/', tags: q,
      webformatURL: 'http://127.0.0.1:5191/img/test.png' }];
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ total: hits.length, hits }));
  }
  res.writeHead(404); res.end();
}).listen(5191, '127.0.0.1', () => console.log('mock Pixabay: http://127.0.0.1:5191/api/'));
