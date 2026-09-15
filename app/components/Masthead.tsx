import Link from "next/link";

/** 모든 화면 맨 위의 얇은 제호. 인쇄에는 안 나온다. */
export default function Masthead() {
  return (
    <div className="border-b border-stone-200 print:hidden">
      <div className="mx-auto flex max-w-3xl items-baseline justify-between px-5 py-3.5">
        <Link
          href="/"
          className="font-display text-[17px] font-semibold tracking-tight text-stone-900 hover:text-emerald-700"
        >
          회의없는회의
        </Link>
        <span className="hidden text-xs text-stone-500 sm:inline">모이지 않고, 결론까지</span>
      </div>
    </div>
  );
}
