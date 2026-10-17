const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const loadWaitForPack = (getPacks, state, delays = []) => {
  const context = vm.createContext({
    window: { __autoBuyRunning: true, __autoBuyPackId: 7 },
    getPacks,
    services: { Localization: { localize: value => value } },
    showNotification: () => {},
    UINotificationType: { NEUTRAL: "neutral" },
    sleep: async delay => {
      delays.push(delay);
      if (state.onSleep) state.onSleep(context.window);
    },
    console: { warn() {} },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/sbctoolbar/sbc-toolbar.js"), "utf8");
  const start = source.indexOf("const waitForAutoBuyPack =");
  const end = source.indexOf("const purchasePack =", start);
  vm.runInContext(`${source.slice(start, end)};globalThis.wait=waitForAutoBuyPack;`, context);
  return context;
};

test("Auto Buy waits for the selected store pack and currency before purchase", async () => {
  let checks = 0;
  const delays = [];
  const context = loadWaitForPack(async () => {
    checks++;
    return { packs: checks < 3 ? [] : [{ id: 7, packType: "CARDPACK", prices: { _collection: { COINS: { amount: 500 } } } }] };
  }, {}, delays);
  const pack = await context.wait(7, "COINS");
  assert.equal(pack.id, 7);
  assert.equal(checks, 3);
  assert.deepEqual(delays, [5000, 5000]);
  assert.equal(context.window.__autoBuyWaitingForPack, false);
});

test("Auto Buy stops polling when the user changes the selected pack", async () => {
  const delays = [];
  const context = loadWaitForPack(async () => ({ packs: [] }), {
    onSleep: window => { window.__autoBuyPackId = 8; },
  }, delays);
  assert.equal(await context.wait(7, "COINS"), null);
  assert.deepEqual(delays, [5000]);
  assert.equal(context.window.__autoBuyWaitingForPack, false);
});