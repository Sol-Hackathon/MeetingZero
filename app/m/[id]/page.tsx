"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import QuestionEditor, { kindLabel } from "@/app/components/QuestionEditor";
import DigestView from "@/app/components/DigestView";
import DecisionEditor from "@/app/components/DecisionEditor";
import ReportActions from "@/app/components/ReportActions";
import AnswerStats from "@/app/components/AnswerStats";
import ResponseStatus from "@/app/components/ResponseStatus";
import type { Decision, DraftQuestion, Question, Round } from "@/lib/types";

interface SubmissionView {
  submissionId: number;
  participantName: string;
  submittedAt: string;
  answers: { questionId: number; value: string }[];
}

type HostRound = Round & { submissionCount: number; submissions: SubmissionView[] };

interface HostState {
  meeting: {
    id: string;
    title: string;
    background: string;
    goal: string;
    maxRounds: number;
    status: string;
    decision: Decision | null;
    expectedParticipants: string[];
    createdAt: string;
  };
  rounds: HostRound[];
}

const MEETING_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "준비 중", cls: "status" },
  collecting: { label: "답변 수집 중", cls: "status status-live" },
  deciding: { label: "결정 대기", cls: "status status-wait" },
  closed: { label: "종료", cls: "status status-done" },
};

export default function HostPage() {
  return (
    <Suspense fallback={<Centered>불러오는 중…</Centered>}>
      <HostView />
    </Suspense>
  );
}

function HostView() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const meetingId = params.id;
  const hostToken = search.get("t") ?? "";

  const [state, setState] = useState<HostState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/meetings/${meetingId}?t=${encodeURIComponent(hostToken)}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "회의를 불러오지 못했습니다.");
      return;
    }
    setState(data);
  }, [meetingId, hostToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // 답변이 들어오는 동안에는 주기적으로 현황을 갱신한다.
  const hasOpenRound = state?.rounds.some((round) => round.status === "open") ?? false;
  useEffect(() => {
    if (!hasOpenRound) return;
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, [hasOpenRound, load]);

  async function call(path: string, init: RequestInit, label: string) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/meetings/${meetingId}${path}${path.includes("?") ? "&" : "?"}t=${encodeURIComponent(hostToken)}`,
        { headers: { "content-type": "application/json" }, ...init },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
      await load();
      return data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setBusy(null);
    }
  }

  if (error && !state) return <Centered>{error}</Centered>;
  if (!state) return <Centered>불러오는 중…</Centered>;

  const { meeting, rounds } = state;
  const status = MEETING_STATUS[meeting.status] ?? { label: meeting.status, cls: "status" };

  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-10">
      <header>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className={status.cls}>{status.label}</span>
          <span className="eyebrow tabular-nums">{meeting.maxRounds}라운드 회의</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-stone-900">
          {meeting.title}
        </h1>
        {meeting.goal && (
          <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
            <span className="mr-2 text-[13px] font-medium text-stone-500">목표</span>
            {meeting.goal}
          </p>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] text-stone-500 hover:text-stone-900">
            배경 보기
          </summary>
          <p className="mt-2 whitespace-pre-wrap border-l-2 border-stone-300 pl-4 text-[15px] leading-relaxed text-stone-700">
            {meeting.background}
          </p>
        </details>
        {rounds.some((round) => round.status === "closed") && (
          <div className="mt-5">
            <ReportActions meetingId={meetingId} hostToken={hostToken} />
          </div>
        )}
      </header>

      {error && (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <div className="mt-10 space-y-6">
        {rounds.map((round) => (
          <RoundCard
            key={round.id}
            round={round}
            totalRounds={meeting.maxRounds}
            meetingId={meetingId}
            meetingTitle={meeting.title}
            expected={meeting.expectedParticipants}
            busy={busy}
            onSave={(intro, questions) =>
              call(
                "/questions",
                {
                  method: "PUT",
                  body: JSON.stringify({ roundNo: round.roundNo, intro, questions }),
                },
                `save-${round.roundNo}`,
              ).then((data) => {
                if (data) setNotice("질문을 저장했습니다.");
                return data;
              })
            }
            onOpen={(intro, questions, deadlineAt) =>
              call(
                "/questions",
                {
                  method: "PUT",
                  body: JSON.stringify({ roundNo: round.roundNo, intro, questions }),
                },
                `open-${round.roundNo}`,
              ).then(async (saved) => {
                if (!saved) return null;
                const data = await call(
                  "/open",
                  { method: "POST", body: JSON.stringify({ roundNo: round.roundNo, deadlineAt }) },
                  `open-${round.roundNo}`,
                );
                if (data) setNotice("참여자 링크가 열렸습니다. 링크를 공유하세요.");
                return data;
              })
            }
            onClose={() =>
              call(
                "/close",
                { method: "POST", body: JSON.stringify({ roundNo: round.roundNo }) },
                `close-${round.roundNo}`,
              ).then((data) => {
                if (data) {
                  setNotice(
                    data.nextRoundNo
                      ? `의견을 정리하고 ${data.nextRoundNo}라운드 질문을 만들었습니다. 검토 후 공개하세요.`
                      : `답변 정리를 마쳤습니다. ${data.finishedReason ?? ""}`,
                  );
                }
                return data;
              })
            }
          />
        ))}
      </div>

      {(meeting.status === "deciding" || meeting.status === "closed") && (
        <div className="mt-6">
          <DecisionEditor
            decision={meeting.decision}
            digests={rounds.flatMap((round) => (round.digest ? [round.digest] : []))}
            participantNames={Array.from(
              new Set(rounds.flatMap((round) => round.submissions.map((s) => s.participantName))),
            )}
            busy={busy === "decide"}
            onSave={(input) =>
              call("/decide", { method: "POST", body: JSON.stringify(input) }, "decide").then(
                (data) => {
                  if (data) setNotice("결론을 확정했습니다. 리포트는 위쪽 버튼으로 볼 수 있습니다.");
                  return data;
                },
              )
            }
          />
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */

function RoundCard({
  round,
  totalRounds,
  meetingId,
  meetingTitle,
  expected,
  busy,
  onSave,
  onOpen,
  onClose,
}: {
  round: HostRound;
  totalRounds: number;
  meetingId: string;
  meetingTitle: string;
  expected: string[];
  busy: string | null;
  onSave: (intro: string, questions: DraftQuestion[]) => Promise<unknown>;
  onOpen: (
    intro: string,
    questions: DraftQuestion[],
    deadlineAt: string | null,
  ) => Promise<unknown>;
  onClose: () => Promise<unknown>;
}) {
  const [intro, setIntro] = useState(round.intro);
  // datetime-local 입력값. 공개할 때 ISO 로 바꿔 보낸다.
  const [deadline, setDeadline] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => toDrafts(round.questions));

  // 서버 상태가 바뀌면(다음 라운드 생성 등) 편집 중인 내용을 다시 맞춘다.
  useEffect(() => {
    if (round.status !== "draft") return;
    setIntro(round.intro);
    setQuestions(toDrafts(round.questions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id, round.status]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/r/${meetingId}`;
    return `${window.location.origin}/r/${meetingId}`;
  }, [meetingId]);

  const status =
    round.status === "draft"
      ? { label: "검토 중", cls: "status" }
      : round.status === "open"
        ? { label: "답변 수집 중", cls: "status status-live" }
        : { label: "마감", cls: "status status-done" };

  return (
    <section className="card p-6 sm:p-7">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-stone-900">
          {round.roundNo}라운드
          <span className="ml-1.5 text-sm font-normal text-stone-400 tabular-nums">
            / {totalRounds}
          </span>
        </h2>
        <span className={status.cls}>{status.label}</span>
      </div>

      {round.status === "draft" && (
        <>
          <p className="mb-5 text-[15px] leading-relaxed text-stone-600">
            AI가 만든 질문입니다. 빼거나 고친 뒤 공개하세요. 여기서 공개해야 참여자가 답할 수
            있습니다.
          </p>

          <label className="label">참여자 안내문</label>
          <textarea
            className="input mb-5 mt-2 min-h-[72px] resize-y"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="참여자가 질문 위에서 먼저 읽을 안내문"
          />

          <QuestionEditor questions={questions} onChange={setQuestions} />

          <div className="mt-5">
            <label className="label" htmlFor={`deadline-${round.id}`}>
              답변 기한 <span className="font-normal text-stone-400">(선택)</span>
            </label>
            <p className="mt-1 text-[13px] leading-5 text-stone-500">
              참여자 화면에 표시됩니다. 지나도 제출은 막지 않고, 마감은 여기서 직접 누릅니다.
            </p>
            <input
              id={`deadline-${round.id}`}
              type="datetime-local"
              className="input mt-2 w-auto"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={busy !== null}
              onClick={() =>
                void onOpen(intro, questions, deadline ? new Date(deadline).toISOString() : null)
              }
            >
              {busy === `open-${round.roundNo}` ? "여는 중…" : "참여자에게 공개하기"}
            </button>
            <button
              className="btn-ghost"
              disabled={busy !== null}
              onClick={() => void onSave(intro, questions)}
            >
              {busy === `save-${round.roundNo}` ? "저장 중…" : "임시 저장"}
            </button>
          </div>
        </>
      )}

      {round.status === "open" && (
        <>
          <ShareBox url={shareUrl} />

          {round.intro && (
            <p className="mt-5 border-l-2 border-stone-300 pl-4 text-[15px] leading-relaxed text-stone-700">
              {round.intro}
            </p>
          )}

          <ol className="mt-5 space-y-2">
            {round.questions.map((question, index) => (
              <li key={question.id} className="text-[15px] leading-relaxed">
                <span className="mr-2 font-display text-stone-400 tabular-nums">Q{index + 1}</span>
                <span className="text-stone-800">{question.text}</span>
                <span className="ml-2 text-xs text-stone-500">{kindLabel(question.kind)}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6">
            <ResponseStatus
              meetingTitle={meetingTitle}
              roundNo={round.roundNo}
              shareUrl={shareUrl}
              expected={expected}
              submitted={round.submissions.map((s) => s.participantName)}
              deadlineAt={round.deadlineAt}
            />
          </div>

          <Distribution round={round} />

          <button
            className="btn-primary mt-5"
            disabled={busy !== null || round.submissionCount === 0}
            onClick={() => void onClose()}
          >
            {busy === `close-${round.roundNo}`
              ? "의견을 정리하는 중… (최대 2분)"
              : round.roundNo < totalRounds
                ? "마감하고 의견 정리 + 재질문 만들기"
                : "마감하고 의견 정리하기"}
          </button>
        </>
      )}

      {round.status === "closed" && (
        <>
          {round.digest ? (
            <DigestView
              digest={round.digest}
              questions={round.questions}
              submissions={round.submissions}
            />
          ) : (
            <p className="text-sm text-stone-500">정리된 내용이 없습니다.</p>
          )}
          <RawAnswers round={round} />
        </>
      )}
    </section>
  );
}

function ShareBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-medium text-emerald-900">참여자에게 이 링크를 보내세요</p>
      <p className="mt-0.5 text-[13px] leading-5 text-emerald-800">
        로그인 없이 바로 답변할 수 있습니다. 다음 라운드에도 같은 링크를 쓰면 됩니다.
      </p>
      <div className="mt-3 flex gap-2">
        <input readOnly className="input bg-white font-mono text-xs" value={url} />
        <button
          className="btn-ghost shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
    </div>
  );
}

/** 수집 중 응답 분포. 마감 전에 분포를 보고 마감 시점을 정할 수 있게 한다. */
function Distribution({ round }: { round: HostRound }) {
  const questions = round.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => question.kind !== "open");
  if (questions.length === 0) return null;
  return (
    <div className="mt-6 border-t border-stone-200 pt-4">
      <p className="text-sm font-medium text-stone-900">응답 분포</p>
      <ul className="mt-3 space-y-5">
        {questions.map(({ question, index }) => (
          <li key={question.id}>
            <p className="mb-2 text-[13px] leading-5 text-stone-700">
              <span className="mr-2 font-display text-stone-400 tabular-nums">Q{index + 1}</span>
              {question.text}
              <span className="ml-2 text-xs text-stone-500">{kindLabel(question.kind)}</span>
            </p>
            <AnswerStats question={question} submissions={round.submissions} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RawAnswers({ round }: { round: HostRound }) {
  if (round.submissions.length === 0) return null;
  return (
    <details className="mt-6 border-t border-stone-200 pt-4">
      <summary className="cursor-pointer text-sm font-medium text-stone-700 hover:text-stone-900">
        원본 답변 {round.submissions.length}건 보기
      </summary>
      <div className="mt-4 space-y-5">
        {round.submissions.map((submission) => (
          <div key={submission.submissionId}>
            <p className="text-sm font-semibold text-stone-900">{submission.participantName}</p>
            <dl className="mt-1.5 space-y-2">
              {round.questions.map((question) => {
                const answer = submission.answers.find((a) => a.questionId === question.id);
                return (
                  <div key={question.id}>
                    <dt className="text-xs text-stone-500">{question.text}</dt>
                    <dd className="whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800">
                      {answer?.value || "(무응답)"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </details>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 text-center text-stone-600">
      {children}
    </main>
  );
}

function toDrafts(questions: Question[]): DraftQuestion[] {
  return questions.map((q) => ({
    text: q.text,
    intent: q.intent,
    kind: q.kind,
    options: q.options,
    required: q.required,
  }));
}
