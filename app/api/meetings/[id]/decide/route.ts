import { getMeeting, saveDecision } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { normalizeDecision } from "@/lib/decision";
import type { Decision } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 주최자가 결론을 확정한다. 모든 라운드가 닫힌 뒤(deciding)에만 가능하고, 확정 후 수정도 여기로. */
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
    if (meeting.status !== "deciding" && meeting.status !== "closed") {
      return fail("아직 답변을 모으는 중입니다. 라운드를 모두 마감한 뒤 결론을 확정할 수 있습니다.");
    }

    const input = normalizeDecision(await request.json().catch(() => null));
    if (!input) return fail("결론 형식이 올바르지 않습니다.");
    if (input.decided.length === 0 && input.toMeet.length === 0 && !input.note) {
      return fail("정해진 것이나 모여서 정할 것을 하나 이상 적어 주세요.");
    }

    const decision: Decision = { ...input, decidedAt: new Date().toISOString() };
    saveDecision(id, decision);

    return ok({ decision, meetingStatus: "closed" });
  } catch (error) {
    return handleError(error);
  }
}
