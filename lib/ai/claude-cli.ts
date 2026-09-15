import { spawn } from "node:child_process";
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

/*
 * Claude Code CLI 를 헤드리스(-p)로 띄워 쓰는 provider. API 키 대신 이 PC 의 Claude 구독 로그인을 쓴다.
 * - 데모 전용. Claude Code 가 로그인된 PC 에서만 돌고, 어디에도 배포할 수 없다.
 * - 도구는 전부 끄고(--tools ""), MCP 도 읽지 않고(--strict-mcp-config), 세션도 남기지 않는다.
 * - 출력은 --json-schema 로 받아 structured_output 을 zod 로 한 번 더 검증한다.
 * - 호출당 기동에 몇 초가 더 든다. 회의 한 건에 4번이면 문제없는 수준.
 */

const DEFAULT_MODEL = "sonnet";
const TIMEOUT_MS = 180_000;

function command(): string {
  return process.env.CLAUDE_CLI_PATH || "claude";
}

export function modelName(): string {
  return process.env.CLAUDE_CLI_MODEL || DEFAULT_MODEL;
}

/** Claude Code 안에서 띄운 프로세스가 물려받는 변수. 남겨 두면 CLI 가 중첩 세션으로 보고 거부한다. */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) delete env[key];
  }
  return env;
}

/**
 * zod 스키마를 CLI 에 넘길 JSON 스키마로. 구조화 출력이 받지 않는 길이·범위 제약은 뺀다.
 * 그 제약은 응답을 받은 뒤 zod 가 다시 검사한다.
 */
function toJsonSchema(schema: z.ZodType): string {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return JSON.stringify(stripConstraints(json));
}

const UNSUPPORTED = new Set(["minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "pattern"]);

function stripConstraints(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripConstraints);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (UNSUPPORTED.has(key)) continue;
      out[key] = stripConstraints(value);
    }
    return out;
  }
  return node;
}

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(args: string[], input: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command(), args, {
      env: childEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new AiUnavailableError("Claude CLI 가 3분 안에 답하지 않아 중단했습니다. 다시 시도해 주세요."));
    }, TIMEOUT_MS);

    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(
          new AiUnavailableError(
            "claude 명령을 찾을 수 없습니다. Claude Code 를 설치하고 로그인하거나, " +
              ".env.local 의 CLAUDE_CLI_PATH 에 실행 파일 경로를 적어 주세요.",
          ),
        );
        return;
      }
      reject(error);
    });
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
    // 프로세스가 먼저 죽으면 stdin 에 EPIPE 가 난다. 결과는 close 에서 처리한다.
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

/** CLI 가 돌려주는 JSON 봉투에서 쓰는 부분만 */
interface Envelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
}

function describeFailure(raw: string): string {
  if (/not logged in|please log in|authenticate|unauthorized|invalid api key/i.test(raw)) {
    return "Claude Code 에 로그인되어 있지 않습니다. 터미널에서 `claude` 를 한 번 실행해 로그인한 뒤 다시 시도하세요.";
  }
  if (/rate.?limit|usage limit|limit reached|overloaded|\b429\b|\b529\b/i.test(raw)) {
    return "Claude 구독 사용량 한도에 걸렸습니다. 5시간 창이 지나면 풀립니다. 잠시 후 다시 시도하세요.";
  }
  if (/nested|inside (a )?claude code/i.test(raw)) {
    return "Claude Code 세션 안에서는 다시 실행할 수 없습니다. 일반 터미널에서 서버를 띄워 주세요.";
  }
  return "";
}

async function generateJson<T extends z.ZodType>(prompt: string, schema: T): Promise<z.infer<T>> {
  const args = [
    "-p",
    "--output-format", "json",
    "--json-schema", toJsonSchema(schema),
    "--system-prompt", SYSTEM,
    "--tools", "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--model", modelName(),
  ];
  const { code, stdout, stderr } = await run(args, prompt);

  let envelope: Envelope | null = null;
  try {
    envelope = JSON.parse(stdout) as Envelope;
  } catch {
    envelope = null;
  }

  if (code !== 0 || !envelope || envelope.is_error) {
    const raw = `${envelope?.result ?? ""}\n${stderr}\n${stdout}`;
    const known = describeFailure(raw);
    const tail = (envelope?.result || stderr || stdout).trim().slice(-300);
    throw new AiUnavailableError(known || `Claude CLI 호출에 실패했습니다 (exit ${code ?? "?"}). ${tail}`);
  }

  let raw: unknown = envelope.structured_output;
  if (raw === undefined && typeof envelope.result === "string") {
    try {
      raw = JSON.parse(envelope.result);
    } catch {
      raw = undefined;
    }
  }
  if (raw === undefined) {
    throw new AiUnavailableError("Claude CLI 응답에서 JSON 을 찾지 못했습니다. 다시 시도해 주세요.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AiUnavailableError(
      `Claude CLI 응답이 예상한 형식과 다릅니다: ${parsed.error.issues[0]?.message ?? ""}`,
    );
  }
  return parsed.data;
}

export async function generateInitialQuestions(input: InitialInput): Promise<InitialPlan> {
  const plan = await generateJson(buildInitialPrompt(input), InitialPlanSchema);
  return {
    intro: plan.intro,
    questions: plan.questions.map(normalizeQuestion),
    hostNote: plan.hostNote,
  };
}

export async function synthesizeAndFollowUp(input: FollowUpInput): Promise<FollowUpPlan> {
  const plan = await generateJson(buildFollowUpPrompt(input), FollowUpPlanSchema);
  return {
    digest: plan.digest as RoundDigest,
    intro: plan.intro,
    questions: plan.questions.map(normalizeQuestion),
    hostNote: plan.hostNote,
  };
}
