# 약속시간 — 사진 기반 복약 시간표 + 식약처 DUR 점검

이 버전은 다음 흐름을 구현합니다.

1. 약 봉투·처방전 사진을 Gemini가 **글자 인식(OCR)** 합니다.
2. 읽은 약 이름을 식품의약품안전처 의약품 품목정보와 대조합니다.
3. 처방전에 시각이 적혀 있으면 그대로 사용하고, `1일 3회 식후`처럼 시각이 없으면 사용자가 입력한 식사시간 기준으로 **확인용 시간**을 제안합니다.
4. 등록된 여러 약의 동일 성분 중복, DUR 병용금기, 효능군 중복, 65세 이상 노인주의 정보를 조회합니다.
5. 정확히 매칭되지 않은 제품은 안전점검에서 제외하고 화면에 “공식 품목 확인 필요”라고 표시합니다.

> 중요: 이 프로젝트는 일정 정리와 공공데이터 조회용 시제품입니다. 처방 변경, 복용 중단, 용량 결정 기능이 아닙니다. 병용금기는 복용 시간을 띄운다고 자동 해결되는 문제가 아니므로 의사·약사 확인을 안내합니다.

## 1. GitHub 저장소에 놓을 파일

저장소의 가장 바깥쪽(루트)에 아래처럼 놓습니다.

```text
내-저장소/
├─ .env                 ← 내 컴퓨터에만 생성, GitHub 업로드 금지
├─ .env.example         ← GitHub에 업로드
├─ .gitignore
├─ README.md
├─ index.html
├─ server.js
├─ package.json
└─ package-lock.json
```

보내주신 `gitignore.txt`는 GitHub에서 파일 이름을 반드시 `.gitignore`로 바꾸세요. 완성본 묶음에는 올바른 이름의 `.gitignore`도 포함되어 있습니다.

## 2. API 키 준비

### Gemini

기존에 쓰던 `GEMINI_API_KEY`를 그대로 사용할 수 있습니다. `.env.example`을 복사해 `.env`라는 새 파일을 만들고 키를 넣으세요.

```env
GEMINI_API_KEY=실제_키
GEMINI_MODEL=gemini-3.6-flash
```

모델 이름이 계정에서 지원되지 않는다는 오류가 나오면 사용 중인 Gemini 계정에서 제공되는 모델 이름으로 `GEMINI_MODEL`만 바꾸면 됩니다.

### 식품의약품안전처 / 공공데이터포털

1. [공공데이터포털](https://www.data.go.kr/)에 가입하고 로그인합니다.
2. `식품의약품안전처 의약품 제품 허가정보`를 검색해 **활용신청**합니다.
3. `식품의약품안전처 의약품안전사용서비스(DUR) 품목정보`도 검색해 **활용신청**합니다.
4. 마이페이지에서 발급된 **일반 인증키(Decoding)** 값을 복사합니다.
5. `.env`에 다음 줄을 추가합니다.

```env
MFDS_API_KEY=복사한_일반인증키_Decoding
```

승인 직후에는 실제 호출까지 시간이 조금 걸릴 수 있습니다. `SERVICE_ACCESS_DENIED`가 나오면 활용신청한 서비스와 승인 상태를 다시 확인하세요.

## 3. 내 컴퓨터에서 실행

Node.js 20 이상이 필요합니다. Windows에서 저장소 폴더를 연 뒤 주소창에 `powershell`을 입력하고 다음 명령을 한 줄씩 실행하세요.

```powershell
npm install
Copy-Item .env.example .env
notepad .env
npm start
```

메모장에서 두 API 키를 입력하고 저장한 뒤 브라우저에서 아래 주소를 여세요.

```text
http://localhost:3000
```

설정 확인 주소는 `http://localhost:3000/api/health`입니다. 다음 두 값이 모두 `true`면 키 이름을 올바르게 읽은 것입니다.

```json
{
  "ok": true,
  "geminiConfigured": true,
  "mfdsConfigured": true
}
```

## 4. GitHub에 올리기

GitHub 저장소 화면의 **Add file → Upload files**를 누르고 `.env`를 제외한 파일을 올립니다. `.gitignore`가 있기 때문에 Git 명령을 써도 `.env`와 `node_modules`는 올라가지 않습니다.

> GitHub Pages만으로는 `server.js`를 실행할 수 없습니다. 이 프로젝트는 사진과 API 키를 서버에서 처리하므로 Node.js 서버가 필요합니다.

가장 쉬운 배포 흐름은 다음과 같습니다.

1. GitHub에 코드를 올립니다.
2. Render 같은 Node.js 호스팅에서 **New Web Service**를 선택합니다.
3. GitHub 저장소를 연결합니다.
4. Build Command는 `npm install`, Start Command는 `npm start`로 둡니다.
5. 호스팅 서비스의 Environment Variables에 `GEMINI_API_KEY`, `GEMINI_MODEL`, `MFDS_API_KEY`를 등록합니다.
6. 배포된 주소에서 `/api/health`를 먼저 확인합니다.

API 키는 `index.html` 안에 절대 넣지 마세요. 브라우저에 공개됩니다.

## 5. 어떤 파일에 무엇이 추가됐나

### `server.js`

- `/api/analyze-prescription`: 사진 OCR 후 식약처 품목 후보까지 붙여 반환
- `/api/check-safety`: 등록 약을 다시 식약처 품목과 연결하고 성분 중복·병용금기·효능군 중복·노인주의 점검
- `/api/health`: 환경변수 설정 상태 확인
- 공공 API 15분 캐시, 12초 타임아웃, 사진 형식·크기 제한
- API 경로가 변경될 때 `.env`만 바꿀 수 있는 설정값

### `index.html`

- 복용자 나이와 기본 아침·점심·저녁 시간 입력
- 사진 인식 결과별 식약처 공식 품목 후보 선택
- 처방전 시각 우선, 식사시간 기반 자동 시간 제안
- 약 추가/삭제 때마다 자동 DUR 재점검
- 동일성분·병용금기·효능군중복·노인주의 경고 카드
- “조회 실패”와 “경고 없음”을 안전 판정으로 오해하지 않도록 별도 문구

### `.env.example` / `.gitignore`

- 필요한 환경변수 이름 제공
- 실제 비밀키가 GitHub에 올라가지 않게 차단

## 6. 꼭 시험할 항목

공개 전에 다음을 실제 약사가 검토한 테스트 처방으로 확인하세요.

- 같은 제품명의 제형·함량이 여러 개일 때 올바른 후보를 고를 수 있는지
- 같은 성분이 다른 상품명으로 두 번 들어갔을 때 중복 경고가 뜨는지
- 식약처 DUR에 등록된 병용금기 조합에서 경고가 뜨는지
- 65세 미만/이상으로 바꿨을 때 노인주의 결과가 달라지는지
- 식약처 API가 실패했을 때 “안전”으로 표시되지 않는지
- 흐릿한 사진, 손글씨, 처방전 여러 장에서 잘못 읽은 값을 수정할 수 있는지

실서비스에서는 약사 또는 의료진 검수, 개인정보 처리방침, 사진 전송 동의, 서버 로그에서 처방정보 제거, 접근통제, 전송구간 암호화(HTTPS), 공공데이터 운영계정 신청을 추가로 준비해야 합니다.
