import { GoogleGenAI } from "@google/genai";
import * as z from "zod/v4";
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

// gemini-2.5-flash 는 신규 사용자에게 더 이상 제공되지 않는다(404).
// 다른 모델로 바꾸려면 .env.local 의 GEMINI_MODEL 을 설정하면 된다.
// 이 키로 쓸 수 있는 목록은 `npm run list-models` 로 확인.
const DEFAULT_MODEL = "gemini-3.6-flash";

/**
 * 생각(thinking) 토큰도 maxOutputTokens 를 함께 쓰기 때문에,
 * 예산을 열어두면 본문을 쓰기 전에 한도에 걸려 빈 응답이 오는 경우가 있다.
 * 그래서 생각 예산에 상한을 두고 본문 몫을 넉넉히 남긴다.
 */
const MAX_OUTPUT_TOKENS = 16384;
const THINKING_BUDGET = 4096;

let cachedClient: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new AiUnavailableError(
      "GEMINI_API_KEY 가 설정되어 있지 않습니다. https://aistudio.google.com/apikey 에서 키를 받아 " +
        ".env.local 에 넣거나, UI 흐름만 확인하려면 MEETINGLESS_MOCK_AI=1 로 실행하세요.",
    );
  }
  if (!cachedClient) cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

/** 답변 정리(재질문 포함)에 쓰는 모델. 어려운 일이라 기본 모델. */
function digestModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/**
 * 1라운드 질문 생성에 쓰는 모델. 비교적 쉬운 일이라 GEMINI_QUESTION_MODEL 로
 * 한도가 넉넉한 모델(예: gemini-3.5-flash-lite)을 따로 둘 수 있다. 없으면 기본 모델.
 */
function questionModel(): string {
  return process.env.GEMINI_QUESTION_MODEL || digestModel();
}

/** 화면 표시용: "gemini-3.6-flash" 또는 "gemini-3.6-flash (질문: gemini-3.5-flash-lite)" */
export function describeModels(): string {
  return questionModel() === digestModel()
    ? digestModel()
    : `${digestModel()} (질문: ${questionModel()})`;
}

/** Gemini 의 responseJsonSchema 는 $schema 키를 이해하지 못하므로 떼어낸다. */
function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/**
 * Gemini 오류를 사용자에게 보여줄 문장으로 바꾼다.
 * 특히 429 는 분당 한도와 일일 한도가 대처법이 완전히 달라서 구분해 준다.
 */
function describeApiError(error: unknown, model: string): string | null {
  const raw = String((error as Error)?.message ?? error);
  const status = raw.match(/"code"\s*:\s*(\d+)/)?.[1];

  if (status === "429" || /RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    const perDay = /PerDay|per day/i.test(raw);
    const retryDelay = raw.match(/"retryDelay"\s*:\s*"(\d+)s"/)?.[1];
    if (perDay) {
      return (
        `오늘 쓸 수 있는 ${model} 무료 사용량을 다 썼습니다. 내일 초기화될 때까지 기다리거나, ` +
        ".env.local 에서 GEMINI_MODEL 또는 GEMINI_QUESTION_MODEL 을 한도가 더 넉넉한 모델" +
        "(예: gemini-3.5-flash-lite)로 바꾸거나, Google AI Studio 에서 결제를 연결하세요."
      );
    }
    return `요청이 잠시 몰렸습니다(분당 한도). ${retryDelay ? `${retryDelay}초` : "1분쯤"} 뒤에 다시 시도해 주세요.`;
  }

  if (status === "503" || /UNAVAILABLE|high demand/i.test(raw)) {
    return "모델이 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해 주세요.";
  }
  if (status === "404" || /is no longer available|NOT_FOUND/i.test(raw)) {
    return `모델 "${model}" 을 쓸 수 없습니다. \`npm run list-models\` 로 사용 가능한 모델을 확인하고 .env.local 의 GEMINI_MODEL / GEMINI_QUESTION_MODEL 을 바꿔주세요.`;
  }
  if (status === "400" && /API key|API_KEY_INVALID/i.test(raw)) {
    return "GEMINI_API_KEY 가 올바르지 않습니다. .env.local 을 확인해 주세요.";
  }
  return null;
}

async function generateJson<T extends z.ZodType>(
  prompt: string,
  schema: T,
  model: string,
): Promise<z.infer<T>> {
  let response;
  try {
    response = await client().models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiSchema(schema),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: THINKING_BUDGET },
      },
    });
  } catch (error) {
    const message = describeApiError(error, model);
    if (message) throw new AiUnavailableError(message);
    throw error;
  }

  const text = response.text?.trim();
  if (!text) {
    const finishReason = response.candidates?.[0]?.finishReason;
    const blockReason = response.promptFeedback?.blockReason;
    throw new AiUnavailableError(
      blockReason
        ? `모델이 요청을 차단했습니다 (${blockReason}). 주제나 배경 문구를 다듬어 다시 시도해 주세요.`
        : finishReason === "MAX_TOKENS"
          ? "응답이 길이 제한에 걸렸습니다. 배경이나 답변이 너무 길지 않은지 확인해 주세요."
          : `모델이 빈 응답을 돌려줬습니다${finishReason ? ` (${finishReason})` : ""}. 다시 시도해 주세요.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiUnavailableError("모델 응답이 올바른 JSON이 아닙니다. 다시 시도해 주세요.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AiUnavailableError(
      `모델 응답이 예상한 형식과 다릅니다: ${parsed.error.issues[0]?.message ?? ""}`,
    );
  }
  return parsed.data;
}

export async function generateInitialQuestions(input: InitialInput): Promise<InitialPlan> {
  const plan = await generateJson(buildInitialPrompt(input), InitialPlanSchema, questionModel());
  return {
    intro: plan.intro,
    questions: plan.questions.map(normalizeQuestion),
  };
}

export async function synthesizeAndFollowUp(input: FollowUpInput): Promise<FollowUpPlan> {
  const plan = await generateJson(buildFollowUpPrompt(input), FollowUpPlanSchema, digestModel());
  return {
    digest: plan.digest as RoundDigest,
    intro: plan.intro,
    questions: plan.questions.map(normalizeQuestion),
  };
}
