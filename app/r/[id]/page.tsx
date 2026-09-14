"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { QuestionKind } from "@/lib/types";

interface PublicQuestion {
  id: number;
  text: string;
  kind: QuestionKind;
  options: string[];
  required: boolean;
}

interface PublicState {
  meeting: { title: string; status: string };
  state: "open" | "submitted" | "waiting" | "closed";
  savedName: string | null;
  round: {
    roundNo: number;
    totalRounds: number;
    intro: string;
    questions: PublicQuestion[];
  } | null;
  myAnswers: { questionId: number; value: string }[];
  previous: {
    roundNo: number;
    overview: string;
    consensus: string[];
    unresolved: string[];
  } | null;
}

function participantToken(meetingId: string): string {
  const key = `meetingless.pt.${meetingId}`;
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}

export default function ParticipantPage() {
  const params = useParams<{ id: string }>();
  const meetingId = params.id;

  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<PublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => setToken(participantToken(meetingId)), [meetingId]);

  const load = useCallback(async () => {
    if (!token) return;
    const response = await fetch(`/api/r/${meetingId}?pt=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "불러오지 못했습니다.");
      return;
    }
    setData(payload);
    if (payload.savedName) setName(payload.savedName);
    if (payload.myAnswers?.length) {
      setAnswers(
        Object.fromEntries(
          (payload.myAnswers as { questionId: number; value: string }[]).map((a) => [
            a.questionId,
            a.value,
          ]),
        ),
      );
    }
  }, [meetingId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !data?.round) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/r/${meetingId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participantToken: token,
          name,
          answers: data.round.questions.map((q) => ({
            questionId: q.id,
            value: answers[q.id] ?? "",
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "제출에 실패했습니다.");
      setEditing(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !data) return <Shell>{error}</Shell>;
  if (!data) return <Shell>불러오는 중…</Shell>;

  if (data.state === "waiting") {
    return (
      <Shell title={data.meeting.title}>
        <p>아직 질문이 열리지 않았습니다. 주최자가 질문을 검토하고 있어요.</p>
        <p className="mt-2 text-sm text-stone-500">잠시 후 이 링크를 다시 열어주세요.</p>
      </Shell>
    );
  }

  if (data.state === "closed") {
    return (
      <Shell title={data.meeting.title}>
        <p>이 회의는 마무리되었습니다. 답변해 주셔서 감사합니다.</p>
      </Shell>
    );
  }

  const round = data.round!;
  const submitted = data.state === "submitted" && !editing;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header>
        <p className="text-xs font-medium tracking-wide text-stone-500">
          {round.roundNo}라운드 / 총 {round.totalRounds}라운드
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{data.meeting.title}</h1>
      </header>

      {data.previous && (
        <section className="mt-6 rounded-xl border border-stone-200 bg-stone-100/70 p-5">
          <h2 className="text-sm font-semibold text-stone-900">
            {data.previous.roundNo}라운드에서 이렇게 정리되었습니다
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            {data.previous.overview}
          </p>
          {data.previous.consensus.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-stone-500">이미 합의된 것</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-stone-700">
                {data.previous.consensus.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {data.previous.unresolved.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-stone-500">아직 남은 것 — 아래에서 여쭙습니다</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-stone-700">
                {data.previous.unresolved.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {round.intro && (
        <p className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-700">
          {round.intro}
        </p>
      )}

      {submitted ? (
        <section className="card mt-6 p-6 text-center">
          <p className="text-lg font-semibold">답변이 저장되었습니다</p>
          <p className="mt-1.5 text-sm text-stone-600">
            다른 분들의 답변이 모이면 주최자가 정리합니다. 다음 라운드 질문이 열리면 같은 링크로
            들어오세요.
          </p>
          <button className="btn-ghost mt-4" onClick={() => setEditing(true)}>
            답변 수정하기
          </button>
        </section>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="card p-5">
            <label className="label" htmlFor="name">
              이름 또는 닉네임
            </label>
            <input
              id="name"
              className="input mt-1.5"
              placeholder="예: 김지민 / 개발팀 A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {round.questions.map((question, index) => (
            <div key={question.id} className="card p-5">
              <p className="text-[15px] font-medium leading-relaxed text-stone-900">
                <span className="mr-1.5 text-stone-400">Q{index + 1}</span>
                {question.text}
                {!question.required && (
                  <span className="ml-1.5 text-xs font-normal text-stone-400">(선택)</span>
                )}
              </p>

              {question.kind === "open" && (
                <textarea
                  className="input mt-3 min-h-[110px] resize-y leading-relaxed"
                  placeholder="자유롭게 적어주세요."
                  value={answers[question.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                  }
                />
              )}

              {question.kind === "choice" && (
                <div className="mt-3 space-y-1.5">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={optionIndex}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition ${
                        answers[question.id] === option
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`q-${question.id}`}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [question.id]: option }))
                        }
                      />
                      {option}
                    </label>
                  ))}
                </div>
              )}

              {question.kind === "scale" && (
                <div className="mt-3">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [question.id]: String(value) }))
                        }
                        className={`h-11 flex-1 rounded-lg border text-sm font-medium transition ${
                          answers[question.id] === String(value)
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-300 hover:bg-stone-50"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-stone-400">
                    <span>1 · 매우 낮음</span>
                    <span>5 · 매우 높음</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
            {submitting ? "제출 중…" : "답변 제출"}
          </button>
          <p className="pb-6 text-center text-xs text-stone-400">
            제출 후에도 이 링크에서 수정할 수 있습니다.
          </p>
        </form>
      )}
    </main>
  );
}

function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 text-center">
      {title && <h1 className="mb-3 text-xl font-bold">{title}</h1>}
      <div className="text-stone-700">{children}</div>
    </main>
  );
}
