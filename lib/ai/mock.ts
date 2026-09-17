import type { FollowUpInput, FollowUpPlan, InitialInput, InitialPlan } from "./prompts";

/** API 키 없이 화면 흐름만 확인할 때 쓰는 고정 응답 */

export async function generateInitialQuestions(input: InitialInput): Promise<InitialPlan> {
  return {
    intro: `"${input.title}" 건으로 모이는 대신 먼저 각자 생각을 받겠습니다. 정답이 아니라 각자 아는 사실과 우려를 적어주시면 됩니다. 원본 답변은 주최자만 보고, 제출 뒤에도 고칠 수 있습니다.`,
    questions: [
      {
        text: `"${input.title}"에 대해 지금 당신이 알고 있는 사실 중, 다른 사람은 모를 수 있는 것은 무엇인가요?`,
        intent: "이 답이 모이면 정보 비대칭이 해소되어 회의의 공유 단계를 대체할 수 있다",
        kind: "open",
        options: [],
        required: true,
      },
      {
        text: "지금 결정을 내린다면 어느 쪽인가요?",
        intent: "이 답이 모이면 초기 입장 분포를 알 수 있다",
        kind: "choice",
        options: ["찬성", "반대", "조건부 찬성", "아직 판단 못 함"],
        required: true,
      },
      {
        text: "그렇게 판단한 이유와, 절대 받아들일 수 없는 안이 있다면 무엇인가요?",
        intent: "이 답이 모이면 2라운드에서 물을 쟁점(crux)을 고를 수 있다",
        kind: "open",
        options: [],
        required: true,
      },
      {
        text: "이 결정이 당신 업무에 주는 리스크는 얼마나 큰가요?",
        intent: "이 답이 모이면 이해관계 강도를 알 수 있다",
        kind: "scale",
        options: [],
        required: true,
      },
    ],
  };
}

export async function synthesizeAndFollowUp(input: FollowUpInput): Promise<FollowUpPlan> {
  const names = input.submissions.map((s) => s.participantName);
  return {
    digest: {
      overview: `[모의 요약] ${input.roundNo}라운드에 ${names.length}명이 답했습니다. 큰 방향에는 이견이 없었으나 실행 시점과 담당 범위에서 의견이 갈렸습니다.`,
      proposal: input.isFinalRound
        ? "[모의] 이번 분기 착수를 전제로 진행하되, 예산 규모는 담당자가 확인한 뒤 확정한다."
        : "",
      consensus: [
        {
          point: "문제 자체가 존재한다는 데는 이견이 없다",
          supporters: names,
          basis: `${names.join(", ")}의 답변`,
        },
      ],
      conflicts: [
        {
          topic: "실행 시점",
          kind: "preference",
          positions: [
            { stance: "이번 분기 안에 시작", who: names.slice(0, 1) },
            { stance: "다음 분기로 미루자", who: names.slice(1) },
          ],
          crux: "지금 착수할 여력이 실제로 있는지에 대한 판단이 다름",
        },
      ],
      unresolved: [
        {
          topic: "예산 확보 가능 여부",
          whyOpen: "예산 규모를 아는 사람이 숫자를 적어 주면 닫힌다",
          askWho: names.slice(0, 1),
        },
      ],
      perQuestion: input.questions.map((q) => ({
        questionId: q.id,
        summary: "[모의] 의도는 대체로 달성됐습니다. 답변이 비슷한 방향이었습니다.",
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
      : "이번 라운드에서 실행 시점과 예산 규모가 정해지면 결론을 낼 수 있습니다.",
    questions: input.isFinalRound
      ? []
      : [
          {
            text: "실행 시점에 대해 다시 묻습니다. 예산이 확보된다는 전제라면 어느 쪽인가요?",
            intent: "전제를 고정했을 때도 의견이 갈리는지 확인되면 실행 시점 항목이 닫힌다",
            kind: "choice",
            options: ["이번 분기 착수", "다음 분기 착수", "아직 판단 못 함"],
            required: true,
          },
          {
            text: "예산 규모를 알고 있다면 숫자로 적어주세요.",
            intent: "예산 숫자가 나오면 미해결 항목이 닫힌다",
            kind: "open",
            options: [],
            required: false,
          },
        ],
  };
}
