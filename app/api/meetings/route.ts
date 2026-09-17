import { createMeeting, createRound } from "@/lib/db";
import { activeProvider, generateInitialQuestions } from "@/lib/ai";
import { fail, handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      background?: string;
      goal?: string;
      maxRounds?: number;
    };

    const title = (body.title ?? "").trim();
    const background = (body.background ?? "").trim();
    const goal = (body.goal ?? "").trim();
    const maxRounds = Math.min(Math.max(Number(body.maxRounds) || 2, 1), 4);

    if (!title) return fail("회의 주제를 입력해 주세요.");
    if (background.length < 10) return fail("배경을 조금 더 자세히 적어 주세요. (10자 이상)");

    const plan = await generateInitialQuestions({ title, background, goal, maxRounds });

    const meeting = createMeeting({ title, background, goal, maxRounds });
    const round = createRound({
      meetingId: meeting.id,
      roundNo: 1,
      intro: plan.intro,
      questions: plan.questions,
    });

    return ok({
      meetingId: meeting.id,
      hostToken: meeting.hostToken,
      /** 어떤 모델이 질문을 만들었는지 (디버깅·seed 로그용) */
      provider: activeProvider(),
      round,
    });
  } catch (error) {
    return handleError(error);
  }
}
