import {
  createRound,
  getMeeting,
  getRound,
  listRounds,
  listSubmissions,
  setMeetingStatus,
  setRoundStatus,
} from "@/lib/db";
import { synthesizeAndFollowUp } from "@/lib/ai";
import { fail, handleError, ok } from "@/lib/api";
import type { RoundDigest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 라운드를 마감하고 답변을 정리한다.
 * 마지막 라운드가 아니고 아직 남은 쟁점이 있으면 다음 라운드 질문을 초안으로 만든다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = new URL(request.url).searchParams.get("t") ?? "";
    const meeting = getMeeting(id);
    if (!meeting) return fail("존재하지 않는 회의입니다.", 404);
    if (token !== meeting.hostToken) return fail("주최자 링크가 올바르지 않습니다.", 403);

    const body = (await request.json().catch(() => ({}))) as { roundNo?: number };
    const round = getRound(id, Number(body.roundNo));
    if (!round) return fail("해당 라운드를 찾을 수 없습니다.", 404);
    if (round.status !== "open") return fail("진행 중인 라운드가 아닙니다.");

    const submissions = listSubmissions(round.id);
    if (submissions.length === 0) {
      return fail("아직 답변이 하나도 없습니다. 최소 1명 이상 답변한 뒤 마감해 주세요.");
    }

    const previousDigests = listRounds(id)
      .filter((r) => r.roundNo < round.roundNo && r.digest)
      .map((r) => ({ roundNo: r.roundNo, digest: r.digest as RoundDigest }));

    const isFinalRound = round.roundNo >= meeting.maxRounds;

    const plan = await synthesizeAndFollowUp({
      meeting,
      roundNo: round.roundNo,
      questions: round.questions,
      submissions,
      previousDigests,
      isFinalRound,
    });

    setRoundStatus(round.id, "closed", plan.digest);

    let nextRoundNo: number | null = null;
    if (!isFinalRound && plan.questions.length > 0) {
      const next = createRound({
        meetingId: id,
        roundNo: round.roundNo + 1,
        intro: plan.intro,
        questions: plan.questions,
      });
      nextRoundNo = next.roundNo;
    } else {
      setMeetingStatus(id, "closed");
    }

    return ok({
      digest: plan.digest,
      hostNote: plan.hostNote,
      nextRoundNo,
      /** 다음 라운드가 만들어지지 않은 이유 */
      finishedReason: nextRoundNo
        ? null
        : isFinalRound
          ? "정해둔 마지막 라운드까지 진행했습니다."
          : "AI 판단상 더 물어볼 것이 남지 않았습니다.",
      rounds: listRounds(id),
    });
  } catch (error) {
    return handleError(error);
  }
}
