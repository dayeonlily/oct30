// 이야기 데이터(story.mjs)와 화면(app.html)을 public/ 으로 내보낸다.
//   실행: node src/build.mjs     (장소 이름·좌표 등은 포함하지 않는다. 서버가 API에서 받아 붙인다.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERAS, STORIES, GLOSSARY } from './story.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', 'public');

const eraIds = new Set(ERAS.map(e => e.id));
for (const s of STORIES) {
  if (!eraIds.has(s.era)) throw new Error('알 수 없는 시대: ' + s.id);
  if (!s.teenOnly && (!s.qk || !s.kid || !s.exk)) throw new Error('어린이용 내용 누락: ' + s.id);
  if (!s.qt || s.qt.length !== 5 || !s.ext) throw new Error('청소년용 내용 누락: ' + s.id);
  if (s.qk && s.qk.length !== 4) throw new Error('어린이 퀴즈 형식: ' + s.id);
}
if (STORIES.length !== new Set(STORIES.map(s => s.id)).size) throw new Error('중복 id');

const stories = STORIES.map(({ id, era, kid, teen, qk, qt, exk, ext, q, note, sensitive, teenOnly }) =>
  ({ id, era, kid, teen, qk, qt, exk, ext, q, note, sensitive, teenOnly: !!teenOnly }));
fs.mkdirSync(pub, { recursive: true });
fs.writeFileSync(path.join(pub, 'story.json'), JSON.stringify({ eras: ERAS, stories, glossary: GLOSSARY }));
fs.copyFileSync(path.join(here, 'app.html'), path.join(pub, 'index.html'));
console.log('빌드 완료: 장소', stories.length, '· 낱말', Object.keys(GLOSSARY).length);
