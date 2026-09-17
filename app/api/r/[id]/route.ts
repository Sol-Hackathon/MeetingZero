import {
  findSubmission,
  getMeeting,
  getOpenRound,
  getParticipantName,
  getRound,
  saveSubmission,
  upsertParticipant,
} from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 40;
/** 답변 하나의 상한. 정리 프롬프트 길이를 묶어 두기 위한 것 (참여자 20명 × 질문 8개여도 50만 자 안) */
const MAX_ANSWER_LENGTH = 3000;

/** 참여자 화면: 지금 열려 있는 라운드의 질문을 돌려준다. (로그인 없음) */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const participantToken = new URL(request.url).searchParams.get("pt") ?? "";

    const meeting = getMeeting(id);
    if (!meeting) return fail("존재하지 않는 회의입니다.", 404);

    const round = getOpenRound(id);
    const savedName = participantToken ? getParticipantName(id, participantToken) : null;

    if (!round) {
      return ok({
        meeting: { title: meeting.title, status: meeting.status },
        state: meeting.status === "closed" ? "closed" : "waiting",
        savedName,
        round: null,
        previous: null,
      });
    }

    // 2라운드부터는 직전 라운드에서 무엇이 정리됐는지 보여준다.
    const prevRound = round.roundNo > 1 ? getRound(id, round.roundNo - 1) : null;
    const previous =
      prevRound?.digest != null
        ? {
            roundNo: prevRound.roundNo,
            overview: prevRound.digest.overview,
            consensus: prevRound.digest.consensus.map((c) => c.point),
            unresolved: prevRound.digest.unresolved.map((u) => u.topic),
          }
        : null;

    const mine = participantToken ? findSubmission(round.id, id, participantToken) : null;

    return ok({
      meeting: { title: meeting.title, status: meeting.status },
      state: mine ? "submitted" : "open",
      savedName: mine?.participantName ?? savedName,
      round: {
        roundNo: round.roundNo,
        totalRounds: meeting.maxRounds,
        intro: round.intro,
        deadlineAt: round.deadlineAt,
        // intent(질문 의도)는 주최자 전용이라 내려보내지 않는다.
        questions: round.questions.map((q) => ({
          id: q.id,
          text: q.text,
          kind: q.kind,
          options: q.options,
          required: q.required,
        })),
      },
      myAnswers: mine?.answers ?? [],
      previous,
    });
  } catch (error) {
    return handleError(error);
  }
}

/** 답변 제출 (재제출 시 덮어쓴다) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const meeting = getMeeting(id);
    if (!meeting) return fail("존재하지 않는 회의입니다.", 404);

    const round = getOpenRound(id);
    if (!round) return fail("지금은 답변을 받고 있지 않습니다.");

    const body = (await request.json()) as {
      participantToken?: string;
      name?: string;
      answers?: { questionId: number; value: string }[];
    };

    const participantToken = String(body.participantToken ?? "").trim();
    // 이름은 정리 프롬프트에서 답변 머리와 참여자 명단에 그대로 들어간다. 한 줄, 괄호·꺾쇠 없이, 40자 안.
    const name = String(body.name ?? "")
      .replace(/\s+/g, " ")
      .replace(/[<>[\]]/g, "")
      .trim();
    if (!participantToken) return fail("잘못된 요청입니다.");
    if (!name) return fail("이름(또는 닉네임)을 입력해 주세요.");
    if (name.length > MAX_NAME_LENGTH) return fail(`이름은 ${MAX_NAME_LENGTH}자 이하로 적어 주세요.`);

    const byId = new Map(round.questions.map((q) => [q.id, q]));
    const answers = (body.answers ?? [])
      .filter((a) => byId.has(Number(a.questionId)))
      .map((a) => ({ questionId: Number(a.questionId), value: String(a.value ?? "").trim() }));

    for (const [index, question] of round.questions.entries()) {
      const answer = answers.find((a) => a.questionId === question.id);
      if (question.required && (!answer || !answer.value)) {
        return fail(`Q${index + 1}은 필수 질문입니다. 답을 적어 주세요.`);
      }
      if (answer && answer.value.length > MAX_ANSWER_LENGTH) {
        return fail(`Q${index + 1} 답변이 너무 깁니다. ${MAX_ANSWER_LENGTH.toLocaleString("ko-KR")}자 이하로 줄여 주세요.`);
      }
    }

    const participantId = upsertParticipant(id, participantToken, name);
    saveSubmission({ roundId: round.id, participantId, answers });

    return ok({ submitted: true, roundNo: round.roundNo });
  } catch (error) {
    return handleError(error);
  }
}
