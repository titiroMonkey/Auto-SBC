const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("generated bundle includes every manifest module in order", () => {
  const frontend = path.resolve(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(frontend, "manifest.json"), "utf8"));
  const expected = manifest.map(file => fs.readFileSync(path.join(frontend, "src", file), "utf8")).join("");
  const actual = fs.readFileSync(path.join(frontend, "..", "plainJavascript.js"), "utf8");
  assert.equal(actual, expected);
});