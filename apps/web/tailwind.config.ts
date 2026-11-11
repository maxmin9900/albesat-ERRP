import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
        },
        navy: {
          DEFAULT: "var(--navy)",
          soft: "var(--navy-soft)",
        },
        muted: "var(--muted)",
        border: "var(--border)",
        surface: "var(--surface)",
        "surface-alt": "var(--surface-alt)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
    },
  },
  plugins: [],
};

export default config;
