import { AiUnavailableError } from "./ai/errors";
import * as claude from "./ai/claude";
import * as claudeCli from "./ai/claude-cli";
import * as gemini from "./ai/gemini";
import * as mock from "./ai/mock";
import type {
  FollowUpInput,
  FollowUpPlan,
  InitialInput,
  InitialPlan,
} from "./ai/prompts";

export { AiUnavailableError };
export type { FollowUpPlan, InitialPlan };

type Provider = "gemini" | "claude" | "claude-cli" | "mock";

const PROVIDERS: readonly string[] = ["gemini", "claude", "claude-cli"];

/**
 * 어떤 모델을 쓸지 고른다.
 * - MEETINGLESS_MOCK_AI=1 이면 무조건 모의 응답
 * - AI_PROVIDER 로 명시 (gemini | claude | claude-cli)
 *   claude-cli 는 이 PC 의 Claude Code 구독 로그인을 쓴다. 키 없음, 데모 전용.
 * - 명시가 없으면 키가 있는 쪽을 쓰고, 둘 다 있으면 gemini 우선
 */
function provider(): Provider {
  if (process.env.MEETINGLESS_MOCK_AI === "1") return "mock";

  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit && PROVIDERS.includes(explicit)) return explicit as Provider;
  if (explicit) {
    throw new AiUnavailableError(
      `AI_PROVIDER 값이 올바르지 않습니다: "${explicit}" (gemini, claude 또는 claude-cli)`,
    );
  }

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "claude";

  throw new AiUnavailableError(
    "API 키가 없습니다. .env.local 에 GEMINI_API_KEY 또는 ANTHROPIC_API_KEY 를 넣거나, " +
      "Claude Code 가 로그인된 PC 라면 AI_PROVIDER=claude-cli 로, " +
      "화면 흐름만 확인하려면 MEETINGLESS_MOCK_AI=1 로 실행하세요.",
  );
}

function impl() {
  switch (provider()) {
    case "gemini":
      return gemini;
    case "claude":
      return claude;
    case "claude-cli":
      return claudeCli;
    case "mock":
      return mock;
  }
}

/** 지금 어떤 모델을 쓰고 있는지 (화면 표시·디버깅용) */
export function activeProvider(): string {
  try {
    const name = provider();
    if (name === "mock") return "mock";
    if (name === "gemini") return gemini.describeModels();
    if (name === "claude-cli") return `claude-cli (${claudeCli.modelName()})`;
    return process.env.ANTHROPIC_MODEL || "claude-opus-5";
  } catch {
    return "(설정 안 됨)";
  }
}

/** 주제·배경으로 1라운드 질문을 만든다. */
export function generateInitialQuestions(input: InitialInput): Promise<InitialPlan> {
  return impl().generateInitialQuestions(input);
}

/** 라운드 답변을 정리하고, 남은 쟁점으로 다음 라운드 질문을 만든다. */
export function synthesizeAndFollowUp(input: FollowUpInput): Promise<FollowUpPlan> {
  return impl().synthesizeAndFollowUp(input);
}
