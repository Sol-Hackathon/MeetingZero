import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { shortId, secretToken } from "./ids";
import type {
  Decision,
  DraftQuestion,
  Meeting,
  Question,
  Round,
  RoundDigest,
  RoundStatus,
} from "./types";

const DB_PATH = path.join(process.cwd(), "data", "meetingless.db");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meetings (
  id            TEXT PRIMARY KEY,
  host_token    TEXT NOT NULL,
  title         TEXT NOT NULL,
  background    TEXT NOT NULL,
  goal          TEXT NOT NULL DEFAULT '',
  max_rounds    INTEGER NOT NULL DEFAULT 2,
  status        TEXT NOT NULL DEFAULT 'draft',
  decision_json TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rounds (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id  TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  round_no    INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',
  intro       TEXT NOT NULL DEFAULT '',
  digest_json TEXT,
  opened_at   TEXT,
  closed_at   TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (meeting_id, round_no)
);

CREATE TABLE IF NOT EXISTS questions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id     INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  order_no     INTEGER NOT NULL,
  text         TEXT NOT NULL,
  intent       TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT 'open',
  options_json TEXT,
  required     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS participants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  name       TEXT NOT NULL,
  UNIQUE (meeting_id, token)
);

CREATE TABLE IF NOT EXISTS submissions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id       INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  submitted_at   TEXT NOT NULL,
  UNIQUE (round_id, participant_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  value         TEXT NOT NULL,
  UNIQUE (submission_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_rounds_meeting ON rounds(meeting_id);
CREATE INDEX IF NOT EXISTS idx_questions_round ON questions(round_id);
CREATE INDEX IF NOT EXISTS idx_submissions_round ON submissions(round_id);
CREATE INDEX IF NOT EXISTS idx_answers_submission ON answers(submission_id);
`;

/**
 * 처음 만든 뒤에 추가된 컬럼. CREATE TABLE IF NOT EXISTS 는 이미 있는 테이블을 건드리지
 * 않으므로, 기존 DB 파일에는 서버가 뜰 때 없는 컬럼만 골라서 붙인다.
 */
const ADDED_COLUMNS: { table: string; column: string; definition: string }[] = [
  { table: "meetings", column: "decision_json", definition: "TEXT" },
];

// dev 서버가 hot reload 될 때마다 커넥션이 새로 열리는 것을 막는다.
const globalForDb = globalThis as unknown as { __meetinglessDb?: DatabaseSync };

function getDb(): DatabaseSync {
  if (!globalForDb.__meetinglessDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec(SCHEMA);
    for (const { table, column, definition } of ADDED_COLUMNS) {
      ensureColumn(db, table, column, definition);
    }
    globalForDb.__meetinglessDb = db;
  }
  return globalForDb.__meetinglessDb;
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string): void {
  const columns = db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as Row[];
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/** 여러 쓰기를 하나로 묶는다. 중간에 실패하면 전부 되돌린다. */
function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* row -> 도메인 객체                                                    */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

function toMeeting(row: Row): Meeting {
  return {
    id: String(row.id),
    hostToken: String(row.host_token),
    title: String(row.title),
    background: String(row.background),
    goal: String(row.goal ?? ""),
    maxRounds: Number(row.max_rounds),
    status: String(row.status) as Meeting["status"],
    decision: row.decision_json ? (JSON.parse(String(row.decision_json)) as Decision) : null,
    createdAt: String(row.created_at),
  };
}

function toQuestion(row: Row): Question {
  return {
    id: Number(row.id),
    roundId: Number(row.round_id),
    orderNo: Number(row.order_no),
    text: String(row.text),
    intent: String(row.intent ?? ""),
    kind: String(row.kind) as Question["kind"],
    options: row.options_json ? (JSON.parse(String(row.options_json)) as string[]) : [],
    required: Number(row.required) === 1,
  };
}

function toRound(row: Row, questions: Question[]): Round {
  return {
    id: Number(row.id),
    meetingId: String(row.meeting_id),
    roundNo: Number(row.round_no),
    status: String(row.status) as RoundStatus,
    intro: String(row.intro ?? ""),
    digest: row.digest_json ? (JSON.parse(String(row.digest_json)) as RoundDigest) : null,
    openedAt: row.opened_at ? String(row.opened_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    questions,
  };
}

/* ------------------------------------------------------------------ */
/* meetings                                                            */
/* ------------------------------------------------------------------ */

export function createMeeting(input: {
  title: string;
  background: string;
  goal: string;
  maxRounds: number;
}): Meeting {
  const db = getDb();
  const meeting: Meeting = {
    id: shortId(10),
    hostToken: secretToken(),
    title: input.title,
    background: input.background,
    goal: input.goal,
    maxRounds: input.maxRounds,
    status: "draft",
    decision: null,
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO meetings (id, host_token, title, background, goal, max_rounds, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    meeting.id,
    meeting.hostToken,
    meeting.title,
    meeting.background,
    meeting.goal,
    meeting.maxRounds,
    meeting.status,
    meeting.createdAt,
  );
  return meeting;
}

export function getMeeting(id: string): Meeting | null {
  const row = getDb().prepare(`SELECT * FROM meetings WHERE id = ?`).get(id) as Row | undefined;
  return row ? toMeeting(row) : null;
}

export function setMeetingStatus(id: string, status: Meeting["status"]): void {
  getDb().prepare(`UPDATE meetings SET status = ? WHERE id = ?`).run(status, id);
}

/** 주최자가 결론을 확정한다. 회의는 closed 가 된다. */
export function saveDecision(meetingId: string, decision: Decision): void {
  getDb()
    .prepare(`UPDATE meetings SET decision_json = ?, status = 'closed' WHERE id = ?`)
    .run(JSON.stringify(decision), meetingId);
}

/* ------------------------------------------------------------------ */
/* rounds                                                              */
/* ------------------------------------------------------------------ */

interface NewRound {
  meetingId: string;
  roundNo: number;
  intro: string;
  questions: DraftQuestion[];
}

/** 트랜잭션 안에서만 부른다. */
function insertRound(db: DatabaseSync, input: NewRound): number {
  const result = db
    .prepare(
      `INSERT INTO rounds (meeting_id, round_no, status, intro, created_at)
       VALUES (?, ?, 'draft', ?, ?)`,
    )
    .run(input.meetingId, input.roundNo, input.intro, now());
  const roundId = Number(result.lastInsertRowid);
  insertQuestions(db, roundId, input.questions);
  return roundId;
}

export function createRound(input: NewRound): Round {
  const db = getDb();
  const roundId = transaction(db, () => insertRound(db, input));
  return getRoundById(roundId)!;
}

export function getRoundById(roundId: number): Round | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM rounds WHERE id = ?`).get(roundId) as Row | undefined;
  if (!row) return null;
  return toRound(row, listQuestions(roundId));
}

export function getRound(meetingId: string, roundNo: number): Round | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM rounds WHERE meeting_id = ? AND round_no = ?`)
    .get(meetingId, roundNo) as Row | undefined;
  if (!row) return null;
  return toRound(row, listQuestions(Number(row.id)));
}

export function listRounds(meetingId: string): Round[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM rounds WHERE meeting_id = ? ORDER BY round_no ASC`)
    .all(meetingId) as Row[];
  return rows.map((row) => toRound(row, listQuestions(Number(row.id))));
}

/** 참여자에게 지금 보여줄 라운드 (열려 있는 것 중 가장 최근) */
export function getOpenRound(meetingId: string): Round | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM rounds WHERE meeting_id = ? AND status = 'open'
       ORDER BY round_no DESC LIMIT 1`,
    )
    .get(meetingId) as Row | undefined;
  if (!row) return null;
  return toRound(row, listQuestions(Number(row.id)));
}

/** 검토가 끝난 라운드를 참여자에게 연다. */
export function openRound(roundId: number): void {
  getDb()
    .prepare(`UPDATE rounds SET status = 'open', opened_at = ? WHERE id = ?`)
    .run(now(), roundId);
}

/**
 * 라운드를 마감한다. 정리 결과 저장, 다음 라운드 생성(있으면) 또는 회의를 결론 대기로 전환을
 * 트랜잭션 하나로 묶는다. 중간에 실패하면 아무것도 바뀌지 않는다.
 * 이미 닫힌 라운드면 예외를 던진다 (같은 라운드를 동시에 두 번 마감한 경우).
 */
export function finishRound(input: {
  roundId: number;
  meetingId: string;
  digest: RoundDigest;
  next: { roundNo: number; intro: string; questions: DraftQuestion[] } | null;
}): { nextRound: Round | null } {
  const db = getDb();
  const nextRoundId = transaction(db, () => {
    const result = db
      .prepare(
        `UPDATE rounds SET status = 'closed', closed_at = ?, digest_json = ?
         WHERE id = ? AND status = 'open'`,
      )
      .run(now(), JSON.stringify(input.digest), input.roundId);
    if (Number(result.changes) === 0) {
      throw new Error("진행 중인 라운드가 아닙니다. 이미 마감됐을 수 있습니다.");
    }
    if (input.next) {
      return insertRound(db, { meetingId: input.meetingId, ...input.next });
    }
    db.prepare(`UPDATE meetings SET status = 'deciding' WHERE id = ?`).run(input.meetingId);
    return null;
  });
  return { nextRound: nextRoundId === null ? null : getRoundById(nextRoundId) };
}

export function updateRoundIntro(roundId: number, intro: string): void {
  getDb().prepare(`UPDATE rounds SET intro = ? WHERE id = ?`).run(intro, roundId);
}

/* ------------------------------------------------------------------ */
/* questions                                                           */
/* ------------------------------------------------------------------ */

export function listQuestions(roundId: number): Question[] {
  const rows = getDb()
    .prepare(`SELECT * FROM questions WHERE round_id = ? ORDER BY order_no ASC, id ASC`)
    .all(roundId) as Row[];
  return rows.map(toQuestion);
}

/** 트랜잭션 안에서만 부른다. */
function insertQuestions(db: DatabaseSync, roundId: number, questions: DraftQuestion[]): void {
  const insert = db.prepare(
    `INSERT INTO questions (round_id, order_no, text, intent, kind, options_json, required)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  questions.forEach((q, index) => {
    insert.run(
      roundId,
      index,
      q.text,
      q.intent ?? "",
      q.kind ?? "open",
      q.options?.length ? JSON.stringify(q.options) : null,
      q.required === false ? 0 : 1,
    );
  });
}

/** 주최자가 검토·수정한 질문 목록으로 통째로 교체한다. */
export function replaceQuestions(roundId: number, questions: DraftQuestion[]): Question[] {
  const db = getDb();
  transaction(db, () => {
    db.prepare(`DELETE FROM questions WHERE round_id = ?`).run(roundId);
    insertQuestions(db, roundId, questions);
  });
  return listQuestions(roundId);
}

/* ------------------------------------------------------------------ */
/* participants & answers                                              */
/* ------------------------------------------------------------------ */

export function upsertParticipant(meetingId: string, token: string, name: string): number {
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM participants WHERE meeting_id = ? AND token = ?`)
    .get(meetingId, token) as Row | undefined;
  if (existing) {
    db.prepare(`UPDATE participants SET name = ? WHERE id = ?`).run(name, Number(existing.id));
    return Number(existing.id);
  }
  const result = db
    .prepare(`INSERT INTO participants (meeting_id, token, name) VALUES (?, ?, ?)`)
    .run(meetingId, token, name);
  return Number(result.lastInsertRowid);
}

export function saveSubmission(input: {
  roundId: number;
  participantId: number;
  answers: { questionId: number; value: string }[];
}): void {
  const db = getDb();
  transaction(db, () => {
    db.prepare(
      `INSERT INTO submissions (round_id, participant_id, submitted_at) VALUES (?, ?, ?)
       ON CONFLICT (round_id, participant_id) DO UPDATE SET submitted_at = excluded.submitted_at`,
    ).run(input.roundId, input.participantId, now());
    const submissionId = Number(
      (
        db
          .prepare(`SELECT id FROM submissions WHERE round_id = ? AND participant_id = ?`)
          .get(input.roundId, input.participantId) as Row
      ).id,
    );
    db.prepare(`DELETE FROM answers WHERE submission_id = ?`).run(submissionId);
    const insert = db.prepare(
      `INSERT INTO answers (submission_id, question_id, value) VALUES (?, ?, ?)`,
    );
    for (const answer of input.answers) {
      insert.run(submissionId, answer.questionId, answer.value);
    }
  });
}

export interface SubmissionView {
  submissionId: number;
  participantName: string;
  submittedAt: string;
  answers: { questionId: number; value: string }[];
}

export function listSubmissions(roundId: number): SubmissionView[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id, s.submitted_at, p.name
       FROM submissions s JOIN participants p ON p.id = s.participant_id
       WHERE s.round_id = ? ORDER BY s.submitted_at ASC`,
    )
    .all(roundId) as Row[];
  const answerStmt = db.prepare(
    `SELECT question_id, value FROM answers WHERE submission_id = ? ORDER BY question_id ASC`,
  );
  return rows.map((row) => ({
    submissionId: Number(row.id),
    participantName: String(row.name),
    submittedAt: String(row.submitted_at),
    answers: (answerStmt.all(Number(row.id)) as Row[]).map((a) => ({
      questionId: Number(a.question_id),
      value: String(a.value),
    })),
  }));
}

export type RoundWithSubmissions = Round & {
  submissionCount: number;
  submissions: SubmissionView[];
};

/** 주최자 화면과 리포트가 쓰는 형태: 라운드마다 답변까지 붙인다. */
export function listRoundsWithSubmissions(meetingId: string): RoundWithSubmissions[] {
  return listRounds(meetingId).map((round) => {
    const submissions = listSubmissions(round.id);
    return { ...round, submissionCount: submissions.length, submissions };
  });
}

export function countSubmissions(roundId: number): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM submissions WHERE round_id = ?`)
    .get(roundId) as Row;
  return Number(row.c);
}

/** 이 참여자가 해당 라운드에 이미 답했는지 */
export function findSubmission(
  roundId: number,
  meetingId: string,
  token: string,
): SubmissionView | null {
  const db = getDb();
  const participant = db
    .prepare(`SELECT id, name FROM participants WHERE meeting_id = ? AND token = ?`)
    .get(meetingId, token) as Row | undefined;
  if (!participant) return null;
  const row = db
    .prepare(`SELECT * FROM submissions WHERE round_id = ? AND participant_id = ?`)
    .get(roundId, Number(participant.id)) as Row | undefined;
  if (!row) return null;
  const answers = (
    db
      .prepare(`SELECT question_id, value FROM answers WHERE submission_id = ?`)
      .all(Number(row.id)) as Row[]
  ).map((a) => ({ questionId: Number(a.question_id), value: String(a.value) }));
  return {
    submissionId: Number(row.id),
    participantName: String(participant.name),
    submittedAt: String(row.submitted_at),
    answers,
  };
}

export function getParticipantName(meetingId: string, token: string): string | null {
  const row = getDb()
    .prepare(`SELECT name FROM participants WHERE meeting_id = ? AND token = ?`)
    .get(meetingId, token) as Row | undefined;
  return row ? String(row.name) : null;
}
