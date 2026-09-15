# 회의없는회의

프로젝트 설명, 실행 방법, 구조는 README.md 를 먼저 읽는다.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

- 토큰은 `tailwind.config.ts`, 공용 클래스는 `app/globals.css`, 제호는 `app/components/Masthead.tsx`.
- 서체는 `app/layout.tsx`에서 `next/font/google`로 싣는다. `<link>`로 서체를 추가하지 않는다.
- 파랑 · 그림자 · 그라디언트 · 색 칩은 쓰지 않는다. 상태는 `.status`, 의미는 왼쪽 괘선.
