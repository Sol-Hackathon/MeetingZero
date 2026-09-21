# 회의없는회의

모이지 않고, 질문과 답변만으로 회의의 결론까지 가는 도구.

회의를 잡는 대신 **링크 하나**를 보냅니다. 참여자는 로그인 없이 3분 안에 답하고,
AI가 답변을 **합의된 것 / 갈린 것 / 아직 답이 안 나온 것**으로 정리합니다.
남은 쟁점만 골라 한 번 더 묻고, 마지막에 주최자가 **정해진 것 / 모여서 정할 것**을 확정합니다.
정말로 모여야 하는 안건만 남기는 것이 목표입니다.

## 어떻게 돌아가나

```
주최자                      AI                        참여자
──────────────────────────────────────────────────────────────
주제 · 배경 입력   ──▶   1라운드 질문 생성
질문 검토 · 공개   ──▶   ─────────────────────▶   링크 열고 답변 (로그인 없음)
답변 현황 확인                                     (같은 링크, 같은 브라우저면 수정 가능)
마감              ──▶   합의 / 갈림 / 미해결 정리
                        남은 쟁점으로 2라운드 질문
2라운드 공개      ──▶   ─────────────────────▶   직전 정리를 보고 다시 답변
마감              ──▶   최종 정리
결론 확정         ◀──   초안 (정해진 것 / 모여서 정할 것)
리포트            ─▶    PDF · 마크다운 · 슬랙용 요약
```

참여자가 몇 명이든 AI 호출은 라운드당 2회(질문 생성, 답변 정리)뿐입니다.

## 5분 만에 띄우기

준비물은 **Node 24 이상**뿐입니다. DB 는 Node 에 내장된 SQLite 를 쓰므로 따로 설치할 것이 없습니다.

```bash
node -v          # v24 이상인지 확인
npm install
```

설정 파일을 만듭니다. 예시 파일을 복사하면 됩니다.

```bash
cp .env.example .env.local            # macOS · Linux · Git Bash
Copy-Item .env.example .env.local     # Windows PowerShell
```

**키 없이 먼저 구경만 하려면** `.env.local` 에서 한 줄만 바꿉니다. 실제 AI 대신 고정된 예시
질문과 정리 결과가 나오고, 화면에 `[모의]` 표시가 붙습니다.

```
MEETINGLESS_MOCK_AI=1
```

**실제 AI 로 돌리려면** Gemini 키를 넣습니다. 무료 등급이 있어 가장 쉽게 시작할 수 있습니다.
키는 [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 에서 받습니다.

```
AI_PROVIDER=gemini
GEMINI_API_KEY=여기에_키
MEETINGLESS_MOCK_AI=0
```

키가 붙었는지 먼저 확인합니다. 회의를 만들다가 실패하는 것보다 빠릅니다.

```bash
npm run check-ai
```

서버를 띄우고 http://localhost:3000 을 엽니다.

```bash
npm run dev
```

> `.env.local` 은 서버가 시작할 때만 읽습니다. 켜둔 채로 고치면 반영되지 않으니 재시작하세요.

## 첫 회의 돌려보기

혼자서 주최자와 참여자 3~4명을 번갈아 맡으면 10분 안에 끝까지 가 볼 수 있습니다.
[samples/scenarios.md](samples/scenarios.md) 의 1번 시나리오를 그대로 쓰는 것을 권합니다.

**1. 회의 만들기** — 첫 화면에서 주제, 배경, 얻고 싶은 결론을 적습니다.
예상 참여자를 한 줄에 한 명씩 적어 두면 나중에 누가 아직 안 했는지 보입니다. 라운드 수는 기본 2.

**2. 질문 검토** — AI 가 만든 질문 3~5개가 나옵니다. 고치거나 빼거나 유형(서술형 · 선택형 · 5점 척도)을
바꾼 뒤 **참여자에게 공개하기**. 답변 기한은 선택입니다.

**3. 참여자로 답하기** — 화면에 나온 `/r/…` 링크를 시크릿 창이나 다른 브라우저에서 엽니다.
이름을 적고 답하면 끝. 브라우저마다 다른 사람으로 취급되므로 창을 바꿔 가며 3~4명을 흉내 냅니다.

> 시나리오의 **페르소나대로 다르게** 답하세요. 모두 같은 소리를 하면 AI 가 "합의됨"으로 정리하고
> 더 물을 것이 없어 거기서 끝납니다. 의견이 갈려야 2라운드 재질문이 제대로 나옵니다.

**4. 현황 보기** — 주최자 화면은 8초마다 갱신됩니다. 답변 수, 답한 사람과 아직인 사람, 선택형 질문의
분포 한 줄이 보입니다. **리마인드 문구 복사**를 누르면 슬랙에 붙일 문장이 복사됩니다.

**5. 마감** — **마감하고 의견 정리 + 재질문 만들기**. 보통 30초에서 2분 걸립니다.
합의된 것, 의견이 갈린 것(누가 어떤 입장인지), 아직 답이 안 나온 것이 정리되고
남은 쟁점만으로 2라운드 질문 초안이 만들어집니다.

**6. 2라운드** — 초안을 검토해 공개하면 참여자는 **같은 링크**에서 직전 라운드 정리를 읽고 다시 답합니다.
마감하면 마지막 정리가 나오고 회의는 결론 대기 상태가 됩니다.

**7. 결론 확정** — 마지막 정리로 채워진 초안이 나옵니다. **정해진 것**과 **모여서 정할 것**(쟁점 한 줄, 참석할 사람)을
고쳐서 확정하면 회의가 끝납니다. 모여서 정할 것이 비어 있으면 회의를 안 해도 된다는 뜻입니다.

**8. 리포트** — **리포트 보기**는 인쇄와 PDF 저장용, **마크다운 복사**는 노션·GitHub 용,
**요약 복사**는 슬랙에 붙이는 결론만 담은 짧은 글입니다.

### 손으로 하기 귀찮으면

dev 서버를 켜 둔 채 다른 터미널에서 시나리오 번호(1~5)를 골라 돌립니다.
회의 생성부터 마지막 라운드 마감까지 자동으로 진행하고 주최자 링크를 출력합니다.
결론 확정만 화면에서 직접 하면 됩니다.

```bash
npm run seed 1
```

참여자 답변은 `samples/scenarios.mjs` 에 미리 적어 둔 문구를 쓰므로 AI 호출은 라운드당 2회로 같습니다.
답변까지 AI 가 페르소나대로 쓰게 하려면 `--ai` 를 붙입니다. 더 현실적이지만 호출이 참여자 수 × 라운드 수만큼 늘어납니다.

```bash
npm run seed -- 1 --ai
npm run seed -- 1 --ai --resume=회의ID:주최자토큰   # 중간에 실패한 회의를 이어서
BASE=http://localhost:3001 npm run seed 3           # 다른 포트에 띄웠을 때
```

> `--ai` 앞의 `--` 는 꼭 필요합니다. 없으면 npm 이 옵션을 가로채 스크립트에 전달되지 않습니다.
> PowerShell 에서는 `$env:BASE="http://localhost:3001"; npm run seed 3` 처럼 씁니다.

## AI 고르기

`AI_PROVIDER` 한 줄로 갈아끼웁니다. 프롬프트와 출력 스키마를 공유하므로 어느 쪽을 쓰든 화면은 같습니다.
비워 두면 키가 들어 있는 쪽을 자동으로 씁니다(둘 다 있으면 Gemini).

| | Gemini | Claude API | Claude CLI | 모의 |
| --- | --- | --- | --- | --- |
| `AI_PROVIDER` | `gemini` | `claude` | `claude-cli` | `MEETINGLESS_MOCK_AI=1` |
| 필요한 것 | `GEMINI_API_KEY` | `ANTHROPIC_API_KEY` | 이 PC 에 로그인된 Claude Code | 없음 |
| 기본 모델 | `gemini-3.6-flash` | `claude-opus-5` | `sonnet` | 고정 응답 |
| 모델 바꾸기 | `GEMINI_MODEL` | `ANTHROPIC_MODEL` | `CLAUDE_CLI_MODEL` | – |
| 비용 | 무료 등급 있음 | 선불 크레딧 | 구독 사용량 차감 | 무료 |
| 어울리는 때 | 처음 · 개인 사용 | 품질 우선 | 키 없는 데모 | 화면 흐름 확인 |

### Gemini 무료 등급

모델별로 **하루 요청 수 제한**이 있습니다. 기본 모델 `gemini-3.6-flash` 는 하루 20회라 금방 소진됩니다.
한도에 걸리면 `429 RESOURCE_EXHAUSTED` 가 나고 다음 날까지 풀리지 않습니다.

| | 2라운드 회의 1건 |
| --- | --- |
| 손으로 진행 · `npm run seed` | 라운드당 2회 = **4회** |
| `npm run seed -- 1 --ai` | 4회 + 참여자 수 × 라운드 수 = **12회** |

한도를 아끼는 방법 두 가지입니다. 쉬운 일인 질문 생성을 한도가 넉넉한 모델에 맡기면 기본 모델 호출이 절반으로 줍니다.

```
GEMINI_MODEL=gemini-3.6-flash
GEMINI_QUESTION_MODEL=gemini-3.5-flash-lite
```

아예 가벼운 모델로 바꾸면 한도가 훨씬 넉넉하고 응답도 빠릅니다. 정리 품질은 조금 떨어집니다.

```
GEMINI_MODEL=gemini-flash-lite-latest
```

내 키로 쓸 수 있는 모델은 `npm run list-models` 로 확인합니다.

> 무료 등급으로 보낸 내용은 Google 의 모델 개선에 쓰일 수 있습니다. 사내 민감 정보를 배경에 적을 거라면
> 유료 등급이나 Claude 쪽을 쓰세요.

### Claude CLI

이 PC 에 설치된 Claude Code 를 헤드리스(`claude -p`)로 띄워 쓰는 방식입니다. API 키가 필요 없고
구독 사용량(5시간 창)에서 차감됩니다. 도구와 MCP 는 전부 끄고 세션도 저장하지 않습니다.
Claude Code 가 로그인된 PC 에서만 돌고 배포는 안 되므로 **데모 전용**입니다. 호출당 기동에 몇 초가 더 걸립니다.

```
AI_PROVIDER=claude-cli
CLAUDE_CLI_MODEL=sonnet        # sonnet | opus | haiku 또는 모델 ID
CLAUDE_CLI_PATH=               # claude 명령이 PATH 에 없을 때만
```

설정 후 `npm run check-ai` 로 먼저 확인하세요.

## 화면과 링크

| 경로 | 누가 | 무엇을 |
| --- | --- | --- |
| `/` | 주최자 | 회의 만들기. 아래쪽에 이 브라우저에서 만든 회의 목록 |
| `/m/{회의ID}?t={주최자토큰}` | 주최자 | 질문 검토, 링크 공유, 응답 현황, 마감, 정리 결과, 결론 확정 |
| `/m/{회의ID}/report?t={주최자토큰}` | 주최자 | 인쇄용 리포트 |
| `/r/{회의ID}` | 참여자 | 열려 있는 라운드에 답변. 로그인 없음 |

**주최자 링크의 `t` 가 곧 권한입니다.** 이 링크를 아는 사람만 정리 결과와 원본 답변을 볼 수 있으므로
참여자에게는 `/r/…` 링크만 보내세요. 주최자 링크는 회의를 만든 브라우저에 저장되어 첫 화면 아래에서
다시 찾을 수 있습니다(최근 20개).

참여자는 브라우저에 저장되는 익명 토큰으로 구분됩니다. 같은 브라우저로 다시 들어오면 이름이 채워져 있고
제출한 답변을 고칠 수 있습니다. 다른 기기에서 열면 다른 사람으로 취급됩니다.
응답 현황의 "누가 답했는지"는 예상 참여자 명단과 **이름**으로 맞춥니다. 괄호 안 소속과 띄어쓰기는 무시합니다.

## 문제가 생기면

| 증상 | 원인과 해결 |
| --- | --- |
| `npm run check-ai` 가 실패 | 키 오타이거나 `.env.local` 을 고친 뒤 서버를 재시작하지 않은 것. 파일을 확인하고 다시 띄우세요 |
| `429 RESOURCE_EXHAUSTED` | Gemini 일일 한도. 위 "Gemini 무료 등급"대로 모델을 바꾸거나 내일 다시 |
| `Cannot find module 'node:sqlite'` | Node 가 24 미만. `node -v` 확인 후 올리세요 |
| 3000 포트가 이미 사용 중 | `npx next dev -p 3001` 로 띄우고, seed 는 `BASE=http://localhost:3001` 을 붙입니다 |
| Claude CLI 에서 `claude` 를 못 찾음 | `CLAUDE_CLI_PATH` 에 실행 파일 경로를 적거나, 터미널에서 `claude` 를 한 번 실행해 로그인 |
| 마감 버튼을 눌렀는데 오래 걸림 | 정상입니다. 2분까지 기다리세요. 같은 라운드는 두 번 마감되지 않게 잠급니다 |
| 처음부터 다시 하고 싶음 | 서버를 끄고 `data/meetingless.db` 를 지우면 초기화됩니다 |
| 주최자 링크를 잃어버림 | 회의를 만든 브라우저의 첫 화면 아래 목록. 다른 브라우저였다면 복구할 수 없습니다 |

## 개발자를 위한 안내

### 구조

```
app/
  page.tsx                    회의 생성 폼 · 내가 만든 회의 목록
  m/[id]/page.tsx             주최자 화면 (라운드 카드 · 결론 카드)
  m/[id]/report/page.tsx      인쇄용 리포트
  r/[id]/page.tsx             참여자 답변 화면
  components/
    QuestionEditor.tsx        질문 검토·편집기
    ResponseStatus.tsx        답변 수집 중 현황 · 미응답자 · 리마인드 문구
    AnswerStats.tsx           선택형 · 5점 척도 응답 분포 막대
    DigestView.tsx            라운드 정리 결과
    DecisionEditor.tsx        결론 확정 편집기 (초안은 마지막 정리 결과에서)
    DecisionDoc.tsx           확정된 결론 읽기 전용 (주최자 화면과 리포트가 공유)
    ReportActions.tsx         리포트 보기 · 마크다운 복사 · 요약 복사
    Masthead.tsx              상단 제호
  api/
    meetings/                 생성 · 조회 · 질문 저장 · 공개 · 마감 · 결론 확정 · 리포트
    r/[id]/                   참여자용 조회 · 제출
lib/
  ai.ts                       provider 선택 (앱은 여기만 부른다)
  ai/
    prompts.ts                시스템 프롬프트 · 출력 스키마 · 사후 보정 (provider 공유)
    gemini.ts  claude.ts      각 API 구현
    claude-cli.ts             Claude Code CLI 구현 (데모 전용)
    mock.ts                   키 없이 쓰는 고정 응답
    errors.ts                 사용자에게 보여줘도 되는 AI 오류
  db.ts                       SQLite 스키마와 쿼리. 없는 컬럼은 서버가 뜰 때 추가
  decision.ts                 결론 초안 만들기 · 입력 검증
  report.ts                   리포트 데이터 · 마크다운 · 요약 텍스트 (순수 함수)
  stats.ts                    선택형 · 척도 집계 (화면 · 리포트 · 마크다운 공유)
  api.ts  ids.ts  types.ts    응답 헬퍼 · 짧은 ID · 도메인 타입
scripts/
  check-ai.mjs                키 연결 확인
  list-models.mjs             이 키로 쓸 수 있는 Gemini 모델 목록
  seed.mjs                    시나리오 자동 실행
samples/
  scenarios.md                테스트용 주제 · 배경 · 페르소나 (사람이 읽는 용)
  scenarios.mjs               같은 내용 (seed 가 읽는 용)
```

### 데이터 모델

```
meetings ─┬─ rounds ─┬─ questions
          │          └─ submissions ── answers
          └─ participants
```

- 라운드: `draft`(주최자 검토 중) → `open`(답변 수집 중) → `closed`(정리 완료).
  마감 시점에 그 라운드의 정리 결과(`digest`)가 저장되고, 남은 쟁점이 있으면 다음 라운드가 `draft` 로 만들어집니다.
- 회의: `draft` → `collecting` → `deciding`(모든 라운드가 닫혀 결론 대기) → `closed`(결론 확정).
  결론은 `meetings.decision_json`, 예상 참여자는 `meetings.expected_json`, 기한은 `rounds.deadline_at`.
- DB 파일은 `data/meetingless.db`. 지우면 초기화됩니다. 기존 파일에 없는 컬럼은 서버가 뜰 때 자동으로 추가합니다.

### 바꾸고 싶을 때

- **모델을 하나 더 붙이기** — 앱은 `generateInitialQuestions` / `synthesizeAndFollowUp` 두 함수만 부릅니다.
  [lib/ai/](lib/ai/) 에 파일 하나를 추가하고 [lib/ai.ts](lib/ai.ts) 에 등록하면 됩니다.
- **질문 품질** — [lib/ai/prompts.ts](lib/ai/prompts.ts) 의 `SYSTEM` 상수에 질문 설계 원칙과 정리 규칙이 있습니다.
  provider 양쪽이 같은 것을 씁니다.
- **출력 형식** — zod 스키마로 강제합니다. Gemini 는 `responseJsonSchema`, Claude 는 structured outputs 를 쓰고,
  받은 뒤 zod 로 한 번 더 검증해서 어긋나면 사용자에게 안내합니다.
- **디자인** — 서체 · 색 · 간격의 기준은 [DESIGN.md](DESIGN.md) 에 있습니다. 토큰은 `tailwind.config.ts`,
  공용 클래스는 `app/globals.css`. 화면을 고치기 전에 먼저 읽습니다.

## 다음 단계 후보

- 이메일 / 슬랙 발송
