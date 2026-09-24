/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        carbon: "#0B0E14",
        "carbon-deep": "#080A0E",
        surface: "#131B24",
        "surface-elevated": "#161F2B",
        cyan: "#00E5FF",
        "cyan-hover": "#33EAFF",
        amber: "#F59E0B",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Space Grotesk", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        panel: "12px",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.45)",
        glow: "0 0 20px rgba(0,229,255,0.14)",
      },
      backdropBlur: {
        panel: "8px",
      },
    },
  },
  plugins: [],
};
