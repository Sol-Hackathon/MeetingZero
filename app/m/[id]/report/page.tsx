"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DigestView from "@/app/components/DigestView";
import ReportActions from "@/app/components/ReportActions";
import { DecisionSummary } from "@/app/components/DecisionEditor";
import {
  formatDateTime,
  lastDigest,
  questionLabel,
  reportSummary,
  type ReportData,
  type ReportRound,
} from "@/lib/report";
import type { Decision } from "@/lib/types";

interface HostResponse {
  meeting: ReportData["meeting"] & { decision: Decision | null };
  rounds: ReportRound[];
}

/** 인쇄용 리포트. 주최자 API 의 데이터를 그대로 문서 형태로 보여준다. */
export default function ReportPage() {
  return (
    <Suspense fallback={<Centered>불러오는 중…</Centered>}>
      <ReportView />
    </Suspense>
  );
}

function ReportView() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const meetingId = params.id;
  const hostToken = search.get("t") ?? "";

  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch(
        `/api/meetings/${meetingId}?t=${encodeURIComponent(hostToken)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error ?? "회의를 불러오지 못했습니다.");
        return;
      }
      const body = payload as HostResponse;
      setData({ meeting: body.meeting, rounds: body.rounds, decision: body.meeting.decision });
    })().catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => {
      cancelled = true;
    };
  }, [meetingId, hostToken]);

  if (error) return <Centered>{error}</Centered>;
  if (!data) return <Centered>불러오는 중…</Centered>;

  const { meeting, rounds, decision } = data;
  const summary = reportSummary(data);
  const digest = lastDigest(rounds);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-8 flex flex-wrap items-center gap-2 print:hidden">
        <a href={`/m/${meetingId}?t=${encodeURIComponent(hostToken)}`} className="btn-ghost">
          ← 주최자 화면
        </a>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          인쇄 · PDF 저장
        </button>
        <ReportActions meetingId={meetingId} hostToken={hostToken} hideViewLink />
        <span className="text-xs text-stone-400">원본 답변은 펼쳐 둔 라운드만 인쇄됩니다.</span>
      </div>

      <article className="space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{meeting.title}</h1>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-stone-600">
            <dt className="text-stone-400">목표</dt>
            <dd>{meeting.goal || "(명시되지 않음)"}</dd>
            <dt className="text-stone-400">진행</dt>
            <dd>
              {summary.period} · {summary.closedRoundCount}라운드 · 참여자{" "}
              {summary.participantCount}명
            </dd>
            <dt className="text-stone-400">상태</dt>
            <dd>{summary.outcome}</dd>
          </dl>
        </header>

        <Section title="배경">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800">
            {meeting.background}
          </p>
        </Section>

        <Section title="결론">
          {decision ? (
            <DecisionSummary decision={decision} />
          ) : (
            <p className="text-sm text-stone-600">
              {digest
                ? `아직 확정되지 않았습니다. 마지막 라운드의 AI 판단은 "${digest.decisionReady ? "결론 가능" : "쟁점 남음"}", "${digest.meetingNeeded.needed ? "실제 회의 권장" : "회의 불필요"}" 입니다.`
                : "아직 마감된 라운드가 없습니다."}
            </p>
          )}
        </Section>

        {rounds.map((round) => (
          <RoundBlock key={round.id} round={round} />
        ))}
      </article>
    </main>
  );
}

function RoundBlock({ round }: { round: ReportRound }) {
  const subtitle =
    round.status === "closed"
      ? `${formatDateTime(round.closedAt)} 마감 · 답변 ${round.submissions.length}명`
      : round.status === "open"
        ? `답변 수집 중 · ${round.submissions.length}명 답변`
        : "주최자 검토 중";

  return (
    <Section title={`${round.roundNo}라운드`} subtitle={subtitle}>
      {round.intro && (
        <p className="mb-4 rounded-lg bg-stone-100 p-3 text-sm leading-relaxed text-stone-700">
          {round.intro}
        </p>
      )}

      <ol className="mb-5 space-y-1.5">
        {round.questions.map((question, index) => (
          <li key={question.id} className="text-sm">
            <span className="mr-1.5 text-stone-400">Q{index + 1}</span>
            <span className="text-stone-800">{question.text}</span>
            <span className="ml-2 text-xs text-stone-400">
              {questionLabel(question.kind)}
              {question.kind === "choice" && question.options.length > 0
                ? ` · ${question.options.join(" / ")}`
                : ""}
            </span>
          </li>
        ))}
      </ol>

      {round.digest && <DigestView digest={round.digest} questions={round.questions} />}

      {round.submissions.length > 0 && (
        <details className="mt-5 rounded-lg border border-stone-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-stone-700">
            원본 답변 {round.submissions.length}건
          </summary>
          <div className="space-y-5 border-t border-stone-200 px-4 py-4">
            {round.submissions.map((submission) => (
              <div key={`${submission.participantName}-${submission.submittedAt}`}>
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
      )}
    </Section>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-3 border-b border-stone-200 pb-1.5 text-lg font-semibold">
        {title}
        {subtitle && <span className="ml-2 text-sm font-normal text-stone-400">{subtitle}</span>}
      </h2>
      {children}
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 text-center text-stone-600">
      {children}
    </main>
  );
}
