// Vercel 함수: GET /api/image?id=<장소번호> — Pixabay 참고 이미지를 Vercel Blob(내 저장소)에 내려받아 두고 그 주소를 돌려준다.
// Pixabay 약관: 이미지는 Pixabay 주소를 계속 직접 연결하지 말고 내 저장소에 내려받아 쓰고, 출처를 표시한다.
// 필요한 환경변수: PIXABAY_API_KEY, BLOB_READ_WRITE_TOKEN(Vercel 대시보드에서 Blob 저장소를 프로젝트에 연결하면 자동 생성)
// 둘 중 하나라도 없으면 { enabled:false } 를 돌려주고 화면은 기본 일러스트를 보여 준다.
import { put, list } from '@vercel/blob';
import story from '../public/story.json' with { type: 'json' };

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const DAY = 24 * 3600_000;

// blob 저장소는 인자로 받아 테스트에서 가짜로 바꿀 수 있게 한다.
export function makeHandler(blob, env = process.env) {
  const pixabayUrl = String(env.PIXABAY_API_URL || 'https://pixabay.com/api/').trim();
  const allowedHosts = new Set([new URL(pixabayUrl).hostname, 'cdn.pixabay.com']);

  async function readMeta(id) {
    const { blobs } = await blob.list({ prefix: `jeju-img/${id}.json`, limit: 1 });
    if (!blobs.length) return null;
    const r = await fetch(blobs[0].url);
    return r.ok ? r.json() : null;
  }
  async function downloadToBlob(id, hit) {
    const src = new URL(hit.webformatURL);
    if (src.protocol !== 'https:' && src.hostname !== '127.0.0.1') throw new Error('허용되지 않은 이미지 주소입니다');
    if (!allowedHosts.has(src.hostname)) throw new Error('허용되지 않은 이미지 주소입니다');
    const res = await fetch(src, { signal: AbortSignal.timeout(15_000) }).catch(() => { throw new Error('이미지를 내려받지 못했습니다'); });
    const ext = EXT[(res.headers.get('content-type') || '').split(';')[0]];
    if (!res.ok || !ext) throw new Error('이미지 응답이 올바르지 않습니다');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) throw new Error('이미지가 너무 큽니다');
    const saved = await blob.put(`jeju-img/${id}.${ext}`, buf, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: res.headers.get('content-type').split(';')[0] });
    return saved.url;
  }
  async function search(id, q) {
    const u = new URL(pixabayUrl);
    for (const [k, v] of Object.entries({ key: String(env.PIXABAY_API_KEY).trim(), q, image_type: 'photo', orientation: 'horizontal', safesearch: 'true', per_page: 5, order: 'popular' })) u.searchParams.set(k, v);
    const res = await fetch(u, { signal: AbortSignal.timeout(10_000) }).catch(() => { throw new Error('Pixabay에 연결하지 못했습니다'); });
    if (!res.ok) throw new Error(`Pixabay 오류 (HTTP ${res.status})`);   // URL(키 포함)은 메시지에 넣지 않는다
    const hit = (await res.json().catch(() => ({}))).hits?.[0];
    const meta = hit
      ? { file: await downloadToBlob(id, hit), user: String(hit.user || ''), pageURL: String(hit.pageURL || ''), at: Date.now() }
      : { none: true, at: Date.now() };
    // 메타는 캐시 시간을 짧게 두어 ‘결과 없음’이 오래 남지 않게 한다
    await blob.put(`jeju-img/${id}.json`, JSON.stringify(meta), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
    return meta;
  }

  return async function handler(req, res) {
    if (!String(env.PIXABAY_API_KEY ?? '').trim() || !String(env.BLOB_READ_WRITE_TOKEN ?? '').trim()) return res.status(200).json({ enabled: false });
    const id = String(req.query?.id ?? '');
    if (!/^\d{1,6}$/.test(id)) return res.status(400).json({ error: 'id가 올바르지 않습니다' });
    const q = story.stories.find(s => s.id === Number(id))?.q;
    if (!q) return res.status(404).json({ error: '알 수 없는 장소입니다' });   // 이야기에 있는 장소만 검색해 Pixabay 호출 한도를 보호
    try {
      let meta = await readMeta(id);
      if (!(meta && (meta.file || (meta.none && Date.now() - meta.at < DAY)))) meta = await search(id, q);
      res.setHeader('Cache-Control', 'public, s-maxage=3600');
      if (meta.none) return res.status(200).json({ enabled: true, found: false });
      return res.status(200).json({ enabled: true, found: true, src: meta.file, user: meta.user, pageURL: meta.pageURL });
    } catch (e) {
      console.error('[image]', id, e.message);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: e.message });
    }
  };
}

export default makeHandler({ put, list });
