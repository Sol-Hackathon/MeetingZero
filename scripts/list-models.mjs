// 이 키로 쓸 수 있는 모델 목록을 확인한다.
//   node --env-file-if-exists=.env.local scripts/list-models.mjs
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY 가 없습니다.");
  process.exit(1);
}

const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
  headers: { "x-goog-api-key": apiKey },
});
const body = await response.json();
if (!response.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exitCode = 1;
} else {
  const usable = (body.models ?? []).filter((m) =>
    (m.supportedGenerationMethods ?? []).includes("generateContent"),
  );
  console.log(`generateContent 가능한 모델 ${usable.length}개:`);
  for (const model of usable) {
    console.log(" ", model.name.replace("models/", ""), "—", model.displayName);
  }
}
