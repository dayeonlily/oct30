// 스탬프 투어 서버: API 키를 환경변수에서 읽어 공공데이터 API를 대신 호출하고, 정리된 결과를 /api/places 로 내려준다.
// 키는 이 프로세스 밖(브라우저·응답·로그)으로 나가지 않는다.
//   실행:  node server.mjs          (Node 18 이상, 별도 설치 패키지 없음)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPlaces, missingEnv } from './lib/places.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const env = process.env;

// 필수 설정: 키 2개(환경변수)와 API 주소 2개(환경변수, 비밀 아님). 호출 로직은 lib/places.mjs(Vercel 함수와 공용)
const missing = missingEnv(env);
if (missing.length) {
  console.error('다음 환경변수가 설정되지 않았습니다:\n  ' + missing.join('\n  ') + '\n\n설정 방법은 README.md 를 참고하세요.');
  process.exit(1);
}

// 선택 설정: Pixabay 키(없으면 그림 이미지 대신 기본 일러스트를 보여 줌), 내용 오류 신고 메일(없으면 신고 버튼 숨김)
const PIXABAY_KEY = String(env.PIXABAY_API_KEY ?? '').trim();
const PIXABAY_URL = String(env.PIXABAY_API_URL || 'https://pixabay.com/api/').trim();
const FEEDBACK_EMAIL = String(env.FEEDBACK_EMAIL ?? '').trim();
const IMG_DIR = path.join(ROOT, 'cache', 'images');
const IMG_META = path.join(ROOT, 'cache', 'images.json');

const PORT = Number(env.PORT) || 5200;
const HOST = env.HOST || '127.0.0.1';
const TTL_MS = (Number(env.JEJU_CULTURE_CACHE_MIN) || 60) * 60_000;

let cache = null;   // { at, places }
let inflight = null;
async function loadPlaces() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  inflight ??= (async () => {
    try {
      cache = { at: Date.now(), places: await fetchPlaces(env) };
      return cache;
    } finally { inflight = null; }
  })();
  try { return await inflight; }
  catch (e) { if (cache) return { ...cache, stale: true }; throw e; }   // 실패하면 마지막 성공 데이터를 쓴다
}

// ── Pixabay 참고 이미지 ──
// Pixabay 약관: 검색 결과는 24시간 캐시하고, 쓸 이미지는 URL을 직접 연결하지 말고 내 서버에 내려받아 쓴다. 출처 표시 필수.
let imgMeta = {};
try { imgMeta = JSON.parse(await fs.readFile(IMG_META, 'utf8')); } catch { /* 첫 실행 */ }
const IMG_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const imgInflight = new Map();
const allowedImgHosts = new Set([new URL(PIXABAY_URL).hostname, 'cdn.pixabay.com']);

async function storyQuery(id) {
  const story = JSON.parse(await fs.readFile(path.join(PUBLIC, 'story.json'), 'utf8'));
  return story.stories.find(s => s.id === Number(id))?.q || null;
}
async function downloadImage(hit) {
  const src = new URL(hit.webformatURL);
  if (!allowedImgHosts.has(src.hostname)) throw new Error('허용되지 않은 이미지 주소입니다');
  const res = await fetch(src, { signal: AbortSignal.timeout(15_000) }).catch(() => { throw new Error('이미지를 내려받지 못했습니다'); });
  const ext = IMG_EXT[(res.headers.get('content-type') || '').split(';')[0]];
  if (!res.ok || !ext) throw new Error('이미지 응답이 올바르지 않습니다');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 4 * 1024 * 1024) throw new Error('이미지가 너무 큽니다');
  const file = `${Number(hit.id)}.${ext}`;
  await fs.mkdir(IMG_DIR, { recursive: true });
  await fs.writeFile(path.join(IMG_DIR, file), buf);
  return file;
}
async function findImage(id) {
  const cached = imgMeta[id];
  if (cached?.file && await fs.access(path.join(IMG_DIR, cached.file)).then(() => true, () => false)) return cached;
  if (cached?.none && Date.now() - cached.at < 24 * 3600_000) return cached;   // 결과 없음도 24시간 캐시
  const q = await storyQuery(id);
  if (!q) return null;
  const u = new URL(PIXABAY_URL);
  for (const [k, v] of Object.entries({ key: PIXABAY_KEY, q, image_type: 'photo', orientation: 'horizontal', safesearch: 'true', per_page: 5, order: 'popular' })) u.searchParams.set(k, v);
  const res = await fetch(u, { signal: AbortSignal.timeout(10_000) }).catch(() => { throw new Error('Pixabay에 연결하지 못했습니다'); });
  if (!res.ok) throw new Error(`Pixabay 오류 (HTTP ${res.status})`);   // URL(키 포함)은 메시지에 넣지 않는다
  const hit = (await res.json().catch(() => ({}))).hits?.[0];
  let meta;
  if (!hit) meta = { none: true, at: Date.now() };
  else meta = { file: await downloadImage(hit), user: String(hit.user || ''), pageURL: String(hit.pageURL || ''), at: Date.now() };
  imgMeta[id] = meta;
  await fs.mkdir(path.dirname(IMG_META), { recursive: true });
  await fs.writeFile(IMG_META, JSON.stringify(imgMeta));
  return meta;
}
function getImage(id) {
  if (!imgInflight.has(id)) imgInflight.set(id, findImage(id).finally(() => imgInflight.delete(id)));
  return imgInflight.get(id);
}

const MIME = { '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const send = (res, code, body, type = 'application/json; charset=utf-8', cache = 'no-store') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': cache, 'x-content-type-options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/health') return send(res, 200, { ok: true });   // 키 값은 노출하지 않는다
    if (url.pathname === '/api/config') return send(res, 200, { imagesEnabled: !!PIXABAY_KEY, feedbackEmail: FEEDBACK_EMAIL || null });
    if (url.pathname === '/api/image') {
      if (!PIXABAY_KEY) return send(res, 200, { enabled: false });
      const id = url.searchParams.get('id') || '';
      if (!/^\d{1,6}$/.test(id)) return send(res, 400, { error: 'id가 올바르지 않습니다' });
      const m = await getImage(id);
      if (!m) return send(res, 404, { error: '알 수 없는 장소입니다' });
      if (m.none) return send(res, 200, { enabled: true, found: false });
      return send(res, 200, { enabled: true, found: true, src: '/img-cache/' + m.file, user: m.user, pageURL: m.pageURL });
    }
    if (url.pathname.startsWith('/img-cache/')) {
      const name = url.pathname.slice('/img-cache/'.length);
      if (!/^\d+\.(jpg|png|webp|gif)$/.test(name)) return send(res, 404, { error: 'not found' });
      const data = await fs.readFile(path.join(IMG_DIR, name)).catch(() => null);
      if (!data) return send(res, 404, { error: 'not found' });
      return send(res, 200, data, MIME['.' + name.split('.')[1]] || 'image/jpeg', 'public, max-age=86400');
    }
    if (url.pathname === '/api/places') {
      if (req.method !== 'GET') return send(res, 405, { error: 'GET만 지원합니다' });
      const c = await loadPlaces();
      return send(res, 200, { updatedAt: new Date(c.at).toISOString(), stale: !!c.stale, count: c.places.length, places: c.places });
    }
    // 정적 파일 (public/ 밖으로 나가는 경로는 차단)
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'forbidden' });
    const data = await fs.readFile(file).catch(() => null);
    if (!data) return send(res, 404, { error: 'not found' });
    return send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    console.error('[요청 실패]', url.pathname, '-', e.message);
    return send(res, 502, { error: e.message });
  }
});

server.listen(PORT, HOST, () => console.log(`스탬프 투어 서버: http://${HOST}:${PORT}  (키 2개 로드됨, 값은 출력하지 않음) · 참고 이미지: ${PIXABAY_KEY ? 'Pixabay 사용' : '꺼짐(PIXABAY_API_KEY 없음)'}`));
