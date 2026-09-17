import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AiUnavailableError } from "./errors";
import {
  FollowUpPlanSchema,
  InitialPlanSchema,
  SYSTEM,
  buildFollowUpPrompt,
  buildInitialPrompt,
  normalizeQuestion,
  type FollowUpInput,
  type FollowUpPlan,
  type InitialInput,
  type InitialPlan,
} from "./prompts";
import type { RoundDigest } from "../types";

const DEFAULT_MODEL = "claude-opus-5";

let cachedClient: Anthropic | null = null;

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new AiUnavailableError(
      "ANTHROPIC_API_KEY 가 설정되어 있지 않습니다. .env.local 에 키를 넣거나, " +
        "UI 흐름만 확인하려면 MEETINGLESS_MOCK_AI=1 로 실행하세요.",
    );
  }
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

function modelName(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

function requireParsed<T>(response: { parsed_output: T | null; stop_reason: string | null }): T {
  if (response.stop_reason === "refusal") {
    throw new AiUnavailableError(
      "모델이 이 내용에 대한 응답을 거부했습니다. 주제나 배경 문구를 다듬어 다시 시도해 주세요.",
    );
  }
  if (!response.parsed_output) {
    throw new AiUnavailableError("모델 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
  }
  return response.parsed_output;
}

export async function generateInitialQuestions(input: InitialInput): Promise<InitialPlan> {
  const response = await client().messages.parse({
    model: modelName(),
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(InitialPlanSchema) },
    messages: [{ role: "user", content: buildInitialPrompt(input) }],
  });

  const plan = requireParsed(response);
  return {
    intro: plan.intro,
    questions: plan.questions.map(normalizeQuestion),
  };
}

export async function synthesizeAndFollowUp(input: FollowUpInput): Promise<FollowUpPlan> {
  const response = await client().messages.parse({
    model: modelName(),
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(FollowUpPlanSchema) },
    messages: [{ role: "user", content: buildFollowUpPrompt(input) }],
  });

  const plan = requireParsed(response);
  return {
    digest: plan.digest as RoundDigest,
    intro: plan.intro,
    questions: plan.questions.map(normalizeQuestion),
  };
}
