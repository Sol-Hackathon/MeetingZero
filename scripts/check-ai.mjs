// API 키가 제대로 붙었는지 확인한다.
//   npm run check-ai
// 회의를 만들다가 실패하는 것보다 먼저 여기서 확인하는 게 빠릅니다.

const provider =
  process.env.AI_PROVIDER?.trim().toLowerCase() ||
  (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    ? "gemini"
    : process.env.ANTHROPIC_API_KEY
      ? "claude"
      : null);

if (process.env.MEETINGLESS_MOCK_AI === "1") {
  console.log("⚠  MEETINGLESS_MOCK_AI=1 이라 앱은 모의 응답을 씁니다.");
  console.log("   실제 모델을 쓰려면 .env.local 에서 0 으로 바꾸세요.");
  console.log("   (아래 확인은 그와 별개로 키만 검사합니다)\n");
}

if (!provider) {
  console.error("✗ 키가 없습니다. .env.local 에 GEMINI_API_KEY 또는 ANTHROPIC_API_KEY 를 넣으세요.");
  process.exit(1); // 아직 열린 소켓이 없어 즉시 종료해도 안전하다
}

const PROMPT =
  '다음 JSON만 출력하세요: {"ok": true, "greeting": "<한국어로 다섯 글자 이내 인사>"}';
const SCHEMA = {
  type: "object",
  properties: { ok: { type: "boolean" }, greeting: { type: "string" } },
  required: ["ok", "greeting"],
  additionalProperties: false,
};

try {
  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY 가 비어 있습니다.");

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const started = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: PROMPT,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: SCHEMA,
        maxOutputTokens: 4096,
        // thinkingConfig 는 일부러 넣지 않는다.
        // Gemini 3.x 는 thinking 끄기(thinkingBudget: 0)를 거부하고,
        // 모델별로 받는 형식(thinkingBudget vs thinkingLevel)이 달라
        // 연결 확인용으로는 기본값에 맡기는 게 안전하다.
      },
    });
    const text = response.text?.trim();
    if (!text) {
      throw new Error(
        `빈 응답 (finishReason: ${response.candidates?.[0]?.finishReason ?? "?"})`,
      );
    }
    console.log(`✓ Gemini 연결 성공 — ${model} (${Date.now() - started}ms)`);
    console.log("  응답:", text);
    console.log("  구조화 출력:", JSON.parse(text).ok === true ? "정상" : "이상함");
  } else if (provider === "claude") {
    const model = process.env.ANTHROPIC_MODEL || "claude-opus-5";
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 가 비어 있습니다.");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const started = Date.now();
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: PROMPT }],
    });
    const text = response.content.find((block) => block.type === "text")?.text?.trim();
    console.log(`✓ Claude 연결 성공 — ${model} (${Date.now() - started}ms)`);
    console.log("  응답:", text);
    console.log("  입력/출력 토큰:", response.usage.input_tokens, "/", response.usage.output_tokens);
  } else {
    throw new Error(`AI_PROVIDER 값이 올바르지 않습니다: "${provider}" (gemini 또는 claude)`);
  }
} catch (error) {
  console.error(`✗ ${provider} 호출 실패`);
  console.error(" ", error?.message ?? error);
  if (String(error?.message).match(/API key|API_KEY_INVALID|401|invalid.?x-api-key/i)) {
    console.error("  → 키가 잘못되었거나 만료됐을 수 있습니다.");
  }
  if (String(error?.message).match(/quota|RESOURCE_EXHAUSTED|429|credit balance/i)) {
    console.error("  → 무료 등급 한도이거나 크레딧이 부족합니다.");
  }
  process.exitCode = 1;
}
