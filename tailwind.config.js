export default {
  content: ["./index.html", "./src/**/*.{svelte,js}"],
  theme: {
    extend: {
      colors: {
        paper: "#fbf7f0",
        parchment: "#fffdf8",
        ink: "#1f1a17",
        muted: "#6f655c",
        clay: "#c96f3b",
        line: "#e4d8c9",
      },
      fontFamily: {
        display: ['"Iowan Old Style"', '"Palatino Linotype"', "serif"],
        sans: ['"Avenir Next"', '"Helvetica Neue"', "sans-serif"],
      },
      boxShadow: {
        panel: "0 24px 70px rgba(77, 54, 33, 0.12)",
      },
    },
  },
  plugins: [],
};
