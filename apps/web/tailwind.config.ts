import type { Config } from "tailwindcss";

// Palette: TNI field uniform. Army green for structure, khaki for surfaces, gold for rank accents.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        army: { 50: "#f1f4ec", 100: "#e1e8d4", 200: "#c3d1a9", 300: "#9db37a", 400: "#7a9456", 500: "#5c7640", 600: "#475d33", 700: "#374a2b", 800: "#2a3a22", 900: "#1d2918", 950: "#121a0f" },
        khaki: { 50: "#f6f4ec", 100: "#ece8d7", 200: "#ddd5b6", 300: "#cbbf91", 400: "#b8a870", 500: "#a08f55" },
        gold: { 300: "#e8cf74", 400: "#dcb83f", 500: "#c9a227", 600: "#a8841b" },
        field: "#e8eadf",
        alert: "#b3261e",
        level: { rendah: "#4c8c4a", sedang: "#e0a526", tinggi: "#c0392b" },
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
        display: ["Barlow Condensed", "Barlow", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
