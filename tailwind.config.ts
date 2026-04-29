import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-inter)", "monospace"],
      },
      colors: {
        background: "#F4F7FB",
        surface: "#FFFFFF",
        border: "#E2E8F4",
        foreground: "#1E293B",
        muted: "#8B95A5",
        primary: {
          DEFAULT: "#4E60A9",
          hover: "#3d4e8a",
        },
        success: {
          DEFAULT: "#34A853",
          hover: "#22c55e",
        },
        warning: {
          DEFAULT: "#F59E0B",
          hover: "#fbbf24",
        },
        danger: {
          DEFAULT: "#EF4444",
          hover: "#f87171",
        }
      },
    },
  },
  plugins: [],
};
export default config;
