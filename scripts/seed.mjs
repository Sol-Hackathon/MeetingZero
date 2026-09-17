// 시나리오 하나를 골라 회의 생성 → 참여자 답변 → 마감 → 재질문까지 자동으로 돌린다.
//
//   npm run seed 1          답변은 samples/scenarios.mjs 에 적힌 문구를 그대로 사용 (AI 호출 최소)
//   npm run seed 1 --ai     답변도 페르소나대로 AI 가 작성 (더 현실적, 호출 많음)
//                           Gemini 키가 있으면 Gemini, 없고 AI_PROVIDER=claude-cli 면 Claude CLI 로 쓴다
//   BASE=http://localhost:3117 npm run seed 3
//   npm run seed 1 --ai --resume=<회의ID>:<주최자토큰>   중간에 실패한 회의를 안 닫힌 라운드부터 이어서 진행
//
// dev 서버가 먼저 떠 있어야 합니다.
//
// 무료 등급 사용량을 아끼려고 기본값을 "AI 없는 답변"으로 두었습니다.
// 이 경우 AI 호출은 라운드당 2회(질문 생성 + 답변 정리)뿐이고,
// 참여자 답변은 미리 적어둔 문구로 채웁니다. 서비스 본체(질문 생성·정리·재질문)를
// 검증하는 데는 이걸로 충분합니다.

import { scenarios } from "../samples/scenarios.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const args = process.argv.slice(2);
const useAiAnswers = args.includes("--ai");
const index = Number(args.find((a) => !a.startsWith("--")) ?? 1);
const resumeArg = args.find((a) => a.startsWith("--resume="));
const resume = resumeArg ? resumeArg.slice("--resume=".length).split(":") : null;
if (resume && resume.length !== 2) {
  console.error("--resume=<회의ID>:<주최자토큰> 형식으로 적어 주세요.");
  process.exit(1);
}
const scenario = scenarios[index - 1];

if (!scenario) {
  console.error(`시나리오 번호는 1~${scenarios.length} 입니다. 받은 값: ${args.join(" ") || "(없음)"}`);
  process.exit(1);
}

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* 오류 해석 — 분당 한도와 일일 한도는 대처법이 다르다                    */
/* ------------------------------------------------------------------ */

class QuotaExhausted extends Error {}

function classify(error) {
  const raw = String(error?.message ?? error);
  if (/"code"\s*:\s*429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    if (/PerDay|per day|오늘 쓸 수 있는/i.test(raw)) return { kind: "daily" };
    const seconds = Number(raw.match(/"retryDelay"\s*:\s*"(\d+)s"/)?.[1] ?? 0);
    return { kind: "minute", waitSeconds: seconds || 60 };
  }
  if (/"code"\s*:\s*503|UNAVAILABLE|high demand|과부하/i.test(raw)) {
    return { kind: "overload", waitSeconds: 30 };
  }
  return { kind: "other" };
}

async function withRetry(fn, label) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const info = classify(error);
      if (info.kind === "daily") {
        throw new QuotaExhausted(String(error?.message ?? error));
      }
      if ((info.kind !== "minute" && info.kind !== "overload") || attempt >= 3) throw error;
      const wait = info.waitSeconds + 5;
      log(`   … ${label}: 한도/과부하로 ${wait}초 대기 후 재시도 (${attempt}/2)`);
      await sleep(wait * 1000);
    }
  }
}

/* ------------------------------------------------------------------ */

async function api(path, init) {
  const response = await fetch(BASE + path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path} 가 JSON이 아닌 응답을 돌려줬습니다: ${text.slice(0, 200)}`);
  }
  if (!response.ok) throw new Error(`${response.status} ${path} — ${body.error}`);
  return body;
}

/** 미리 적어둔 문구로 답변을 만든다. AI 호출 없음. */
function cannedAnswers(participant, participantIndex, round) {
  return round.questions.map((question) => {
    if (question.kind === "choice" && question.options.length > 0) {
      // 참여자마다 다른 선택지를 고르게 해서 의견이 갈리도록 한다.
      return {
        questionId: question.id,
        value: question.options[participantIndex % question.options.length],
      };
    }
    if (question.kind === "scale") {
      return { questionId: question.id, value: String(participant.scale ?? 3) };
    }
    return { questionId: question.id, value: participant.voice };
  });
}

/** 페르소나대로 AI 가 답변을 쓴다. --ai 일 때만 사용. */
async function aiAnswers(participant, round, previous, ai, model) {
  const questionBlock = round.questions
    .map((q) => {
      if (q.kind === "choice") {
        return `- id ${q.id} [선택형] ${q.text}\n  선택지: ${q.options.join(" / ")}`;
      }
      if (q.kind === "scale") return `- id ${q.id} [5점 척도] ${q.text}`;
      return `- id ${q.id} [서술형] ${q.text}`;
    })
    .join("\n");

  const prompt = `당신은 아래 회의의 참여자 한 명입니다. 그 사람이 되어 질문에 답하세요.

<회의주제>
${scenario.title}
</회의주제>

<배경>
${scenario.background}
</배경>

<당신>
이름: ${participant.name}
역할: ${participant.role}
성향과 사정: ${participant.persona}
</당신>
${
  previous
    ? `\n<직전 라운드 정리>\n${previous.overview}\n남은 쟁점: ${previous.unresolved.join(", ") || "없음"}\n</직전 라운드 정리>\n`
    : ""
}
<질문>
${questionBlock}
</질문>

규칙:
- 선택형은 주어진 선택지 중 하나를 글자 그대로 정확히 쓰세요.
- 5점 척도는 "1"~"5" 중 숫자 하나만 쓰세요.
- 서술형은 2~4문장으로, 실제 직장인이 설문에 답하듯 쓰세요.
- 당신의 성향과 사정에 맞게 답하세요. 숨기려는 것은 돌려 말해도 됩니다.
- 모든 질문에 답하고, questionId 는 위에 준 id 를 그대로 쓰세요.`;

  if (ai === "claude-cli") return cliAnswers(prompt, model, participant.name);

  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              answers: {
                type: "array",
                items: {
                  type: "object",
                  properties: { questionId: { type: "number" }, value: { type: "string" } },
                  required: ["questionId", "value"],
                  additionalProperties: false,
                },
              },
            },
            required: ["answers"],
            additionalProperties: false,
          },
          maxOutputTokens: 8192,
        },
      }),
    `${participant.name} 답변 생성`,
  );

  const text = response.text?.trim();
  if (!text) {
    throw new Error(
      `${participant.name} 답변이 비었습니다 (finishReason: ${response.candidates?.[0]?.finishReason ?? "?"})`,
    );
  }
  return JSON.parse(text).answers;
}

/** Claude Code CLI 로 참여자 답변을 쓴다. lib/ai/claude-cli.ts 와 같은 방식 (키 없음, 구독 사용량 차감). */
async function cliAnswers(prompt, model, who) {
  const { spawn } = await import("node:child_process");
  const schema = JSON.stringify({
    type: "object",
    properties: {
      answers: {
        type: "array",
        items: {
          type: "object",
          properties: { questionId: { type: "number" }, value: { type: "string" } },
          required: ["questionId", "value"],
          additionalProperties: false,
        },
      },
    },
    required: ["answers"],
    additionalProperties: false,
  });
  // Claude Code 안에서 실행하면 넘어오는 변수. 남기면 중첩 세션으로 보고 거부한다.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k !== "CLAUDECODE" && !k.startsWith("CLAUDE_CODE_")),
  );
  const output = await new Promise((resolve, reject) => {
    const child = spawn(
      process.env.CLAUDE_CLI_PATH || "claude",
      ["-p", "--output-format", "json", "--json-schema", schema, "--tools", "",
        "--strict-mcp-config", "--no-session-persistence", "--model", model],
      { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${who} 답변 생성 실패 (exit ${code}): ${(err || out).trim().slice(-300)}`)),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
  const envelope = JSON.parse(output);
  if (envelope.is_error) throw new Error(`${who} 답변 생성 실패: ${envelope.result}`);
  const answers = envelope.structured_output?.answers ?? JSON.parse(envelope.result ?? "{}").answers;
  if (!Array.isArray(answers)) throw new Error(`${who} 답변에서 JSON 을 찾지 못했습니다.`);
  return answers;
}

/* ------------------------------------------------------------------ */

let ai = null;
let answerModel = null;
if (useAiAnswers) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    const { GoogleGenAI } = await import("@google/genai");
    ai = new GoogleGenAI({ apiKey });
    // 참여자 답변은 본 서비스보다 가벼운 작업이라, 한도가 넉넉한 모델을 따로 쓴다.
    // 모델마다 사용량이 따로 계산되므로 본 서비스 몫을 덜 잡아먹는다.
    answerModel = process.env.SEED_ANSWER_MODEL || "gemini-flash-lite-latest";
  } else if ((process.env.AI_PROVIDER ?? "").trim().toLowerCase() === "claude-cli") {
    ai = "claude-cli";
    answerModel = process.env.SEED_ANSWER_MODEL || process.env.CLAUDE_CLI_MODEL || "sonnet";
  } else {
    console.error("--ai 를 쓰려면 GEMINI_API_KEY 가 있거나 AI_PROVIDER=claude-cli 여야 합니다.");
    process.exit(1);
  }
}

const totalAiCalls = scenario.maxRounds * 2 + (useAiAnswers ? scenario.maxRounds * scenario.participants.length : 0);
log(`시나리오 ${index}. ${scenario.title}`);
log(
  `참여자 ${scenario.participants.length}명 · 최대 ${scenario.maxRounds}라운드 · ` +
    `답변 ${useAiAnswers ? `AI 작성(${answerModel})` : "미리 적어둔 문구"} · AI 호출 최대 ${totalAiCalls}회\n`,
);

let meetingId = null;
let hostToken = null;

try {
  if (resume) {
    [meetingId, hostToken] = resume;
    log(`회의 ${meetingId} 를 안 닫힌 라운드부터 이어서 진행합니다.`);
  } else {
    log("회의를 만들고 1라운드 질문을 생성하는 중…");
    const created = await withRetry(
      () =>
        api("/api/meetings", {
          method: "POST",
          body: JSON.stringify({
            title: scenario.title,
            background: scenario.background,
            goal: scenario.goal,
            maxRounds: scenario.maxRounds,
          }),
        }),
      "질문 생성",
    );
    meetingId = created.meetingId;
    hostToken = created.hostToken;
    if (created.provider) log(`   모델: ${created.provider}`);
  }
  const t = encodeURIComponent(hostToken);

  let roundNo = 1;
  let previous = null;

  while (true) {
    const state = await api(`/api/meetings/${meetingId}?t=${t}`);
    if (resume && roundNo === 1) {
      // 이어서 할 때는 아직 안 닫힌 첫 라운드부터. 직전 라운드 정리는 답변 생성 문맥으로 넘긴다.
      const pending = state.rounds.find((r) => r.status !== "closed");
      if (!pending) {
        log("모든 라운드가 이미 마감돼 있습니다.");
        break;
      }
      roundNo = pending.roundNo;
      const prior = state.rounds.find((r) => r.roundNo === roundNo - 1)?.digest;
      if (prior) previous = { overview: prior.overview, unresolved: prior.unresolved.map((u) => u.topic) };
    }
    const target = state.rounds.find((r) => r.roundNo === roundNo);
    if (!target) break;

    log(`\n━━ ${roundNo}라운드 질문 ━━`);
    target.questions.forEach((q, i) => log(`  Q${i + 1} [${q.kind}] ${q.text}`));

    // 주최자가 검토를 마쳤다고 보고 그대로 공개한다.
    if (target.status === "draft") {
      await api(`/api/meetings/${meetingId}/open?t=${t}`, {
        method: "POST",
        body: JSON.stringify({ roundNo }),
      });
    }

    const publicView = await api(`/api/r/${meetingId}?pt=seed-probe`);

    log(`\n  참여자 답변 ${useAiAnswers ? "생성" : "입력"} 중…`);
    // 이어서 할 때 이미 전원이 답한 라운드면 답변을 다시 만들지 않는다.
    const alreadyAnswered =
      target.status === "open" && target.submissionCount >= scenario.participants.length;
    if (alreadyAnswered) log(`   답변 ${target.submissionCount}건이 이미 있어 그대로 씁니다.`);
    for (const [i, participant] of scenario.participants.entries()) {
      if (alreadyAnswered) break;
      const answers = useAiAnswers
        ? await aiAnswers(participant, publicView.round, previous, ai, answerModel)
        : cannedAnswers(participant, i, publicView.round);
      await api(`/api/r/${meetingId}`, {
        method: "POST",
        body: JSON.stringify({
          participantToken: `seed-${meetingId}-${participant.name}`,
          name: `${participant.name} (${participant.role})`,
          answers,
        }),
      });
      const sample = answers.find((a) => a.value.length > 12)?.value ?? answers[0]?.value ?? "";
      log(`   ✓ ${participant.name} — ${sample.slice(0, 58)}${sample.length > 58 ? "…" : ""}`);
    }

    log(`\n  답변을 정리하는 중…`);
    const closed = await withRetry(
      () =>
        api(`/api/meetings/${meetingId}/close?t=${t}`, {
          method: "POST",
          body: JSON.stringify({ roundNo }),
        }),
      "답변 정리",
    );

    const digest = closed.digest;
    log(`\n━━ ${roundNo}라운드 정리 ━━`);
    log(`  ${digest.overview}`);
    log(`  합의   : ${digest.consensus.map((c) => c.point).join(" / ") || "(없음)"}`);
    log(`  갈림   : ${digest.conflicts.map((c) => c.topic).join(" / ") || "(없음)"}`);
    log(`  미해결 : ${digest.unresolved.map((u) => u.topic).join(" / ") || "(없음)"}`);
    log(`  결론 가능: ${digest.decisionReady ? "가능" : "쟁점 남음"}`);
    log(`  회의 필요: ${digest.meetingNeeded.needed ? "권장" : "불필요"} — ${digest.meetingNeeded.reason}`);

    previous = {
      overview: digest.overview,
      unresolved: digest.unresolved.map((u) => u.topic),
    };

    if (!closed.nextRoundNo) {
      log(`\n종료: ${closed.finishedReason}`);
      break;
    }
    roundNo = closed.nextRoundNo;
  }
} catch (error) {
  if (error instanceof QuotaExhausted) {
    log(`\n오늘 쓸 수 있는 무료 사용량을 다 썼습니다. 재시도해도 풀리지 않습니다.`);
    log(`할 수 있는 것:`);
    log(`  1) 내일 다시 (한도는 태평양시 자정에 초기화됩니다)`);
    log(`  2) .env.local 에 GEMINI_MODEL=gemini-flash-lite-latest 로 바꾸기 (한도가 더 넉넉합니다)`);
    log(`  3) .env.local 에 MEETINGLESS_MOCK_AI=1 로 두고 화면 흐름만 확인하기`);
    log(`  4) Google AI Studio 에서 결제 연결`);
  } else {
    log(`\n실패: ${error?.message ?? error}`);
  }
  if (meetingId) {
    log(`\n여기까지 만들어진 회의는 남아 있습니다. 브라우저에서 이어서 진행할 수 있습니다:`);
    log(`${BASE}/m/${meetingId}?t=${encodeURIComponent(hostToken)}`);
  }
  process.exitCode = 1;
}

if (meetingId && process.exitCode !== 1) {
  log(`\n주최자 화면:  ${BASE}/m/${meetingId}?t=${encodeURIComponent(hostToken)}`);
  log(`참여자 링크:  ${BASE}/r/${meetingId}`);
}
