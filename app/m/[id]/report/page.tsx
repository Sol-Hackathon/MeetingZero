"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AnswerStats from "@/app/components/AnswerStats";
import DecisionDoc from "@/app/components/DecisionDoc";
import ReportActions from "@/app/components/ReportActions";
import {
  aiOpinion,
  attendeesFact,
  evidenceBeyondDecision,
  firstSentence,
  lastClosedRound,
  namesLabel,
  oneLineSummary,
  questionLabel,
  reportSummary,
  roundMetaLine,
  type Evidence,
  type ReportData,
  type ReportRound,
} from "@/lib/report";
import type { Decision, RoundDigest } from "@/lib/types";

interface HostResponse {
  meeting: ReportData["meeting"] & { decision: Decision | null };
  rounds: ReportRound[];
}

/*
 * 인쇄용 리포트. 대시보드가 아니라 문서라서 칩 · 카드 · 색 막대를 쓰지 않는다.
 * 부록의 분포 막대만 예외이고, 그것도 무채색만 쓴다.
 * 순서는 lib/report.ts 의 마크다운과 같다: 결론 → 근거 → 진행 경과 → 배경 → 부록.
 *
 * 글자 크기 단계: 제목 2xl/3xl · 섹션 xl · 소제목 base · 본문 15px · 보조 13px · 메타 xs
 */

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

  usePrintExpandsDetails();

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
  const last = lastClosedRound(rounds);
  const evidence = last?.digest ? evidenceBeyondDecision(last.digest, decision) : null;
  const attendees = attendeesFact(decision, summary.participants);
  const answered = rounds.filter((round) => round.submissions.length > 0);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 print:max-w-none print:px-0 print:py-0">
      <article>
        <header>
          <h1 className="text-balance font-display text-3xl font-semibold leading-tight text-stone-900 sm:text-4xl">
            {meeting.title}
          </h1>
          {meeting.goal && (
            <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
              <span className="mr-2 text-[13px] font-medium text-stone-500">목표</span>
              {meeting.goal}
            </p>
          )}
          <p className="mt-3 text-[13px] leading-5 text-stone-600 tabular-nums">{summary.metaLine}</p>
          <p className="text-[13px] leading-5 text-stone-600">
            참여자 <span className="tabular-nums">{summary.participants.length}</span>명
            {summary.participants.length > 0 && (
              <>
                <span className="mx-1.5 text-stone-300">·</span>
                {summary.participants.join(", ")}
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 print:hidden">
            <a href={`/m/${meetingId}?t=${encodeURIComponent(hostToken)}`} className="btn-ghost">
              ← 주최자 화면
            </a>
            <button type="button" className="btn-ghost" onClick={() => window.print()}>
              인쇄 · PDF 저장
            </button>
            <ReportActions meetingId={meetingId} hostToken={hostToken} hideViewLink />
          </div>
        </header>

        {/* 결론: 문서에서 가장 눈에 띄어야 한다 */}
        <SectionTitle primary>결론</SectionTitle>
        <p className="font-display text-xl font-medium leading-snug text-stone-900">
          {oneLineSummary(data)}
        </p>
        {attendees && (
          <p className="mt-2 text-[13px] leading-5 text-stone-600">
            참석 필요
            <span className="mx-1.5 text-stone-300">·</span>
            <span className="font-medium text-stone-900">{attendees}</span>
          </p>
        )}
        {decision ? (
          <div className="mt-6">
            <DecisionDoc
              decision={decision}
              all={summary.participants}
              positionsByTopic={evidence?.positionsByTopic}
            />
          </div>
        ) : (
          <p className="mt-4 text-[15px] leading-relaxed text-stone-600">
            아직 확정되지 않았습니다. 주최자 화면에서 결론을 확정하면 여기에 표시됩니다.
          </p>
        )}

        {last?.digest && evidence && (
          <>
            <SectionTitle>
              근거
              <SectionNote>AI 정리 · {last.roundNo}라운드 기준</SectionNote>
            </SectionTitle>
            <EvidenceDoc
              digest={last.digest}
              evidence={evidence}
              all={summary.participants}
              showConsensus={decision === null}
            />
          </>
        )}

        {rounds.length > 0 && (
          <>
            <SectionTitle>진행 경과</SectionTitle>
            <ProgressList rounds={rounds} />
          </>
        )}

        <SectionTitle>배경</SectionTitle>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800">
          {meeting.background}
        </p>

        {answered.length > 0 && (
          <div className="print:break-before-page">
            <SectionTitle>
              부록
              <SectionNote>라운드별 질문과 답변</SectionNote>
            </SectionTitle>
            {answered.map((round) => (
              <AppendixRound key={round.id} round={round} />
            ))}
          </div>
        )}
      </article>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* 섹션                                                                 */
/* ------------------------------------------------------------------ */

function EvidenceDoc({
  digest,
  evidence,
  all,
  showConsensus,
}: {
  digest: RoundDigest;
  evidence: Evidence;
  all: string[];
  showConsensus: boolean;
}) {
  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-stone-800">{digest.overview}</p>

      {showConsensus && digest.proposal && (
        <div>
          <Subheading>AI 결론 후보</Subheading>
          <p className="text-[15px] leading-relaxed text-stone-800">{digest.proposal}</p>
        </div>
      )}

      {showConsensus && digest.consensus.length > 0 && (
        <div>
          <Subheading>의견이 모인 지점</Subheading>
          <ul className="space-y-2">
            {digest.consensus.map((item, index) => (
              <li key={index} className="break-inside-avoid">
                <p className="text-[15px] leading-relaxed text-stone-800">{item.point}</p>
                {item.basis && <Sub>근거: {item.basis}</Sub>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evidence.conflicts.length > 0 && (
        <div>
          <Subheading>의견이 갈린 지점</Subheading>
          <ul className="space-y-4">
            {evidence.conflicts.map((conflict, index) => (
              <li key={index} className="break-inside-avoid">
                <p className="text-[15px] font-medium leading-relaxed text-stone-900">
                  {conflict.topic}
                </p>
                <ul className="mt-1.5 space-y-1 text-[15px] leading-relaxed">
                  {conflict.positions.map((position, positionIndex) => (
                    <li key={positionIndex} className="text-stone-700">
                      <span className="font-medium text-stone-900">
                        {namesLabel(position.who, all) || "익명"}
                      </span>
                      <span className="mx-1.5 text-stone-400">·</span>
                      {position.stance}
                    </li>
                  ))}
                </ul>
                {conflict.crux && <Sub>쟁점: {conflict.crux}</Sub>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evidence.unresolved.length > 0 && (
        <div>
          <Subheading>정보가 부족한 지점</Subheading>
          <ul className="space-y-2">
            {evidence.unresolved.map((item, index) => (
              <li key={index} className="break-inside-avoid">
                <p className="text-[15px] leading-relaxed text-stone-800">{item.topic}</p>
                {item.whyOpen && <Sub>{item.whyOpen}</Sub>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[13px] leading-5 text-stone-600">
        <span className="font-semibold text-stone-700">당시 AI 의견</span> · {aiOpinion(digest)}
      </p>
    </div>
  );
}

/** 라운드마다 두 줄: 번호와 메타 한 줄, 첫 문장 한 줄. 표 대신 목록이라 폰에서도 가로 스크롤이 없다. */
function ProgressList({ rounds }: { rounds: ReportRound[] }) {
  return (
    <ol className="divide-y divide-stone-200 border-y border-stone-200">
      {rounds.map((round) => (
        <li key={round.id} className="break-inside-avoid py-3">
          <p>
            <span className="font-display text-base font-semibold text-stone-900 tabular-nums">
              {round.roundNo}라운드
            </span>
            <span className="ml-2 text-[13px] leading-5 text-stone-600 tabular-nums">
              {roundMetaLine(round)}
            </span>
          </p>
          {round.digest && (
            <p className="mt-1 text-[15px] leading-relaxed text-stone-800">
              {firstSentence(round.digest.overview)}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/** 부록의 라운드 하나. 질문 기준으로 묶어 질문 전문이 참여자 수만큼 반복되지 않게 한다. */
function AppendixRound({ round }: { round: ReportRound }) {
  return (
    <details className="mt-4 border-t border-stone-200 pt-3">
      <summary className="cursor-pointer text-base font-semibold text-stone-900">
        {round.roundNo}라운드
        <span className="ml-2 text-[13px] font-normal text-stone-500">
          질문 {round.questions.length}개 · 답변 {round.submissions.length}명
        </span>
      </summary>

      <div className="mt-4 space-y-7">
        {round.intro && (
          <p className="border-l-2 border-stone-300 pl-3 text-[13px] leading-5 text-stone-600">
            {round.intro}
          </p>
        )}

        {round.questions.map((question, index) => {
          const perQuestion = round.digest?.perQuestion.find((p) => p.questionId === question.id);
          return (
            <div key={question.id} className="break-inside-avoid">
              <p className="text-[15px] font-medium leading-relaxed text-stone-900">
                <Num>Q{index + 1}.</Num>
                {question.text}
              </p>
              <p className="text-[13px] leading-5 text-stone-500">
                {questionLabel(question.kind)}
                {question.kind === "choice" && question.options.length > 0
                  ? ` · ${question.options.join(" / ")}`
                  : ""}
              </p>
              {perQuestion?.summary && (
                <p className="mt-2 text-[13px] leading-5 text-stone-600">
                  <span className="font-semibold text-stone-700">AI 요약</span> ·{" "}
                  {perQuestion.summary}
                </p>
              )}
              {question.kind === "open" ? (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[15px] leading-relaxed">
                  {round.submissions.map((submission) => {
                    const answer = submission.answers.find((a) => a.questionId === question.id);
                    return (
                      <Fragment key={`${submission.participantName}-${submission.submittedAt}`}>
                        <dt className="font-medium text-stone-900">{submission.participantName}</dt>
                        <dd className="whitespace-pre-wrap text-stone-700">
                          {answer?.value?.trim() || "(무응답)"}
                        </dd>
                      </Fragment>
                    );
                  })}
                </dl>
              ) : (
                <div className="mt-3">
                  <AnswerStats question={question} submissions={round.submissions} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* 타이포그래피 조각                                                      */
/* ------------------------------------------------------------------ */

function SectionTitle({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <h2
      className={`mb-4 break-after-avoid font-display text-2xl font-semibold text-stone-900 ${
        primary ? "mt-8 border-t-2 border-stone-900 pt-4" : "mt-12 border-b border-stone-300 pb-2"
      }`}
    >
      {children}
    </h2>
  );
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return <span className="ml-2 text-sm font-normal text-stone-500">{children}</span>;
}

function Subheading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 break-after-avoid text-base font-semibold text-stone-900">{children}</h3>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[13px] leading-5 text-stone-600">{children}</p>;
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="mr-2 text-stone-400 tabular-nums">{children}</span>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 text-center text-stone-600">
      {children}
    </main>
  );
}

/** 인쇄할 때는 접힌 부록을 전부 펼치고, 끝나면 되돌린다. 접힌 details 는 인쇄되지 않기 때문. */
function usePrintExpandsDetails() {
  useEffect(() => {
    const opened: HTMLDetailsElement[] = [];
    const before = () => {
      document.querySelectorAll<HTMLDetailsElement>("details:not([open])").forEach((el) => {
        el.open = true;
        opened.push(el);
      });
    };
    const after = () => {
      opened.splice(0).forEach((el) => {
        el.open = false;
      });
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
}
