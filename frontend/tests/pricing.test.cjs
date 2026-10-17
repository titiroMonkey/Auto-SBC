const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("SBC price is one coin lower for a player never seen before", () => {
  const ownership = new Map();
  const context = vm.createContext({
    Map,
    isItemFixed: () => false,
    getPrice: item => item.definitionId === 77 ? 500 : 100,
    getPriceItems: () => ({}),
    getSettings: (_set, _challenge, key) => key === "conceptPremium" ? 1 : 100,
    collectionBookGetOwnedCounts: () => ownership,
    services: { Localization: { localize: value => value } },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/solver/pricing.js"), "utf8");
  vm.runInContext(`${source};globalThis.price=getSBCPrice;`, context);

  const player = {
    definitionId: 77, rating: 80, rareflag: 1, duplicateId: 0,
    isSpecial: () => false, getTier: () => 1, isTradeable: () => true,
  };
  assert.equal(context.price(player), 479);
  ownership.set(77, 1);
  assert.equal(context.price(player), 480);

  const concept = { ...player, concept: true };
  ownership.clear();
  assert.equal(context.price(concept), 499);
  ownership.set(77, 1);
  assert.equal(context.price(concept), 500);
});

test("FUT.GG prices share a throttle across signed, direct and failed requests", async () => {
  let now = 0;
  let fail = false;
  const calls = [];
  const context = vm.createContext({
    URL,
    Date: { now: () => now },
    localStorage: { getItem: () => null },
    getSettings: () => 0,
    setTimeout(resolve, delay) { now += delay; resolve(); },
    GM_xmlhttpRequest(options) {
      calls.push({ method: options.method, url: options.url, time: now });
      if (fail) {
        fail = false;
        options.onload({ status: 429 });
      } else {
        options.onload({ status: 200, responseText: JSON.stringify(options.method === "POST"
          ? { data: { url: JSON.parse(options.data).url + "?verify=token" } }
          : { data: { price: 100 } }) });
      }
    },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/player/player-pricing.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const FUTGG_REQUEST_TIMEOUT_MS"), source.indexOf("function makePostRequest")), context);
  await Promise.all([
    context.fetchFutggSignedJson("/api/fut/player-prices/27/1/"),
    context.fetchFutggSignedJson("/api/fut/player-prices/27/2/"),
    context.makeGetRequest("https://www.fut.gg/api/fut/player-prices/25/?ids=3"),
  ]);
  assert.deepEqual(calls.map(call => [call.method, call.time]), [["POST", 0], ["GET", 0], ["POST", 1300], ["GET", 1300], ["GET", 2600]]);
  fail = true;
  await assert.rejects(context.fetchFutggSignedJson("/api/fut/player-prices/27/4/"), error => error.status === 429);
  await context.fetchFutggSignedJson("/api/fut/player-prices/27/5/");
  assert.equal(calls[6].time - calls[5].time, 2500);
  const before = now;
  await context.makeGetRequest("https://www.fut.gg/api/fut/gallery/fc27/");
  assert.equal(now, before);
});

test("transfer-market search queue serializes concurrent searches and spaces starts", async () => {
  let now = 0;
  const context = vm.createContext({
    Date: { now: () => now },
    setTimeout(resolve, delay) { now += delay; resolve(); },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/player/player-pricing.js"), "utf8");
  const start = source.indexOf("let transferMarketSearchQueue = Promise.resolve();");
  const end = source.indexOf("let fetchLivePlayerPrice =", start);
  vm.runInContext(`${source.slice(start, end)};globalThis.runSearch=runTransferMarketSearch;`, context);

  const starts = [];
  let active = 0;
  let maximumActive = 0;
  await Promise.all(Array.from({ length: 4 }, (_, index) => context.runSearch(async () => {
    starts.push(now);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise(resolve => setTimeout(resolve, 200));
    active -= 1;
    return index;
  })));

  assert.equal(maximumActive, 1);
  assert.deepEqual(starts, [0, 1200, 2400, 3600]);
});

test("startup prices the full concept pool after cache initialization", async () => {
  let finishCache;
  const players = Array.from({ length: 120 }, (_, index) => ({ definitionId: index + 1, concept: true }));
  const calls = [];
  const context = vm.createContext({
    ensureConceptCacheInit: () => new Promise(resolve => { finishCache = resolve; }),
    window: { getAutoSbcConceptPlayers: () => players },
    getConceptPlayers: () => { throw new Error("Cache is already populated"); },
    fetchPlayerPrices: async (items, options) => calls.push({ items, options }),
    console,
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/core/init.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const refreshConceptPricesOnStartup ="), source.indexOf("const refreshTransferListSeenOnStartup =")) + ";globalThis.refresh=refreshConceptPricesOnStartup;", context);
  const request = context.refresh();
  assert.equal(calls.length, 0);
  finishCache();
  await request;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].items, players);
  assert.equal(calls[0].items.length, 120);
  assert.equal(calls[0].options.throttleProfile, "concept");
  assert.equal(calls[0].options.waitForCompletion, false);
  assert.match(source, /\["Fetch all concept prices \(background\)", refreshConceptPricesOnStartup\]/);
});

test("startup concept pricing fetches players when the cache is empty", async () => {
  const players = [{ definitionId: 77, concept: true }];
  let priced;
  const context = vm.createContext({
    ensureConceptCacheInit: async () => {},
    window: { autoSbcConceptPlayers: [] },
    getConceptPlayers: async () => players,
    fetchPlayerPrices: async items => { priced = items; },
    console,
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/core/init.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const refreshConceptPricesOnStartup ="), source.indexOf("const refreshTransferListSeenOnStartup =")) + ";globalThis.refresh=refreshConceptPricesOnStartup;", context);
  await context.refresh();
  assert.equal(priced, players);
});

test("extinct price resolver requests EA market limits and caches the maximum", async () => {
  const cache = { 77: { eaId: 77, price: 0, priceLimitMin: 0, priceLimitMax: 0, isExtinct: true } };
  let requests = 0;
  const context = vm.createContext({
    setTimeout: callback => { callback(); return 0; },
    console: { log() {}, warn() {} },
    getPriceItems: () => cache,
    PriceItem: values => Object.assign(cache, values),
    getAutoSbcItemDisplayName: () => "Extinct Player",
    services: { Item: { requestMarketData(item) {
      requests += 1;
      return { observe(_context, callback) {
        item._itemPriceLimits = { minimum: 150, maximum: 15000000 };
        callback(null, { success: true });
      } };
    } } },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/player/player-pricing.js"), "utf8");
  const start = source.indexOf("const ITEM_PRICE_LIMITS_CACHE_MS");
  const end = source.indexOf("let transferMarketSearchQueue = Promise.resolve();", start);
  vm.runInContext(`${source.slice(start, end)};globalThis.resolveMax=ensureExtinctPlayerMaxPrice;globalThis.ensureLimits=ensureItemMarketData;`, context);

  assert.equal(await context.ensureLimits({ definitionId: 88 }), null);
  assert.equal(requests, 0);
  cache[88] = { price: 1000, isExtinct: false };
  assert.equal(await context.ensureLimits({ definitionId: 88 }), null);
  assert.equal(requests, 0);

  const item = { definitionId: 77, _itemPriceLimits: { minimum: null, maximum: null }, getStaticData() { return {}; } };
  assert.equal(await context.resolveMax(item), 15000000);
  assert.equal(requests, 1);
  assert.equal(cache[77].price, 15000000);
  assert.equal(cache[77].type, "PLAYER");
  assert.equal(cache[77].priceLimitMax, 15000000);
  assert.equal(cache[77].priceLimitMin, 150);
  assert.equal(await context.resolveMax(item), 15000000);
  assert.equal(requests, 1);
});

test("EA 404 price limits are deduplicated and negatively cached", async () => {
  let now = 1000;
  let requests = 0;
  const item = { id: 900077, definitionId: 77, _itemPriceLimits: null };
  const cache = { 77: { isExtinct: true } };
  const context = vm.createContext({
    Date: { now: () => now },
    setTimeout: callback => { callback(); return 0; },
    console: { log() {}, warn() {} },
    getPriceItems: () => cache,
    getAutoSbcItemDisplayName: () => "Missing limits item",
    services: { Item: { requestMarketData() {
      requests++;
      return { observe(_observer, callback) { callback(null, { success: false, status: 404 }); } };
    } } },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/player/player-pricing.js"), "utf8");
  const start = source.indexOf("const ITEM_PRICE_LIMITS_CACHE_MS");
  const end = source.indexOf("let transferMarketSearchQueue = Promise.resolve();", start);
  vm.runInContext(`${source.slice(start, end)};globalThis.ensure=ensureItemMarketData;`, context);
  const results = await Promise.all([context.ensure(item), context.ensure(item), context.ensure(item)]);
  assert.deepEqual(results, [null, null, null]);
  assert.equal(requests, 1);
  await context.ensure(item);
  assert.equal(requests, 1);
  now += 7 * 24 * 60 * 60 * 1000;
  await context.ensure(item);
  assert.equal(requests, 2);
});

test("EA market price limits skip concepts keyed by definition ID", async () => {
  let requests = 0;
  const context = vm.createContext({
    Date,
    setTimeout: callback => { callback(); return 0; },
    console: { log() {}, warn() {} },
    getPriceItems: () => ({ 170249: { isExtinct: true } }),
    getAutoSbcItemDisplayName: () => "Concept Player",
    services: { Item: { requestMarketData() { requests++; throw new Error("must not request concept limits"); } } },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/player/player-pricing.js"), "utf8");
  const start = source.indexOf("const ITEM_PRICE_LIMITS_CACHE_MS");
  const end = source.indexOf("let transferMarketSearchQueue = Promise.resolve();", start);
  vm.runInContext(`${source.slice(start, end)};globalThis.ensure=ensureItemMarketData;`, context);
  assert.equal(await context.ensure({ id: 170249, definitionId: 170249, concept: true }), null);
  assert.equal(await context.ensure({ id: 170250, definitionId: 170250, owners: 0 }), null);
  assert.equal(requests, 0);
});

test("Gallery listing can force market limits for a newly bought non-extinct concept", async () => {
  const cache = { 77: { isExtinct: false } };
  const item = { id: 900077, definitionId: 77, concept: true, owners: 0, _itemPriceLimits: null };
  let requests = 0;
  const context = vm.createContext({
    Date,
    setTimeout: callback => { callback(); return 0; },
    console: { log() {}, warn() {} },
    getPriceItems: () => cache,
    getAutoSbcItemDisplayName: () => "Recently bought player",
    PriceItem: values => Object.assign(cache, values),
    services: { Item: { requestMarketData(requestItem) {
      requests++;
      return { observe(_observer, callback) {
        requestItem._itemPriceLimits = { minimum: 150, maximum: 15000000 };
        callback(null, { success: true });
      } };
    } } },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/player/player-pricing.js"), "utf8");
  const start = source.indexOf("const ITEM_PRICE_LIMITS_CACHE_MS");
  const end = source.indexOf("let transferMarketSearchQueue = Promise.resolve();", start);
  vm.runInContext(`${source.slice(start, end)};globalThis.ensure=ensureItemMarketData;`, context);

  assert.equal(await context.ensure(item), null);
  assert.equal(requests, 0);
  const limits = await context.ensure(item, { force: true });
  assert.equal(limits.minimum, 150);
  assert.equal(limits.maximum, 15000000);
  assert.equal(requests, 1);
});

test("EA market limits persist in shared item-price cache for seven days", async () => {
  let now = 1000;
  let requests = 0;
  const cache = { 88: { isExtinct: true, type: "PLAYER" } };
  const item = { id: 900088, definitionId: 88, _itemPriceLimits: null, getSearchType: () => "player" };
  const context = vm.createContext({
    Date: { now: () => now },
    setTimeout: callback => { callback(); return 0; },
    localStorage: { getItem: () => null, setItem() {} },
    console: { log() {}, warn() {} },
    getPriceItems: () => cache,
    PriceItem: items => Object.assign(cache, items),
    getAutoSbcItemDisplayName: () => "Marketable Player",
    services: { Item: { requestMarketData(requestItem) {
      requests++;
      return { observe(_observer, callback) {
        requestItem._itemPriceLimits = { minimum: 150, maximum: 15000000 };
        callback(null, { success: true });
      } };
    } } },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/player/player-pricing.js"), "utf8");
  const start = source.indexOf("const ITEM_PRICE_LIMITS_CACHE_MS");
  const end = source.indexOf("let transferMarketSearchQueue = Promise.resolve();", start);
  vm.runInContext(`${source.slice(start, end)};globalThis.ensure=ensureItemMarketData;`, context);
  await context.ensure(item);
  assert.equal(cache[88].priceLimitMin, 150);
  assert.equal(cache[88].priceLimitMax, 15000000);
  assert.equal(cache[88].priceLimitsFetchedAt, now);
  await context.ensure({ id: 900088, definitionId: 88, _itemPriceLimits: null });
  assert.equal(requests, 1);
  now += 7 * 24 * 60 * 60 * 1000 + 1;
  await context.ensure(item);
  assert.equal(requests, 2);
});

test("misc price feed populates non-player cache at hourly cadence", async () => {
  let now = Date.UTC(2026, 9, 3);
  let priceWrites = 0;
  const requests = [];
  const stored = new Map();
  const manifest = { "misc-prices-ps5": "abc123" };
  const priceCache = {};
  const feed = { items: {
    manager: { "1000047": { price: 200, status: "available", priceUpdatedAt: "updated" } },
    chemistry_style: { "268435456": { price: 500, status: "available" } },
    manager_league: { "300000001": { price: 700, status: "available" } },
  } };
  const context = vm.createContext({
    URL,
    Date: { now: () => now },
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    window: { __autoSbcMiscPriceRefreshStarted: false, setInterval() {} },
    getSettings: () => 0,
    getPriceItems: () => priceCache,
    savePriceItems() { priceWrites++; },
    updateCBRMinPrice() {},
    PriceItem(items) { Object.assign(priceCache, items); priceWrites++; },
    makeGetRequest: async url => {
      requests.push(url);
      if (url.endsWith("manifest.json")) return JSON.stringify(manifest);
      if (url.includes("misc-prices-ps5.v1.abc123.json")) return JSON.stringify(feed);
      throw new Error(`Unexpected price URL ${url}`);
    },
    setTimeout(resolve) { resolve(); },
    console: { info() {}, warn() {} },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/player/player-pricing.js"), "utf8");
  const start = source.indexOf("const FUTGG_MISC_PRICE_CACHE_KEY");
  const end = source.indexOf("function makePostRequest", start);
  const getPriceStart = source.indexOf("let getPrice = function");
  const getPriceEnd = source.indexOf("// Function to update minimum prices", getPriceStart);
  Object.assign(context, {
    FUTGG_GAME_YEAR: 27,
    FUTGG_ORIGIN: "https://www.fut.gg",
    FUTGG_PRICE_REQUEST_DELAY_MS_DEFAULT: 1300,
    FUTGG_PRICE_ERROR_BACKOFF_MS_DEFAULT: 3000,
    FUTGG_429_MAX_BACKOFF_MS_DEFAULT: 90000,
    FUTGG_429_BASE_BACKOFF_MS_DEFAULT: 2500,
    FUTGG_PRICE_BLOCK_UNTIL_KEY: "blocked-until",
    getFutggPriceBlockUntil: () => 0,
    sleepMs: async () => {},
    normalizePriceType: value => String(value || "").toUpperCase(),
    isConceptLikePriceItem: () => false,
  });
  vm.runInContext(`${source.slice(getPriceStart, getPriceEnd)}${source.slice(start, end)};globalThis.lookup=getPrice;globalThis.refresh=refreshFutggMiscPrices;globalThis.start=startFutggMiscPriceRefresh;`, context);
  assert.equal(await context.refresh(), 3);
  assert.equal(priceCache["1000047"].type, "STAFF");
  assert.equal(priceCache["1000047"].price, 200);
  assert.equal(priceCache["268435456"].miscPriceCategory, "chemistry_style");
  assert.equal(priceCache["300000001"].miscPriceCategory, "manager_league");
  assert.equal(context.lookup({ definitionId: 1000047, getSearchType: () => "staff" }), 200);
  assert.equal(context.lookup({ definitionId: 268435456, getSearchType: () => "training" }), 500);
  assert.equal(context.lookup({ definitionId: 300000001, getSearchType: () => "training" }), 700);
  assert.equal(priceWrites, 1);
  assert.equal(await context.refresh(), 0);
  assert.equal(requests.length, 2);
  now += 60 * 60 * 1000;
  assert.equal(await context.refresh(), 3);
  assert.equal(requests.length, 4);
  context.start();
  assert.equal(context.window.__autoSbcMiscPriceRefreshStarted, true);
});