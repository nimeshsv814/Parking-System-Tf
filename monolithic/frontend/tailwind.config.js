export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#d8eef3",
        mint: "#55d78d",
        amber: "#f6bf45",
        ember: "#f26d5b",
        customSlate: "#7d8596", // ✅ renamed
      },
      boxShadow: {
        glow: "0 20px 60px rgba(19, 37, 53, 0.18)",
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        rise: "rise 0.5s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      fontFamily: {
        sans: ["Space Grotesk", "ui-sans-serif", "sans-serif"],
        serif: ["Instrument Serif", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};