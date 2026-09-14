import { countSubmissions, getMeeting, listRounds, listSubmissions } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = new URL(request.url).searchParams.get("t") ?? "";

    const meeting = getMeeting(id);
    if (!meeting) return fail("존재하지 않는 회의입니다.", 404);
    if (token !== meeting.hostToken) {
      return fail("주최자 링크가 올바르지 않습니다.", 403);
    }

    const rounds = listRounds(id).map((round) => ({
      ...round,
      submissionCount: countSubmissions(round.id),
      submissions: listSubmissions(round.id),
    }));

    return ok({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        background: meeting.background,
        goal: meeting.goal,
        maxRounds: meeting.maxRounds,
        status: meeting.status,
        createdAt: meeting.createdAt,
      },
      rounds,
    });
  } catch (error) {
    return handleError(error);
  }
}
