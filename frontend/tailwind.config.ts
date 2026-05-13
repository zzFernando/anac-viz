import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        anac: {
          blue:  "#003F7F",
          light: "#0066CC",
          dark:  "#001F50",
        },
        gold:    "#C89600",
        surface: "#EEF2F7",
      },
      fontFamily: {
        sans: ["Inter", "var(--font-inter)", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.07)",
        lift: "0 4px 16px rgba(0,0,0,0.10)",
      },
      borderRadius: {
        card: "0.6rem",
      },
    },
  },
  plugins: [],
};

export default config;
