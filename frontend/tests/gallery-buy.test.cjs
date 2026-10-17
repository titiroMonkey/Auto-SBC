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
    getSettings: (setId, challengeId, key) => key === "sbcBuyConceptsMaxPrice" ? 15000 : key === "sbcBuyConceptsPriceAbove" ? 100 : undefined,
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

test("closing Gallery buy stops the active attempt and remaining players", async () => {
  const { context } = setup();
  const originalStatus = context.ensureStatusContainer;
  let panel;
  context.ensureStatusContainer = () => { const status = originalStatus(); panel = status.container; return status; };
  let attempts = 0;
  context.tryQuickBuy = async (_owner, _item, options) => {
    attempts++;
    assert.equal(Boolean(options.cancelled()), false);
    panel.__onClose();
    assert.equal(options.cancelled(), true);
    return { success: false, reason: "stopped" };
  };
  const result = await context.buy(0, 0, {
    galleryLineup: true,
    squadPlayers: [{ definitionId: 1, concept: true }, { definitionId: 2, concept: true }],
  });
  assert.equal(result.reason, "stopped");
  assert.equal(result.purchased, 0);
  assert.equal(attempts, 1);
});

test("Quick Buy cancellation during either market search prevents bidding", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-button.js"), "utf8");
  for (const cancelAfterSearch of [1, 2]) {
    let searches = 0;
    let stopped = false;
    let bids = 0;
    const context = vm.createContext({
      getPrice: () => 1000,
      getSettings: () => 15000,
      fetchLivePlayerPrice: async () => {
        searches++;
        if (searches === cancelAfterSearch) stopped = true;
        return { id: 123, _auction: { tradeId: 456, buyNowPrice: 900 } };
      },
      services: { Item: { bid() { bids++; throw new Error("Must not bid after close"); } } },
      console,
    });
    vm.runInContext(source.slice(source.indexOf("const tryQuickBuy"), source.indexOf("const quickListItem")) + ";globalThis.buy=tryQuickBuy;", context);
    const result = await context.buy({}, { definitionId: 1 }, {
      useGlobalSettings: true,
      suppressNotifications: true,
      cancelled: () => stopped,
    });
    assert.equal(result.reason, "stopped");
    assert.equal(searches, cancelAfterSearch);
    assert.equal(bids, 0);
  }
});

test("score buying rechecks exclusions and changed scoped price caps before bidding", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-button.js"), "utf8");
  for (const scenario of ["excluded-before-search", "excluded-before-bid", "lowered-cap"]) {
    let searches = 0;
    let validations = 0;
    let bids = 0;
    const context = vm.createContext({
      console, getPrice: () => 650,
      UINotificationType: { NEGATIVE: 0, POSITIVE: 1 },
      getSettings: (set, challenge, key) => {
        assert.equal(set, 31); assert.equal(challenge, 61);
        return ({ sbcBuyConceptsMaxPrice: 4000, sbcBuyConceptsPriceAbove: 1000,
          maxPlayerPrice: scenario === "lowered-cap" && searches === 2 ? 650 : 1500 })[key];
      },
      fetchLivePlayerPrice: async () => { searches++; return { id: 123, _auction: { tradeId: 456, buyNowPrice: 700 } }; },
      services: { Item: { bid() { bids++; throw new Error("Must not bid outside current settings"); } } },
    });
    vm.runInContext(source.slice(source.indexOf("const tryQuickBuy"), source.indexOf("const quickListItem")) + ";globalThis.buy=tryQuickBuy;", context);
    const result = await context.buy({}, { definitionId: 77, concept: true }, {
      scoreSbcLineup: true, suppressNotifications: true,
      validateItem: async () => {
        validations++;
        return scenario === "lowered-cap" || (scenario === "excluded-before-bid" && validations === 1);
      },
    }, 31, 61);
    assert.equal(bids, 0);
    assert.equal(result.reason, scenario === "lowered-cap" ? "priceAboveThreshold" : "excludedBySettings");
    assert.equal(searches, scenario === "excluded-before-search" ? 0 : 2);
    if (scenario === "lowered-cap") assert.equal(result.limit, 650);
  }
});

test("purchase queue waits for each bought player to be staged", async () => {
  const { context } = setup();
  const order = [];
  context.tryQuickBuy = async (_owner, item) => { order.push(`buy:${item.definitionId}`); return { success: true }; };
  await context.buy(31, 61, {
    scoreSbcLineup: true,
    squadPlayers: [{ definitionId: 1, concept: true }, { definitionId: 2, concept: true }],
    onPurchased: async item => { await new Promise(resolve => setImmediate(resolve)); order.push(`stage:${item.definitionId}`); },
  });
  assert.deepEqual(order, ["buy:1", "stage:1", "buy:2", "stage:2"]);
});

test("score replacement queue retries each failed player before returning the first failure", async () => {
  const { context } = setup();
  const attempted = [];
  context.tryQuickBuy = async (_owner, item) => {
    attempted.push(item.definitionId);
    return { success: false, reason: "bidFailed" };
  };
  const result = await context.buy(31, 61, { scoreSbcLineup: true, replaceFailedConcept: true,
    squadPlayers: [{ definitionId: 77, concept: true }, { definitionId: 88, concept: true }] });
  assert.deepEqual(attempted, [77, 77, 77, 77, 88, 88, 88, 88]);
  assert.equal(result.reason, "conceptBuyFailed");
  assert.equal(result.failedConcept.definitionId, 77);
});

test("Gallery bulk buy caps at each player's price without SBC access", async () => {
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
  assert.equal(calls[0][2].capToCurrentPrice, true);
  assert.equal(calls[0][5], 1000);
  assert.deepEqual(purchased, [1]);
});

test("score concepts use scoped SBC caps and send purchases to club without normal squad access", async () => {
  const { context, calls } = setup();
  const result = await context.buy(31, 61, {
    scoreSbcLineup: true,
    galleryPurchaseAction: "club",
    squadPlayers: [{ definitionId: 1, concept: true }],
  });
  assert.equal(result.purchased, 1);
  assert.equal(calls[0][2].useGlobalSettings, false);
  assert.equal(calls[0][2].capToCurrentPrice, false);
  assert.equal(calls[0][2].galleryPurchaseAction, "club");
  assert.equal(calls[0][3], 31);
  assert.equal(calls[0][4], 61);
  assert.equal(calls[0][5], 1100);
});

test("score purchases use explicit SBC names instead of stale ambient numeric context", async () => {
  const { context, calls } = setup();
  context.getPrice = () => 650;
  context.getSettings = (sbc, _challenge, key) => sbc === "Gold Re-Roll"
    ? ({ sbcBuyConceptsMaxPrice: 700, sbcBuyConceptsPriceAbove: 0 })[key]
    : ({ sbcBuyConceptsMaxPrice: 4000, sbcBuyConceptsPriceAbove: 1000 })[key];
  await context.buy(9, 24, { scoreSbcLineup: true, settingsScope: { sbc: "Gold Re-Roll", challenge: "global" },
    galleryPurchaseAction: "club", squadPlayers: [{ definitionId: 1, concept: true }] });
  assert.equal(calls[0][5], 650);
  assert.equal(calls[0][2].settingsScope.sbc, "Gold Re-Roll");
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-button.js"), "utf8");
  let bids = 0;
  const sandbox = vm.createContext({
    console, getPrice: () => 650, getSettings: context.getSettings,
    UINotificationType: { NEGATIVE: 0, POSITIVE: 1 },
    fetchLivePlayerPrice: async (_item, options) => {
      assert.equal(options.maxBuy, 650);
      return { id: 123, _auction: { tradeId: 456, buyNowPrice: 850 } };
    },
    services: { Item: { bid() { bids++; } } },
  });
  vm.runInContext(source.slice(source.indexOf("const tryQuickBuy"), source.indexOf("const quickListItem")) + ";globalThis.buy=tryQuickBuy;", sandbox);
  const result = await sandbox.buy({}, { definitionId: 1, concept: true }, {
    scoreSbcLineup: true, settingsScope: { sbc: "Gold Re-Roll", challenge: "global" }, suppressNotifications: true,
  }, 9, 24);
  assert.equal(result.reason, "priceAboveThreshold");
  assert.equal(result.limit, 650);
  assert.equal(bids, 0);
});

test("score concept purchases cannot exceed the solver max-player price via purchase uplift", async () => {
  const { context, calls } = setup();
  context.getPrice = () => 650;
  context.getSettings = (_set, _challenge, key) => ({ sbcBuyConceptsMaxPrice: 4000, sbcBuyConceptsPriceAbove: 1000, maxPlayerPrice: 650 })[key];
  await context.buy(31, 61, { scoreSbcLineup: true, galleryPurchaseAction: "club", squadPlayers: [{ definitionId: 1, concept: true }] });
  assert.equal(calls[0][5], 650);
});

test("Gallery resolved current price is the exact cap, not FUT.GG range maximum", async () => {
  const { context, calls } = setup();
  await context.buy(0, 0, {
    galleryLineup: true,
    playerPrices: { 44: 20000 },
    playerMaxPrices: { 44: 25000 },
    squadPlayers: [{ definitionId: 44, concept: true }],
  });
  assert.equal(calls[0][5], 20000);
  assert.equal(calls[0][2].currentPrice, 20000);
  assert.equal(calls[0][2].maxBuyPrice, 20000);
  assert.equal(calls[0][2].capToCurrentPrice, true);
});

test("Gallery does not buy when the player's current price is unavailable", async () => {
  const { context, calls } = setup();
  const result = await context.buy(0, 0, {
    galleryLineup: true,
    playerPrices: {},
    squadPlayers: [{ definitionId: 45, concept: true }],
  });
  assert.equal(result.purchased, 0);
  assert.equal(result.total, 1);
  assert.equal(calls.length, 0);
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
  assert.equal(typeof calls[0][2].onProgress, "function");
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
  await sandbox.apply(123, 1000, "market");
  assert.deepEqual(calls.splice(0), [["move", 5], ["list", 900]]);
  await sandbox.apply(123, 1000, "markup10");
  assert.deepEqual(calls.splice(0), [["move", 5], ["list", 1100]]);
  await assert.rejects(sandbox.apply(789, 1000, "club"), /not in unassigned/);
  await sandbox.apply(123, 5000, "markup10");
  assert.deepEqual(calls.splice(0), [["move", 5], ["list", 5500]]);
  await assert.rejects(sandbox.apply(123, 10000, "markup10"), /price limit/);
  assert.deepEqual(calls, []);
  item._itemPriceLimits.maximum = 1000000;
  for (const [cost, expected] of [
    [950, 1100],
    [850, 950],
    [9000, 9900],
    [9100, 10250],
    [45000, 49750],
    [95000, 105000],
  ]) {
    const action = "markup10";
    await sandbox.apply(123, cost, action);
    assert.deepEqual(calls.splice(0), [["move", 5], ["list", expected]]);
    assert.ok(expected >= cost * 1.1);
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

test("Quick Buy finishes an empty capped search before background price refresh", async () => {
  const calls = [];
  const progress = [];
  let finishRefresh;
  const sandbox = vm.createContext({
    console, getPrice: () => 650, getSettings: () => 15000,
    fetchLivePlayerPrice: async (_item, options) => {
      calls.push(options);
      if (options.purchaseSearch) return null;
      return new Promise(resolve => { finishRefresh = resolve; });
    },
    services: { Item: { bid() { throw new Error("Must not bid"); } } },
    showNotification() {}, UINotificationType: { NEGATIVE: 0, POSITIVE: 1 },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/sbc/sbc-button.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const tryQuickBuy"), source.indexOf("const quickListItem")) + ";globalThis.buy=tryQuickBuy;", sandbox);
  const result = await sandbox.buy({}, { definitionId: 1 }, { useGlobalSettings: true, capToCurrentPrice: true, onProgress: message => progress.push(message) });
  assert.equal(result.reason, "noListing");
  assert.equal(calls[0].maxBuy, 650);
  assert.equal(calls[0].purchaseSearch, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].purchaseSearch, undefined);
  assert.match(progress.at(-1), /Nothing exists at or below 650/);
  finishRefresh({ _auction: { buyNowPrice: 800 } });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(progress.at(-1), /updated to 800/);
});

test("single-player Quick Buy submits the rechecked live price at or below current price", async () => {
  let lookup = 0;
  let bid;
  const progress = [];
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

  const result = await sandbox.buy({}, { definitionId: 1 }, { useGlobalSettings: true, capToCurrentPrice: true, onProgress: message => progress.push(message) });

  assert.equal(lookup, 2);
  assert.equal(bid.price, 1000);
  assert.equal(bid.listing._auction.buyNowPrice, 1000);
  assert.equal(result.success, true);
  assert.match(progress[0], /Searching transfer market/);
  assert.match(progress[1], /rechecking price/);
  assert.match(progress[2], /waiting for EA confirmation/);
  assert.match(progress.at(-1), /success/);
});