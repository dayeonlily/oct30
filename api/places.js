// Vercel 함수: GET /api/places — 공공데이터 API 두 개를 호출해 합친 장소 목록을 돌려준다.
// 결과는 Vercel CDN이 1시간 캐시하고(성공 응답만), 그 사이 호출은 공공데이터 API에 가지 않는다.
import { fetchPlaces } from '../lib/places.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET만 지원합니다' });
  try {
    const places = await fetchPlaces(process.env);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ updatedAt: new Date().toISOString(), stale: false, count: places.length, places });
  } catch (e) {
    console.error('[places]', e.message);   // 원인은 Vercel Logs에서 확인 (키 값은 포함되지 않음)
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: e.message });
  }
}
