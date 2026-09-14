"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import QuestionEditor, { kindLabel } from "@/app/components/QuestionEditor";
import DigestView from "@/app/components/DigestView";
import type { DraftQuestion, Question, Round } from "@/lib/types";

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
    createdAt: string;
  };
  rounds: HostRound[];
}

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

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <a href="/" className="text-sm text-stone-500 hover:text-stone-900">
        ← 회의없는회의
      </a>

      <header className="mt-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{meeting.title}</h1>
          <span className="chip mt-1 shrink-0 bg-stone-200 text-stone-700">
            {meeting.status === "closed"
              ? "종료"
              : meeting.status === "collecting"
                ? "진행 중"
                : "준비 중"}
          </span>
        </div>
        {meeting.goal && (
          <p className="mt-1.5 text-sm text-stone-600">목표 · {meeting.goal}</p>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-stone-500">배경 보기</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-stone-100 p-3 text-sm leading-relaxed text-stone-700">
            {meeting.background}
          </p>
        </details>
      </header>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <div className="mt-8 space-y-6">
        {rounds.map((round) => (
          <RoundCard
            key={round.id}
            round={round}
            totalRounds={meeting.maxRounds}
            meetingId={meetingId}
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
            onOpen={(intro, questions) =>
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
                  { method: "POST", body: JSON.stringify({ roundNo: round.roundNo }) },
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
                      : `회의를 마쳤습니다. ${data.finishedReason ?? ""}`,
                  );
                }
                return data;
              })
            }
          />
        ))}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function RoundCard({
  round,
  totalRounds,
  meetingId,
  busy,
  onSave,
  onOpen,
  onClose,
}: {
  round: HostRound;
  totalRounds: number;
  meetingId: string;
  busy: string | null;
  onSave: (intro: string, questions: DraftQuestion[]) => Promise<unknown>;
  onOpen: (intro: string, questions: DraftQuestion[]) => Promise<unknown>;
  onClose: () => Promise<unknown>;
}) {
  const [intro, setIntro] = useState(round.intro);
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

  const statusChip =
    round.status === "draft"
      ? { text: "검토 중", cls: "bg-stone-200 text-stone-700" }
      : round.status === "open"
        ? { text: "답변 수집 중", cls: "bg-blue-100 text-blue-800" }
        : { text: "마감", cls: "bg-stone-800 text-white" };

  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {round.roundNo}라운드
          <span className="ml-1.5 text-sm font-normal text-stone-400">/ {totalRounds}</span>
        </h2>
        <span className={`chip ${statusChip.cls}`}>{statusChip.text}</span>
      </div>

      {round.status === "draft" && (
        <>
          <p className="mb-4 text-sm text-stone-600">
            AI가 만든 질문입니다. 빼거나 고친 뒤 공개하세요. 여기서 공개해야 참여자가 답할 수
            있습니다.
          </p>

          <label className="label">참여자 안내문</label>
          <textarea
            className="input mb-4 mt-1.5 min-h-[72px] resize-y text-sm leading-relaxed"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="참여자가 질문 위에서 먼저 읽을 안내문"
          />

          <QuestionEditor questions={questions} onChange={setQuestions} />

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={busy !== null}
              onClick={() => void onOpen(intro, questions)}
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
            <p className="mt-4 rounded-lg bg-stone-100 p-3 text-sm leading-relaxed text-stone-700">
              {round.intro}
            </p>
          )}

          <ol className="mt-4 space-y-2">
            {round.questions.map((question, index) => (
              <li key={question.id} className="text-sm">
                <span className="mr-1.5 text-stone-400">Q{index + 1}</span>
                <span className="text-stone-800">{question.text}</span>
                <span className="ml-2 text-xs text-stone-400">{kindLabel(question.kind)}</span>
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-lg border border-stone-200 p-4">
            <p className="text-sm font-medium">
              답변 {round.submissionCount}명
              {round.submissionCount === 0 && (
                <span className="ml-2 font-normal text-stone-500">아직 응답이 없습니다</span>
              )}
            </p>
            {round.submissions.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {round.submissions.map((submission) => (
                  <li
                    key={submission.submissionId}
                    className="chip bg-stone-100 text-stone-700"
                    title={new Date(submission.submittedAt).toLocaleString("ko-KR")}
                  >
                    {submission.participantName}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            className="btn-primary mt-4"
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
            <DigestView digest={round.digest} questions={round.questions} />
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
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="text-sm font-medium text-blue-900">참여자에게 이 링크를 보내세요</p>
      <p className="mt-0.5 text-xs text-blue-700">
        로그인 없이 바로 답변할 수 있습니다. 다음 라운드에도 같은 링크를 쓰면 됩니다.
      </p>
      <div className="mt-2.5 flex gap-2">
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

function RawAnswers({ round }: { round: HostRound }) {
  if (round.submissions.length === 0) return null;
  return (
    <details className="mt-5 rounded-lg border border-stone-200">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-stone-700">
        원본 답변 {round.submissions.length}건 보기
      </summary>
      <div className="space-y-5 border-t border-stone-200 px-4 py-4">
        {round.submissions.map((submission) => (
          <div key={submission.submissionId}>
            <p className="text-sm font-semibold text-stone-900">{submission.participantName}</p>
            <dl className="mt-1.5 space-y-2">
              {round.questions.map((question) => {
                const answer = submission.answers.find((a) => a.questionId === question.id);
                return (
                  <div key={question.id}>
                    <dt className="text-xs text-stone-500">{question.text}</dt>
                    <dd className="whitespace-pre-wrap text-sm text-stone-800">
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
    <main className="flex min-h-screen items-center justify-center px-5 text-center text-stone-600">
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
