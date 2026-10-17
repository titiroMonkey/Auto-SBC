const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({ setTimeout });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";globalThis.optimize=optimizeScoreSbc;", context);
const candidate = (id, score, cost) => ({ item: { id, definitionId: 99 }, score, cost });

test("shared squad loader skips score SBCs on initial load and reopening", async () => {
  const loaded = [];
  const sandbox = vm.createContext({
    console: { log() {} },
    services: { SBC: { loadChallenge(challenge) {
      assert.notEqual(challenge.type, "ONE_CLICK_CHALLENGE");
      loaded.push(challenge.id);
      return { observe(owner, callback) { callback({}, { success: true, data: { squad: {} } }); } };
    } } },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/sbc-core.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("let loadChallenge ="), source.indexOf("let fetchSBCData =")) + ";globalThis.load=loadChallenge;", sandbox);
  for (const status of ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "IN_PROGRESS"]) {
    await sandbox.load({ id: 61, type: "ONE_CLICK_CHALLENGE", status });
  }
  assert.deepEqual(loaded, []);
  await sandbox.load({ id: 62, type: "OPEN_CHALLENGE", status: "IN_PROGRESS" });
  assert.deepEqual(loaded, [62]);
});

test("sidebar opens score work area before selecting and leaves normal SBCs alone", async () => {
  const calls = [];
  const scoreChallenge = { id: 61, type: "ONE_CLICK_CHALLENGE", status: "IN_PROGRESS" };
  const normalChallenge = { id: 62, type: "OPEN_CHALLENGE", status: "IN_PROGRESS" };
  let failStart = false;
  let failUnassigned = false;
  let phone = false;
  class Controller {
    initWithSBCSet(set, id) { calls.push(["init", set.id, id]); }
    async _eAutoSelect() { calls.push(["select"]); }
  }
  Controller.prototype.__autoSbcCostSelect = true;
  class SplitController {
    constructor() { this.workAreaController = new Controller(); }
    initWithSBCSet(set, id) { this.workAreaController.initWithSBCSet(set, id); }
  }
  const navigation = { pushViewController(controller) { assert.ok(controller instanceof (phone ? Controller : SplitController)); calls.push(["open"]); } };
  const sandbox = vm.createContext({
    isPhone: () => phone,
    processUnassigned: async options => {
      assert.equal(options.suppressNavigation, true);
      calls.push(["unassigned"]);
      await Promise.resolve();
      if (failUnassigned) throw new Error("Unassigned failed");
      calls.push(["processed"]);
    },
    getChallenges: async () => ({ challenges: [scoreChallenge, normalChallenge] }),
    getCurrentViewController: () => ({ rootController: { getRootNavigationController: () => navigation } }),
    UTOneClickSBCWorkAreaViewController: Controller,
    UTOneClickSBCWorkAreaSplitViewController: SplitController,
    UTOneClickSBCReviewViewController: class ReviewController {},
    UTOneClickSBCController: { enterChallenge(owner, challenge, success, failure) {
      assert.equal(owner, navigation); assert.equal(challenge, scoreChallenge);
      calls.push(["start"]); if (failStart) failure(); else success();
    } },
    document: { getElementById: () => null },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";globalThis.open=openScoreSbcFromSidebar;", sandbox);
  assert.equal(await sandbox.open({ id: 31 }), true);
  assert.deepEqual(calls, [["unassigned"], ["processed"], ["start"], ["init", 31, 61], ["open"], ["select"]]);
  calls.length = 0;
  assert.equal(await sandbox.open({ id: 31 }, 62), false);
  assert.deepEqual(calls, []);
  failUnassigned = true;
  await assert.rejects(sandbox.open({ id: 31 }, 61), /Unassigned failed/);
  assert.deepEqual(calls, [["unassigned"]]);
  failUnassigned = false;
  failStart = true;
  await assert.rejects(sandbox.open({ id: 31 }, 61), /Could not start score SBC/);
  failStart = false;
  assert.equal(await sandbox.open({ id: 31 }, 61), true);
  phone = true;
  calls.length = 0;
  assert.equal(await sandbox.open({ id: 31 }, 61), true);
  assert.deepEqual(calls, [["unassigned"], ["processed"], ["start"], ["init", 31, 61], ["open"], ["select"]]);
});

test("score submission refreshes the tab after native success, including partial batches", async () => {
  const calls = [];
  const warnings = [];
  const observable = {};
  let failRefresh = false;
  class ReviewController {
    _onSubmissionComplete(request, response) {
      assert.equal(this, controller);
      assert.equal(request, observable);
      calls.push(["native", response]);
      this.viewModel = null;
      return "native-result";
    }
  }
  const controller = new ReviewController();
  const sandbox = vm.createContext({
    UTOneClickSBCReviewViewController: ReviewController,
    createSBCTab: async () => {
      calls.push(["refresh"]);
      if (failRefresh) throw new Error("Refresh failed");
    },
    console: { warn: (...args) => warnings.push(args) },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";installScoreSbcSubmitRefresh();installScoreSbcSubmitRefresh();", sandbox);
  for (const response of [
    { success: true, data: { challengeCompleted: false } },
    { success: true, data: { challengeCompleted: true, setCompleted: true } },
    { success: false, data: {} },
    { success: true },
  ]) {
    calls.length = 0;
    controller.viewModel = {};
    assert.equal(controller._onSubmissionComplete(observable, response), "native-result");
    assert.deepEqual(calls, [["native", response]]);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, response.success && response.data
      ? [["native", response], ["refresh"]] : [["native", response]]);
  }
  failRefresh = true;
  controller.viewModel = {};
  controller._onSubmissionComplete(observable, { success: true, data: {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][1].message, /Refresh failed/);
});

const filterFixture = async (settings = {}, prices = {}, overrides = {}) => {
  const sandbox = vm.createContext({
    getSettings: (setId, challengeId, key) => {
      assert.equal(setId, 31); assert.equal(challengeId, 61); return settings[key];
    },
    getPriceItems: () => prices,
    isItemLocked: item => !!item.locked,
    services: { Localization: { localize: key => key } },
    getUserSquads: async () => [{ _id: 7, _players: [{ _item: { id: 1 } }] }],
    getChallenges: async () => ({ challenges: [{ id: 62, squad: { _players: [{ _item: { id: 1 } }] } }] }),
    loadChallenge: async () => {},
    ...overrides,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";globalThis.filter=createScoreSbcFilter;", sandbox);
  return sandbox.filter({ id: 31 }, { id: 61 });
};

test("score filters honor scoped rating, identity, type, price and squad exclusions", async () => {
  const item = { id: 1, definitionId: 99, rating: 80, leagueId: 13, nationId: 14, teamId: 15, rareflag: 1,
    loans: -1, isSpecial: () => true, isTradeable: () => true, upgrades: {} };
  assert.equal((await filterFixture())(item, 500), true);
  const exclusions = [
    { ratingRange: [81, 99] }, { ratingRange: [40, 79] }, { excludePlayers: ["99"] },
    { excludeLeagues: [13] }, { excludeNations: [14] }, { excludeTeams: [15] },
    { excludeRarity: ["item.raretype1"] }, { excludeSpecial: true }, { excludeTradable: true },
    { excludeEvolutions: true }, { onlyStorage: true }, { maxPlayerPrice: 499 },
    { excludeFromSquadIds: ["7"] }, { excludeSbcSquads: true },
  ];
  for (const settings of exclusions) assert.equal((await filterFixture(settings))(item, 500), false, JSON.stringify(settings));
  for (const [setting, flag] of [["excludeSbc", "isSbc"], ["excludeObjective", "isObjective"], ["excludeExtinct", "isExtinct"]]) {
    assert.equal((await filterFixture({ [setting]: true }, { 99: { [flag]: true } }))(item, 500), false);
  }
  assert.equal((await filterFixture({ maxPlayerPrice: 500 }))(item, 500), true);
});

test("storage exclusion override is explicit and never permits loans or locked cards", async () => {
  const item = { id: 1, definitionId: 99, rating: 90, loans: -1, isStorage: true };
  const settings = { ratingRange: [40, 80], excludePlayers: [99], maxPlayerPrice: 100 };
  assert.equal((await filterFixture(settings))(item, 500), false);
  const allows = await filterFixture({ ...settings, useDupes: true });
  assert.equal(allows(item, 50), true);
  assert.equal(allows(item, 500), false);
  assert.equal(allows({ ...item, locked: true }, 500), false);
  assert.equal(allows({ ...item, loans: 2 }, 500), false);
  assert.equal(allows({ ...item, concept: true }, 500), false);
});

test("protected squad lookup errors stop optimization", async () => {
  await assert.rejects(filterFixture({ excludeFromSquadIds: [7] }, {}, {
    getUserSquads: async () => { throw new Error("Squad lookup failed"); },
  }), /Squad lookup failed/);
  await assert.rejects(filterFixture({ excludeSbcSquads: true }, {}, {
    getChallenges: async () => ({ challenges: [{ id: 62 }] }),
  }), /Could not load protected SBC squad/);
});

test("score optimizer beats greedy cost-per-point", async () => {
  const pool = [candidate(1, 9, 5), candidate(2, 6, 4), candidate(3, 6, 4)];
  const result = await context.optimize(pool, 12);
  assert.equal(result.cost, 8);
  assert.equal(result.score, 12);
  assert.equal(result.reached, true);
  assert.equal(result.items.length, 2);
  const partial = await context.optimize(pool, 30);
  assert.equal(partial.score, 21);
  assert.equal(partial.reached, false);
});

test("distinct copies can be selected but an item instance cannot be reused", async () => {
  const result = await context.optimize([candidate(1, 5, 2), candidate("1", 5, 2), candidate(2, 5, 3)], 10);
  assert.equal(result.items.length, 2);
  assert.equal(result.cost, 5);
  assert.equal(result.score, 10);
});

test("handles remaining progress, free cards, invalid prices and empty pools", async () => {
  const result = await context.optimize([candidate(1, 100, NaN), candidate(2, 100, -1), candidate(3, 20, 0)], 20);
  assert.equal(result.items.length, 1);
  assert.equal(result.cost, 0);
  assert.equal((await context.optimize([], 20)).reached, false);
  assert.equal((await context.optimize([candidate(1, 5, 2)], 0)).items.length, 0);
});

test("matches exhaustive minimum cost across small pools", async () => {
  const pool = Array.from({ length: 9 }, (_, index) => candidate(index + 1, (index * 7) % 19 + 1, (index * 13) % 23));
  for (const target of [10, 25, 50, 90]) {
    let bestScore = -1;
    let bestCost = Infinity;
    for (let mask = 0; mask < 1 << pool.length; mask++) {
      const selected = pool.filter((entry, index) => mask & (1 << index));
      const score = Math.min(target, selected.reduce((sum, entry) => sum + entry.score, 0));
      const cost = selected.reduce((sum, entry) => sum + entry.cost, 0);
      if (score > bestScore || (score === bestScore && cost < bestCost)) { bestScore = score; bestCost = cost; }
    }
    const result = await context.optimize(pool, target);
    assert.equal(Math.min(target, result.score), bestScore);
    assert.equal(result.cost, bestCost);
  }
});

test("full solution can use more than thirty cards instead of expensive single-batch players", async () => {
  const pool = Array.from({ length: 70 }, (_, index) => candidate(index + 1, 40, 1));
  pool.push(candidate(100, 2500, 100));
  const result = await context.optimize(pool, 2500);
  assert.equal(result.items.length, 63);
  assert.equal(result.cost, 63);
  assert.equal(result.score, 2520);
  assert.equal(result.reached, true);
});

test("Auto-Select fetches all pages, prices by SBC settings, stages thirty and warns without submitting", async () => {
  const items = Array.from({ length: 70 }, (_, index) => ({ id: index + 1, rating: 60, sbsScore: 40, loans: -1 }));
  const selected = new Set();
  const notifications = [];
  const offsets = [];
  let fail = false;
  let shields = 0;
  let reviews = 0;
  let activeTab = "storage";
  let refreshed = 0;
  class Controller {}
  const model = {
    _currentState: () => state,
    _itemTabMap: new Map(), _itemScoreMap: new Map(), _itemEntityMap: new Map(),
    getActiveTab: () => activeTab, getChallenge: () => ({ id: 61, scoreRequirement: 2500, submittedScore: 0 }),
    getSet: () => ({ id: 31 }), getSelectedItemIds: () => [...selected],
    getSelectedEntries: () => [...selected].map(id => ({ item: model._itemEntityMap.get(id) })),
    getSelectionLimit: () => 30, _buildCriteria: () => ({ sbcChallengeId: 61 }),
    isItemSelectable: () => true, deselectCurrentTab: () => selected.clear(),
    selectItem: item => { assert.ok(selected.size < 30); selected.add(item.id); },
    getCurrentPageItems: () => state.items.slice(state.currentPage * 30, (state.currentPage + 1) * 30), isItemSelected: item => selected.has(item.id),
  };
  const state = { items: items.slice(0, 30), currentPage: 1, serverOffset: 30, retrievedAll: false };
  const sandbox = vm.createContext({
    setTimeout, clearTimeout, console: { warn() {} }, UTOneClickSBCWorkAreaViewController: Controller,
    OneClickSBCWorkAreaTab: { CLUB: "club", STORAGE: "storage", FAVOURITE: "favourite" },
    dirtyClubCache: () => { refreshed++; },
    isItemLocked: () => false,
    getSettings: () => undefined,
    getPriceItems: () => ({}),
    getSBCPrice: (item, setId, challengeId) => {
      assert.equal(item.isStorage, activeTab === "storage"); assert.equal(setId, 31); assert.equal(challengeId, 61); return 1;
    },
    gClickShield: { showShield: () => shields++, hideShield: () => shields-- },
    EAClickShieldView: { Shield: { LOADING: "loading" } },
    UINotificationType: { WARNING: "warning", NEGATIVE: "negative", POSITIVE: "positive" },
    services: {
      Localization: { localize: key => key },
      Notification: { queue: message => notifications.push(message) },
      Club: { search: criteria => {
        if (activeTab === "club") assert.ok(refreshed > 0);
        offsets.push(criteria.offset);
        assert.equal(criteria.sbcChallengeId, 61);
        const request = { unobserve() {}, observe(observer, callback) {
          callback(request, { success: !fail, response: { items: items.slice(criteria.offset, criteria.offset + criteria.count), retrievedAll: criteria.offset + criteria.count >= items.length } });
        } };
        return request;
      } },
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";installScoreSbcAutoSelect();", sandbox);
  const controller = new Controller();
  controller.viewModel = model;
  controller.getView = () => ({ clearSelection() {}, setItemSelected() {} });
  controller._refreshSelectionControls = () => {};
  controller._refreshCurrentPage = () => {};
  let splitReviews = 0;
  const requirementsController = { viewModel: { requirement: 61 } };
  controller.workAreaDelegate = { requirementsController, reviewSelection: (sender, viewModel) => {
    assert.equal(sender, requirementsController);
    assert.equal(viewModel, requirementsController.viewModel);
    assert.equal(controller.__scoreSbcBusy, false);
    assert.equal(shields, 0);
    splitReviews++;
  } };
  controller._eReviewTap = () => { reviews++; };
  await controller._eAutoSelect();
  assert.deepEqual(offsets, [0, 30, 60]);
  assert.equal(selected.size, 30);
  assert.equal(state.currentPage, 0);
  assert.equal(state.items.length, 70);
  assert.equal(state.serverOffset, 70);
  assert.equal(state.retrievedAll, true);
  assert.ok(model.getCurrentPageItems().every(item => selected.has(item.id)));
  assert.equal(new Set(state.items.map(item => item.id)).size, 70);
  assert.match(notifications[0][0], /63 optimized cards.*3 submission batches required/);
  assert.equal(notifications[0][1], "warning");
  assert.equal(splitReviews, 1);
  assert.equal(reviews, 0);
  assert.equal(shields, 0);
  const before = [...selected];
  fail = true;
  await controller._eAutoSelect();
  assert.deepEqual([...selected], before);
  assert.equal(splitReviews, 1);
  assert.equal(reviews, 0);
  assert.equal(notifications.at(-1)[1], "negative");
  assert.equal(shields, 0);
  assert.equal(controller.__scoreSbcBusy, false);
  fail = false;
  activeTab = "club";
  selected.clear();
  model._itemTabMap.clear();
  controller.workAreaDelegate = null;
  await controller._eAutoSelect();
  assert.equal(refreshed, 1);
  assert.equal(reviews, 1);
});

test("concept score candidates honor useConcepts, onlyStorage, and price settings", async () => {
  const item = { id: 100, definitionId: 99, rating: 80, loans: -1, concept: true };
  assert.equal((await filterFixture())(item, 500), false);
  assert.equal((await filterFixture({ useConcepts: true }))(item, 500), true);
  assert.equal((await filterFixture({ useConcepts: true, onlyStorage: true }))(item, 500), false);
  assert.equal((await filterFixture({ useConcepts: true, maxPlayerPrice: 400 }))(item, 500), false);
  assert.equal((await filterFixture({ useConcepts: true, useDupes: true, excludePlayers: [99] }))({ ...item, isDuplicateItem: true }, 500), false);
});

test("score SBC stages club and storage cards but keeps concepts in a separate buy plan", async () => {
  let autoBuy = false;
  const club = { id: 1, definitionId: 11, rating: 80, loans: -1, sbsScore: 40 };
  const storage = { id: 2, definitionId: 22, rating: 80, loans: -1, sbsScore: 40 };
  const concept = { id: 33, definitionId: 33, rating: 80, loans: -1, sbsScore: 40, concept: true };
  const selected = new Set();
  const state = {};
  const challenge = { id: 61, scoreRequirement: 120, submittedScore: 0 };
  const model = {
    _itemTabMap: new Map(), _itemScoreMap: new Map(), _itemEntityMap: new Map(),
    _currentState: () => state,
    getActiveTab: () => "club", getChallenge: () => challenge, getSet: () => ({ id: 31 }),
    getSelectedItemIds: () => [...selected], getSelectedEntries: () => [],
    getSelectionLimit: () => 30, _buildCriteria: () => ({}), isItemSelectable: () => true,
    deselectCurrentTab: () => selected.clear(), isItemSelected: item => selected.has(item.id),
    selectItem: item => { assert.equal(Boolean(item.concept), false); selected.add(item.id); },
  };
  class Controller {}
  const sandbox = vm.createContext({
    setTimeout, clearTimeout, console,
    UTOneClickSBCWorkAreaViewController: Controller,
    OneClickSBCWorkAreaTab: { CLUB: "club", STORAGE: "storage", FAVOURITE: "favourite" },
    getSettings: (_set, _challenge, key) => key === "useConcepts" ? true : key === "sbcBuyConcepts" ? autoBuy : undefined,
    getStoragePlayers: async () => [storage], getConceptPlayers: async () => [concept],
    getSBCPrice: item => item.concept ? 20 : item.isStorage ? 0 : 10,
    getPriceItems: () => ({}), isItemLocked: () => false,
    gClickShield: { showShield() {}, hideShield() {} }, EAClickShieldView: { Shield: { LOADING: 1 } },
    UINotificationType: { WARNING: 1, NEGATIVE: 2, POSITIVE: 3 },
    services: { Localization: { localize: value => value }, Notification: { queue() {} },
      Club: { search: () => ({ unobserve() {}, observe(_owner, callback) {
        callback({ unobserve() {} }, { success: true, response: { items: [club], retrievedAll: true } });
      } }) } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";installScoreSbcAutoSelect();", sandbox);
  const controller = new Controller();
  controller.viewModel = model;
  controller._refreshCurrentPage = () => {};
  controller._eReviewTap = () => { throw new Error("Concepts must not enter review"); };
  await controller._eAutoSelect();
  assert.deepEqual([...selected].sort(), [1, 2]);
  assert.equal(model._itemTabMap.get(2), "storage");
  assert.equal(model._itemEntityMap.has(33), false);
  assert.equal(controller.__scoreConceptPlan.items[0].definitionId, 33);
  assert.equal(controller.__scoreConceptPlan.selectedIds, "1,2");
  let purchases = 0;
  controller.__scoreBuyAction = async () => { purchases++; };
  autoBuy = true;
  await controller._eAutoSelect();
  assert.equal(purchases, 1);
  autoBuy = false;
  await controller._eAutoSelect();
  assert.equal(purchases, 1);
});

test("replacement concept candidates skip bought IDs and duplicate definition variants", () => {
  const sandbox = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";globalThis.filter=scoreSbcFilterExtraConceptDefinitions;", sandbox);
  const candidate = (id, definitionId, concept = true) => ({ item: { id, definitionId, concept } });
  const filtered = sandbox.filter(
    [candidate(10, 100), candidate(11, 100), candidate(12, 101), candidate(13, 102, false)],
    new Set(["100"]),
    new Set(["101"]),
  );
  assert.deepEqual(Array.from(filtered, entry => entry.item.id), [13]);
});

test("native Buy Concepts button buys a score plan without submitting and rejects stale selection", async () => {
  let onPress;
  let buys = 0;
  let selections = 0;
  const root = { isConnected: true, querySelector: () => ({ appendChild() {} }) };
  class Button {
    init() {}
    getRootElement() { return {}; }
    addTarget(_controller, callback) { onPress = callback; }
    setText(value) { this.text = value; }
    setInteractionState(value) { this.enabled = value; }
  }
  const controller = {
    viewModel: { getChallenge: () => ({ submittedScore: 0 }), getSelectedItemIds: () => [1] },
    getView: () => ({ getRootElement: () => root }),
    _eAutoSelect: async () => { selections++; },
    __scoreConceptPlan: { items: [{ concept: true, definitionId: 33, rating: 83, loans: -1 }], set: { id: 31 }, challenge: { id: 61 }, selectedIds: "1", submittedScore: 0 },
  };
  const sandbox = vm.createContext({
    UTStandardButtonControl: Button, EventType: { TAP: "tap" }, getSettings: (_set, _challenge, key) => key === "useConcepts" ? true : undefined,
    getSBCPrice: () => 650, getPrice: () => 650, getPriceItems: () => ({}), isItemLocked: () => false,
    UINotificationType: { NEGATIVE: 1 }, services: { Notification: { queue() {} }, Localization: { localize: value => value } },
    window: { autoSbcConsoleApi: { runQuickBuySquad: async (set, challenge, options) => {
      buys++;
      assert.equal(set, 31); assert.equal(challenge, 61);
      assert.equal(options.scoreSbcLineup, true);
      assert.equal(options.galleryPurchaseAction, "club");
      assert.equal(options.cancelled(), false);
      assert.equal(options.squadPlayers[0].definitionId, 33);
      assert.equal(await options.validateItem(options.squadPlayers[0]), true);
    } } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";globalThis.update=updateScoreSbcBuyButton;", sandbox);
  sandbox.update(controller);
  assert.equal(controller.__scoreBuyButton.text, "Buy Concepts (1)");
  await onPress();
  assert.equal(buys, 1); assert.equal(selections, 0);
  controller.__scoreConceptPlan = { items: [{ concept: true }], set: { id: 31 }, challenge: { id: 61 }, selectedIds: "2", submittedScore: 0 };
  await onPress();
  assert.equal(buys, 1);
  assert.equal(controller.__scoreConceptPlan, null);
});

test("scoped premium 1 permits three 650-coin 83 concepts and a bronze for 1250 score", async () => {
  const sandbox = vm.createContext({
    isItemFixed: () => false,
    getPriceItems: () => ({}),
    getPrice: item => String(item.definitionId).endsWith("_CBR") ? 650 : item.marketPrice,
    getSettings: (setId, challengeId, key) => {
      assert.equal(key, "conceptPremium");
      return setId === 31 && challengeId === 61 ? 1 : 10;
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/pricing.js"), "utf8") + ";globalThis.price=getSBCPrice;", sandbox);
  const concepts = [1, 2, 3].map(id => ({ id, definitionId: id, rating: 83, concept: true, loans: -1, marketPrice: 650, sbsScore: 410 }));
  const allows = await filterFixture({ useConcepts: true, maxPlayerPrice: 650 });
  const pool = concepts.map(item => {
    const cost = sandbox.price(item, 31, 61);
    assert.equal(cost, 650);
    assert.equal(allows(item, cost), true);
    return { item, score: item.sbsScore, cost };
  });
  pool.push(candidate(4, 20, 100));
  for (const [index, score] of [180, 180, 180, 160, 140, 140, 140, 140].entries()) {
    pool.push(candidate(index + 10, score, 500));
  }
  const result = await context.optimize(pool, 1250);
  assert.equal(result.reached, true);
  assert.equal(result.score, 1250);
  assert.equal(result.cost, 2050);
  assert.deepEqual(Array.from(result.items, item => item.id).sort((left, right) => left - right), [1, 2, 3, 4]);
});

test("EA score requirements and market-price cap apply before storage overrides and discounts", async () => {
  const sandbox = vm.createContext({
    getSettings: (_set, _challenge, key) => ({ useDupes: true, useConcepts: true, maxPlayerPrice: 650, ratingRange: [40, 96] })[key],
    getPrice: item => item.marketPrice,
    getPriceItems: () => ({}), isItemLocked: () => false,
    SBCEligibilityKey: { 28: "PLAYER_MAX_OVR" },
    services: { Localization: { localize: value => value } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";globalThis.filter=createScoreSbcFilter;", sandbox);
  const allows = await sandbox.filter({ id: 31 }, {
    id: 61, eligibilityRequirements: [{ kvPairs: { _collection: { 28: [83] } }, count: 1, scope: 1 }],
  });
  const player = { id: 1, definitionId: 99, loans: -1, rating: 83, marketPrice: 650 };
  assert.equal(allows(player, 500), true);
  assert.equal(allows({ ...player, rating: 84, isStorage: true }, 200), false);
  assert.equal(allows({ ...player, marketPrice: 700 }, 500), false);
  assert.equal(allows({ ...player, marketPrice: 750, isStorage: true }, 200), false);
  assert.equal(allows({ ...player, concept: true }, 650), true);
  assert.equal(allows({ ...player, concept: true, rating: 84 }, 650), false);
  assert.equal(allows({ ...player, marketPrice: -1 }, 100), false);
});

test("purchased concepts are selected by instance ID and open review after the last purchase", async () => {
  const selected = new Set([7]);
  const state = { items: [{ id: 7, sbsScore: 20 }], currentPage: 1 };
  const challenge = { id: 61, submittedScore: 0, scoreRequirement: 1250 };
  const plan = { items: [1, 2, 3].map(id => ({ id, definitionId: id, concept: true, sbsScore: 410 })),
    set: { id: 31 }, challenge, submittedScore: 0, selectedIds: "7" };
  const model = {
    _itemTabMap: new Map(), _itemScoreMap: new Map(), _itemEntityMap: new Map([[7, state.items[0]]]),
    _tabStates: { club: state }, getActiveTab: () => "club", _currentState: () => state,
    getChallenge: () => challenge, getSet: () => plan.set,
    getSelectedItemIds: () => [...selected], getSelectionLimit: () => 30,
    getSelectedEntries: () => [...selected].map(id => ({ item: model._itemEntityMap.get(id) })),
    selectItem: item => { assert.equal(item.concept, false); selected.add(item.id); return true; },
  };
  let press;
  let reviews = 0;
  let refreshed = 0;
  class Button { init() {} getRootElement() { return {}; } addTarget(_owner, callback) { press = callback; } setText() {} setInteractionState() {} }
  const root = { isConnected: true, querySelector: selector => selector.includes("toolbar") ? { appendChild() {} } : null };
  const controller = { viewModel: model, __scoreConceptPlan: plan, __scoreOptimalPlan: true,
    getView: () => ({ getRootElement: () => root }), _refreshCurrentPage: () => refreshed++, _eReviewTap: () => reviews++ };
  const sandbox = vm.createContext({
    UTStandardButtonControl: Button, EventType: { TAP: 1 }, OneClickSBCWorkAreaTab: { CLUB: "club" },
    getSettings: (_set, _challenge, key) => key === "useConcepts" ? true : key === "autoSubmit" ? 4 : undefined,
    services: { Notification: { queue() {} } }, UINotificationType: { WARNING: 1, NEGATIVE: 2 },
    window: { autoSbcConsoleApi: { runQuickBuySquad: async (_set, _challenge, options) => {
      assert.equal(options.squadPlayers.length, 3);
      for (const [index, concept] of options.squadPlayers.entries()) {
        assert.equal(options.cancelled(), false);
        await options.onPurchased(concept, { purchasedItem: { id: 900 + concept.id, definitionId: concept.definitionId, sbsScore: 410, concept: true } });
        assert.equal(selected.has(900 + concept.id), true);
        assert.equal(plan.items.length, 2 - index);
        assert.equal(reviews, 0);
      }
      return { success: true, purchased: 3 };
    } } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";globalThis.update=updateScoreSbcBuyButton;", sandbox);
  sandbox.update(controller);
  await press();
  assert.equal(refreshed, 3);
  assert.equal(reviews, 1);
  assert.equal(controller.__scoreConceptPlan, null);
  assert.equal(state.items[0].id, 903);
  assert.equal(state.currentPage, 0);
  assert.equal(model._itemTabMap.get(901), "club");
  assert.deepEqual([...controller.__scorePurchasedDefinitions].sort(), ["1", "2", "3"]);
  assert.equal(model._itemEntityMap.get(901).concept, false);
  assert.equal(model.__scoreAutoSubmit.optimal, true);
});

test("score review auto-submit is one-shot and refuses incomplete, concept, or changed selections", async () => {
  for (const scenario of ["valid", "disabled", "partial", "concept", "changed", "squad", "not-optimal"]) {
    let submissions = 0;
    const item = { id: 1, definitionId: 99, rating: 83, loans: -1, sbsScore: scenario === "partial" ? 410 : 1250, concept: scenario === "concept" };
    const challenge = { id: 61, submittedScore: 0, scoreRequirement: 1250 };
    const model = {
      getSet: () => ({ id: 31 }), getChallenge: () => challenge,
      getSelectedItemIds: () => scenario === "changed" ? [2] : [1],
      getSelectedEntries: () => [{ item }], getSelectedInSquadCount: () => scenario === "squad" ? 1 : 0,
      __scoreAutoSubmit: { ids: "1", submittedScore: 0, optimal: scenario !== "not-optimal" },
    };
    class Review { viewDidAppear() {} _onSubmissionComplete() {} submitSelection() { submissions++; } }
    const sandbox = vm.createContext({
      console, UTOneClickSBCReviewViewController: Review,
      getSettings: (_set, _challenge, key) => key === "autoSubmit" ? scenario === "disabled" ? 0 : 4 : undefined,
      getSBCPrice: () => 650, getPriceItems: () => ({}), isItemLocked: () => false,
      services: { Localization: { localize: key => key } },
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";installScoreSbcSubmitRefresh();", sandbox);
    const review = new Review(); review.viewModel = model;
    review.viewDidAppear();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(submissions, scenario === "valid" ? 1 : 0, scenario);
    review.viewDidAppear();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(submissions, scenario === "valid" ? 1 : 0);
  }
});

test("score loop respects repeat counts, reward pack copies, and Stop", async () => {
  let repeats = 1;
  let mode = 4;
  let reopen = 0;
  const opened = [];
  let packs = [{ id: 10, isMyPack: true }, { id: 10, isMyPack: true }, { id: 20, isMyPack: true }];
  const source = fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8");
  const sandbox = vm.createContext({
    getSettings: (_set, _challenge, key) => ({ autoSubmit: mode, repeatCount: repeats, autoOpenPacks: true })[key],
    getPacks: async () => ({ packs }), repositories: { Store: { setDirty() {} } },
    openPack: async pack => { opened.push(pack.id); packs.splice(packs.indexOf(pack), 1); },
    openScoreSbcFromSidebar: async (set, id) => { assert.equal(set.id, 31); assert.equal(id, 61); reopen++; },
  });
  vm.runInContext(source.slice(source.indexOf("const scoreSbcSettingsScope ="), source.indexOf("const createScoreSbcFilter =")) + source.slice(source.indexOf("let scoreSbcRun ="), source.indexOf("const reviewScoreSbcSelection =")) + ";globalThis.run={start:startScoreSbcRun,finish:finishScoreSbcRun,stop:stopScoreSbcRun};", sandbox);
  const run = sandbox.run.start({ id: 31 }, { id: 61 });
  run.packCounts = new Map([["10", 1], ["20", 1]]);
  assert.equal(run.remaining, 2);
  await sandbox.run.finish(run, { challengeCompleted: true });
  assert.deepEqual(opened, [10]);
  assert.equal(reopen, 1);
  assert.equal(run.remaining, 1);
  run.packCounts = new Map([["10", 1], ["20", 1]]);
  await sandbox.run.finish(run, { challengeCompleted: true });
  assert.equal(reopen, 1);
  assert.equal(run.stopped, true);
  assert.equal(run.completed, 2);
  repeats = -1;
  const infinite = sandbox.run.start({ id: 31 }, { id: 61 });
  assert.equal(infinite.remaining, Infinity);
  sandbox.run.stop();
  await sandbox.run.finish(infinite, { challengeCompleted: true });
  assert.equal(reopen, 1);
  repeats = 0;
  const once = sandbox.run.start({ id: 31 }, { id: 61 });
  assert.equal(once.remaining, 1);
  await sandbox.run.finish(once, { challengeCompleted: false });
  assert.equal(once.completed, 0);
  assert.equal(once.stopped, true);
  repeats = 2;
  const disabled = sandbox.run.start({ id: 31 }, { id: 61 });
  mode = 0;
  await sandbox.run.finish(disabled, { challengeCompleted: true });
  assert.equal(reopen, 1);
  assert.equal(disabled.stopped, true);
});

test("score loop acknowledges native rewards before opening packs", async () => {
  const order = [];
  let exit;
  class Rewards {
    constructor() { this.onExit = { observe: (_owner, callback) => { exit = callback; } }; }
    onButtonTapped() { order.push("acknowledge"); shield.currentController = null; exit({ unobserve() {} }); }
  }
  const shield = { currentController: new Rewards() };
  const sandbox = vm.createContext({
    getSettings: (_set, _challenge, key) => key === "autoOpenPacks" ? true : 4,
    gPopupClickShield: shield, UTGameRewardsViewController: Rewards,
    repositories: { Store: { setDirty: () => order.push("dirty") } },
    getPacks: async () => { order.push("packs"); return { packs: [] }; },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const scoreSbcSettingsScope ="), source.indexOf("const createScoreSbcFilter =")) + source.slice(source.indexOf("let scoreSbcRun ="), source.indexOf("const reviewScoreSbcSelection =")) + ";globalThis.finish=finishScoreSbcRun;", sandbox);
  await sandbox.finish({ set: { id: 31 }, challengeId: 61, remaining: 1, completed: 0, stopped: false, packCounts: new Map() }, { challengeCompleted: true });
  assert.deepEqual(order, ["acknowledge", "dirty", "packs"]);
});

test("failed concept buying refreshes live price before re-solving without blacklisting", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8");
  for (const reason of ["conceptBuyFailed", "stopped", "no-live-price"]) {
    let solves = 0;
    let refreshedPrice = 650;
    let refreshes = 0;
    const attempts = [];
    const model = { getSelectedItemIds: () => [7], getChallenge: () => ({ submittedScore: 0 }) };
    const root = { isConnected: true, querySelector: selector => selector.includes("toolbar") ? { appendChild() {} } : null };
    class Button { init() {} getRootElement() { return {}; } addTarget() {} setText() {} setInteractionState() {} }
    const plan = definitionId => ({ items: [{ definitionId, concept: true }], set: { id: 31 }, challenge: { id: 61 }, submittedScore: 0, selectedIds: "7" });
    const controller = { viewModel: model, getView: () => ({ getRootElement: () => root }), __scoreConceptPlan: plan(77) };
    controller._eAutoSelect = async () => {
      solves++;
      assert.equal(controller.__scoreReplacingConcept, true);
      assert.equal(refreshedPrice, 850);
      assert.equal(controller.__scoreFailedConcepts, undefined);
      controller.__scoreConceptPlan = plan(88);
    };
    const sandbox = vm.createContext({
      UTStandardButtonControl: Button, EventType: { TAP: 1 }, getSettings: () => true,
      services: { Notification: { queue() {} } }, UINotificationType: { NEGATIVE: 1 },
      fetchLivePlayerPrice: async (item, options) => {
        refreshes++;
        assert.equal(item.definitionId, 77);
        assert.equal(options.maxBuy, undefined);
        if (reason === "no-live-price") return null;
        refreshedPrice = 850;
        return { _auction: { buyNowPrice: refreshedPrice } };
      },
      window: { autoSbcConsoleApi: { runQuickBuySquad: async (_set, _challenge, options) => {
        attempts.push(options.squadPlayers[0].definitionId);
        return attempts.length === 1 ? { reason: reason === "no-live-price" ? "conceptBuyFailed" : reason, failedConcept: options.squadPlayers[0], failure: { reason: "noListing" } } : { reason: "stopped" };
      } } },
    });
    vm.runInContext(source + ";globalThis.update=updateScoreSbcBuyButton;", sandbox);
    sandbox.update(controller);
    await controller.__scoreBuyAction();
    assert.equal(solves, reason === "conceptBuyFailed" ? 1 : 0);
    assert.equal(refreshes, reason === "stopped" ? 0 : 1);
    assert.deepEqual(attempts, reason === "conceptBuyFailed" ? [77, 88] : [77]);
  }
});

test("concept preview renders native selected tiles without selecting unowned items", () => {
  const sections = [];
  const grids = [];
  let indicatorResets = 0;
  const element = () => ({ style: {}, children: [], setAttribute() {},
    append(...children) { this.children.push(...children); }, remove() { this.removed = true; } });
  class Grid {
    constructor() { this.root = element(); grids.push(this); }
    init() {}
    setItems(items) {
      this.items = items;
      this._itemTileViews = items.map(() => ({ _playerView: { _bottomRightStatusIndicator: { reset() { indicatorResets++; } } } }));
    }
    getRootElement() { return this.root; }
    dealloc() { this.disposed = true; }
  }
  const body = { prepend: section => sections.push(section) };
  const selected = [{ item: { id: 7, sbsScore: 20 } }];
  const controller = {
    getView: () => ({ getRootElement: () => ({ querySelector: () => body }) }),
    viewModel: { getSelectedEntries: () => selected },
    __scoreConceptPlan: { items: [1, 2, 3].map(id => ({ id, concept: true, sbsScore: 410 })),
      challenge: { scoreRequirement: 1250, submittedScore: 0 } },
  };
  const sandbox = vm.createContext({ document: { createElement: element }, UTOneClickSBCItemGridView: Grid });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/features/solver/score-sbc.js"), "utf8") + ";globalThis.render=renderScoreSbcConceptPreview;", sandbox);
  sandbox.render(controller);
  assert.equal(grids[0].items.length, 3);
  assert.equal(indicatorResets, 3);
  assert.ok(grids[0].items.every(entry => entry.item.tradable === true));
  assert.equal(controller.__scoreConceptPlan.items[0].tradable, undefined);
  assert.ok(grids[0].items.every(entry => entry.isSelected && entry.item.concept && !entry.isInSquad));
  assert.match(sections[0].children[0].textContent, /Selected concepts \(3\).*1250\/1250/);
  assert.equal(selected.length, 1);
  controller.__scoreConceptPlan = null;
  sandbox.render(controller);
  assert.equal(grids[0].disposed, true);
  assert.equal(sections[0].removed, true);
  assert.equal(controller.__scoreConceptPreview, null);
});