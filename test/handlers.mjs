// Vercel 함수 동작 확인용 스크립트 (가짜 공공 API·가짜 Pixabay·메모리 저장소 사용, 실제 키/네트워크 불필요)
//   준비:  터미널 두 개에서 mock/mock-api.mjs, mock/mock-pixabay.mjs 를 같은 키로 실행
//   실행:  node test/handlers.mjs
import assert from 'node:assert/strict';

const INFO = 'info+key', LOC = 'loc/key==', PIX = 'pix-test-key';
Object.assign(process.env, {
  JEJU_CULTURE_INFO_KEY: encodeURIComponent(INFO), JEJU_CULTURE_LOCATION_KEY: encodeURIComponent(LOC),
  JEJU_CULTURE_INFO_URL: 'http://127.0.0.1:5190/info', JEJU_CULTURE_LOCATION_URL: 'http://127.0.0.1:5190/location',
});

const call = async (handler, { method = 'GET', query = {} } = {}) => {
  const r = { code: 200, headers: {}, body: undefined };
  const res = { setHeader: (k, v) => { r.headers[k.toLowerCase()] = v; }, status(c) { r.code = c; return this; }, json(b) { r.body = b; return this; } };
  await handler({ method, query }, res);
  return r;
};

// 메모리 Blob 저장소 (메타 JSON은 data: URL이라 실제 fetch 로 읽을 수 있다)
const store = new Map();
const fakeBlob = {
  async put(pathname, body, opts) {
    assert.equal(opts.access, 'public');
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const url = pathname.endsWith('.json') ? `data:application/json;base64,${buf.toString('base64')}` : `https://blob.example/${pathname}`;
    store.set(pathname, { url, size: buf.length });
    return { url, pathname };
  },
  async list({ prefix, limit = 1000 }) {
    return { blobs: [...store].filter(([p]) => p.startsWith(prefix)).slice(0, limit).map(([pathname, v]) => ({ pathname, url: v.url })) };
  },
};

let n = 0;
const ok = (name) => console.log(`  ✓ ${name}`, ++n && '');

const { default: places } = await import('../api/places.js');
const { default: config } = await import('../api/config.js');
const { makeHandler } = await import('../api/image.js');

console.log('places');
let r = await call(places);
assert.equal(r.code, 200); assert.equal(r.body.count, 120); assert.match(r.headers['cache-control'], /s-maxage=3600/);
assert.ok(r.body.places.find(p => p.id === 541 && p.name === '입산봉' && p.title)); ok('120건 병합, CDN 캐시 헤더');
r = await call(places, { method: 'POST' }); assert.equal(r.code, 405); ok('GET 외 거부');
const saved = process.env.JEJU_CULTURE_INFO_KEY; process.env.JEJU_CULTURE_INFO_KEY = 'wrong';
r = await call(places); assert.equal(r.code, 502); assert.match(r.body.error, /인증키를 거부/); assert.equal(r.headers['cache-control'], 'no-store');
assert.ok(!JSON.stringify(r.body).includes('wrong')); ok('틀린 키 → 502, 캐시 안 함, 키 값 미노출');
process.env.JEJU_CULTURE_INFO_KEY = saved;
delete process.env.JEJU_CULTURE_LOCATION_URL;
r = await call(places); assert.equal(r.code, 502); assert.match(r.body.error, /JEJU_CULTURE_LOCATION_URL/); ok('환경변수 누락 시 이름만 안내');
process.env.JEJU_CULTURE_LOCATION_URL = 'http://127.0.0.1:5190/location';

console.log('config');
delete process.env.PIXABAY_API_KEY; delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.FEEDBACK_EMAIL;
r = await call(config); assert.deepEqual(r.body, { imagesEnabled: false, feedbackEmail: null }); ok('키 없으면 이미지 꺼짐');
process.env.PIXABAY_API_KEY = PIX; r = await call(config); assert.equal(r.body.imagesEnabled, false); ok('Blob 토큰 없으면 이미지 꺼짐');
process.env.BLOB_READ_WRITE_TOKEN = 'dummy'; process.env.FEEDBACK_EMAIL = 'help@example.org';
r = await call(config); assert.deepEqual(r.body, { imagesEnabled: true, feedbackEmail: 'help@example.org' }); ok('둘 다 있으면 켜짐 + 신고 메일');

console.log('image');
const env = { PIXABAY_API_KEY: PIX, BLOB_READ_WRITE_TOKEN: 'dummy', PIXABAY_API_URL: 'http://127.0.0.1:5191/api/' };
const image = makeHandler(fakeBlob, env);
r = await call(makeHandler(fakeBlob, {}), { query: { id: '541' } }); assert.deepEqual(r.body, { enabled: false }); ok('설정 없으면 enabled:false');
r = await call(image, { query: { id: 'abc' } }); assert.equal(r.code, 400); ok('잘못된 id → 400');
r = await call(image, { query: { id: '99999' } }); assert.equal(r.code, 404); ok('이야기에 없는 장소 → 404 (Pixabay 호출 안 함)');
r = await call(image, { query: { id: '541' } });
assert.equal(r.code, 200); assert.equal(r.body.found, true); assert.match(r.body.src, /^https:\/\/blob\.example\/jeju-img\/541\.png$/); assert.equal(r.body.user, 'tester');
assert.ok(store.has('jeju-img/541.png') && store.has('jeju-img/541.json')); ok('Pixabay 검색 → Blob에 이미지·메타 저장');
const before = store.get('jeju-img/541.json').url;
r = await call(image, { query: { id: '541' } }); assert.equal(r.body.found, true); assert.equal(store.get('jeju-img/541.json').url, before); ok('두 번째는 저장된 메타 사용(재검색 없음)');
r = await call(makeHandler(fakeBlob, { ...env, PIXABAY_API_KEY: 'WRONG' }), { query: { id: '447' } });
assert.equal(r.code, 502); assert.ok(!JSON.stringify(r.body).includes('WRONG')); ok('틀린 Pixabay 키 → 502, 키 미노출');

console.log(`\n${n}개 확인 통과`);
