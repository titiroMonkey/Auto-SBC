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
  assert.equal(allows(item, 500), true);
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
  class Controller {}
  const model = {
    _currentState: () => state,
    _itemTabMap: new Map(), _itemScoreMap: new Map(), _itemEntityMap: new Map(),
    getActiveTab: () => "storage", getChallenge: () => ({ id: 61, scoreRequirement: 2500, submittedScore: 0 }),
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
    OneClickSBCWorkAreaTab: { STORAGE: "storage", FAVOURITE: "favourite" },
    isItemLocked: () => false,
    getSettings: () => undefined,
    getPriceItems: () => ({}),
    getSBCPrice: (item, setId, challengeId) => {
      assert.equal(item.isStorage, true); assert.equal(setId, 31); assert.equal(challengeId, 61); return 1;
    },
    gClickShield: { showShield: () => shields++, hideShield: () => shields-- },
    EAClickShieldView: { Shield: { LOADING: "loading" } },
    UINotificationType: { WARNING: "warning", NEGATIVE: "negative", POSITIVE: "positive" },
    services: {
      Localization: { localize: key => key },
      Notification: { queue: message => notifications.push(message) },
      Club: { search: criteria => {
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
  assert.equal(shields, 0);
  const before = [...selected];
  fail = true;
  await controller._eAutoSelect();
  assert.deepEqual([...selected], before);
  assert.equal(notifications.at(-1)[1], "negative");
  assert.equal(shields, 0);
  assert.equal(controller.__scoreSbcBusy, false);
});