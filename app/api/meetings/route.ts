import { createMeeting, createRound } from "@/lib/db";
import { activeProvider, generateInitialQuestions } from "@/lib/ai";
import { fail, handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 예상 참여자: 배열이나 줄바꿈·쉼표로 구분한 문자열. 공백과 중복은 정리한다. */
function parseNames(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input.map(String)
    : typeof input === "string"
      ? input.split(/[\n,]/)
      : [];
  const names: string[] = [];
  for (const name of raw.map((n) => n.trim()).filter(Boolean)) {
    if (!names.includes(name)) names.push(name);
  }
  return names.slice(0, 50);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      background?: string;
      goal?: string;
      maxRounds?: number;
      expectedParticipants?: unknown;
    };

    const title = (body.title ?? "").trim();
    const background = (body.background ?? "").trim();
    const goal = (body.goal ?? "").trim();
    // 첫 화면의 선택지(1~3)와 같은 범위로 자른다.
    const maxRounds = Math.min(Math.max(Number(body.maxRounds) || 2, 1), 3);
    const expectedParticipants = parseNames(body.expectedParticipants);

    if (!title) return fail("회의 주제를 입력해 주세요.");
    if (background.length < 10) return fail("배경을 조금 더 자세히 적어 주세요. (10자 이상)");

    const plan = await generateInitialQuestions({ title, background, goal, maxRounds });

    const meeting = createMeeting({ title, background, goal, maxRounds, expectedParticipants });
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
