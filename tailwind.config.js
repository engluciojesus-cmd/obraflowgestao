/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(220 18% 10%)",
        foreground: "hsl(220 14% 92%)",
        card: "hsl(220 16% 14%)",
        side: "hsl(220 14% 20%)",
        line: "hsl(220 12% 26%)",
        "muted-foreground": "hsl(220 8% 62%)",
        cta: { DEFAULT: "hsl(28 92% 54%)", foreground: "hsl(24 40% 8%)" },
        ok: "hsl(148 55% 48%)",
        err: "hsl(0 72% 58%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
