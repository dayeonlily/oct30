// 공공데이터 API 호출 + 두 결과 병합. 로컬 서버(server.mjs)와 Vercel 함수(api/places.js)가 함께 쓴다.
// 키는 호출 시점에 환경변수에서 읽고, 오류 메시지에는 요청 URL(키 포함)을 절대 넣지 않는다.
import { buildUrl, extractPage, mergePlaces, normalizeKey } from '../adapter.mjs';

export const SOURCES = [
  { label: '위치정보', keyVar: 'JEJU_CULTURE_LOCATION_KEY', urlVar: 'JEJU_CULTURE_LOCATION_URL' },
  { label: '일반정보', keyVar: 'JEJU_CULTURE_INFO_KEY', urlVar: 'JEJU_CULTURE_INFO_URL' },
];
const PER_PAGE = 100, MAX_PAGES = 50;

// 설정되지 않은 필수 환경변수 이름 목록(값은 다루지 않는다)
export const missingEnv = env =>
  SOURCES.flatMap(s => [s.keyVar, s.urlVar].filter(v => !String(env[v] ?? '').trim()));

async function fetchAll(src, env) {
  const base = String(env[src.urlVar]).trim();
  const key = normalizeKey(env[src.keyVar]);
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(buildUrl(base, key, page, PER_PAGE), { signal: AbortSignal.timeout(15_000) })
      .catch(() => { throw new Error(`${src.label} API에 연결하지 못했습니다`); });
    if (res.status === 401 || res.status === 403) throw new Error(`${src.label} API가 인증키를 거부했습니다 (${src.keyVar} 확인)`);
    if (!res.ok) throw new Error(`${src.label} API 오류 (HTTP ${res.status})`);
    let json;
    try { json = await res.json(); } catch { throw new Error(`${src.label} API 응답이 JSON이 아닙니다`); }
    let got;
    try { got = extractPage(json); } catch (e) { throw new Error(`${src.label}: ${e.message}`); }
    rows.push(...got.rows);
    if (!got.rows.length || got.rows.length < PER_PAGE || (got.total && rows.length >= got.total)) break;
  }
  return rows;
}

// 위치정보 + 일반정보를 받아 고유번호로 합친 장소 목록을 돌려준다.
export async function fetchPlaces(env = process.env) {
  const missing = missingEnv(env);
  if (missing.length) throw new Error('서버 설정이 부족합니다 (환경변수: ' + missing.join(', ') + ')');
  const [loc, info] = await Promise.all(SOURCES.map(s => fetchAll(s, env)));
  return mergePlaces(loc, info);
}
