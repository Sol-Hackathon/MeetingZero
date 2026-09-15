import type { Config } from "tailwindcss";

/*
 * 디자인 토큰. 근거와 규칙은 DESIGN.md 에 있다.
 * - stone: 따뜻한 종이 톤의 무채색. 화면 배경(50)부터 잉크(900)까지.
 * - emerald: 강조색이자 "정해진 것 / 합의"의 의미색. 진녹색 하나로 통일.
 * - amber: "갈린 것 / 모여서 정할 것". red: 오류와 "실제 회의 권장".
 * 기존 코드의 stone-* / emerald-* / amber-* / red-* 클래스가 그대로 새 팔레트를 쓴다.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Pretendard",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "sans-serif",
        ],
        display: ["var(--font-display)", "Apple SD Gothic Neo", "Georgia", "serif"],
      },
      colors: {
        stone: {
          50: "#F8F5EF",
          100: "#F0EBE2",
          200: "#E4DDD1",
          300: "#CFC6B7",
          400: "#A79E90",
          500: "#7F766A",
          600: "#615A50",
          700: "#4A443C",
          800: "#332E29",
          900: "#1C1916",
          950: "#110F0D",
        },
        emerald: {
          50: "#EEF5F0",
          100: "#E1EEE6",
          200: "#C3DDCE",
          300: "#9AC4AC",
          400: "#5E9C7A",
          500: "#1F6F4A",
          600: "#1A5F3F",
          700: "#154D34",
          800: "#123F2B",
          900: "#0E3223",
        },
        amber: {
          50: "#FBF5EA",
          100: "#F8EDD5",
          200: "#EFDCAF",
          300: "#E4C57E",
          400: "#D2A24A",
          500: "#B4811F",
          600: "#96691A",
          700: "#7A5516",
          800: "#5F4211",
          900: "#4B340E",
        },
        red: {
          50: "#FBEFED",
          100: "#F8E1DD",
          200: "#EFC3BC",
          300: "#E39A8F",
          400: "#CE6656",
          500: "#B4372B",
          600: "#9E2F25",
          700: "#86281F",
          800: "#6B2019",
          900: "#541A14",
        },
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "10px",
        xl: "14px",
      },
      maxWidth: {
        reading: "42rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
