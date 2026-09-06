import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F7F5",
        panel: "#FFFFFF",
        surface: "#F1F0EC",
        border: "rgba(28,28,26,0.08)",
        "border-strong": "rgba(28,28,26,0.16)",
        ink: "#1C1C1A",
        inksoft: "#55554F",
        muted: "#8C8C86",
        accent: "#2F6FE0",
        "accent-light": "#E8F0FD",
        success: "#2F9E5C",
        warning: "#C2790A",
        pendent: "#C97B3C",
        curs: "#3E7C74",
        fet: "#7C9473",
        danger: "#A85751",
        "danger-light": "#FAECE7",
        // Àlies antics, mantinguts mentre es migren la resta de pàgines
        // al nou sistema. S'eliminaran quan totes facin servir border/surface.
        line: "#E3DCC9",
        linesoft: "#ECE6D6",
        sidebar: "#1C2621"
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Work Sans", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
