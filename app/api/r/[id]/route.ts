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
    const name = String(body.name ?? "").trim();
    if (!participantToken) return fail("잘못된 요청입니다.");
    if (!name) return fail("이름(또는 닉네임)을 입력해 주세요.");

    const byId = new Map(round.questions.map((q) => [q.id, q]));
    const answers = (body.answers ?? [])
      .filter((a) => byId.has(Number(a.questionId)))
      .map((a) => ({ questionId: Number(a.questionId), value: String(a.value ?? "").trim() }));

    for (const question of round.questions) {
      if (!question.required) continue;
      const answer = answers.find((a) => a.questionId === question.id);
      if (!answer || !answer.value) {
        return fail(`필수 질문에 답해 주세요: "${question.text}"`);
      }
    }

    const participantId = upsertParticipant(id, participantToken, name);
    saveSubmission({ roundId: round.id, participantId, answers });

    return ok({ submitted: true, roundNo: round.roundNo });
  } catch (error) {
    return handleError(error);
  }
}
