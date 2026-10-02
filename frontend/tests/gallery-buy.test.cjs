const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const setup = () => {
  const element = () => ({ style: {}, dataset: {}, appendChild() {}, append() {}, textContent: "", innerHTML: "" });
  const calls = [];
  const context = vm.createContext({
    document: { createElement: element },
    ensureStatusContainer: () => ({ container: element(), content: element(), footer: element() }),
    getSettings: (setId, challengeId, key) => key === "sbcBuyConceptsMaxPrice" ? 15000 : 100,
    getPrice: () => 1000,
    formatPlayerName: item => String(item.definitionId),
    showNotification() {},
    UINotificationType: { NEGATIVE: 0, POSITIVE: 1 },
    getControllerInstance: () => { throw new Error("Gallery must not access the SBC controller"); },
    sbcSets: () => { throw new Error("Gallery must not load SBC sets"); },
    sleep: async () => {},
    tryQuickBuy: async (...args) => { calls.push(args); return { success: true }; },
    console,
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-view.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("  const runQuickBuySquad ="), source.indexOf("  window.autoSbcConsoleApi =")) + ";globalThis.buy=runQuickBuySquad;", context);
  return { context, calls };
};

test("Gallery bulk buy uses explicit concepts and existing price caps without SBC access", async () => {
  const { context, calls } = setup();
  const purchased = [];
  const result = await context.buy(0, 0, {
    galleryLineup: true,
    galleryPurchaseAction: "profit10",
    squadPlayers: [{ definitionId: 1, concept: true }, { definitionId: 2, concept: false }],
    onPurchased: item => purchased.push(item.definitionId),
  });
  assert.equal(result.purchased, 1);
  assert.equal(result.total, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].useGlobalSettings, true);
  assert.equal(calls[0][2].galleryPurchaseAction, "profit10");
  assert.equal(calls[0][5], 1100);
  assert.deepEqual(purchased, [1]);
});

test("Empty Gallery lineups never fall back to an SBC and disposed pages stop buying", async () => {
  const { context, calls } = setup();
  const empty = await context.buy(0, 0, { galleryLineup: true, squadPlayers: [] });
  assert.equal(empty.reason, "no-concepts");
  const stopped = await context.buy(0, 0, {
    galleryLineup: true,
    squadPlayers: [{ concept: true, definitionId: 1 }],
    cancelled: () => true,
  });
  assert.equal(stopped.reason, "stopped");
  assert.equal(calls.length, 0);
  await assert.rejects(context.buy(0, 0, {}), /requires both/);
});

test("Single-player Quick Buy popup caps exactly at the player's current price", async () => {
  const { context, calls } = setup();
  const result = await context.buy(0, 0, {
    singleItem: { definitionId: 88, concept: true },
  });
  assert.equal(result.purchased, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].capToCurrentPrice, true);
  assert.equal(calls[0][5], 1000);
});

test("Gallery purchase actions target the purchased instance and respect prices and limits", async () => {
  const calls = [];
  const item = { id: 123, _itemPriceLimits: { minimum: 150, maximum: 10000 } };
  const sandbox = vm.createContext({
    fetchUnassigned: async () => [{ id: 456 }, item],
    ensureItemMarketData: async () => {},
    fetchLivePlayerPrice: async () => ({ _auction: { buyNowPrice: 900 } }),
    UTCurrencyInputControl: {
      PRICE_TIERS: [{ min: 100000, inc: 1000 }, { min: 50000, inc: 500 }, { min: 10000, inc: 250 }, { min: 1000, inc: 100 }, { min: 150, inc: 50 }, { min: 0, inc: 150 }],
      getIncrementBelowVal: price => price - (price > 1000 ? 100 : 50),
    },
    services: { Item: { move(items, pile) {
      assert.equal(items[0], item);
      calls.push(["move", pile]);
      return { observe(owner, callback) { callback({ unobserve() {} }, { success: true }); } };
    } } },
    quickListItem: async (entry, prices) => { assert.equal(entry, item); calls.push(["list", prices.max]); return { success: true }; },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-button.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const applyGalleryPurchaseAction"), source.indexOf("const tryQuickBuy")) + ";globalThis.apply=applyGalleryPurchaseAction;", sandbox);
  await sandbox.apply(123, 1000, "club");
  assert.deepEqual(calls.splice(0), [["move", 7]]);
  for (const [action, price] of [["minBin", 900], ["cost", 1000], ["profit5", 1200], ["profit10", 1200]]) {
    await sandbox.apply(123, 1000, action);
    assert.deepEqual(calls.splice(0), [["move", 5], ["list", price]]);
  }
  await assert.rejects(sandbox.apply(789, 1000, "club"), /not in unassigned/);
  await sandbox.apply(123, 5000, "profit5");
  assert.deepEqual(calls.splice(0), [["move", 5], ["list", 5600]]);
  await sandbox.apply(123, 5000, "profit10");
  assert.deepEqual(calls.splice(0), [["move", 5], ["list", 5800]]);
  await assert.rejects(sandbox.apply(123, 10000, "profit5"), /price limit/);
  assert.deepEqual(calls, []);
  item._itemPriceLimits.maximum = 1000000;
  for (const [cost, action, expected] of [
    [950, "profit10", 1100],
    [950, "profit5", 1100],
    [850, "profit10", 1000],
    [9000, "profit5", 10000],
    [9100, "profit5", 10250],
    [45000, "profit10", 52500],
    [95000, "profit10", 110000],
  ]) {
    await sandbox.apply(123, cost, action);
    assert.deepEqual(calls.splice(0), [["move", 5], ["list", expected]]);
    assert.ok(expected * 95 >= cost * (action === "profit10" ? 110 : 105));
  }
});

test("Gallery post-purchase failure preserves buy success and bypasses general unassigned rules", async () => {
  let actions = 0;
  const sandbox = vm.createContext({
    setTimeout, clearTimeout, console,
    getPrice: () => 1000,
    getSettings: () => 15000,
    fetchLivePlayerPrice: async () => ({ id: 123, _auction: { tradeId: 456, buyNowPrice: 1000 } }),
    services: { Item: { bid: () => ({ observe(owner, callback) {
      void callback({ unobserve() {} }, { success: true });
    } }) } },
    processUnassigned: () => { throw new Error("Must not run general rules"); },
    applyGalleryPurchaseAction: async (itemId, price, action) => {
      assert.equal(itemId, 123); assert.equal(price, 1000); assert.equal(action, "profit10");
      actions += 1;
      throw new Error("Transfer list full");
    },
    showNotification() {},
    UINotificationType: { NEGATIVE: 0, POSITIVE: 1 },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-button.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const tryQuickBuy"), source.indexOf("const quickListItem")) + ";globalThis.buy=tryQuickBuy;", sandbox);
  const result = await sandbox.buy({}, { definitionId: 1 }, { useGlobalSettings: true, galleryPurchaseAction: "profit10" });
  assert.equal(result.success, true);
  assert.equal(result.postPurchaseError, "Transfer list full");
  assert.equal(actions, 1);
});

test("single-player Quick Buy skips when the confirmed listing exceeds current cached price", async () => {
  let lookup = 0;
  let bids = 0;
  const sandbox = vm.createContext({
    setTimeout, clearTimeout, console,
    getPrice: () => 1000,
    getSettings: (_setId, _challengeId, key) => key === "sbcBuyConceptsMaxPrice" ? 25000 : 12000,
    fetchLivePlayerPrice: async () => {
      lookup += 1;
      return { id: 123, _auction: { tradeId: 456 + lookup, buyNowPrice: lookup === 1 ? 900 : 1001 } };
    },
    services: { Item: { bid: () => { bids += 1; return { observe() {} }; } } },
    showNotification() {},
    UINotificationType: { NEGATIVE: 0, POSITIVE: 1 },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-button.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const tryQuickBuy"), source.indexOf("const quickListItem")) + ";globalThis.buy=tryQuickBuy;", sandbox);

  const result = await sandbox.buy({}, { definitionId: 1 }, { useGlobalSettings: true, capToCurrentPrice: true });

  assert.equal(lookup, 2);
  assert.equal(bids, 0);
  assert.equal(result.success, false);
  assert.equal(result.reason, "priceAboveThreshold");
  assert.equal(result.limit, 1000);
  assert.equal(result.price, 1001);
});

test("single-player Quick Buy submits the rechecked live price at or below current price", async () => {
  let lookup = 0;
  let bid;
  const sandbox = vm.createContext({
    setTimeout, clearTimeout, console,
    getPrice: () => 1000,
    getSettings: () => 25000,
    fetchLivePlayerPrice: async () => {
      lookup += 1;
      return { id: 123, _auction: { tradeId: 456, buyNowPrice: 1000 } };
    },
    services: { Item: { bid: (listing, price) => {
      bid = { listing, price };
      return { observe(owner, callback) { callback({ unobserve() {} }, { success: true }); } };
    } } },
    processUnassigned: () => Promise.resolve(),
    showNotification() {},
    UINotificationType: { NEGATIVE: 0, POSITIVE: 1 },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-button.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const tryQuickBuy"), source.indexOf("const quickListItem")) + ";globalThis.buy=tryQuickBuy;", sandbox);

  const result = await sandbox.buy({}, { definitionId: 1 }, { useGlobalSettings: true, capToCurrentPrice: true });

  assert.equal(lookup, 2);
  assert.equal(bid.price, 1000);
  assert.equal(bid.listing._auction.buyNowPrice, 1000);
  assert.equal(result.success, true);
});