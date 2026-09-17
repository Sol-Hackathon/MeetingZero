"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SavedMeeting {
  id: string;
  title: string;
  hostToken: string;
  createdAt: string;
}

const STORAGE_KEY = "meetingless.hosted";

function loadHosted(): SavedMeeting[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedMeeting[];
  } catch {
    return [];
  }
}

const EXAMPLE = {
  title: "신규 온보딩 플로우 개편 방향 결정",
  background:
    "가입 후 첫 주 이탈률이 42%로 지난 분기 대비 8%p 올랐습니다. 원인으로 (1) 초기 설정 단계가 6단계로 길다 (2) 핵심 기능 가치를 첫 세션에 못 느낀다 (3) 결제 유도가 너무 이르다 는 가설이 나와 있습니다. 개발 2명, 디자이너 1명을 3주간 투입할 수 있고, 이번 분기 안에 배포해야 합니다.",
  goal: "세 가설 중 무엇을 먼저 검증할지, 3주 안에 무엇을 만들지 정하기",
};

const STEPS = [
  ["질문", "주제와 배경을 적으면 AI가 물어볼 것을 만듭니다. 주최자가 고쳐서 공개합니다."],
  ["답변", "참여자는 링크 하나로, 로그인 없이, 각자 편한 시간에 답합니다."],
  ["결론", "합의된 것과 갈린 것을 정리하고, 남은 쟁점만 다시 묻습니다. 모여서 정할 것만 남깁니다."],
] as const;

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [background, setBackground] = useState("");
  const [goal, setGoal] = useState("");
  const [maxRounds, setMaxRounds] = useState(2);
  const [expected, setExpected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hosted, setHosted] = useState<SavedMeeting[]>([]);

  useEffect(() => setHosted(loadHosted()), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, background, goal, maxRounds, expectedParticipants: expected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "질문 생성에 실패했습니다.");

      const entry: SavedMeeting = {
        id: data.meetingId,
        title,
        hostToken: data.hostToken,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...loadHosted()].slice(0, 20)));
      router.push(`/m/${data.meetingId}?t=${encodeURIComponent(data.hostToken)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-12 sm:pt-16">
      <header className="max-w-2xl">
        <p className="eyebrow">링크 하나로 끝내는 회의</p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.15] text-stone-900 sm:text-5xl">
          모이지 않고,
          <br />
          결론까지 갑니다.
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-stone-600">
          주제와 배경만 적으면 AI가 물어볼 것을 정리합니다. 참여자는 링크를 받아 답만 하면 되고,
          모인 답변에서 아직 결론이 안 난 것만 다시 묻습니다.
        </p>
      </header>

      <ol className="mt-10 grid gap-6 border-y border-stone-200 py-6 sm:grid-cols-3 sm:gap-8">
        {STEPS.map(([name, description], index) => (
          <li key={name} className="flex gap-3 sm:block">
            <span className="font-display text-2xl font-semibold leading-none text-stone-300 tabular-nums">
              {index + 1}
            </span>
            <div className="sm:mt-3">
              <p className="text-sm font-semibold text-stone-900">{name}</p>
              <p className="mt-1 text-[13px] leading-5 text-stone-600">{description}</p>
            </div>
          </li>
        ))}
      </ol>

      <form onSubmit={submit} className="card mt-10 space-y-7 p-6 sm:p-8">
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="title">
              회의 주제
            </label>
            <button
              type="button"
              className="text-xs text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-stone-900"
              onClick={() => {
                setTitle(EXAMPLE.title);
                setBackground(EXAMPLE.background);
                setGoal(EXAMPLE.goal);
              }}
            >
              예시로 채우기
            </button>
          </div>
          <input
            id="title"
            className="input mt-2"
            placeholder="예: 신규 온보딩 플로우 개편 방향 결정"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="background">
            배경
          </label>
          <p className="mt-1 text-[13px] leading-5 text-stone-500">
            지금까지 있었던 일, 제약(일정·인원·예산), 이미 나온 안이 있다면 함께 적어주세요.
            여기 적힌 내용은 질문으로 다시 묻지 않습니다.
          </p>
          <textarea
            id="background"
            className="input mt-2 min-h-[176px] resize-y"
            placeholder="현재 상황과 제약 조건을 적어주세요."
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="goal">
            이 회의로 얻고 싶은 결론 <span className="font-normal text-stone-400">(선택)</span>
          </label>
          <input
            id="goal"
            className="input mt-2"
            placeholder="예: 3주 안에 무엇을 만들지 하나로 정하기"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="expected">
            예상 참여자 <span className="font-normal text-stone-400">(선택)</span>
          </label>
          <p className="mt-1 text-[13px] leading-5 text-stone-500">
            한 줄에 한 명씩 적으면 누가 아직 답하지 않았는지 보여주고, 리마인드 문구에 이름을 넣어
            드립니다.
          </p>
          <textarea
            id="expected"
            className="input mt-2 min-h-[88px] resize-y"
            placeholder={"김지민\n박서준 (개발팀)\n이수아"}
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
          />
        </div>

        <div>
          <span className="label">라운드 수</span>
          <p className="mt-1 text-[13px] leading-5 text-stone-500">
            한 라운드는 질문 배포, 답변 수집, 정리까지입니다. 다음 라운드에서는 남은 쟁점만 다시
            묻습니다.
          </p>
          <div className="mt-2 inline-flex rounded-md border border-stone-300 bg-white p-0.5">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxRounds(n)}
                className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  maxRounds === n
                    ? "bg-stone-900 text-stone-50"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                {n}라운드
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full py-3 text-[15px]" disabled={loading}>
          {loading ? "질문을 만드는 중… (최대 1분)" : "질문 만들기"}
        </button>
      </form>

      {hosted.length > 0 && (
        <section className="mt-14">
          <h2 className="eyebrow">이 브라우저에서 만든 회의</h2>
          <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
            {hosted.map((meeting) => (
              <li key={meeting.id}>
                <a
                  className="flex items-baseline justify-between gap-4 py-3 hover:text-emerald-700"
                  href={`/m/${meeting.id}?t=${encodeURIComponent(meeting.hostToken)}`}
                >
                  <span className="truncate text-[15px] font-medium">{meeting.title}</span>
                  <span className="shrink-0 text-xs text-stone-500 tabular-nums">
                    {new Date(meeting.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
