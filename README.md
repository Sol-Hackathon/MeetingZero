# 회의없는회의

모이지 않고, 질문과 답변만으로 회의의 결론까지 가는 도구.

주최자가 **주제와 배경**을 적으면 AI가 물어볼 질문을 만들고, 주최자가 검토한 뒤
**링크 하나**를 참여자에게 보냅니다. 참여자는 로그인 없이 바로 답합니다.
답변이 모이면 AI가 **합의된 것 / 갈린 것 / 아직 답이 안 나온 것**으로 정리하고,
남은 쟁점만 골라 다음 라운드 질문을 만듭니다.

## 현재 구현 범위

주제 입력부터 결론 확정과 리포트까지, 회의 한 건의 전체 흐름입니다.

1. 주제·배경 입력 → AI가 1라운드 질문 생성
2. 주최자가 질문 검토 (수정·삭제·추가·순서·유형 변경)
3. 참여자 링크 공개 → **회원가입/로그인 없이** 답변 수집
4. 마감 → AI가 답변 정리 + 아직 결론이 안 난 것만 골라 **재질문 생성**
5. 2라운드 공개 → 참여자는 같은 링크에서 직전 라운드 요약을 보고 다시 답변
6. 마지막 라운드가 닫히면 **결론 확정** → AI 정리 결과로 채운 초안을 주최자가 고쳐
   "정해진 것 / 모여서 정할 것"을 기록하고 회의를 종결
7. 리포트 → 회의 전체를 마크다운으로 복사하거나, 인쇄용 화면에서 PDF 로 저장

아직 만들지 않은 것: 마감 기한과 미응답자 리마인드, 응답 분포 시각화, 이메일/슬랙 발송.

## 실행

```bash
npm install
```

`.env.local` 에 키를 넣습니다. **무료 등급이 있는 Gemini** 가 기본입니다.
키는 [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 에서 받습니다.

```
AI_PROVIDER=gemini
GEMINI_API_KEY=...
MEETINGLESS_MOCK_AI=0
```

키가 제대로 붙었는지 먼저 확인합니다. 회의를 만들다가 실패하는 것보다 빠릅니다.

```bash
npm run check-ai
```

```bash
npm run dev
```

http://localhost:3000 접속.

> `.env.local` 은 서버가 시작할 때만 읽습니다. 켜둔 채로 고치면 반영되지 않으니 재시작하세요.
>
> 키 없이 화면 흐름만 보려면 `MEETINGLESS_MOCK_AI=1` 로 두면 됩니다.
> 이때는 실제 AI 대신 고정된 예시 질문·요약이 나오고, 결과에 `[모의]` 표시가 붙습니다.

## 테스트 데이터

[samples/scenarios.md](samples/scenarios.md) 에 시나리오 5개가 있습니다. 주제·배경·목표를
그대로 붙여넣으면 되고, 참여자 페르소나(입장과 각자만 아는 사정)도 같이 적혀 있습니다.
모두가 같은 소리를 하면 AI가 "합의됨"으로 정리하고 라운드가 거기서 끝나므로,
의견이 갈리게 답해야 재질문이 제대로 나옵니다.

참여자 3~4명을 손으로 입력하는 게 번거로우면 자동으로 돌릴 수 있습니다.
dev 서버를 띄운 뒤 다른 터미널에서:

```bash
npm run seed 1
```

시나리오 번호(1~5)를 골라 회의 생성 → 참여자 답변 → 마감 → 재질문 → 다음 라운드까지
끝까지 진행하고, 마지막에 주최자 화면 링크를 출력합니다.

참여자 답변은 기본적으로 `samples/scenarios.mjs` 에 미리 적어둔 문구를 씁니다(AI 호출 없음).
선택형 질문은 참여자마다 다른 선택지를 고르게 해서 의견이 갈리도록 합니다.
답변까지 AI가 페르소나대로 쓰게 하려면 `--ai` 를 붙이세요 — 더 현실적이지만 호출이 3배로 늡니다.

```bash
npm run seed 1 --ai
```

## 무료 등급 사용량

Gemini 무료 등급은 **모델별로 하루 요청 수 제한**이 있습니다. `gemini-3.6-flash` 는
**하루 20회**라 금방 소진됩니다. 한도에 걸리면 `429 RESOURCE_EXHAUSTED` 가 나고,
재시도해도 다음 날까지 풀리지 않습니다.

호출 수는 이렇게 듭니다.

| | 2라운드 회의 1건 |
| --- | --- |
| 손으로 진행 | 라운드당 2회 = **4회** (질문 생성 + 답변 정리) |
| `npm run seed` | **4회** |
| `npm run seed --ai` | 4회 + 참여자 수 × 라운드 수 = **12회** |

참여자가 몇 명이든 답변 정리는 1회입니다. 사람이 늘어도 호출은 안 늘어납니다.

한도가 부담되면 `.env.local` 에서 모델을 바꾸세요. 한도가 훨씬 넉넉하고 응답도 10배 빠릅니다.

```
GEMINI_MODEL=gemini-flash-lite-latest
```

지금 쓸 수 있는 모델과 사용량은 이렇게 확인합니다.

```bash
npm run list-models
```

## 모델 바꾸기

`AI_PROVIDER` 한 줄로 갈아끼웁니다. 프롬프트와 출력 스키마는 양쪽이 공유하므로
어느 쪽을 쓰든 화면에 들어오는 형식은 같습니다.

| | Gemini | Claude |
| --- | --- | --- |
| `AI_PROVIDER` | `gemini` | `claude` |
| 키 | `GEMINI_API_KEY` | `ANTHROPIC_API_KEY` |
| 기본 모델 | `gemini-3.6-flash` | `claude-opus-5` |
| 모델 변경 | `GEMINI_MODEL` | `ANTHROPIC_MODEL` |
| 비용 | 무료 등급 있음 | 선불 크레딧 필요 |

`AI_PROVIDER` 를 비워두면 키가 들어 있는 쪽을 자동으로 씁니다(둘 다 있으면 Gemini).

> 무료 등급은 분당·일당 요청 수 제한이 있습니다. 회의 하나에 라운드 수만큼 호출하므로
> 개인·소규모 사용에는 충분하지만, 무료 등급으로 보낸 내용은 Google 의 모델 개선에
> 쓰일 수 있습니다. 사내 민감 정보를 배경에 적을 거라면 유료 등급이나 Claude 쪽을 쓰세요.

## 화면

| 경로 | 누가 | 무엇을 |
| --- | --- | --- |
| `/` | 주최자 | 회의 만들기 |
| `/m/{회의ID}?t={주최자토큰}` | 주최자 | 질문 검토, 링크 공유, 응답 현황, 마감, 정리 결과, 결론 확정 |
| `/m/{회의ID}/report?t={주최자토큰}` | 주최자 | 인쇄용 리포트 (PDF 저장) |
| `/r/{회의ID}` | 참여자 | 열려 있는 라운드에 답변 (로그인 없음) |

주최자 링크의 `t` 파라미터가 곧 권한입니다. 이 링크를 아는 사람만 정리 결과와 원본 답변을 볼 수 있으므로
참여자에게는 `/r/...` 링크만 보내야 합니다. 주최자 링크는 회의를 만든 브라우저의 localStorage 에도
저장되어 첫 화면 아래쪽에서 다시 찾을 수 있습니다.

참여자는 브라우저 localStorage 에 저장되는 익명 토큰으로 구분됩니다. 같은 브라우저로 다시 들어오면
이름이 채워져 있고, 제출한 답변을 수정할 수 있습니다. 다른 기기에서 열면 다른 사람으로 취급됩니다.

## 구조

```
app/
  page.tsx                    회의 생성 폼
  m/[id]/page.tsx             주최자 화면
  m/[id]/report/page.tsx      인쇄용 리포트
  r/[id]/page.tsx             참여자 답변 화면
  components/
    QuestionEditor.tsx        질문 검토·편집기
    DigestView.tsx            라운드 정리 결과 표시
    DecisionEditor.tsx        결론 확정 편집기 (초안은 마지막 정리 결과에서)
    ReportActions.tsx         리포트 보기 · 마크다운 복사
  api/
    meetings/                 생성 · 조회 · 질문저장 · 공개 · 마감 · 결론확정 · 리포트
    r/[id]/                   참여자용 조회 · 제출
lib/
  ai.ts                       provider 선택 (앱은 여기만 부른다)
  ai/
    prompts.ts                시스템 프롬프트 · 출력 스키마 · 프롬프트 조립 (공유)
    gemini.ts                 Gemini 구현
    claude.ts                 Claude 구현
    mock.ts                   키 없이 쓰는 고정 응답
  db.ts                       SQLite 스키마와 쿼리
  decision.ts                 결론 초안 만들기 · 입력 검증
  report.ts                   마크다운 리포트 조립 (순수 함수)
  types.ts                    도메인 타입
scripts/
  check-ai.mjs                키 연결 확인
  list-models.mjs             이 키로 쓸 수 있는 모델 목록
  seed.mjs                    시나리오 자동 실행
samples/
  scenarios.md                테스트용 주제·배경·페르소나 (사람이 읽는 용)
  scenarios.mjs               같은 내용 (seed 스크립트가 읽는 용)
```

- **AI**: 앱은 `generateInitialQuestions` / `synthesizeAndFollowUp` 두 함수만 부르고,
  어떤 모델을 쓸지는 [lib/ai.ts](lib/ai.ts) 가 정합니다. 모델을 하나 더 붙이려면
  `lib/ai/` 에 파일 하나를 추가하고 dispatcher에 등록하면 됩니다.
- **질문 품질**을 바꾸고 싶으면 [lib/ai/prompts.ts](lib/ai/prompts.ts) 의 `SYSTEM` 상수를 고치세요.
  여기에 질문 설계 원칙이 들어 있고 provider 양쪽이 같은 걸 씁니다.
- **출력 형식**은 zod 스키마로 강제합니다. Gemini 는 `responseJsonSchema`, Claude 는
  structured outputs 를 쓰고, 받은 뒤 zod 로 한 번 더 검증해서 형식이 어긋나면 사용자에게
  안내 메시지를 띄웁니다.
- **디자인**: 서체·색·간격의 기준은 [DESIGN.md](DESIGN.md) 에 있습니다. 토큰은 `tailwind.config.ts`,
  공용 클래스는 `app/globals.css`. 화면을 고칠 때 먼저 읽습니다.
- **DB**: Node 24 내장 `node:sqlite`. 별도 설치나 네이티브 빌드가 필요 없고 파일은 `data/meetingless.db`
  에 생깁니다. 지우면 초기화됩니다.

## 데이터 모델

```
meetings ─┬─ rounds ─┬─ questions
          │          └─ submissions ── answers
          └─ participants
```

라운드 상태는 `draft`(주최자 검토 중) → `open`(답변 수집 중) → `closed`(정리 완료) 로만 진행합니다.
`closed` 시점에 그 라운드의 정리 결과(`digest`)가 저장되고, 남은 쟁점이 있으면 다음 라운드가
`draft` 로 만들어집니다.

회의 상태는 `draft` → `collecting` → `deciding`(모든 라운드가 닫혀 결론 대기) → `closed`(주최자가 결론 확정)
로 진행합니다. 확정한 결론은 `meetings.decision_json` 에 저장됩니다. 기존 DB 파일에 없는 컬럼은
서버가 뜰 때 자동으로 추가되므로 DB 를 지우지 않아도 됩니다.

## 다음 단계 후보

- 마감 기한 설정과 미응답자 리마인드
- 선택형 질문 응답 분포 시각화
