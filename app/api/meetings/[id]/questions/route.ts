import { getMeeting, getRound, replaceQuestions, updateRoundIntro } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import type { DraftQuestion, QuestionKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: QuestionKind[] = ["open", "choice", "scale"];

/** 주최자가 검토·수정한 질문을 저장한다. 아직 열리지 않은(draft) 라운드만 수정 가능. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = new URL(request.url).searchParams.get("t") ?? "";
    const meeting = getMeeting(id);
    if (!meeting) return fail("존재하지 않는 회의입니다.", 404);
    if (token !== meeting.hostToken) return fail("주최자 링크가 올바르지 않습니다.", 403);

    const body = (await request.json()) as {
      roundNo?: number;
      intro?: string;
      questions?: DraftQuestion[];
    };

    const round = getRound(id, Number(body.roundNo));
    if (!round) return fail("해당 라운드를 찾을 수 없습니다.", 404);
    if (round.status !== "draft") {
      return fail("이미 참여자에게 열린 라운드는 수정할 수 없습니다.");
    }

    const incoming = Array.isArray(body.questions) ? body.questions : [];
    const cleaned: DraftQuestion[] = incoming
      .map((q) => ({
        text: String(q.text ?? "").trim(),
        intent: String(q.intent ?? "").trim(),
        kind: KINDS.includes(q.kind) ? q.kind : "open",
        options: Array.isArray(q.options)
          ? q.options.map((o) => String(o).trim()).filter(Boolean)
          : [],
        required: q.required !== false,
      }))
      .filter((q) => q.text.length > 0);

    if (cleaned.length === 0) return fail("질문이 최소 1개는 있어야 합니다.");

    for (const q of cleaned) {
      if (q.kind === "choice" && q.options.length < 2) {
        return fail(`선택형 질문에는 선택지가 2개 이상 필요합니다: "${q.text}"`);
      }
    }

    updateRoundIntro(round.id, String(body.intro ?? "").trim());
    replaceQuestions(round.id, cleaned);

    return ok({ round: getRound(id, round.roundNo) });
  } catch (error) {
    return handleError(error);
  }
}
