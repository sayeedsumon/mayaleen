import type { Config } from "tailwindcss";

/** Mayaleen look: lake teal on warm sand, Fraunces headings, Inter text. */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#F5F3EE",
        panel: "#FBFAF7",
        line: "#E2DDD2",
        hair: "#ECE8DF",
        field: "#D9D3C7",
        sand: { DEFAULT: "#F7F5F0", 2: "#F2EFE8", 3: "#ECE8DF" },
        ink: { DEFAULT: "#17211F", 2: "#3E4A47", muted: "#5B6663" },
        lake: { DEFAULT: "#0E5C56", dark: "#0A4440", deep: "#0A2E2B", soft: "#E2EEEB", faint: "#F2F8F6", muted: "#8FA9A5" },
        amber: { DEFAULT: "#B8740F", soft: "#FBEFD9", ink: "#7A4A06", line: "#E7C98F" },
        sky: { DEFAULT: "#2F5F9A", soft: "#E3ECF7", ink: "#1F4A7A" },
        leaf: { soft: "#E2F1E6", ink: "#1E5B33" },
        rose: { soft: "#F6E3E0", ink: "#8A2A1E" },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        bn: ["\"Hind Siliguri\"", "Inter", "system-ui", "sans-serif"],
        bnDisplay: ["\"Noto Serif Bengali\"", "\"Hind Siliguri\"", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
