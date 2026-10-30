# 제주 시간여행 스탬프 투어

시대별(선사~오늘) 제주 역사문화 스탬프 투어입니다. 어린이용·청소년용 두 가지 눈높이를 지원합니다.
장소 정보는 **공공데이터 API**로, 참고 이미지는 **Pixabay API**로 받아오고, 키는 모두 **환경변수**로만 읽습니다.

```
브라우저 ─ /api/places ─▶ server.mjs ─(키)─▶ 공공데이터 API ×2   (이름·좌표·주소·자료 제목·원문 링크)
   │    └ /api/image ───▶            ─(키)─▶ Pixabay API        (장소별 참고 이미지, 내려받아 서버에 저장)
   └ /story.json (시대·설명·퀴즈·해설·낱말 풀이)
```

> 브라우저는 환경변수를 읽을 수 없어서, 키를 쓰는 호출은 서버(`server.mjs`)가 대신합니다. 키는 브라우저·응답·로그로 나가지 않습니다.
> 그래서 `index.html`을 더블클릭해서 열 수 없고, **서버를 실행한 뒤 주소로 접속**해야 합니다.

## 환경변수

필수 (없으면 어떤 변수가 빠졌는지 알려 주고 시작하지 않음)

| 이름 | 설명 |
|---|---|
| `JEJU_CULTURE_INFO_KEY` | 제주역사문화 **일반정보** API 인증키 |
| `JEJU_CULTURE_LOCATION_KEY` | 제주역사문화 **위치정보** API 인증키 |
| `JEJU_CULTURE_INFO_URL` | 일반정보 API 요청 주소(키 제외) |
| `JEJU_CULTURE_LOCATION_URL` | 위치정보 API 요청 주소(키 제외) |

선택

| 이름 | 설명 |
|---|---|
| `PIXABAY_API_KEY` | 있으면 장소 그림을 Pixabay 사진으로 보여 줍니다. **없으면 시대별 기본 일러스트**가 나옵니다. |
| `FEEDBACK_EMAIL` | 있으면 각 장소 화면에 ‘내용이 이상하면 알려 주세요’(메일) 링크가 생깁니다. 없으면 숨김. |
| `PORT`, `HOST` | 기본 `5200`, `127.0.0.1` |
| `JEJU_CULTURE_CACHE_MIN` | 공공데이터 결과 캐시(분), 기본 60 |
| `JEJU_CULTURE_KEY_PARAM` | 공공데이터 키 파라미터 이름, 기본 `serviceKey` |
| `PIXABAY_API_URL` | 테스트용으로 Pixabay 주소를 바꿀 때만 사용 |

공공데이터포털에서 복사한 키는 *Encoding*(`%2B` 등 포함)이든 *Decoding*이든 그대로 넣어도 됩니다.

## 실행 (Node 18 이상, 설치할 패키지 없음)

PowerShell:

```powershell
cd C:\vibe\day5\stamp-tour
$env:JEJU_CULTURE_INFO_KEY      = "<일반정보 키>"
$env:JEJU_CULTURE_LOCATION_KEY  = "<위치정보 키>"
$env:JEJU_CULTURE_INFO_URL      = "<일반정보 API 주소>"
$env:JEJU_CULTURE_LOCATION_URL  = "<위치정보 API 주소>"
$env:PIXABAY_API_KEY            = "<Pixabay 키>"     # 선택
node server.mjs
```

그 뒤 http://127.0.0.1:5200 에 접속합니다. `.env` 파일을 쓰려면 `.env.example`을 `.env`로 복사해 채우고 `node --env-file=.env server.mjs`로 실행합니다(`.env`는 `.gitignore`에 포함).

## 처음 쓰는 사람을 위한 화면 구성

- **처음 화면**: 어린이용/청소년용을 먼저 고르게 합니다(고르기 전에는 닫히지 않음). 이후에도 상단 버튼으로 바꿀 수 있고, 스탬프는 모드별로 따로 저장됩니다.
- **장소 화면**: 참고 이미지 → 설명(낱말 누르면 뜻풀이, 🔊 읽어 주기) → 퀴즈 → **정답 해설** + 스탬프. 청소년용은 자료 출처도 보입니다.
- **스탬프북**: 시대별 스탬프, 수료증(인쇄), **저장 코드로 백업·옮기기**, **이미지로 저장**.
- **더 알아보기**: 투어에 넣지 않은 장소를 API 결과에서 검색합니다.
- **안내(ℹ️)**: 자료·시대 구분 방식·일반 상식이 섞인 부분·아픈 역사 장소·선생님/보호자 안내.
- 접근성: 글자 크게, 터치 영역 44px 이상, 대비 4.5:1 이상의 시대 색, 키보드·화면낭독기용 라벨, 움직임 줄이기 설정 반영.

## Pixabay 이미지 처리

Pixabay 약관에 맞춰 서버가 검색 결과를 받아 **이미지를 `cache/images/`에 내려받아 서버에서 제공**합니다(Pixabay 주소를 화면에 직접 연결하지 않음). 한 번 받은 장소는 다시 요청하지 않고, ‘결과 없음’은 24시간 캐시합니다. 화면에는 촬영자와 Pixabay 링크를 함께 보여 줍니다.
장소별 검색어는 `src/story-extra.mjs`의 `QUERY`에 있습니다. Pixabay 사진은 분위기를 보여 주는 **참고 이미지**라서 화면에도 그렇게 표시합니다.
> 테스트용 가짜 키로 받은 이미지가 남지 않도록, 키를 바꿨다면 `cache/` 폴더를 지워 주세요.

## 내용 수정 · 빌드

설명·퀴즈·해설·낱말 풀이·시대 정의는 `src/story.mjs`(장소별 본문·퀴즈)와 `src/story-extra.mjs`(해설·검색어·주석·낱말 풀이)에, 화면은 `src/app.html`에 있습니다. 고친 뒤:

```powershell
node src/build.mjs     # public/story.json, public/index.html 생성
```

## 실제 공공데이터 API 형식에 맞추기

요청 파라미터와 응답 해석은 `adapter.mjs`에 모여 있습니다(`buildUrl`, `extractPage`, `normalize`). `{data:[...]}`(odcloud)와 `{response:{body:{items}}}`(기존 data.go.kr) 형태의 **JSON**을 지원하고 **XML은 지원하지 않습니다**.

> 이 데이터셋(위치정보 15109570, 일반정보 15109587)의 API는 공공데이터포털의 odcloud(`api.odcloud.kr`)이며 응답은 `{ data: [...] }` 형태입니다.
> 환경변수 `..._URL`에는 **데이터 주소**(`https://api.odcloud.kr/api/<번호>/v1/uddi:...`)를 넣는 것이 정석이지만,
> 포털에서 복사한 **Swagger 문서 주소**를 넣어도 서버가 문서 안의 실제 데이터 주소를 찾아 호출합니다(`odcloud.kr` 도메인만 따라감).
> 다른 형식의 API를 쓸 때는 위 세 함수를 조정하세요. 형식이 맞지 않으면 오류 메시지에 응답의 **구조(필드 이름)** 가 표시되어 원인을 알 수 있습니다.

## API 없이 흐름 확인하기 (개발용)

`mock/`에 가짜 API가 있고, 같은 이름의 환경변수 키와 일치할 때만 응답합니다(키는 임시 문자열이면 됩니다).

```powershell
# 터미널 1
$env:JEJU_CULTURE_INFO_KEY="test-info"; $env:JEJU_CULTURE_LOCATION_KEY="test-loc"; node mock/mock-api.mjs
# 터미널 2 (이미지까지 확인하려면)
$env:PIXABAY_API_KEY="test-pix"; node mock/mock-pixabay.mjs
# 터미널 3
$env:JEJU_CULTURE_INFO_KEY="test-info"; $env:JEJU_CULTURE_LOCATION_KEY="test-loc"
$env:JEJU_CULTURE_INFO_URL="http://127.0.0.1:5190/info"; $env:JEJU_CULTURE_LOCATION_URL="http://127.0.0.1:5190/location"
$env:PIXABAY_API_KEY="test-pix"; $env:PIXABAY_API_URL="http://127.0.0.1:5191/api/"
node server.mjs
```

## Vercel 배포

GitHub 저장소를 Vercel 프로젝트에 연결하면 `main`에 푸시할 때마다 자동 배포됩니다. 로컬 `server.mjs`는 개발용이고, Vercel에서는 아래 함수가 같은 일을 합니다.

| 파일 | 역할 |
|---|---|
| `public/` | 화면(`index.html`)과 `story.json` — 정적 파일로 제공 |
| `api/places.js` | `/api/places` — 공공데이터 API 호출·병합. 결과는 Vercel CDN이 1시간 캐시 |
| `api/config.js` | `/api/config` — 이미지 사용 여부, 신고 메일 |
| `api/image.js` | `/api/image` — Pixabay 이미지를 **Vercel Blob**에 저장해 제공 |
| `lib/places.mjs`, `adapter.mjs` | 위 함수와 로컬 서버가 함께 쓰는 호출·해석 로직 |
| `vercel.json` | 정적 폴더(`public`)와 함수 제한 시간 설정 |

Vercel 프로젝트 **Settings → Environment Variables**에 입력합니다(저장소에는 올리지 않음). 변수를 추가·수정한 뒤에는 **Redeploy**해야 반영됩니다.

- 필수: `JEJU_CULTURE_INFO_KEY`, `JEJU_CULTURE_LOCATION_KEY`, `JEJU_CULTURE_INFO_URL`, `JEJU_CULTURE_LOCATION_URL`
- 선택: `FEEDBACK_EMAIL`, `PIXABAY_API_KEY`
- 사진을 쓰려면 **Storage → Blob** 저장소를 만들어 이 프로젝트에 연결하세요(`BLOB_READ_WRITE_TOKEN`이 자동 생성됨). Pixabay 키나 Blob 중 하나라도 없으면 시대별 기본 그림이 나옵니다.
- 화면에 “자료를 불러오지 못했어요”가 뜨면 **Vercel → Logs**에서 `[places]` 줄을 확인하세요. 원인(키 거부, 주소 오류, 응답 형식 불일치 등)이 적혀 있고 키 값은 포함되지 않습니다. 브라우저 Network 탭의 `/api/places` 응답에도 같은 문장이 나옵니다.

함수 동작 확인: 가짜 API 두 개(`mock/`)를 띄운 뒤 `node test/handlers.mjs` (실제 키·네트워크 불필요, 13개 검사).

## 알아둘 점

- 시대 구분은 자료의 제목·주제·내용을 보고 이 프로젝트에서 정리한 것입니다. 자료에 없는 일반 상식이 섞인 곳은 화면에 ‘ℹ️’로 밝힙니다.
- 스탬프·이름은 브라우저(localStorage)에만 저장됩니다. 지도는 인터넷 연결이 필요합니다.
- 서버는 기본적으로 내 컴퓨터(127.0.0.1)에서만 접속됩니다.
