import { getMeeting, listRoundsWithSubmissions } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { buildMarkdown, buildSummaryText } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 회의 전체를 문서로 돌려준다.
 * - 기본: 마크다운 (GitHub · 노션에 그대로 붙여 넣는 용도)
 * - ?format=summary: 결론만 담은 짧은 일반 텍스트 (슬랙 · 메신저용)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get("t") ?? "";
    const meeting = getMeeting(id);
    if (!meeting) return fail("존재하지 않는 회의입니다.", 404);
    if (token !== meeting.hostToken) return fail("주최자 링크가 올바르지 않습니다.", 403);

    const data = {
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
    };

    const summary = url.searchParams.get("format") === "summary";
    return new Response(summary ? buildSummaryText(data) : buildMarkdown(data), {
      headers: {
        "content-type": `${summary ? "text/plain" : "text/markdown"}; charset=utf-8`,
        "content-disposition": `inline; filename="meeting-${id}.${summary ? "txt" : "md"}"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
