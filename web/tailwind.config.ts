import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: "#0a1625",
        panel: "#f7fbff",
        saffron: "#ff9933",
        green: "#138808",
        police: "#0057b8",
        fsl: "#b54708",
        court: "#7e22ce"
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      boxShadow: {
        gov: "0 10px 35px rgba(9, 32, 58, 0.16)"
      },
      backgroundImage: {
        "gov-grid":
          "radial-gradient(circle at 1px 1px, rgba(18,35,52,0.10) 1px, transparent 0)"
      }
    }
  },
  plugins: []
};

export default config;
