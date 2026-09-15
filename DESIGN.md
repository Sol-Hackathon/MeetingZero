# Design System — 회의없는회의

이 문서가 화면의 기준이다. 서체, 색, 간격, 반경, 움직임은 여기서 정한 대로만 쓴다.
토큰 값은 `tailwind.config.ts`, 공용 클래스는 `app/globals.css`에 있다.

## Product Context
- **What this is:** 모이지 않고 질문과 비동기 답변만으로 회의의 결론에 도달하는 도구. 주최자가 주제를 적으면 AI가 질문을 만들고, 참여자는 링크로 답하고, AI가 합의·갈림·미해결로 정리한 뒤 주최자가 "정해진 것 / 모여서 정할 것"을 확정한다.
- **Who it's for:** 팀장·PM 등 회의를 여는 사람(주최자)과, 그 회의에 불려 가는 팀원(참여자). 둘 다 바쁘고, 회의를 줄이고 싶다.
- **Space/industry:** 비동기 협업 · 의사결정 도구. 이웃: 설문 폼(Tally, Typeform), 문서 협업(Notion), 비동기 커뮤니케이션(Loom).
- **Project type:** 폼 중심 웹앱 + 문서(리포트). 실시간 대시보드가 아니라 읽고 쓰는 화면.

## Memorable Thing
**"모이지 않아도 결론이 난다."** 화면은 잘 정리된 회의록처럼 조용하고 단호해야 한다.
모든 시각 결정은 이 한 문장에 봉사한다. 대시보드처럼 보이는 순간 이 인상이 깨진다.

## Aesthetic Direction
- **Direction:** Editorial minimal. 강한 활자 위계, 넉넉한 여백, 얇은 괘선. 장식은 활자와 여백이 대신한다.
- **Decoration level:** minimal. 그림자 없음, 그라디언트 없음, 아이콘 없음. 배경색 박스 대신 왼쪽 괘선.
- **Mood:** 종이 위에 잉크. 따뜻하지만 감정적이지 않다. 결론을 말하는 사람의 목소리.
- **Safe choices:** 단일 읽기 열(42~48rem), 폼 컨트롤은 관습대로(라디오 행, 세그먼트 버튼), 오류는 빨강.
- **Risks:** (1) 제목에 한글 세리프 Hahmlet. 같은 종류의 도구는 전부 산세리프 한 벌만 쓴다. (2) 강조색을 파랑이 아니라 진녹색 하나로, 그것도 "정해진 것"의 의미색과 일치시킨다. 브랜드 색 = 결론의 색.

## Typography
- **Display/Hero:** Hahmlet (variable, 500–700) — 문서 제목, 섹션 제목, 라운드 번호, 한 줄 요약. 한글 세리프 중 획이 현대적이라 회의록의 권위와 도구의 가벼움을 같이 준다.
- **Body:** IBM Plex Sans KR (400/500/600) — 본문, 폼, 버튼, 표. 휴머니스트 산세리프라 세리프 제목과 어울리고, 숫자에 tabular figures가 있어 표와 라운드 번호가 흔들리지 않는다.
- **UI/Labels:** Body와 같음. 라벨은 13px 500, 눈썹(eyebrow)은 12px 500 + tracking-wide.
- **Data/Tables:** IBM Plex Sans KR + `tabular-nums`.
- **Code:** 시스템 monospace (공유 링크 한 곳뿐이라 별도 서체를 싣지 않는다).
- **Loading:** `next/font/google`로 빌드 때 받아 자체 호스팅. `app/layout.tsx`에서 `--font-sans`, `--font-display` CSS 변수로 노출. 폴백: Pretendard → Apple SD Gothic Neo → Malgun Gothic.
- **Scale (px / Tailwind):**
  - Hero 36–48 `text-4xl sm:text-5xl` display 600, leading 1.15
  - 페이지 제목 30 `text-3xl` display 600, leading-tight
  - 섹션 제목 24 `text-2xl` display 600 (리포트) / 20 `text-xl` (카드)
  - 소제목 16 `text-base` sans 600
  - 본문 15 `text-[15px]` sans 400, leading-relaxed(1.625). 한글 본문은 1.6 이상.
  - 보조 13 `text-[13px]` leading-5, `text-stone-600`
  - 메타 12 `text-xs` leading-5, `text-stone-500`, 숫자는 tabular-nums
  - 소제목이 본문보다 작아지는 역전은 금지.

## Color
- **Approach:** restrained. 무채색 + 강조 1 + 의미색 2. 색이 나오면 뜻이 있어야 한다.
- **Neutrals (stone, 따뜻한 종이 톤):** 50 `#F8F5EF` 화면 배경 · 100 `#F0EBE2` 조용한 면 · 200 `#E4DDD1` 괘선 · 300 `#CFC6B7` 입력 테두리 · 400 `#A79E90` 플레이스홀더 · 500 `#7F766A` 메타 · 600 `#615A50` 보조 글자 · 700 `#4A443C` · 800 `#332E29` · 900 `#1C1916` 잉크(제목, 본문, 기본 버튼)
- **Primary / 강조 (emerald):** 500 `#1F6F4A` — 링크 호버, 포커스 링, "정해진 것 / 합의된 것"의 왼쪽 괘선, 공개 링크 박스. 700 `#154D34` 글자용. 100 `#E1EEE6` 옅은 면.
- **Secondary / 의미색 (amber):** 500 `#B4811F` — "갈린 것 / 모여서 정할 것", 결정 대기 상태. 700 `#7A5516` 글자용. 100 `#F8EDD5` 옅은 면.
- **Danger (red):** 600 `#9E2F25` 오류 메시지, "실제 회의 권장". 50 `#FBEFED` 옅은 면.
- **기본 버튼은 잉크(stone-900).** 강조색 버튼은 없다. 색은 상태와 의미에만 쓴다.
- **파랑 금지.** 기본 링크 파랑, 정보 파랑 모두 쓰지 않는다. 회색 계열 링크에 녹색 호버.
- **Dark mode:** 아직 없음. 넣을 때는 배경을 `#161412` 계열 따뜻한 검정으로 다시 잡고 의미색 채도를 15% 낮춘다.

## Spacing
- **Base unit:** 4px
- **Density:** comfortable. 카드 안쪽 24px(모바일 20px), 카드 사이 24px, 섹션 사이 40–48px, 페이지 위 40px.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)
- 목록 항목 사이 8–12px. 라벨과 입력 사이 8px.

## Layout
- **Approach:** grid-disciplined, 단일 열. 좌우 분할 없음.
- **Max content width:** 홈·주최자 `max-w-3xl`(48rem), 참여자·리포트 `max-w-2xl`(42rem). 읽는 화면일수록 좁게.
- **Masthead:** 모든 화면 맨 위에 얇은 제호(`app/components/Masthead.tsx`). 인쇄에는 안 나온다.
- **Border radius:** sm 4px(칩, 세그먼트) · md 6px(입력, 버튼) · lg 10px(카드). 둥근 알약 모양(pill)은 쓰지 않는다.
- **Cards:** 1px `stone-200` 테두리, 흰 배경, 그림자 없음. 카드 안에 카드를 넣지 않는다. 구분이 더 필요하면 괘선(`border-t border-stone-200`)이나 왼쪽 3px 의미색 선.
- **Status:** 색 점 + 글자(`.status`, `.status-live/-wait/-done`). 색 칩은 쓰지 않는다.

## Motion
- **Approach:** minimal-functional. 이해를 돕는 전환만.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** 색·테두리 전환 150ms. 등장 애니메이션 없음. 스크롤 연동 없음.

## Components (globals.css)
`.card` `.label` `.input` `.btn` `.btn-primary` `.btn-ghost` `.btn-quiet` `.chip` `.eyebrow` `.status`
새 화면은 이 클래스를 먼저 쓰고, 없는 것만 Tailwind 유틸리티로 조합한다.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-15 | Editorial minimal 방향, Hahmlet + IBM Plex Sans KR, 진녹색 강조 하나 | /design-consultation. 리포트 리뷰에서 "대시보드 부품을 문서에 썼다"가 핵심 지적이라, 제품 전체를 문서의 인상으로 통일 |
| 2026-09-15 | stone 팔레트를 따뜻한 종이 톤으로 덮어씀 | 기존 코드의 stone-* 클래스를 그대로 살리면서 화면 전체의 온도를 한 번에 바꾸기 위해 |
| 2026-09-15 | 파랑 사용 안 함 | 파랑은 "링크 · 정보"의 기본값이라 도구가 다 똑같아 보이는 원인. 강조는 결론의 색(녹색) 하나로 |
