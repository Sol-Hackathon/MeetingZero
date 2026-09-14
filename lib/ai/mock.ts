import type { FollowUpInput, FollowUpPlan, InitialInput, InitialPlan } from "./prompts";

/** API 키 없이 화면 흐름만 확인할 때 쓰는 고정 응답 */

export async function generateInitialQuestions(input: InitialInput): Promise<InitialPlan> {
  return {
    intro: `"${input.title}" 건으로 모이는 대신 먼저 각자 생각을 받겠습니다. 3분이면 충분합니다. 솔직하게 적어주세요.`,
    questions: [
      {
        text: `"${input.title}"에 대해 지금 당신이 알고 있는 사실 중, 다른 사람은 모를 수 있는 것은 무엇인가요?`,
        intent: "정보 비대칭 해소 — 회의 시간의 상당 부분을 차지하는 공유 단계를 대체",
        kind: "open",
        options: [],
        required: true,
      },
      {
        text: "지금 결정을 내린다면 어느 쪽인가요?",
        intent: "초기 의견 분포 파악",
        kind: "choice",
        options: ["찬성", "반대", "조건부 찬성", "판단할 정보가 부족함"],
        required: true,
      },
      {
        text: "그렇게 판단한 이유와, 생각을 바꾸게 만들 수 있는 조건은 무엇인가요?",
        intent: "쟁점(crux) 추출 — 2라운드 재질문의 재료",
        kind: "open",
        options: [],
        required: true,
      },
      {
        text: "이 결정이 당신 업무에 주는 리스크는 얼마나 큰가요? (1: 거의 없음 ~ 5: 매우 큼)",
        intent: "이해관계 강도 파악",
        kind: "scale",
        options: [],
        required: true,
      },
    ],
    hostNote: "[모의 응답] 실제 질문 생성을 보려면 API 키를 설정하세요.",
  };
}

export async function synthesizeAndFollowUp(input: FollowUpInput): Promise<FollowUpPlan> {
  const names = input.submissions.map((s) => s.participantName);
  return {
    digest: {
      overview: `[모의 요약] ${input.roundNo}라운드에 ${names.length}명이 답했습니다. 큰 방향에는 이견이 없었으나 실행 시점과 담당 범위에서 의견이 갈렸습니다.`,
      consensus: [
        { point: "문제 자체가 존재한다는 데는 이견이 없다", basis: `${names.join(", ")}의 답변` },
      ],
      conflicts: [
        {
          topic: "실행 시점",
          positions: [
            { stance: "이번 분기 안에 시작", who: names.slice(0, 1) },
            { stance: "다음 분기로 미루자", who: names.slice(1) },
          ],
          crux: "지금 착수할 여력이 실제로 있는지에 대한 판단이 다름",
        },
      ],
      unresolved: [{ topic: "예산 확보 가능 여부", whyOpen: "숫자를 아는 사람이 답하지 않음" }],
      perQuestion: input.questions.map((q) => ({
        questionId: q.id,
        summary: "[모의] 답변이 대체로 비슷한 방향이었습니다.",
        notable: input.submissions
          .map((s) => s.answers.find((a) => a.questionId === q.id)?.value ?? "")
          .filter(Boolean)
          .slice(0, 2),
      })),
      decisionReady: input.isFinalRound,
      meetingNeeded: {
        needed: false,
        reason: "[모의] 남은 쟁점은 추가 질문으로 좁힐 수 있습니다.",
      },
    },
    intro: input.isFinalRound
      ? ""
      : "1라운드 답변을 정리했습니다. 아래는 아직 결론이 나지 않은 부분만 다시 여쭙는 질문입니다.",
    questions: input.isFinalRound
      ? []
      : [
          {
            text: "실행 시점에 대해 다시 묻습니다. 예산이 확보된다는 전제라면 어느 쪽인가요?",
            intent: "전제를 고정했을 때도 의견이 갈리는지 확인",
            kind: "choice",
            options: ["이번 분기 착수", "다음 분기 착수", "여전히 판단 불가"],
            required: true,
          },
          {
            text: "예산 규모를 알고 있다면 알려주세요. 모르면 '모름'이라고 적어주세요.",
            intent: "미해결 정보 확보",
            kind: "open",
            options: [],
            required: true,
          },
        ],
    hostNote: "[모의 응답] 실제 요약을 보려면 API 키를 설정하세요.",
  };
}
