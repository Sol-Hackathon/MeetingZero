import { getMeeting, getRound, openRound, setMeetingStatus } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 검토가 끝난 라운드를 참여자에게 공개한다. */
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

    const body = (await request.json().catch(() => ({}))) as {
      roundNo?: number;
      deadlineAt?: string | null;
    };
    const round = getRound(id, Number(body.roundNo));
    if (!round) return fail("해당 라운드를 찾을 수 없습니다.", 404);
    if (round.status !== "draft") return fail("이미 공개된 라운드입니다.");
    if (round.questions.length === 0) return fail("질문이 없습니다.");

    let deadlineAt: string | null = null;
    if (body.deadlineAt) {
      const date = new Date(body.deadlineAt);
      if (Number.isNaN(date.getTime())) return fail("기한 형식이 올바르지 않습니다.");
      if (date.getTime() < Date.now()) return fail("기한이 이미 지났습니다. 앞으로의 시각을 골라 주세요.");
      deadlineAt = date.toISOString();
    }

    openRound(round.id, deadlineAt);
    setMeetingStatus(id, "collecting");

    return ok({ round: getRound(id, round.roundNo) });
  } catch (error) {
    return handleError(error);
  }
}
