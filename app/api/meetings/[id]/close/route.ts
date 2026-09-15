import { finishRound, getMeeting, getRound, listRounds, listSubmissions } from "@/lib/db";
import { synthesizeAndFollowUp } from "@/lib/ai";
import { fail, handleError, ok } from "@/lib/api";
import type { RoundDigest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 지금 정리 중인 라운드. 같은 라운드를 동시에 두 번 마감해 AI 를 두 번 부르는 것을 막는다 (인스턴스 1개 전제). */
const closing = new Set<number>();

/**
 * 라운드를 마감하고 답변을 정리한다.
 * 마지막 라운드가 아니고 아직 남은 쟁점이 있으면 다음 라운드 질문을 초안으로 만들고,
 * 아니면 회의를 결론 대기(deciding) 상태로 넘긴다.
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
    if (closing.has(round.id)) {
      return fail("이미 정리하는 중입니다. 잠시 후 새로고침해 주세요.", 409);
    }

    const submissions = listSubmissions(round.id);
    if (submissions.length === 0) {
      return fail("아직 답변이 하나도 없습니다. 최소 1명 이상 답변한 뒤 마감해 주세요.");
    }

    const previousDigests = listRounds(id)
      .filter((r) => r.roundNo < round.roundNo && r.digest)
      .map((r) => ({ roundNo: r.roundNo, digest: r.digest as RoundDigest }));

    const isFinalRound = round.roundNo >= meeting.maxRounds;

    closing.add(round.id);
    try {
      const plan = await synthesizeAndFollowUp({
        meeting,
        roundNo: round.roundNo,
        questions: round.questions,
        submissions,
        previousDigests,
        isFinalRound,
      });

      const hasNext = !isFinalRound && plan.questions.length > 0;
      let nextRoundNo: number | null = null;
      try {
        const { nextRound } = finishRound({
          roundId: round.id,
          meetingId: id,
          digest: plan.digest,
          next: hasNext
            ? { roundNo: round.roundNo + 1, intro: plan.intro, questions: plan.questions }
            : null,
        });
        nextRoundNo = nextRound?.roundNo ?? null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return fail(`마감을 저장하지 못했습니다: ${message}`, 409);
      }

      return ok({
        digest: plan.digest,
        hostNote: plan.hostNote,
        nextRoundNo,
        meetingStatus: nextRoundNo ? "collecting" : "deciding",
        /** 다음 라운드가 만들어지지 않은 이유 */
        finishedReason: nextRoundNo
          ? null
          : isFinalRound
            ? "정해둔 마지막 라운드까지 진행했습니다. 결론을 확정해 주세요."
            : "AI 판단상 더 물어볼 것이 남지 않았습니다. 결론을 확정해 주세요.",
        rounds: listRounds(id),
      });
    } finally {
      closing.delete(round.id);
    }
  } catch (error) {
    return handleError(error);
  }
}
