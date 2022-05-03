module.exports = {
  globDirectory: ".",
  globPatterns: ["**/*.{png,html,js,json}"],
  swDest: "dist/sw.js",
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  sourcemap: false,
};
