const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const createElement = () => ({
  style: {},
  children: [],
  setAttribute() {},
  appendChild(child) { this.children.push(child); },
  append(...children) { this.children.push(...children); },
});

test("score SBC Quick Buy retries each player before reporting failure for replacement", async () => {
  const attempts = [];
  const statusContent = createElement();
  const statusContainer = { style: {}, dataset: {} };
  const timerFooter = { textContent: "" };
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-view.js"), "utf8");
  const start = source.indexOf("  const runQuickBuySquad = async");
  const end = source.indexOf("\n  window.autoSbcConsoleApi =", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const sandbox = vm.createContext({
    document: { createElement },
    ensureStatusContainer: () => ({ container: statusContainer, content: statusContent, footer: timerFooter }),
    getSettings: (_set, _challenge, key) => ({ sbcBuyConceptsMaxPrice: 4000, sbcBuyConceptsPriceAbove: 1000 })[key],
    getPrice: () => 750,
    formatPlayerName: item => item.name,
    sleep: async () => {},
    showNotification() {},
    tryQuickBuy: async (_context, item) => {
      attempts.push(item.definitionId);
      if (item.definitionId === 11) return { success: false, reason: "noListing" };
      return { success: true, priceLabel: "750" };
    },
    UINotificationType: { POSITIVE: "positive", NEGATIVE: "negative" },
    Math: {
      floor: value => Math.floor(value),
      min: (...values) => Math.min(...values),
      max: (...values) => Math.max(...values),
      random: () => 0,
    },
  });
  vm.runInContext(`${source.slice(start, end)}; globalThis.buy = runQuickBuySquad;`, sandbox);

  const result = await sandbox.buy(31, 61, {
    scoreSbcLineup: true,
    replaceFailedConcept: true,
    squadPlayers: [
      { definitionId: 11, name: "First", concept: true },
      { definitionId: 22, name: "Second", concept: true },
    ],
  });

  assert.deepEqual(attempts, [11, 11, 11, 11, 22], result.error?.message || result.reason);
  assert.equal(result.reason, "conceptBuyFailed");
  assert.equal(result.failedConcept.definitionId, 11);
  assert.equal(result.purchased, 1);
  assert.equal(result.total, 2);
});