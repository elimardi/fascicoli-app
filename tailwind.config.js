/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#EEF2FF",
          100: "#E0E7FF",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
        },
        bozza: {
          bg:   "#FEF3C7",
          text: "#92400E",
          border: "#F59E0B",
        },
        inviato: {
          bg:   "#D1FAE5",
          text: "#065F46",
          border: "#10B981",
        },
        errore: {
          bg:   "#FEE2E2",
          text: "#991B1B",
          border: "#EF4444",
        },
      },
    },
  },
  plugins: [],
};
