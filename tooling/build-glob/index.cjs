// shortcut: only vite-plugin-dynamic-import 1.6.0's sync(patterns, { cwd }) is supported; remove when its glob dependency is fixed upstream.
const { globSync } = require("tinyglobby");
module.exports = { sync: globSync };
