// 공공데이터 API 호출·응답 해석을 한곳에 모은 어댑터.
// 실제 API의 요청/응답 형식이 다르면 이 파일(KEY_PARAM, buildUrl, extractPage, normalize)만 고치면 된다.

export const KEY_PARAM = process.env.JEJU_CULTURE_KEY_PARAM || 'serviceKey';

// 포털에서 복사한 'Encoding 키'(%2B 같은 퍼센트 인코딩 포함)도, 'Decoding 키'도 그대로 쓸 수 있게 정규화한다.
export function normalizeKey(raw) {
  const k = String(raw ?? '').trim();
  if (/%[0-9A-Fa-f]{2}/.test(k)) {
    try { return decodeURIComponent(k); } catch { /* 디코딩 불가면 원본 사용 */ }
  }
  return k;
}

export function buildUrl(base, key, page, perPage) {
  const u = new URL(base);
  u.searchParams.set(KEY_PARAM, key);
  // data.go.kr 계열이 쓰는 두 가지 페이지 파라미터 이름을 함께 보낸다.
  u.searchParams.set('page', page);
  u.searchParams.set('perPage', perPage);
  u.searchParams.set('pageNo', page);
  u.searchParams.set('numOfRows', perPage);
  u.searchParams.set('returnType', 'JSON');
  u.searchParams.set('type', 'json');
  return u;
}

// 지원하는 응답 형태
//  1) odcloud:  { data: [...], totalCount }
//  2) 기존 data.go.kr: { response: { body: { items: { item: [...] } | [...], totalCount } } }
export function extractPage(json) {
  if (Array.isArray(json?.data)) return { rows: json.data, total: Number(json.totalCount ?? json.matchCount) || null };
  const body = json?.response?.body;
  if (body) {
    let items = body.items?.item ?? body.items ?? [];
    if (!Array.isArray(items)) items = items ? [items] : [];
    return { rows: items, total: Number(body.totalCount) || null };
  }
  throw new Error('인식할 수 없는 API 응답 형식입니다');
}

const pick = (row, ...names) => {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && String(row[n]).trim() !== '') return String(row[n]).trim();
  return '';
};
const num = v => (v === '' ? NaN : Number(v));

// 한 행을 공통 필드로 정리한다. 없는 필드는 빈 값으로 두고 병합 단계에서 서로 보완한다.
export function normalize(row) {
  return {
    id: Number(pick(row, '데이터 고유번호', '데이터고유번호', 'dataId', 'id')),
    name: pick(row, '장소명', 'placeName', 'name'),
    lat: num(pick(row, '위도', 'latitude', 'lat')),
    lng: num(pick(row, '경도', 'longitude', 'lng')),
    addr: pick(row, '위치', '주소', 'address'),
    title: pick(row, '제목', 'title'),
    author: pick(row, '저작자', 'author'),
    date: pick(row, '발행일', 'publishedDate'),
    url: pick(row, '데이터 상세보기 URL', '데이터상세보기URL', 'url'),
  };
}

// 위치정보(좌표·주소·URL)와 일반정보(제목·저작자·발행일)를 고유번호로 합친다.
export function mergePlaces(locationRows, infoRows) {
  const map = new Map();
  for (const r of [...infoRows, ...locationRows]) {
    const p = normalize(r);
    if (!Number.isFinite(p.id)) continue;
    const prev = map.get(p.id) || {};
    const next = { ...prev };
    for (const [k, v] of Object.entries(p)) if (v !== '' && !(typeof v === 'number' && Number.isNaN(v))) next[k] = v;
    map.set(p.id, next);
  }
  return [...map.values()].filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.name);
}
