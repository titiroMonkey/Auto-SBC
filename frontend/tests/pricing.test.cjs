const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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