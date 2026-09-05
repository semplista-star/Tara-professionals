import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F6F3EC",
        panel: "#FFFFFF",
        ink: "#1C2621",
        inksoft: "#445048",
        muted: "#7A7264",
        line: "#E3DCC9",
        linesoft: "#ECE6D6",
        sidebar: "#1C2621",
        pendent: "#C97B3C",
        curs: "#3E7C74",
        fet: "#7C9473",
        danger: "#A85751"
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
