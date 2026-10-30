// 개발·테스트용 가짜 공공데이터 API. 실제 API가 없어도 서버·화면의 전체 흐름을 확인할 수 있다.
// 이 서버도 키를 코드에 두지 않고 같은 환경변수(JEJU_CULTURE_*_KEY)와 비교한다.
//   실행:  node mock/mock-api.mjs      (포트 5190, 경로 /location, /info)
//   MOCK_SHAPE=classic 이면 기존 data.go.kr 형태(response.body.items.item)로 응답한다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const load = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const DATA = { '/location': { rows: load('location.json'), keyVar: 'JEJU_CULTURE_LOCATION_KEY' },
               '/info': { rows: load('info.json'), keyVar: 'JEJU_CULTURE_INFO_KEY' } };
const classic = process.env.MOCK_SHAPE === 'classic';

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const src = DATA[u.pathname];
  const json = (c, o) => { res.writeHead(c, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
  if (!src) return json(404, { msg: 'no such api' });
  const expected = process.env[src.keyVar];
  if (!expected || u.searchParams.get('serviceKey') !== expected) return json(401, { code: -4, msg: '등록되지 않은 인증키 입니다.' });
  const page = Number(u.searchParams.get('page')) || 1, per = Number(u.searchParams.get('perPage')) || 10;
  const rows = src.rows.slice((page - 1) * per, page * per);
  console.log(`[mock] ${u.pathname} page=${page} perPage=${per} -> ${rows.length}건`);   // 키는 출력하지 않는다
  json(200, classic
    ? { response: { header: { resultCode: '00' }, body: { items: { item: rows }, pageNo: page, numOfRows: per, totalCount: src.rows.length } } }
    : { page, perPage: per, currentCount: rows.length, totalCount: src.rows.length, data: rows });
}).listen(5190, '127.0.0.1', () => console.log('mock API: http://127.0.0.1:5190/{location,info}'));
