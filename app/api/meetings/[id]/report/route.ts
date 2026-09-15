import { getMeeting, listRoundsWithSubmissions } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { buildMarkdown } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 회의 전체를 마크다운 문서로 돌려준다. 슬랙·노션·GitHub 에 그대로 붙여 넣는 용도. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = new URL(request.url).searchParams.get("t") ?? "";
    const meeting = getMeeting(id);
    if (!meeting) return fail("존재하지 않는 회의입니다.", 404);
    if (token !== meeting.hostToken) return fail("주최자 링크가 올바르지 않습니다.", 403);

    const markdown = buildMarkdown({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        background: meeting.background,
        goal: meeting.goal,
        maxRounds: meeting.maxRounds,
        status: meeting.status,
        createdAt: meeting.createdAt,
      },
      rounds: listRoundsWithSubmissions(id),
      decision: meeting.decision,
    });

    return new Response(markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `inline; filename="meeting-${id}.md"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
