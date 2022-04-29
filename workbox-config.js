module.exports = {
  globDirectory: ".",
  globPatterns: ["**/*.{png,html,js,json}"],
  swDest: "sw.js",
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  sourcemap: false,
};
