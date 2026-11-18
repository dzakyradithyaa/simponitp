import type { Config } from "tailwindcss";

// Palet Figma terang: putih + abu netral, merah #D71920 sebagai satu-satunya aksen.
// Nama "army" dan "gold" dipertahankan supaya halaman lain (admin, dashboard,
// login) otomatis ikut berubah: army = abu netral, gold = merah, khaki = abu muda.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        army: {
          50: "#f7f7f7",
          100: "#f0f0f0",
          200: "#e2e2e2",
          300: "#cfcfcf",
          400: "#9a9a9a",
          500: "#6b6b6b",
          600: "#4a4a4a",
          700: "#333333",
          800: "#2a2a2a",
          900: "#202020",
          950: "#161616",
        },
        khaki: {
          50: "#fafafa",
          100: "#f0f0f0",
          200: "#e2e2e2",
          300: "#cfcfcf",
          400: "#b5b5b5",
          500: "#9a9a9a",
        },
        gold: {
          300: "#f08a8e",
          400: "#e5474d",
          500: "#d71920",
          600: "#b8141a",
        },
        field: "#f5f5f5",
        alert: "#b3261e",
        level: { rendah: "#4c8c4a", sedang: "#e0a526", tinggi: "#c0392b" },
      },
      transitionTimingFunction: { apple: "cubic-bezier(0.32, 0.72, 0, 1)" },
      keyframes: {
        "rise-center": {
          from: { transform: "translate(-50%, 16px)", opacity: "0" },
          to: { transform: "translate(-50%, 0)", opacity: "1" },
        },
        "sheet-in": {
          from: { transform: "translateY(28px) scale(0.98)", opacity: "0" },
          to: { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "rise-center": "rise-center 420ms cubic-bezier(0.32,0.72,0,1)",
        "sheet-in": "sheet-in 420ms cubic-bezier(0.32,0.72,0,1)",
        "fade-in": "fade-in 300ms ease-out",
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"DM Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
