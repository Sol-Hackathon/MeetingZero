"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { QuestionKind } from "@/lib/types";
import { formatDateTime } from "@/lib/report";

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
    deadlineAt: string | null;
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
    const deciding = data.meeting.status === "deciding";
    return (
      <Shell title={data.meeting.title}>
        <p>
          {deciding
            ? "답변이 모두 모였습니다. 주최자가 결론을 정리하고 있어요."
            : "아직 질문이 열리지 않았습니다. 주최자가 질문을 검토하고 있어요."}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          {deciding ? "정리가 끝나면 주최자가 결과를 공유할 거예요." : "잠시 후 이 링크를 다시 열어주세요."}
        </p>
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
    <main className="mx-auto max-w-2xl px-5 pb-20 pt-10">
      <header>
        <p className="eyebrow tabular-nums">
          {round.roundNo}라운드 <span className="text-stone-300">/</span> 총 {round.totalRounds}라운드
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-stone-900">
          {data.meeting.title}
        </h1>
        {round.deadlineAt && (
          <p className="mt-3 text-[13px] leading-5 text-stone-600 tabular-nums">
            {new Date(round.deadlineAt).getTime() < Date.now() ? (
              <>
                <span className="font-medium text-amber-700">기한이 지났습니다.</span> 주최자가 곧
                마감합니다. 지금 답해도 반영됩니다.
              </>
            ) : (
              <>
                <span className="font-medium text-stone-700">답변 기한</span>
                <span className="mx-1.5 text-stone-300">·</span>
                {formatDateTime(round.deadlineAt)}
              </>
            )}
          </p>
        )}
      </header>

      {data.previous && (
        <section className="card mt-8 p-5 sm:p-6">
          <h2 className="eyebrow">{data.previous.roundNo}라운드에서 이렇게 정리되었습니다</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-800">{data.previous.overview}</p>
          {data.previous.consensus.length > 0 && (
            <div className="mt-4 border-l-[3px] border-emerald-500 pl-3">
              <p className="text-xs font-medium text-stone-500">이미 합의된 것</p>
              <ul className="mt-1 space-y-1 text-[15px] leading-relaxed text-stone-800">
                {data.previous.consensus.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {data.previous.unresolved.length > 0 && (
            <div className="mt-4 border-l-[3px] border-amber-500 pl-3">
              <p className="text-xs font-medium text-stone-500">아직 남은 것. 아래에서 여쭙습니다</p>
              <ul className="mt-1 space-y-1 text-[15px] leading-relaxed text-stone-800">
                {data.previous.unresolved.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {round.intro && (
        <p className="mt-8 whitespace-pre-wrap text-[16px] leading-relaxed text-stone-700">
          {round.intro}
        </p>
      )}

      {submitted ? (
        <section className="card mt-8 p-8 text-center">
          <p className="font-display text-2xl font-semibold text-stone-900">답변이 저장되었습니다</p>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
            다른 분들의 답변이 모이면 주최자가 정리합니다. 다음 라운드 질문이 열리면 같은 링크로
            들어오세요.
          </p>
          <button className="btn-ghost mt-5" onClick={() => setEditing(true)}>
            답변 수정하기
          </button>
        </section>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="card p-5 sm:p-6">
            <label className="label" htmlFor="name">
              이름 또는 닉네임
            </label>
            <input
              id="name"
              className="input mt-2"
              placeholder="예: 김지민 / 개발팀 A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {round.questions.map((question, index) => (
            <fieldset key={question.id} className="card p-5 sm:p-6">
              <legend className="sr-only">질문 {index + 1}</legend>
              <p className="text-[16px] font-medium leading-relaxed text-stone-900">
                <span className="mr-2 font-display text-stone-400 tabular-nums">Q{index + 1}</span>
                {question.text}
                {!question.required && (
                  <span className="ml-1.5 text-xs font-normal text-stone-400">(선택)</span>
                )}
              </p>

              {question.kind === "open" && (
                <textarea
                  className="input mt-4 min-h-[120px] resize-y"
                  placeholder="자유롭게 적어주세요."
                  value={answers[question.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                  }
                />
              )}

              {question.kind === "choice" && (
                <div className="mt-4 space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const on = answers[question.id] === option;
                    return (
                      <label
                        key={optionIndex}
                        className={`flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 text-[15px] transition-colors duration-150 ${
                          on
                            ? "border-stone-900 bg-stone-900 text-stone-50"
                            : "border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-100"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`q-${question.id}`}
                          value={option}
                          checked={on}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [question.id]: option }))
                          }
                        />
                        <span
                          className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                            on ? "border-stone-50 bg-emerald-400" : "border-stone-300"
                          }`}
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              )}

              {question.kind === "scale" && (
                <div className="mt-4">
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => {
                      const on = answers[question.id] === String(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [question.id]: String(value) }))
                          }
                          className={`h-11 rounded-md border text-[15px] font-medium tabular-nums transition-colors duration-150 ${
                            on
                              ? "border-stone-900 bg-stone-900 text-stone-50"
                              : "border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-100"
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-stone-500">
                    <span>1 · 매우 낮음</span>
                    <span>5 · 매우 높음</span>
                  </div>
                </div>
              )}
            </fieldset>
          ))}

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-3 text-[15px]" disabled={submitting}>
            {submitting ? "제출 중…" : "답변 제출"}
          </button>
          <p className="pb-6 text-center text-xs text-stone-500">
            제출 후에도 이 링크에서 수정할 수 있습니다.
          </p>
        </form>
      )}
    </main>
  );
}

function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-5 text-center">
      {title && (
        <h1 className="mb-4 font-display text-2xl font-semibold leading-tight text-stone-900">
          {title}
        </h1>
      )}
      <div className="text-[15px] leading-relaxed text-stone-700">{children}</div>
    </main>
  );
}
