import * as z from "zod/v4";
import type { DraftQuestion, Meeting, Question, RoundDigest } from "../types";
import type { SubmissionView } from "../db";

/* ------------------------------------------------------------------ */
/* 스키마 — provider 와 무관하게 공유한다                                 */
/* ------------------------------------------------------------------ */

export const QuestionSchema = z.object({
  text: z.string().describe("참여자에게 그대로 보여줄 질문 문장"),
  intent: z.string().describe("이 질문으로 무엇을 확정하려는지 (주최자에게만 보임)"),
  kind: z.enum(["open", "choice", "scale"]),
  options: z.array(z.string()).describe("kind가 choice일 때의 선택지. 그 외에는 빈 배열"),
  required: z.boolean(),
});

export const InitialPlanSchema = z.object({
  intro: z.string().describe("참여자가 답변 페이지에서 먼저 읽을 2~3문장 안내문"),
  questions: z.array(QuestionSchema).min(3).max(8),
  hostNote: z.string().describe("주최자에게 주는 한 줄 조언"),
});

export const DigestSchema = z.object({
  overview: z.string().describe("이번 라운드 답변 전체를 2~4문장으로 요약"),
  consensus: z.array(
    z.object({
      point: z.string(),
      basis: z.string().describe("누가 어떤 말을 해서 그렇게 판단했는지"),
    }),
  ),
  conflicts: z.array(
    z.object({
      topic: z.string(),
      positions: z.array(z.object({ stance: z.string(), who: z.array(z.string()) })),
      crux: z.string().describe("이 대립이 갈리는 진짜 쟁점 한 문장"),
    }),
  ),
  unresolved: z.array(
    z.object({
      topic: z.string(),
      whyOpen: z.string().describe("왜 아직 결론이 안 났는지"),
    }),
  ),
  perQuestion: z.array(
    z.object({
      questionId: z.number().describe("입력으로 준 질문의 id를 그대로 사용"),
      summary: z.string(),
      notable: z.array(z.string()).describe("눈에 띄는 개별 답변 인용"),
    }),
  ),
  decisionReady: z.boolean().describe("추가 질문 없이 결론을 낼 수 있으면 true"),
  meetingNeeded: z.object({
    needed: z.boolean(),
    reason: z.string(),
  }),
});

export const FollowUpPlanSchema = z.object({
  digest: DigestSchema,
  intro: z.string(),
  questions: z.array(QuestionSchema).max(6),
  hostNote: z.string(),
});

export interface InitialPlan {
  intro: string;
  questions: DraftQuestion[];
  hostNote: string;
}

export interface FollowUpPlan {
  digest: RoundDigest;
  intro: string;
  questions: DraftQuestion[];
  hostNote: string;
}

export interface InitialInput {
  title: string;
  background: string;
  goal: string;
  maxRounds: number;
}

export interface FollowUpInput {
  meeting: Meeting;
  roundNo: number;
  questions: Question[];
  submissions: SubmissionView[];
  previousDigests: { roundNo: number; digest: RoundDigest }[];
  isFinalRound: boolean;
}

/* ------------------------------------------------------------------ */
/* 프롬프트                                                             */
/* ------------------------------------------------------------------ */

export const SYSTEM = `당신은 "회의없는회의" 서비스의 퍼실리테이터입니다.

이 서비스의 목적은 사람을 한자리에 모으지 않고, 잘 설계된 질문과 비동기 답변만으로
회의에서 나왔을 결론에 도달하는 것입니다. 따라서 당신이 만드는 질문은
"모여서 이야기해봅시다"를 대체할 수 있을 만큼 구체적이어야 합니다.

질문을 만들 때 지키는 원칙:
- 회의에서 시간을 잡아먹는 것은 정보 공유가 아니라 '의사결정에 필요한 입력'을 모으는 과정이다.
  따라서 각자가 이미 알고 있는 사실, 제약, 선호, 반대 이유를 끌어내는 질문을 우선한다.
- 예/아니오로 끝나거나, 답을 모아도 아무 결정이 안 되는 질문은 만들지 않는다.
- 한 질문에 두 가지를 묻지 않는다.
- 답변자가 3분 안에 쓸 수 있는 분량으로 묻는다.
- 배경에 이미 답이 적혀 있는 것은 다시 묻지 않는다.
- 의견이 갈릴 것 같은 지점은 선택지(choice)로 물어 분포를 눈에 보이게 만든다.
- 우선순위나 확신도처럼 정도를 물어야 하는 것은 scale(1~5)로 묻는다.
- 질문 수는 꼭 필요한 만큼만. 많을수록 응답률이 떨어진다.

모든 출력은 한국어로 작성합니다. 반드시 주어진 JSON 스키마에 맞는 JSON만 출력하고,
설명이나 코드블록 표시를 덧붙이지 마세요.`;

export function buildInitialPrompt(input: InitialInput): string {
  return `아래 회의를 "열지 않고" 끝내려고 합니다.
참여자들에게 비동기로 물어볼 1라운드 질문을 설계해 주세요.

<회의주제>
${input.title}
</회의주제>

<배경>
${input.background}
</배경>

<원하는결론>
${input.goal || "(주최자가 명시하지 않음 — 배경에서 추론할 것)"}
</원하는결론>

전체 ${input.maxRounds}라운드로 진행할 예정입니다. 지금은 1라운드이므로,
이후 라운드에서 좁혀 물을 수 있도록 우선 '판단에 필요한 재료'를 넓게 확보하는 질문을 만드세요.

intro 에는 참여자가 왜 이 질문에 답해야 하는지, 언제까지 어떤 태도로 답하면 되는지를
2~3문장으로 적어주세요. hostNote 에는 주최자가 질문을 검토할 때 특히 확인했으면 하는 점을 한 줄로 적어주세요.`;
}

export function buildFollowUpPrompt(input: FollowUpInput): string {
  const transcript = input.submissions
    .map((submission) => {
      const lines = input.questions.map((question) => {
        const answer = submission.answers.find((a) => a.questionId === question.id);
        return `  Q${question.id}. ${question.text}\n  A. ${answer?.value?.trim() || "(무응답)"}`;
      });
      return `[${submission.participantName}]\n${lines.join("\n")}`;
    })
    .join("\n\n");

  const history = input.previousDigests.length
    ? input.previousDigests.map((d) => `${d.roundNo}라운드 요약: ${d.digest.overview}`).join("\n")
    : "(이전 라운드 없음)";

  const nextInstruction = input.isFinalRound
    ? `이번이 마지막 라운드였습니다. questions 는 빈 배열로 두고, intro 는 빈 문자열로 두세요.
정리(digest)에만 집중하세요.`
    : `아직 결론이 나지 않은 지점만 골라 ${input.roundNo + 1}라운드 질문을 만드세요.

재질문을 만들 때 지키는 원칙:
- 이미 합의된 것은 다시 묻지 않는다. 참여자가 "아까 답했는데"라고 느끼는 순간 응답률이 무너진다.
- 의견이 갈린 지점(conflicts)은 "누가 맞나"가 아니라 "무엇이 사실이면 생각을 바꾸겠는가"를 묻는다.
- 정보가 없어서 못 정한 것(unresolved)은 그 정보를 가진 사람이 답할 수 있는 형태로 묻는다.
- 갈린 선택지는 choice 로 다시 물어 이번 라운드에 수렴 여부를 확인한다.
- 3개 이하로 줄일 수 있으면 줄인다.
- 만약 추가로 물을 것이 없다면 questions 를 빈 배열로 두고 decisionReady 를 true 로 두세요.`;

  return `아래는 "${input.meeting.title}" 회의의 ${input.roundNo}라운드 비동기 답변입니다.

<배경>
${input.meeting.background}
</배경>

<원하는결론>
${input.meeting.goal || "(명시되지 않음)"}
</원하는결론>

<이전라운드>
${history}
</이전라운드>

<이번라운드질문>
${input.questions.map((q) => `Q${q.id} (${q.kind}). ${q.text}`).join("\n")}
</이번라운드질문>

<답변 참여자 ${input.submissions.length}명>
${transcript}
</답변>

할 일:
1) 답변을 정리(digest)하세요. 합의된 것 / 갈린 것 / 아직 답이 안 나온 것을 분리하고,
   perQuestion 에는 위 질문의 Q번호(id)를 그대로 써서 질문별 요약을 남기세요.
   consensus 나 conflicts 를 쓸 때는 반드시 실제 답변에 근거해야 하며, 없는 말을 지어내지 마세요.
   답변이 부실해서 판단할 수 없으면 unresolved 로 넘기세요.
   meetingNeeded 에는 지금까지 모인 내용만으로 결론이 가능한지, 아니면 정말 사람이 모여야 하는지
   (예: 감정적 합의, 실시간 협상이 필요한 경우) 솔직하게 판단해 적으세요.
2) ${nextInstruction}`;
}

export function normalizeQuestion(q: z.infer<typeof QuestionSchema>): DraftQuestion {
  return {
    text: q.text,
    intent: q.intent,
    kind: q.kind,
    options: q.kind === "choice" ? q.options.filter(Boolean) : [],
    required: q.required,
  };
}
