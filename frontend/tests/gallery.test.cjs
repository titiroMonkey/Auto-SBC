const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("Auto complete all respects player source and target grade with concept costs", async () => {
  const solver = vm.createContext({ setTimeout });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/data/gallery.js"), "utf8") + ";globalThis.cheapest=futGalleryCheapest;globalThis.optimize=futGalleryOptimize;globalThis.evaluate=futGalleryEvaluate;", solver);
  const context = vm.createContext({
    futGalleryCheapest: solver.cheapest,
    futGalleryOptimize: solver.optimize,
    futGalleryEvaluate: solver.evaluate,
    futGalleryEligibility: () => ({ matches: player => player.eligible }),
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const futGalleryAutoComplete ="), source.indexOf("const futGalleryShowAutoComplete =")) + ";globalThis.complete=futGalleryAutoComplete;", context);
  const item = { requiredCards: 2, grades: [{ name: "D", threshold: 90 }, { name: "C", threshold: 100 }, { name: "B", threshold: 180 }, { name: "S", threshold: 200 }] };
  const candidates = [
    { eaId: 1, score: 50, available: true, eligible: true },
    { eaId: 2, score: 50, available: true, eligible: true },
    { eaId: 3, score: 150, available: false, eligible: true },
    { eaId: 4, score: 200, available: false, eligible: false },
  ];
  const options = { price: () => 500 };
  const club = await context.complete(item, [], candidates, "club", "S", options);
  assert.equal(club.reached, false);
  assert.equal(club.cost, 0);
  const freeHigherGrade = await context.complete(item, [], candidates, "concepts", "D", options);
  assert.equal(freeHigherGrade.reached, true);
  assert.equal(freeHigherGrade.grade, "C");
  assert.equal(freeHigherGrade.cost, 0);
  assert.equal(freeHigherGrade.usedConcepts, false);
  assert.deepEqual(Array.from(freeHigherGrade.players, player => player.eaId).sort(), [1, 2]);
  const low = await context.complete(item, [], candidates, "club", "D", options);
  assert.equal(low.reached, true);
  const concepts = await context.complete(item, [], candidates, "concepts", "S", options);
  assert.equal(concepts.reached, true);
  assert.equal(concepts.cost, 500);
  assert.equal(concepts.missing.length, 1);
  assert.equal(concepts.usedConcepts, true);
  assert.equal(concepts.players.some(player => player.eaId === 4), false);
});

test("Gallery player details use native split panel methods and clean up when switching cards", () => {
  const children = new Set();
  const controllers = [];
  const documentListeners = new Map();
  const buttons = [];
  const closeOrder = [];
  const element = () => ({
    children: [],
    attributes: {},
    classList: { add() {}, remove() {} },
    style: {},
    setAttribute(name, value) { this.attributes[name] = value; }, getAttribute(name) { return this.attributes[name]; },
    addEventListener(type, callback) { this[`on${type}`] = callback; },
    append() {}, appendChild(child) { this.children.push(child); }, remove() { this.removed = true; },
    contains(target) { return target === this || target?.insidePanel === true; },
  });
  const panelRoots = [];
  class Details {
    constructor() { controllers.push(this); this.panelRoot = element(); panelRoots.push(this.panelRoot); }
    initWithIterator(iterator) { this.iterator = iterator; }
    enableSwiping(value) { assert.equal(value, false); }
    setNavigationStyle(value) { assert.equal(value, "secondary"); }
    getView() { return { getRootElement: () => this.panelRoot }; }
    viewWillAppear() {}
    viewDidAppear() { this.visible = true; }
    viewWillDisappear() {}
    viewDidDisappear() { this.visible = false; }
    dealloc() { this.disposed = true; }
  }
  const root = element();
  root.contains = target => target === root || target?.insideGallery === true;
  const splitView = { removedRight: 0, layoutPasses: 0 };
  let leftLayout = "ui-layout-left";
  root.__galleryController = {
    leftController: { getView: () => ({ addClass(value) { leftLayout = value; } }) },
    getView() { return splitView; },
    setRightController(controller) { this.rightController = controller; controller.viewDidAppear(); },
    removeRightController() {
      leftLayout = "";
      closeOrder.push("remove");
      this.rightController.viewDidDisappear();
      this.rightController = null;
      splitView.removedRight++;
      splitView.layoutPasses++;
    },
    hideRightPanel(hidden) { this.hidden = hidden; if (hidden) closeOrder.push("hide"); },
    addChildViewController: controller => children.add(controller),
    removeChildViewController: controller => children.delete(controller),
  };
  const context = vm.createContext({
    document: {
      createElement() { const button = element(); buttons.push(button); return button; },
      addEventListener(type, callback) { documentListeners.set(type, callback); },
      removeEventListener(type, callback) { if (documentListeners.get(type) === callback) documentListeners.delete(type); },
    },
    UTNavigationBarView: { Style: { SECONDARY: "secondary" } },
    enums: { UILayout: { LEFT: "ui-layout-left" } },
    UTItemDetailsNavigationController: Details,
    UTItemEntity: class { constructor(entity) { Object.assign(this, entity); } },
    EAIterator: class { constructor(items) { this.items = items; } },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  vm.runInContext(source + ";globalThis.open=futGalleryOpenPlayerDetails;", context);
  const entity = { id: 123, definitionId: 456, pile: 7, concept: false };
  context.open(root, { entity });
  assert.equal(children.size, 1);
  assert.equal(controllers[0].visible, true);
  assert.equal(root.__galleryController.rightController, controllers[0]);
  assert.equal(panelRoots[0].children.length, 1);
  assert.equal(buttons[0].getAttribute("aria-label"), "Close player details");
  assert.equal(buttons[0].title, "Close player details");
  assert.equal(typeof documentListeners.get("pointerdown"), "function");
  documentListeners.get("pointerdown")({ target: { insidePanel: true }, composedPath: () => [{ insidePanel: true }] });
  assert.equal(root.__galleryCloseDetails !== null, true);
  documentListeners.get("pointerdown")({ target: {}, composedPath: () => [] });
  assert.notEqual(root.__galleryCloseDetails, null);
  documentListeners.get("pointerdown")({ target: { insideGallery: true }, composedPath: () => [{ insideGallery: true }, root] });
  assert.equal(root.__galleryCloseDetails, null);
  assert.equal(controllers[0].disposed, true);
  assert.equal(root.__galleryController.rightController, null);
  assert.equal(leftLayout, "ui-layout-left");
  assert.deepEqual(closeOrder.splice(0), ["hide", "remove"]);
  assert.equal(splitView.removedRight, 1);
  assert.equal(splitView.layoutPasses, 1);
  assert.equal(documentListeners.has("pointerdown"), false);
  context.open(root, { entity });
  buttons[1].onclick({ preventDefault() {}, stopPropagation() {} });
  assert.equal(root.__galleryCloseDetails, null);
  assert.equal(controllers[1].disposed, true);
  assert.equal(root.__galleryController.rightController, null);
  assert.equal(root.__galleryController.hidden, true);
  assert.equal(splitView.layoutPasses, 2);
  context.open(root, { entity });
  assert.equal(panelRoots[2].children.length, 1);
  const playerMedia = { classList: { contains: name => name === "fg-player-media" } };
  documentListeners.get("pointerdown")({ target: playerMedia, composedPath: () => [playerMedia] });
  assert.notEqual(root.__galleryCloseDetails, null);
  assert.equal(controllers[2].disposed, undefined);
  context.open(root, { entity: { definitionId: 789, concept: true } });
  assert.equal(children.size, 1);
  assert.equal(controllers[2].disposed, true);
  assert.equal(controllers[3].iterator.items[0].concept, true);
  assert.equal(root.__galleryController.hidden, false);
  root.__galleryCloseDetails();
  assert.equal(children.size, 0);
  assert.equal(root.__galleryController.hidden, true);
  assert.equal(controllers[3].disposed, true);
  assert.equal(root.__galleryCloseDetails, null);
  assert.equal(entity.pile, 7);
});

test("Collection Book and Gallery use EA split controllers with reusable left content", () => {
  const root = {};
  function Split() { this.children = []; }
  Split.prototype.addChildViewController = function (child) { this.children.push(child); };
  Split.prototype.setLeftController = function (child) { this.leftController = child; };
  Split.prototype.hideRightPanel = function (hidden) { this.hidden = hidden; };
  function Content() {}
  Content.prototype.init = function () { this.initialized = true; };
  Content.prototype.getView = function () { return { getRootElement: () => root, addClass: value => { this.layoutClass = value; } }; };
  const context = vm.createContext({
    enums: { UILayout: { LEFT: "ui-layout-left" } },
    UTSplitViewController: Split,
    EAViewController: Content,
    EAView: function () {},
    UTHomeHubViewController: function () { throw new Error("Home Hub requires its tiles"); },
    UTHomeHubView: function () { throw new Error("Home Hub requires its tiles"); },
    JSUtils: { inherits(child, parent) { child.prototype = Object.create(parent.prototype); child.prototype.constructor = child; } },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/nav.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("// --- EA controller / view")) +
    ";globalThis.controllers=[collectionBookController,futGalleryController];globalThis.mount=collectionBookMountNativeContent;", context);
  for (const Controller of context.controllers) {
    const owner = new Controller();
    assert.ok(owner instanceof Split);
    assert.ok(owner.createCollectionContentView() instanceof context.EAView);
    assert.equal(context.mount(owner), root);
    assert.ok(owner.leftController instanceof Content);
    assert.equal(owner.leftController.initialized, true);
    assert.equal(owner.leftController.layoutClass, "ui-layout-left");
    assert.equal(owner.hidden, true);
    owner.rightController = {};
    context.mount(owner);
    assert.equal(owner.children.length, 1);
    assert.equal(owner.hidden, false);
  }
});

test("Collection Book overlapping builds render only the latest page", async () => {
  const ownership = [];
  const lists = [];
  const root = {
    children: [],
    set innerHTML(value) { this.children = []; },
    appendChild(child) { this.children.push(child); },
    classList: { toggle() {} },
  };
  const context = vm.createContext({
    collectionBookEnsureStyles() {},
    _collectionBookSections: new Map(),
    collectionBookFetchOwnership: () => new Promise(resolve => ownership.push(resolve)),
    collectionBookFetchList: () => new Promise(resolve => lists.push(resolve)),
    COLLECTION_BOOK_ONLY_CLUB_KEY: "club",
    document: {
      createElement: () => ({ classList: { add() {} }, appendChild() {}, addEventListener() {}, remove() {} }),
      createTextNode: text => text,
    },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/nav.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const collectionBookBuildPage ="), source.indexOf('window.addEventListener("autosbc:concepts-ready"')) + ";globalThis.build=collectionBookBuildPage;", context);
  const first = context.build(root);
  const second = context.build(root);
  ownership[0]();
  await first;
  assert.equal(root.children.length, 0);
  ownership[1]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(root.children.length, 2);
  const third = context.build(root);
  ownership[2]();
  await new Promise(resolve => setImmediate(resolve));
  lists[0]([]);
  await second;
  assert.equal(root.children.length, 2);
  lists[1]([]);
  await third;
  assert.equal(root.children.length, 3);
});

test("Collection Book card route opens local native details without Unassigned navigation", () => {
  const entity = { id: 123, definitionId: 456, pile: 7 };
  const root = { __galleryController: {} };
  const opened = [];
  const context = vm.createContext({
    document: { getElementById: id => { assert.equal(id, "CollectionBookPanel"); return root; } },
    collectionBookGetItemEntity: id => id === 456 ? entity : null,
    futGalleryEnsureStyles() {},
    futGalleryOpenPlayerDetails: (panel, player) => opened.push({ panel, entity: player.entity }),
    getCurrentViewController: () => { throw new Error("Must not navigate to Unassigned"); },
    console,
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/nav.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const collectionBookOpenNativeSidebar ="), source.indexOf("// Build a live EA item view")) + ";globalThis.open=collectionBookOpenNativeSidebar;", context);
  context.open({ player: { eaId: 456 } });
  assert.equal(opened.length, 1);
  assert.equal(opened[0].panel, root);
  assert.equal(opened[0].entity, entity);
  context.open({ player: { eaId: 789 } });
  assert.equal(opened.length, 1);
});

const load = (globals = {}) => {
  const context = vm.createContext({ setTimeout, ...globals });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/data/gallery.js"), "utf8") +
    ";globalThis.api={evaluate:futGalleryEvaluate,tag:futGalleryEvaluateTag,playerTagBonus:futGalleryPlayerTagBonus,optimize:futGalleryOptimize,cheapest:futGalleryCheapest,categories:futGalleryCategories,icons:futGalleryIconUrls,eligible:futGalleryEligibility,candidates:futGalleryGetCandidates,loan:futGalleryIsLoan,load:futGalleryLoadCatalogue,isVariant:futGalleryIsVariantItem,price:futGalleryPrice,enrichMarketPrices:futGalleryEnrichMarketPrices,fetchVariantPrice:futGalleryFetchVariantPrice,fetchVariantPriceData:futGalleryFetchVariantPriceData,addPristineVariants:futGalleryAddPristineVariants,enrichVariantPrices:futGalleryEnrichVariantPrices,refreshConceptPrices:futGalleryRefreshConceptPrices};", context);
  return context.api;
};
const player = (eaId, score, fields = {}) => ({ eaId, score, rating: 80, positions: [], nationId: 1, clubId: 1, leagueId: 1, rarityId: 0, playerId: eaId, ...fields });
const loadRewardPlanner = () => {
  const context = vm.createContext({ setTimeout });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/data/gallery.js"), "utf8") + ";globalThis.plan=futGalleryPlanRewards;globalThis.reward=futGalleryRewardAmount;globalThis.maxScore=futGalleryMaxScoreWithinBudget;", context);
  return context;
};

test("Gallery refreshes cached prices for every concept in the current lineup", async () => {
  const requests = [];
  const context = vm.createContext({
    setTimeout,
    window: { getAutoSbcConceptPlayers: () => [{ definitionId: 10, concept: true }] },
    fetchPlayerPrices: async (players, options) => requests.push({ players, options }),
    fetchFutggSignedJson: async () => ({ data: { currentPrice: { price: 250 } } }),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/data/gallery.js"), "utf8") +
    ";globalThis.refresh=futGalleryRefreshConceptPrices;", context);
  const lineup = [
    { eaId: 10, inClub: false, isVariantItem: false, entity: { definitionId: 10 } },
    { eaId: 20, inClub: false, isVariantItem: true, itemDefinitionId: 20, entity: { definitionId: 20 } },
    { eaId: 30, inClub: true, isVariantItem: false, entity: { definitionId: 30 } },
  ];

  assert.equal(await context.refresh(lineup), 2);
  assert.equal(requests[0].players.length, 1);
  assert.equal(requests[0].players[0].definitionId, 10);
  assert.equal(requests[0].options.force, true);
  assert.equal(requests[0].options.throttleProfile, "concept");
  assert.equal(requests[0].options.waitForCompletion, true);
  assert.equal(lineup[1].variantPrice, 250);
  assert.equal(lineup[1].variantPriceResolved, true);
});

test("Max Gems maximizes complete-set score directly within its budget without requiring a grade", async () => {
  const api = loadRewardPlanner();
  const set = { requiredCards: 2, grades: [{ name: "S", threshold: 1000, rewards: [] }] };
  const candidates = [
    player(1, 60, { available: true }),
    player(2, 90, { available: false }),
    player(3, 100, { available: false }),
  ];
  const result = await api.maxScore(set, [], candidates, 20, { price: item => item.eaId === 2 ? 20 : 50 });
  assert.equal(result.reached, true);
  assert.equal(result.grade, null);
  assert.equal(result.cost, 20);
  assert.equal(api.reward(set, { complete: true, totalScore: 150 }, "gems"), 150);
});

test("Gallery budget planner counts complete sets only and buys shared players once", async () => {
  const api = loadRewardPlanner();
  const grades = [{ name: "S", threshold: 100, rewards: [{ type: "event_token_1", value: 10, count: 1 }] }];
  const sets = [{ id: 1, clubEaId: 1, requiredCards: 1, name: "First", grades }, { id: 2, clubEaId: 1, requiredCards: 1, name: "Second", grades }];
  const candidates = [player(1, 100, { price: 500, available: false })];
  assert.equal(api.reward(sets[0], { complete: false, totalScore: 100 }, "tokens"), 0);
  const result = await api.plan(sets, [], candidates, "tokens", 500, { price: item => item.price });
  assert.equal(result.reward, 20);
  assert.equal(result.cost, 500);
  assert.equal(result.purchases.length, 1);
  assert.equal(result.sets.length, 2);
  const tooSmall = await api.plan(sets, [], candidates, "tokens", 499, { price: item => item.price });
  assert.equal(tooSmall.reward, 0);
});

test("Gallery reward planner reports the current grade before solving", async () => {
  const api = loadRewardPlanner();
  const events = [];
  const set = { id: 1, name: "Arsenal", clubEaId: 1, requiredCards: 1, grades: [{ name: "S", threshold: 100, rewards: [{ type: "event_token_1", value: 10, count: 1 }] }] };
  await api.plan([set], [], [], "tokens", 1000, {
    progress: (completed, total, message) => events.push({ completed, total, message }),
    solve: async () => {
      assert.match(events.at(-1).message, /Arsenal: calculating grade S/);
      assert.equal(events.at(-1).completed, 0);
      return { reached: false };
    },
  });
  assert.match(events[0].message, /Checking Arsenal/);
  assert.equal(events.at(-1).completed, 1);
});

test("Gallery Max Gems portfolio optimizes score without progress by grade", async () => {
  const api = loadRewardPlanner();
  const events = [];
  const set = { id: 4, name: "Score Set", clubEaId: 1, requiredCards: 2, grades: [{ name: "S", threshold: 1000, rewards: [] }] };
  const candidates = Array.from({ length: 46 }, (_, index) => player(index + 1, index + 1, { clubId: 1, available: true }));
  const result = await api.plan([set], [], candidates, "gems", 0, {
    progress: (_completed, _total, message) => events.push(message),
    solve: async () => { throw new Error("Gems must not use grade solving"); },
    portfolioSolver: async payload => {
      assert.equal(payload.choices.length, 1);
      assert.equal(payload.choices[0].reward, 91);
      return { status: "OPTIMAL", selectedIndexes: [0], reward: 91, cost: 0, optimal: true };
    },
  });
  assert.equal(result.reward, 91);
  assert.equal(events.some(message => /grade/i.test(message)), false);
  assert.ok(events.some(message => /maximising score within budget/i.test(message)));
});

test("Gallery maps complete choices through the backend portfolio solver", async () => {
  const api = loadRewardPlanner();
  const set = { id: 9, name: "Test", clubEaId: 1, requiredCards: 1, grades: [{ name: "S", threshold: 100, rewards: [{ type: "event_token_1", value: 10, count: 1 }] }] };
  const result = await api.plan([set], [], [player(44, 100, { price: 500 })], "tokens", 500, {
    price: item => item.price,
    portfolioSolver: async payload => {
      assert.equal(payload.choices[0].requiredCards, 1);
      assert.equal(payload.choices[0].playerIds[0], 44);
      assert.equal(payload.choices[0].purchases[0].cost, 500);
      return { status: "OPTIMAL", selectedIndexes: [0], reward: 10, cost: 500, optimal: true, scope: "supplied complete lineup choices" };
    },
  });
  assert.equal(result.solverStatus, "OPTIMAL");
  assert.equal(result.sets[0].set.id, 9);
  assert.equal(result.purchases.length, 1);
  assert.equal(result.remaining, 0);
});

test("Gallery reward planner excludes incomplete and unpriced sets and separates gems from tokens", async () => {
  const api = loadRewardPlanner();
  const grades = [{ name: "S", threshold: 100, rewards: [{ type: "gem", value: 3, count: 2 }, { type: "event_token_1", value: 10, count: 1 }] }];
  const sets = [{ id: 1, clubEaId: 1, requiredCards: 2, grades }];
  const candidates = [player(1, 100, { available: true }), player(2, 100, { available: false })];
  const result = await api.plan(sets, [], candidates, "gems", 1000, { price: item => item.price });
  assert.equal(result.reward, 0);
  candidates[1].price = 200;
  const complete = await api.plan(sets, [], candidates, "gems", 200, { price: item => item.price });
  assert.equal(complete.reward, 200);
  assert.equal(complete.remaining, 0);
  const tokens = await api.plan(sets, [], candidates, "tokens", 200, { price: item => item.price });
  assert.equal(tokens.reward, 10);
});
const set = { requiredCards: 2, grades: [{ name: "D", threshold: 200, rewards: [] }, { name: "S", threshold: 300, rewards: [{ type: "event_token_1", count: 1, value: 5 }] }] };
const tag = (type, attribute, bonus = 10, minItems = 2) => ({ id: 1, name: "Test tag", rules: [{ type, attribute, values: ["gold"] }], tiers: [{ minItems, bonus }] });

test("Gallery keeps FUT.GG holographic item prices separate from standard EA prices", async () => {
  const requested = [];
  const globals = {
    getPrice: () => 14000000,
    fetchFutggSignedJson: async path => {
      requested.push(path);
      return { data: { currentPrice: { price: path.includes("67146440") ? 13965000 : 14350000 }, priceRange: { minPrice: 150, maxPrice: 15000000 } } };
    },
  };
  const api = load(globals);
  const standard = { eaId: 37576, entity: { definitionId: 37576, databaseId: 37576 } };
  const pristine = {
    eaId: 67146440,
    entity: { definitionId: 67146440, databaseId: 37576, holographicType: "pristine" },
    isVariantItem: true,
  };

  assert.equal(api.isVariant(pristine.entity, pristine.eaId), true);
  assert.equal(api.price(standard), 14000000);
  assert.ok(Number.isNaN(api.price(pristine)));
  pristine.variantPrice = await api.fetchVariantPrice(pristine.eaId, { holographicType: "pristine" });
  assert.equal(pristine.variantPrice, 13965000);
  assert.equal((await api.fetchVariantPriceData(pristine.eaId, { holographicType: "pristine" })).maxPrice, 15000000);
  assert.equal(api.price(pristine), 13965000);
  assert.deepEqual(requested, ["/api/fut/player-prices/27/67146440/"]);
});

test("Gallery candidate construction retains EA holographic item identity", () => {
  const standard = { id: 37576, definitionId: 37576, databaseId: 37576, subtype: 3, sbsScore: 45000, rating: 94, _staticData: { name: "Ronaldo" } };
  const pristine = { id: 67146440, definitionId: 67146440, databaseId: 37576, subtype: 3, holographicType: "pristine", sbsScore: 67500, rating: 94, _staticData: { name: "Ronaldo" } };
  const api = load({ window: { autoSbcConceptPlayers: [standard, pristine], __clubPlayersEntries: [] } });
  const candidates = api.candidates();

  assert.deepEqual(Array.from(candidates, item => item.eaId), [37576, 67146440]);
  assert.equal(candidates[0].isVariantItem, false);
  assert.equal(candidates[1].isVariantItem, true);
  assert.equal(candidates[1].itemDefinitionId, 67146440);
});

test("Gallery enrichment fetches and stores only the exact variant price", async () => {
  const requested = [];
  const api = load({
    fetchFutggSignedJson: async path => {
      requested.push(path);
      return { data: { currentPrice: { price: 13965000 } } };
    },
  });
  const standard = { eaId: 37576, itemDefinitionId: 37576, isVariantItem: false, available: false };
  const pristine = { eaId: 67146440, itemDefinitionId: 67146440, isVariantItem: true, available: false, holographicType: "pristine" };

  await api.enrichVariantPrices([standard, pristine]);

  assert.deepEqual(requested, ["/api/fut/player-prices/27/67146440/"]);
  assert.equal(standard.variantPrice, undefined);
  assert.equal(pristine.variantPrice, 13965000);
  assert.equal(pristine.purchaseCost, 13965000);
});

test("Gallery fetches missing market prices only for unowned players matching the set", async () => {
  const fetched = [];
  const api = load({
    getPrice: entity => entity?.price,
    window: { collectionBookFetchMissingPrices: async players => fetched.push(...players) },
  });
  const players = [
    { eaId: 1, available: false, entity: { definitionId: 1, price: null } },
    { eaId: 2, available: false, entity: { definitionId: 2, price: 2500 } },
    { eaId: 3, available: true, entity: { definitionId: 3, price: null } },
    { eaId: 4, available: false, entity: { definitionId: 4, price: null } },
  ];

  await api.enrichMarketPrices(players, { matches: player => player.eaId !== 4 });

  assert.deepEqual(Array.from(fetched, player => player.eaId), [1]);
});

test("Gallery gets Pristine variants from EA concepts and prices their own item ID", async () => {
  const requested = [];
  const api = load({
    fetchFutggSignedJson: async path => {
      requested.push(path);
      assert.equal(path, "/api/fut/player-prices/27/67146440/");
      return { data: { currentPrice: { price: 13965000 }, priceRange: { minPrice: 150, maxPrice: 15000000 } } };
    },
    makeGetRequest: async () => { throw new Error("variant discovery should use cached EA concepts"); },
    searchEaConceptEntitiesByDefIds: async () => { throw new Error("no secondary concept lookup expected"); },
    window: { autoSbcConceptPlayers: [
      { id: 37576, definitionId: 37576, databaseId: 37576, sbsScore: 45000, rating: 94, _staticData: { name: "Ronaldo" } },
      { id: 67146440, definitionId: 67146440, databaseId: 37576, holographicType: "pristine", sbsScore: 67500, rating: 94, _staticData: { name: "Ronaldo" } },
    ] },
  });
  const candidates = await api.enrichVariantPrices(api.candidates());

  assert.deepEqual(Array.from(candidates, candidate => candidate.eaId), [37576, 67146440]);
  assert.equal(candidates[0].holographicType, null);
  assert.equal(candidates[1].holographicType, "pristine");
  assert.equal(candidates[1].holographic, true);
  assert.equal(candidates[1].variantPrice, 13965000);
  assert.equal(candidates[1].maxPrice, 15000000);
  assert.equal(candidates[1].available, false);
  assert.deepEqual(requested, ["/api/fut/player-prices/27/67146440/"]);
});

test("manual seen states persist and override automatic ownership counts", () => {
  const stored = new Map();
  const events = [];
  const rebuilds = [];
  const context = vm.createContext({
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    window: { dispatchEvent: event => { events.push(event.type); assert.equal(event.detail.manual, true); },
      __collectionBookOnClubUpdate: (_counts, options) => rebuilds.push(options.rebuild) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    collectionBookGetOwnedCounts: () => new Map(),
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/data/collection-book.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const COLLECTION_BOOK_MANUAL_SEEN_KEY"), source.indexOf("let _collectionBookOwnershipCounts")) + ";globalThis.manual={set:collectionBookSetManualSeen,get:collectionBookGetManualSeen,apply:collectionBookApplyManualSeenCounts};", context);
  const api = context.manual;
  api.set(77, "unseen");
  assert.equal(api.apply(new Map([[77, 3]])).has(77), false);
  api.set(77, "seen");
  assert.equal(api.apply(new Map()).get(77), 1);
  assert.equal(api.apply(new Map([[77, 1]]), true).has(77), false);
  api.set(77, "firstOwner");
  assert.equal(api.apply(new Map(), true).get(77), 1);
  assert.equal(api.get(77), "firstOwner");
  assert.deepEqual(events, ["autosbc:ownership-ready", "autosbc:ownership-ready", "autosbc:ownership-ready"]);
  assert.deepEqual(rebuilds, [true, true, true]);
});

test("transfer-list observations record players but not consumables", async () => {
  const recorded = [];
  const context = vm.createContext({ collectionBookRecordOwnership: async items => recorded.push(...items) });
  const source = fs.readFileSync(path.join(__dirname, "../src/data/collection-book.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const collectionBookRecordTransferPlayers ="), source.indexOf("const collectionBookRecordOwnership =")) + ";globalThis.record=collectionBookRecordTransferPlayers;", context);
  await context.record([
    { id: 1, isPlayer: () => true },
    { id: 2, isPlayer: () => false },
    { id: 3, getSearchType: () => "player" },
    { id: 4, getSearchType: () => "consumable" },
  ]);
  assert.deepEqual(recorded.map(item => item.id), [1, 3]);
});

test("transfer-list fetch records seen players before returning to Gallery", async () => {
  const items = [{ id: 7, definitionId: 77 }];
  let finishRecording;
  let returned = false;
  const context = vm.createContext({
    services: { Item: { requestTransferItems: () => ({ observe(_owner, callback) {
      void callback(null, { response: { items } });
    } }) } },
    collectionBookRecordTransferPlayers: values => {
      assert.equal(values[0], items[0]);
      return new Promise(resolve => { finishRecording = resolve; });
    },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/unassigned/fetchers.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("let fetchTransferList ="), source.indexOf("let clearSoldItems =")) + ";globalThis.fetchList=fetchTransferList;", context);
  const request = context.fetchList().then(values => { returned = true; return values; });
  await Promise.resolve();
  assert.equal(returned, false);
  finishRecording();
  assert.deepEqual(Array.from(await request), items);
  const gallery = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  assert.match(gallery, /await fetchTransferList\(\)/);
  assert.ok(gallery.indexOf("await fetchTransferList()") < gallery.indexOf("let candidates = futGalleryGetCandidates()"));
});

test("app initialization scans transfer-list players and tolerates failures", async () => {
  let requests = 0;
  let fail = false;
  const warnings = [];
  const context = vm.createContext({
    fetchTransferList: async () => { requests++; if (fail) throw new Error("EA unavailable"); },
    console: { warn: (...args) => warnings.push(args) },
  });
  const source = fs.readFileSync(path.join(__dirname, "../src/core/init.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const refreshTransferListSeenOnStartup ="), source.indexOf("const init =")) + ";globalThis.refresh=refreshTransferListSeenOnStartup;", context);
  await context.refresh();
  assert.equal(requests, 1);
  assert.equal(warnings.length, 0);
  fail = true;
  await context.refresh();
  assert.equal(requests, 2);
  assert.equal(warnings.length, 1);
  assert.match(source, /\["Record transfer-list players as seen \(background\)", refreshTransferListSeenOnStartup\]/);
});

test("loan and timed-only club entries do not count as Gallery ownership", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/collection-book.js"), "utf8");
  const window = { __clubPlayersEntries: [
    { definitionId: 1, itemAttributes: { loans: 7 } },
    { definitionId: 2, loans: 0 },
    { definitionId: 3, itemAttributes: { loans: -1 } },
    { definitionId: 4, itemAttributes: { isLoan: () => true } },
    { definitionId: 6, itemAttributes: { loans: -1, isTimeLimited: () => true } },
    { definitionId: 7, itemAttributes: { loans: -1, isTimeLimited: true } },
  ], autoSbcConceptPlayers: [1, 2, 3, 4, 5, 6, 7].map(definitionId => ({ definitionId, loans: -1, sbsScore: 100,
    ...(definitionId === 6 ? { isTimeLimited: () => true } : {}),
    ...(definitionId === 7 ? { isTimeLimited: true } : {}),
  })) };
  const context = vm.createContext({ window, Map, _collectionBookOwnershipCounts: new Map([[5, 1]]) });
  vm.runInContext(source.slice(source.indexOf("const collectionBookIsTimeLimited ="), source.indexOf("const collectionBookGetClubCounts =")) + ";globalThis.counts=collectionBookGetOwnedCounts;", context);
  const candidates = load({ window, collectionBookGetOwnedCounts: context.counts }).candidates();
  assert.deepEqual(Array.from(candidates.filter(value => value.available), value => value.eaId), [3, 5]);
  assert.deepEqual(Array.from(candidates, value => value.eaId).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test("opening a Gallery set removes saved loan and time-limited players", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({
    futGalleryIsLoan: item => typeof item?.isLoan === "function" ? item.isLoan() : Number(item?.loans ?? -1) >= 0,
    futGalleryIsTimeLimited: item => (typeof item?.isTimeLimited === "function" ? item.isTimeLimited() : item?.isTimeLimited === true) || Number(item?.limitedUseType) > 1,
  });
  vm.runInContext(source.slice(0, source.indexOf("const futGallerySetBadge")) + ";globalThis.filter=futGalleryUsableSetPlayers;", context);
  const candidates = [
    { eaId: 1, entity: { loans: -1 } },
    { eaId: 2, entity: { loans: 3 } },
    { eaId: 3, entity: { loans: -1, isTimeLimited: true } },
    { eaId: 4, isLoan: () => true, entity: { loans: -1 } },
    { eaId: 5, entity: { loans: -1, limitedUseType: 2 } },
  ];
  assert.deepEqual(Array.from(context.filter(candidates), player => player.eaId), [1]);
  assert.match(source, /candidates = futGalleryUsableSetPlayers\(candidates\)/);
});

test("Gallery recognizes timed limited-use items and prunes their saved lineup IDs", () => {
  const context = vm.createContext({ setTimeout, window: {
    autoSbcConceptPlayers: [{ definitionId: 10, loans: -1, limitedUseType: 2 }],
    __clubPlayersEntries: [{ definitionId: 11, itemAttributes: { loans: -1, limitedUseType: 2 } }],
  } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/data/gallery.js"), "utf8") + ";globalThis.isTimed=futGalleryIsTimeLimited;", context);
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.prune=futGalleryPruneTimedLoanPlans;", context);
  const plans = { set: { ids: [10, 11, 12] } };

  assert.equal(context.isTimed({ limitedUseType: 2 }), true);
  assert.equal(context.isTimed({ limitedUseType: 1 }), false);
  assert.equal(context.prune(plans, []), true);
  assert.deepEqual(Array.from(plans.set.ids), [12]);

  const stillUsable = { set: { ids: [10, 11] } };
  assert.equal(context.prune(stillUsable, [{ eaId: 10 }]), true);
  assert.deepEqual(Array.from(stillUsable.set.ids), [10]);
});

test("eligible players sort price, rating and score in both directions with unknowns last", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.sort=futGallerySortPlayers;", context);
  const players = [
    { eaId: 1, name: "Alpha", price: 300, rating: 80, score: 20 },
    { eaId: 2, name: "Beta", price: 100, rating: 90, score: 10 },
    { eaId: 3, name: "Gamma", price: 0, rating: null, score: null },
  ];
  for (const [type, ascendingIds, descendingIds] of [
    ["price", [2, 1, 3], [1, 2, 3]],
    ["rating", [1, 2, 3], [2, 1, 3]],
    ["score", [2, 1, 3], [1, 2, 3]],
  ]) {
    assert.deepEqual(Array.from(context.sort(players, type, true, player => player.price), player => player.eaId), ascendingIds);
    assert.deepEqual(Array.from(context.sort(players, type, false, player => player.price), player => player.eaId), descendingIds);
  }
  assert.deepEqual(players.map(player => player.eaId), [1, 2, 3]);
});

test("Gallery purchase metric counts missing concepts and flags unknown prices", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.cost=futGalleryPurchaseCost;", context);
  const players = [
    { eaId: 1, available: true, price: 10000 },
    { eaId: 2, available: false, price: 2500 },
    { eaId: 2, available: false, price: 2500 },
    { eaId: 3, available: false, price: 0 },
    { eaId: 4, available: false, price: 6000 },
  ];
  const cost = context.cost(players, new Set([4]), player => player.price);
  assert.equal(cost.total, 2500);
  assert.equal(cost.count, 2);
  assert.equal(cost.unpriced, 1);
  assert.equal(context.cost([], new Set(), () => NaN).total, 0);
  for (const price of [NaN, Infinity, -1, undefined]) {
    assert.equal(context.cost([{ eaId: 1 }], new Set(), () => price).unpriced, 1);
  }
});

test("bonus rounding uses only matching items", () => {
  const result = load().tag(tag("COUNT", "LEVEL", 3), [player(1, 101), player(2, 102), player(3, 1000, { rating: 60 })]);
  assert.equal(result.bonus, 6);
  assert.equal(result.count, 2);
});

test("First Owner follows FUT.GG item-count tiers", () => {
  const api = load();
  const firstOwnerTag = {
    id: 7, name: "First Owner", rules: [{ type: "COUNT", attribute: "FIRST_OWNED", values: ["true"] }],
    tiers: [{ minItems: 5, bonus: 150 }, { minItems: 10, bonus: 300 }, { minItems: 20, bonus: 500 }],
  };
  const lineup = count => Array.from({ length: count }, (_, index) => player(index + 1, 100, { firstOwner: true }));
  const five = api.tag(firstOwnerTag, lineup(5));
  const ten = api.tag(firstOwnerTag, lineup(10));
  const twenty = api.tag(firstOwnerTag, lineup(20));

  assert.equal(five.percent, 150);
  assert.equal(five.bonus, 750);
  assert.equal(ten.percent, 300);
  assert.equal(ten.bonus, 3000);
  assert.equal(twenty.percent, 500);
  assert.equal(twenty.bonus, 10000);
  assert.equal(api.tag(firstOwnerTag, lineup(4)).bonus, 0);
  assert.equal(api.tag(firstOwnerTag, [player(4, 100, { firstOwner: false })]).bonus, 0);
});

test("Bonus tag tier progress reports current tier and next threshold", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.progress=futGalleryGetTierProgress;", context);
  const tiers = [{ minItems: 5, bonus: 150 }, { minItems: 10, bonus: 300 }, { minItems: 20, bonus: 500 }];

  const belowFirst = context.progress({ count: 4, tiers });
  assert.equal(belowFirst.fillPercent, 20);
  assert.equal(belowFirst.currentTierIndex, -1);
  assert.equal(belowFirst.remaining, 1);

  const middle = context.progress({ count: 10, tiers });
  assert.equal(middle.fillPercent, 50);
  assert.equal(middle.currentTierIndex, 1);
  assert.equal(middle.remaining, 10);

  const maximum = context.progress({ count: 25, tiers });
  assert.equal(maximum.fillPercent, 100);
  assert.equal(maximum.currentTierIndex, 2);
  assert.equal(maximum.remaining, 0);
  assert.match(source, /aria-valuetext/);
  assert.match(source, /fg-tier-marker/);
});

test("Starter Set screenshot matches FUT.GG with the same first-owner flags", () => {
  const api = load();
  const players = [14000, 14000, 11000, 11000, 11000].map((score, index) => player(index + 1, score, {
    clubId: index + 1, nationId: index + 1, leagueId: index + 1, firstOwner: false,
  }));
  const tags = [tag("COUNT_DIFF", "NATION", 1, 5), tag("COUNT_DIFF", "CLUB", 1, 5), tag("COUNT_DIFF", "LEAGUEID", 1, 5), tag("COUNT", "LEVEL", 1, 5), tag("COUNT", "FIRST_OWNED", 150, 5)];
  const starter = { ...set, requiredCards: 5 };
  const result = api.evaluate(starter, tags, players);
  assert.equal(result.baseScore, 61000);
  assert.equal(result.bonusScore, 2440);
  assert.equal(result.totalScore, 63440);
  assert.equal(result.bonuses.filter(value => value.paid).length, 4);
  assert.equal(api.evaluate(starter, tags, players.map(value => ({ ...value, firstOwner: true }))).totalScore, 154940);
});

test("club eligibility applies FUT.GG women-only requirements without restricting mixed sets", () => {
  const api = load();
  const women = api.eligible({ clubEaId: 88, description: "Requires 15 Birmingham City Women's players to complete." }, []);
  assert.equal(women.matches({ clubId: 88, gender: 1 }), true);
  assert.equal(women.matches({ clubId: 88, gender: 0 }), false);
  assert.equal(women.matches({ clubId: 88 }), false);
  assert.equal(women.matches({ clubId: 99, gender: 1 }), false);
  const mixed = api.eligible({ clubEaId: 1, description: "Requires 20 Arsenal Mens or Womens players to complete." }, []);
  assert.equal(mixed.matches({ clubId: 1, gender: 0 }), true);
  assert.equal(mixed.matches({ clubId: 116009, eligibilityClubId: 1, gender: 1 }), true);
  const men = api.eligible({ clubEaId: 88, description: "Requires Birmingham City Men's players." }, []);
  assert.equal(men.matches({ clubId: 88, gender: 0 }), true);
  assert.equal(men.matches({ clubId: 88, gender: 1 }), false);
});

test("linked clubs share set eligibility but retain separate club bonus groups", () => {
  const api = load({
    window: { autoSbcConceptPlayers: [1, 2].map(teamId => ({ definitionId: teamId, teamId, sbsScore: 100, loans: -1 })) },
    UTSquadChemCalculatorUtils: class { normalizeClubId() { return 1; } },
    repositories: { TeamConfig: {} },
  });
  const candidates = api.candidates();
  assert.equal(candidates.filter(api.eligible({ clubEaId: 1 }, []).matches).length, 2);
  assert.equal(api.tag(tag("COUNT_DIFF", "CLUB"), candidates).count, 2);
  assert.equal(api.tag(tag("MAX_COUNT_ALL_SAME", "CLUB"), candidates).count, 1);
});

test("different groups count their highest scoring representative", () => {
  const result = load().tag(tag("COUNT_DIFF", "NATION"), [player(1, 100), player(2, 200), player(3, 80, { nationId: 2 })]);
  assert.equal(result.bonus, 28);
  assert.equal(result.count, 2);
});

test("only ten tags pay; grades require all slots; rewards accumulate", () => {
  const api = load();
  const tags = Array.from({ length: 12 }, (_, index) => ({ ...tag("COUNT", "LEVEL"), id: index }));
  const result = api.evaluate(set, tags, [player(1, 100), player(2, 100)]);
  assert.equal(result.bonusScore, 200);
  assert.equal(result.grade, "S");
  assert.equal(result.tokens, 5);
  assert.equal(api.evaluate(set, [], [player(1, 10000)]).grade, null);
  assert.equal(api.evaluate(set, [], [player(1, 200), player(2, null)]).grade, null);
  assert.equal(api.evaluate(set, [], [player(1, 100), player(2, 100)]).grade, "D");
});

test("optimizer finds bonus-aware optimum without duplicate definitions", async () => {
  const api = load();
  const players = [player(1, 100), player(2, 90, { nationId: 2 }), player(3, 80, { nationId: 2 }), player(3, 80, { nationId: 2 })];
  const result = await api.optimize(set, [tag("MAX_COUNT_ALL_SAME", "NATION", 100)], players);
  assert.deepEqual(Array.from(result.players, value => value.eaId), [2, 3]);
  assert.equal(result.optimal, true);
});

test("large search can stop and returns a bounded best-found result", async () => {
  const api = load();
  const players = Array.from({ length: 40 }, (_, index) => player(index + 1, 1000 - index, { nationId: index % 5 + 1 }));
  const largeSet = { ...set, requiredCards: 10 };
  const tags = [tag("MAX_COUNT_ALL_SAME", "NATION", 20, 5)];
  assert.equal(await api.optimize(largeSet, tags, players, { cancelled: () => true }), null);
  const result = await api.optimize(largeSet, tags, players, { maxChecks: 400 });
  assert.equal(result.players.length, 10);
  assert.equal(result.optimal, false);
  assert.equal(result.checks, 400);
});

test("eligibility uses normalized clubs, EA league labels and rarity tags", () => {
  const api = load({ factories: { DataProvider: { getLeagueDP: () => [{ id: 13, label: "Premier League (ENG 1)" }] } } });
  assert.equal(api.eligible({ clubEaId: 1 }, []).matches(player(1, 100)), true);
  assert.equal(api.eligible({ categorySlug: "leagues", name: "Premier League" }, []).matches(player(1, 100, { leagueId: 13 })), true);
  assert.equal(api.eligible({ slug: "season-1" }, []).matches(player(1, 100, { rarityName: "Destined for Glory" })), true);
  assert.equal(api.eligible({ slug: "starter-set" }, []).matches(player(1, 100, { rarityId: 22 })), false);
  assert.ok(api.eligible({ slug: "unrecognized" }, []).error);
});

test("league-category set icons render alongside a club badge", () => {
  const api = load({
    AssetLocationUtils: {
      getBadgeImageUri: id => `club:${id}`,
      getLeagueImageUri: id => `league:${id}`,
    },
    factories: { DataProvider: { getLeagueDP: () => [{ id: 13, label: "Premier League (ENG 1)" }] } },
  });
  const set = { categorySlug: "leagues", name: "Premier League", clubEaId: 1 };
  assert.deepEqual(Array.from(api.icons(set)), ["club:1"]);
  assert.deepEqual(Array.from(api.icons(set, { leagueOnly: true })), ["league:13"]);
  assert.deepEqual(Array.from(api.icons({ categorySlug: "leagues", name: "Premier League" })), ["league:13"]);
});

test("club join rejects loans and never marks concepts first owner", () => {
  const concept = { definitionId: 1, sbsScore: 100, rating: 80, loans: -1, owners: 1, possiblePositions: [0], _staticData: { name: "Player" } };
  const globals = { window: { autoSbcConceptPlayers: [concept], __clubPlayersEntries: [{ definitionId: 2, id: 22, itemAttributes: { ...concept, definitionId: 2, loans: 5 } }] }, PlayerPosition: { 0: "GK" } };
  const result = load(globals).candidates();
  assert.equal(result.length, 1);
  assert.equal(result[0].firstOwner, false);
  assert.equal(result[0].inClub, false);
  assert.equal(result[0].positions[0], "GK");
  assert.equal(concept.owners, 1);
});

test("seen-only concepts are available for solving without first-owner credit", async () => {
  const concept = { definitionId: 1, sbsScore: 100, rating: 80, loans: -1, owners: 1, possiblePositions: [0], _staticData: { name: "Seen player" } };
  const api = load({
    window: { autoSbcConceptPlayers: [concept, { ...concept, definitionId: 2 }], __clubPlayersEntries: [] },
    collectionBookGetOwnedCounts: () => new Map([[1, 3]]),
    PlayerPosition: { 0: "GK" },
  });
  const candidates = api.candidates();
  const available = candidates.filter(value => value.available);
  assert.equal(available.length, 1);
  assert.equal(available[0].seen, true);
  assert.equal(available[0].inClub, false);
  assert.equal(available[0].firstOwner, false);
  assert.equal(candidates[1].available, false);
  const result = await api.optimize({ ...set, requiredCards: 1 }, [], available);
  assert.deepEqual(Array.from(result.players, value => value.eaId), [1]);
  assert.equal(api.tag(tag("COUNT", "FIRST_OWNED", 150, 1), result.players).bonus, 0);
});

test("definition-level first-owner history does not mark another copy as first owner", () => {
  const concept = { definitionId: 1, sbsScore: 100, rating: 80, loans: -1, owners: 5, possiblePositions: [] };
  const api = load({
    window: { autoSbcConceptPlayers: [concept, { ...concept, definitionId: 2 }], __clubPlayersEntries: [] },
    collectionBookGetOwnedCounts: () => new Map([[1, 1], [2, 1]]),
    collectionBookGetFirstOwnerCounts: () => new Map([[1, 1]]),
  });
  const candidates = api.candidates();
  assert.equal(candidates[0].firstOwner, false);
  assert.equal(candidates[1].firstOwner, false);
  assert.equal(api.tag(tag("COUNT", "FIRST_OWNED", 150, 1), candidates).bonus, 0);
  assert.equal(concept.owners, 5);
});

test("Gallery first-owner bonus uses current club item owners or explicit manual override", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/gallery.js"), "utf8");
  const context = vm.createContext({
    window: { autoSbcConceptPlayers: [
      { definitionId: 1, loans: -1, sbsScore: 100, owners: 1 },
      { definitionId: 2, loans: -1, sbsScore: 100, owners: 1 },
    ], __clubPlayersEntries: [
      { definitionId: 1, id: 101, itemAttributes: { definitionId: 1, loans: -1, owners: 3, sbsScore: 100 } },
      { definitionId: 2, id: 102, itemAttributes: { definitionId: 2, loans: -1, owners: 1, sbsScore: 100 } },
    ] },
    collectionBookGetOwnedCounts: () => new Map(),
    collectionBookGetFirstOwnerCounts: () => new Map([[1, 1]]),
    collectionBookGetManualSeen: id => Number(id) === 1 ? "firstOwner" : null,
  });
  vm.runInContext(source + ";globalThis.getCandidates=futGalleryGetCandidates;", context);
  const candidates = context.getCandidates();
  assert.equal(candidates.find(value => value.eaId === 1).firstOwner, true);
  assert.equal(candidates.find(value => value.eaId === 2).firstOwner, true);
});

test("player detail First Owner default uses exact item history", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/overrides/player/player-item.js"), "utf8");
  assert.match(source, /collectionBookIsFirstOwner\(item\.id, item\.owners\)/);
  assert.doesNotMatch(source, /item\.owners === 1 \|\| collectionBookGetFirstOwnerCounts\(\)/);
});

test("Gallery restores persisted first-owner tags by exact item ID", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/gallery.js"), "utf8");
  const context = vm.createContext({
    window: {
      autoSbcConceptPlayers: [
        { definitionId: 1, loans: -1, sbsScore: 100, owners: 3 },
        { definitionId: 2, loans: -1, sbsScore: 100, owners: 1 },
      ],
      __clubPlayersEntries: [
        { definitionId: 1, id: 101, itemAttributes: { id: 101, definitionId: 1, loans: -1, owners: 3, sbsScore: 100 } },
        { definitionId: 2, id: 102, itemAttributes: { id: 102, definitionId: 2, loans: -1, owners: 1, sbsScore: 100 } },
      ],
    },
    collectionBookGetOwnedCounts: () => new Map(),
    collectionBookGetManualSeen: () => null,
    collectionBookIsFirstOwner: id => id === 101,
  });
  vm.runInContext(source + ";globalThis.getCandidates=futGalleryGetCandidates;", context);
  const candidates = context.getCandidates();
  assert.equal(candidates.find(value => value.eaId === 1).firstOwner, true);
  assert.equal(candidates.find(value => value.eaId === 2).firstOwner, false);
});

test("ownership hydration preserves first-owner flags per item instance", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/collection-book.js"), "utf8");
  const start = source.indexOf("let _collectionBookOwnershipCounts = new Map();");
  const end = source.indexOf("// Load persisted ownership cache from the backend", start);
  const context = vm.createContext({ CustomEvent: function () {}, window: { dispatchEvent() {} } });
  vm.runInContext(`${source.slice(start, end)};globalThis.apply=_collectionBookApplyOwnershipCounts;globalThis.first=collectionBookIsFirstOwner;`, context);
  context.apply({ 1: 2 }, { 1: 1 }, { "101": true, "102": false });
  assert.equal(context.first(101, 3), true);
  assert.equal(context.first(102, 1), false);
  assert.equal(context.first(103, 1), true);
});

test("ownership observations retain first-owner status and reject concepts, loans and timed items", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/collection-book.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf("const collectionBookIsTimeLimited ="), source.indexOf("// Record ownership for a batch")) + ";globalThis.pairs=_collectionBookOwnershipPairs;", context);
  const pairs = context.pairs([
    { definitionId: 1, id: 11, owners: 1 },
    { definitionId: 2, id: 12, owners: 3 },
    { definitionId: 3, id: 13 },
    { definitionId: 4, id: 14, owners: 1, concept: true },
    { definitionId: 5, id: 15, owners: 1, loans: 2 },
    { definitionId: 6, id: 16, owners: 1, isTimeLimited: () => true },
    { definitionId: 7, id: 17, owners: 1, isTimeLimited: true },
  ]);
  assert.deepEqual(Array.from(pairs, item => item.firstOwner), [true, false, null]);
});

test("cheapest grade uses free seen players and the lowest cost qualifying purchases", async () => {
  const api = load();
  const players = [player(1, 100, { available: true }), player(2, 110, { price: 200 }), player(3, 500, { price: 900 }), player(4, 1000)];
  const result = await api.cheapest(set, [], players, "D", { price: value => value.price });
  assert.equal(result.reached, true);
  assert.equal(result.optimal, true);
  assert.equal(result.cost, 200);
  assert.deepEqual(Array.from(result.players, value => value.eaId).sort(), [1, 2]);
  assert.equal(result.missing.length, 1);
  assert.equal(result.unpriced, 1);
  const higher = await api.cheapest(set, [], players, "S", { price: value => value.price });
  assert.equal(higher.cost, 900);
  assert.equal(await api.cheapest(set, [], players, "D", { cancelled: () => true }), null);
});

test("each grade minimizes cached purchase price rather than maximizing points", async () => {
  const api = load({ getPrice: entity => entity.price });
  const grades = ["D", "C", "B", "A", "S"].map((name, index) => ({ name, threshold: (index + 1) * 100, rewards: [] }));
  const players = grades.map((grade, index) => player(index + 1, grade.threshold, { entity: { price: (index + 1) * 200 } }));
  players.push(player(99, 10000, { entity: { price: 10000 } }));
  for (const [index, grade] of grades.entries()) {
    const result = await api.cheapest({ requiredCards: 1, grades }, [], players, grade.name);
    assert.equal(result.reached, true);
    assert.equal(result.cost, (index + 1) * 200);
    assert.equal(result.players[0].eaId, index + 1);
  }
});

test("purchased concepts never gain first-owner bonuses and incomplete lineups cannot reach grades", async () => {
  const api = load();
  const players = [player(1, 10, { available: true, firstOwner: true }), player(2, 10, { firstOwner: true })];
  const result = await api.cheapest(set, [tag("COUNT", "FIRST_OWNED", 1000, 2)], players, "D", { price: () => 100 });
  assert.equal(result.reached, false);
  assert.equal(result.players.find(value => value.eaId === 2).firstOwner, false);
  assert.equal(players[1].firstOwner, true);
  const incomplete = await api.cheapest(set, [], [player(1, 1000, { available: true })], "D");
  assert.equal(incomplete.reached, false);
});

test("overview completion uses owned-or-seen filled slots, independent of grade", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.entries=futGalleryOverviewEntries;", context);
  const summaries = [
    { item: { name: "Zulu", requiredCards: 20 }, filled: 20, outcome: { grade: "C", totalScore: 100 } },
    { item: { name: "Alpha", requiredCards: 20 }, filled: 19, outcome: { grade: "S", totalScore: 300 } },
    { item: { name: "Beta", requiredCards: 20 }, filled: 20, outcome: { grade: null, totalScore: 0 } },
    { item: { name: "Unknown", requiredCards: 20 }, filled: 20, outcome: { totalScore: 0 }, error: "Unsupported" },
  ];
  const names = values => Array.from(values, value => value.item.name);
  assert.deepEqual(names(context.entries(summaries, "name", true)), ["Beta", "Zulu"]);
  assert.deepEqual(names(context.entries(summaries, "gems", true)), ["Zulu", "Beta"]);
  assert.deepEqual(names(context.entries(summaries, "gems", false)), ["Alpha", "Zulu", "Beta", "Unknown"]);
  assert.equal(summaries[0].item.name, "Zulu");
  assert.match(source, /candidates\.filter\(requirement\.matches\)\.filter\(player => player\.available\)/);
});

test("set card badge shows grade only with all players, otherwise player count", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryOverviewEntries")) + ";globalThis.badge=futGallerySetBadge;", context);
  const entry = (filled, requiredCards, grade) => ({ filled, item: { requiredCards }, outcome: { grade } });
  assert.equal(context.badge(entry(30, 30, "D")).text, "D");
  assert.equal(context.badge(entry(5, 5, "S")).text, "S");
  assert.equal(context.badge(entry(21, 30, null)).text, "21/30");
  assert.equal(context.badge(entry(21, 30, "S")).graded, false);
  assert.equal(context.badge(entry(30, 30, null)).text, "30/30");
  assert.equal(context.badge({ ...entry(30, 30, "S"), players: [{ available: true }, { available: false }] }).graded, false);
  assert.equal(context.badge(entry(0, 30, null)).text, "0/30");
  assert.equal(context.badge({ ...entry(30, 30, "S"), error: "Unsupported" }).graded, false);
});

test("Gallery overview stats count only completed no-concept sets", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryPlayerPrice")) + ";globalThis.stats=futGalleryOverviewStats;", context);
  const summaries = [
    { item: { requiredCards: 2 }, players: [{ available: true }, { available: true }], outcome: { grade: "B", totalScore: 120, tokens: 15 } },
    { item: { requiredCards: 2 }, players: [{ available: true }, { available: false }], outcome: { grade: "S", totalScore: 999, tokens: 80 } },
    { item: { requiredCards: 2 }, players: [{ available: true }], outcome: { totalScore: 30, tokens: 0 } },
  ];
  const candidates = [
    { seen: true, inClub: false, firstOwner: false },
    { seen: true, inClub: true, firstOwner: true },
    { seen: false, inClub: true, firstOwner: true },
  ];
  const stats = context.stats(summaries, candidates);
  assert.deepEqual({ ...stats, gradeCounts: Array.from(stats.gradeCounts, grade => ({ ...grade })) }, {
    completedSets: 1,
    totalSets: 3,
    gradeCounts: [
      { name: "D", count: 0 },
      { name: "C", count: 0 },
      { name: "B", count: 1 },
      { name: "A", count: 0 },
      { name: "S", count: 0 },
    ],
    completedItems: 2,
    gems: 120,
    tokens: 15,
    seenPlayers: 1,
    firstOwnedPlayers: 2,
  });
});

test("Gallery browser has Overview, Sets, and Categories with stats in Overview", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const navMarkup = source.match(/navigation\.innerHTML = `([^`]+)`/)?.[1] || "";
  assert.match(navMarkup, /data-page="overview"/);
  assert.match(navMarkup, /data-page="sets"/);
  assert.match(navMarkup, /data-page="categories"/);
  assert.doesNotMatch(navMarkup, /data-page="stats"/);
  assert.match(source, /page === "overview" \? `<section class="fg-stats-page"/);
  assert.match(source, /category\.value = item\.name; browserQuery = ""; page = "sets"/);
});

test("Gallery player values are labeled Gems and do not reuse the Points icon", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({ document: { createElement: () => ({ setAttribute() {} }) } });
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.gemIcon=futGalleryCreateGemIcon;", context);
  assert.equal(context.gemIcon().className, "ut-one-click-sbc-work-area-item-view--score-icon fg-gem-icon");
  assert.match(source, /gems\.append\(futGalleryCreateGemIcon\(\), document\.createTextNode\(number\(player\.score\)\)\)/);
  assert.match(source, /gems\.setAttribute\("aria-label", `\$\{number\(player\.score\)\} Gems`\)/);
  assert.doesNotMatch(source, /autosbc-auto-buy-currency-icon--points/);
  assert.doesNotMatch(source, /number\(player\.score\)\}\s*pts/);
  assert.match(source, /"Gems from completed sets"/);
  assert.match(source, /Base Gems/);
  assert.match(source, /Total Gems/);
});

test("Gallery player cards center content and omit the concept status footer", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  assert.match(source, /\.fg-player \{ display:flex; flex-direction:column;/);
  assert.match(source, /\.fg-player-info \{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;/);
  assert.match(source, /<div class="fg-player-info"><strong><\/strong><div class="fg-gems"><\/div><\/div>/);
  assert.doesNotMatch(source, /Concept \/ Not owned|fg-player-state/);
});

test("Gallery does not duplicate EA First Owner badge beneath player cards", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  assert.doesNotMatch(source, /futGalleryCreateFirstOwnerIcon|fg-first-owner-icon/);
  assert.doesNotMatch(source, /fg-player-state|Concept \/ Not owned|In club \/ First owner/);
});

test("Gallery hides duplicate names only after rendering native player cards", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  assert.match(source, /const playerName = tile\.querySelector\("strong"\)/);
  assert.match(source, /media\.appendChild\(element\); views\.push\(view\); tile\.__galleryView = view;\s*playerName\.remove\(\);\s*\} catch/);
  assert.match(source, /catch \{\s*const image = document\.createElement\("img"\)/);
});

test("Gallery set sidebar shows achieved grade and gems only for complete owned lineups", () => {
  const context = loadRewardPlanner();
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.sidebar=futGallerySetSidebarSummary;", context);
  const set = {
    clubEaId: 1, requiredCards: 2,
    grades: [{ name: "D", threshold: 100, rewards: [{ type: "gem", value: 3, count: 2 }, { type: "event_token_1", value: 5, count: 2 }] }],
  };
  const candidates = [player(1, 60000, { available: true }), player(2, 134095, { available: true })];
  const achieved = context.sidebar(set, [], candidates);
  assert.equal(achieved.complete, true);
  assert.equal(achieved.grade, "D");
  assert.equal(achieved.gems, 194095);
  assert.equal(achieved.tokens, 10);

  const incomplete = context.sidebar(set, [], candidates.slice(0, 1));
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.grade, null);
  assert.equal(incomplete.gems, 0);
  assert.equal(incomplete.tokens, 0);
});

test("Gallery sidebar Gems match the active or saved lineup instead of re-picking owned players", () => {
  const context = loadRewardPlanner();
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.sidebar=futGallerySetSidebarSummary;", context);
  const set = { clubEaId: 1, requiredCards: 2, grades: [{ name: "D", threshold: 1, rewards: [] }] };
  const candidates = [
    player(1, 100, { clubId: 1, available: true }),
    player(2, 90, { clubId: 1, available: true }),
    player(3, 10, { clubId: 1, available: true }),
  ];

  const projected = context.sidebar(set, [], candidates);
  const active = context.sidebar(set, [], candidates, [1, 3]);
  const saved = context.sidebar(set, [], candidates, [2, 3]);
  assert.equal(projected.gems, 190);
  assert.equal(active.gems, 110);
  assert.equal(saved.gems, 100);
  assert.equal(active.tokens, 0);
});

test("Gallery reward candidate pool includes eligible concepts regardless of display mode", () => {
  const context = loadRewardPlanner();
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.rewardCandidates=futGallerySetRewardCandidates;", context);
  const set = { clubEaId: 1, requiredCards: 2 };
  const candidates = [
    player(1, 100, { clubId: 1, available: true }),
    player(2, 80, { clubId: 1, available: false }),
    player(3, 200, { clubId: 2, available: false }),
  ];
  assert.deepEqual(Array.from(context.rewardCandidates(set, [], candidates), value => value.eaId), [1, 2]);
});

test("Gallery overview exposes all-set Max Gems and Max Tokens budget planners", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  assert.match(source, /\["gems", "tokens"\]/);
  assert.match(source, /currency === "gems" \? "Maximise Gems" : "Maximise Tokens"/);
  assert.match(source, /futGalleryShowRewardPlan\(root, currency, catalogue, candidates/);
  assert.match(source, /result\.sets\.forEach\(choice => savePlan\(choice\.set, choice\.players, false\)\)/);
  assert.match(source, /available: player\.available === true/);
});

test("Gallery grade badges reuse the shared grade medal icon", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  assert.match(source, /badge\.className = `fg-remaining\$\{badgeState\.graded \? " fg-grade-icon" : ""\}`/);
  assert.match(source, /\.fg-remaining\.fg-grade-icon \{ position:absolute/);
});

test("set overview sorts completion percentage, Gems and alphabet in both directions", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.entries=futGalleryOverviewEntries;", context);
  const summaries = [
    { item: { name: "Alpha", requiredCards: 20 }, filled: 10, outcome: { totalScore: 300 } },
    { item: { name: "Beta", requiredCards: 5 }, filled: 5, outcome: { totalScore: 100 } },
    { item: { name: "Gamma", requiredCards: 0 }, filled: 0, outcome: { totalScore: 200 } },
  ];
  for (const [sort, expected] of [["completion", ["Gamma", "Alpha", "Beta"]], ["gems", ["Beta", "Gamma", "Alpha"]], ["name", ["Alpha", "Beta", "Gamma"]]]) {
    assert.deepEqual(Array.from(context.entries(summaries, sort, false, true), entry => entry.item.name), expected);
    assert.deepEqual(Array.from(context.entries(summaries, sort, false, false), entry => entry.item.name), [...expected].reverse());
  }
  assert.deepEqual(Array.from(context.entries(summaries, "completion", true, true), entry => entry.item.name), ["Beta"]);
  assert.deepEqual(summaries.map(entry => entry.item.name), ["Alpha", "Beta", "Gamma"]);
});

test("Sets coin sorting keeps unknown costs last and hides only completed lineups", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.entries=futGalleryOverviewEntries;globalThis.cost=futGalleryCompletionCost;", context);
  const summaries = [
    { item: { name: "Complete", requiredCards: 1 }, players: [{ available: true }], coinsToComplete: 0 },
    { item: { name: "Cheap", requiredCards: 1 }, players: [{ available: false }], coinsToComplete: 200 },
    { item: { name: "Expensive", requiredCards: 1 }, players: [], coinsToComplete: 1000 },
    { item: { name: "Unknown", requiredCards: 1 }, players: [], coinsToComplete: null },
  ];
  const names = values => Array.from(values, entry => entry.item.name);
  assert.deepEqual(names(context.entries(summaries, "coins", false, true, true)), ["Cheap", "Expensive", "Unknown"]);
  assert.deepEqual(names(context.entries(summaries, "coins", false, false)), ["Expensive", "Cheap", "Complete", "Unknown"]);
  const entry = { item: { requiredCards: 2 }, players: [{ eaId: 1, available: true }] };
  const candidates = [entry.players[0], { eaId: 2, available: false, score: 10, price: 300 }, { eaId: 3, available: false, score: 20, price: 500 }];
  assert.equal(context.cost(entry, candidates, () => true, player => player.price), 300);
  assert.equal(context.cost(entry, [candidates[0]], () => true, player => player.price), null);
  assert.equal(context.cost({ item: { requiredCards: 1 }, players: [{ eaId: 4, available: false }] }, [], () => true, () => NaN), null);
});

test("categories aggregate cached sets and retain empty categories", () => {
  const result = load().categories({ categories: [{ name: "Clubs", slug: "clubs" }, { name: "Leagues", slug: "leagues" }], sets: [{ categorySlug: "clubs", totalTokens: 10 }, { categorySlug: "clubs", totalTokens: 20 }] });
  assert.equal(result[0].sets.length, 2);
  assert.equal(result[0].totalTokens, 30);
  assert.equal(result[1].sets.length, 0);
});

test("catalogue fetch caches only definitions and never requests player pools", async () => {
  const urls = [];
  let saved;
  const api = load({
    COLLECTION_BOOK_ORIGIN: "https://www.fut.gg",
    _collectionBookReadCache: () => null,
    _collectionBookWriteCache: (key, data) => { saved = data; },
    _collectionBookGetJson: async url => { urls.push(url); return { data: { tags: [], categories: [{ name: "Clubs", slug: "clubs", sets: [{ id: 1, clubEaId: 1, grades: [] }] }], sets: [{ items: [{ eaId: 999 }] }] } }; },
    window: { dispatchEvent() {} }, CustomEvent: class {},
  });
  await api.load({ force: true });
  assert.equal(urls.length, 2);
  assert.ok(urls.every(url => !url.includes("/pool/")));
  assert.equal(saved.sets[0].clubEaId, 1);
  assert.equal(saved.sets[0].items, undefined);
});

test("concept cache preserves scores, zero GK position, attributes and skill encoding", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/concepts-indexeddb.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const hasUtItemEntityFunctions")) + ";globalThis.serialize=toSerializableConcept;globalThis.position=normalizeEaPosition;", context);
  const cosmetics = { 1: { type: 1, subtype: 1, signature: "Pristine" } };
  const value = context.serialize({ definitionId: 123, type: "player", sbsScore: 23750, preferredPosition: 0, authenticity: true, holographicType: "pristine", _hyperCosmeticDTOs: cosmetics, _staticData: { name: "Ronaldo", firstName: "Ronaldo Luís", lastName: "Nazário de Lima", knownAs: "Ronaldo" }, getSkillMoves: () => 5, getWeakFoot: () => 4, getAttributes: () => [1, 2, 3, 4, 5, 6] });
  assert.equal(value.gradingScore, 23750);
  assert.equal(value.preferredPosition, 0);
  assert.equal(value.skillmoves, 4);
  assert.equal(value.itemType, "player");
  assert.equal(value.authenticity, true);
  assert.equal(value.holographicType, "pristine");
  assert.equal(value.staticName, "Ronaldo");
  assert.equal(value.firstName, "Ronaldo Luís");
  assert.equal(value.lastName, "Nazário de Lima");
  assert.equal(value.knownAs, "Ronaldo");
  assert.deepEqual(JSON.parse(JSON.stringify(value.hyperCosmeticDTOs)), cosmetics);
  assert.equal(value.attributeArray.length, 6);
  assert.equal(context.position("RM"), 12);
  assert.equal(context.position("LW"), 27);
  assert.equal(context.position(null), -1);
});

test("concept cache rehydration initializes the EA entity with cosmetics and signature", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/concepts-indexeddb.js"), "utf8");
  const start = source.indexOf("const normalizeEaPosition");
  const end = source.indexOf("const enrichConceptEntity");
  let factoryPayload;
  const context = vm.createContext({
    PlayerPosition: { 25: "ST" },
    UTItemEntityFactory: class { createItem(payload) {
      factoryPayload = payload;
      return { definitionId: payload.resourceId, rating: payload.rating, _staticData: {}, getStaticData() { return this._staticData; }, setStaticData(value) { this._staticData = value; }, getSearchType() {} };
    } },
  });
  vm.runInContext(`${source.slice(start, source.indexOf("const createConceptEntityFromEaSearch"))}${source.slice(source.indexOf("const hasUtItemEntityFunctions"), end)};globalThis.rehydrate=rehydrateConceptEntity;`, context);
  const cosmetics = { 1: { type: 1, subtype: 1, signature: "Pristine" } };
  const entity = context.rehydrate({ resourceId: 67146440, assetId: 37576, rating: 94, authenticity: true, holographicType: "pristine", hyperCosmeticDTOs: cosmetics, staticName: "Ronaldo", firstName: "Ronaldo Luís", lastName: "Nazário de Lima", knownAs: "Ronaldo" });

  assert.equal(factoryPayload.resourceId, 67146440);
  assert.equal(factoryPayload.definitionId, 67146440);
  assert.equal(factoryPayload.assetId, 37576);
  assert.equal(factoryPayload.firstName, "Ronaldo Luís");
  assert.equal(factoryPayload.lastName, "Nazário de Lima");
  assert.equal(factoryPayload.knownAs, "Ronaldo");
  assert.equal(factoryPayload.authenticity, true);
  assert.equal(factoryPayload.holographicType, "pristine");
  assert.deepEqual(JSON.parse(JSON.stringify(factoryPayload.hyperCosmeticDTOs)), cosmetics);
  assert.deepEqual(JSON.parse(JSON.stringify(factoryPayload._hyperCosmeticDTOs)), cosmetics);
  assert.equal(entity.concept, true);
  assert.equal(entity.authenticity, true);
  assert.equal(entity.holographicType, "pristine");
  assert.equal(entity.getStaticData().name, "Ronaldo");
  assert.equal(entity.getStaticData().knownAs, "Ronaldo");
  assert.deepEqual(JSON.parse(JSON.stringify(entity._hyperCosmeticDTOs)), cosmetics);
});

test("refreshed standard concepts derive native display name from EA names when name is placeholder", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/concepts-indexeddb.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const hasUtItemEntityFunctions")) + ";globalThis.serialize=toSerializableConcept;", context);
  const serialized = context.serialize({
    definitionId: 50563395,
    _staticData: { name: "---", firstName: "Kylian", lastName: "Mbappé", knownAs: "---" },
  });
  assert.equal(serialized.staticName, "Kylian Mbappé");

  const hydrationSource = fs.readFileSync(path.join(__dirname, "../src/data/concepts-indexeddb.js"), "utf8");
  const start = hydrationSource.indexOf("const normalizeEaPosition");
  const end = hydrationSource.indexOf("const enrichConceptEntity");
  const hydratedContext = vm.createContext({
    PlayerPosition: {},
    UTItemEntityFactory: class { createItem(payload) {
      return {
        definitionId: payload.resourceId,
        rating: 91,
        _staticData: { name: "---", firstName: "---", lastName: "---", knownAs: "---" },
        getStaticData() { return this._staticData; },
        setStaticData(value) { this._staticData = value; },
        getSearchType() {},
      };
    } },
  });
  vm.runInContext(`${hydrationSource.slice(start, hydrationSource.indexOf("const createConceptEntityFromEaSearch"))}${hydrationSource.slice(hydrationSource.indexOf("const hasUtItemEntityFunctions"), end)};globalThis.rehydrate=rehydrateConceptEntity;`, hydratedContext);
  const entity = hydratedContext.rehydrate({ ...serialized, rating: 91 });
  assert.equal(entity.getStaticData().name, "Kylian Mbappé");
});

test("Collection Book builds non-loan EA concept cards with native cosmetic metadata", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/nav.js"), "utf8");
  const start = source.indexOf("const collectionBookEnsureNativePlayerName");
  const end = source.indexOf("// --- view state", start);
  let factoryPayload;
  let rendered;
  const staticData = { name: "Mbappé", firstName: "Kylian", lastName: "Mbappé", knownAs: "---" };
  const cosmetics = { 1: { type: 1, subtype: 0 }, 2: { type: 2, subtype: 30 } };
  const concept = {
    id: 67340611, definitionId: 67340611, databaseId: 231747, rating: 91, rareflag: 22,
    nationId: 18, leagueId: 53, teamId: 243, owners: 0, loans: -1,
    authenticity: false, holographicType: "pristine", _hyperCosmeticDTOs: cosmetics,
    getStaticData: () => staticData, getAttributes: () => [96, 91, 81, 92, 30, 77],
    getStats: () => [0, 0, 0, 0, 0], getBasePossiblePositions: () => [25, 27],
    getPlusRoles: () => [],
  };
  const context = vm.createContext({
    window: { collectionBookGetItemEntity: () => null },
    collectionBookGetConceptIndex: () => new Map([[67340611, concept]]),
    ItemType: { PLAYER: 1 },
    LimitedUseType: { NONE: 0 },
    PlayerPosition: { 25: "ST", 27: "LW" },
    normalizeEaPosition: value => value,
    createUtItemEntity: payload => { factoryPayload = payload; return { ...payload, setStaticData(value) { this._staticData = value; } }; },
    UTItemViewFactory: { createLargeItem: () => ({ init() {}, render(item) { rendered = item; }, getRootElement: () => ({}) }) },
    collectionBookApplyCopyCounter() {},
  });
  vm.runInContext(`${source.slice(start, end)};globalThis.build=collectionBookCreateEaCardElement;`, context);

  context.build({ eaId: 67340611, overall: 91, position: "ST" }, false, 0, false);

  assert.equal(factoryPayload.loans, -1);
  assert.equal(factoryPayload.limitedUseType, 0);
  assert.equal(factoryPayload.concept, true);
  assert.equal(factoryPayload.rating, 91);
  assert.equal(factoryPayload.preferredPosition, "ST");
  assert.deepEqual(Array.from(factoryPayload.possiblePositions), ["ST", "LW"]);
  assert.equal(factoryPayload.firstName, "Kylian");
  assert.equal(factoryPayload.lastName, "Mbappé");
  assert.deepEqual(JSON.parse(JSON.stringify(factoryPayload.hyperCosmeticDTOs)), cosmetics);
  assert.equal(rendered.concept, true);
  assert.equal(rendered.definitionId, 67340611);
});

test("Collection Book generates EA native names only when concept static data is missing", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/nav.js"), "utf8");
  const start = source.indexOf("const collectionBookEnsureNativePlayerName");
  const end = source.indexOf("// Build a live EA item view", start);
  class StaticPlayerData {
    generateNameData(firstName, lastName, knownAs) {
      this.firstName = firstName || "---";
      this.lastName = lastName || "---";
      this.knownAs = knownAs || "---";
      this.name = this.knownAs !== "---" ? this.knownAs : this.lastName;
    }
    hasNameData() { return !!(this.firstName !== "---" || this.lastName !== "---" || this.knownAs !== "---"); }
  }
  const context = vm.createContext({ UTStaticPlayerItemDataDTO: StaticPlayerData });
  vm.runInContext(`${source.slice(start, end)};globalThis.ensure=collectionBookEnsureNativePlayerName;`, context);
  const entity = { _staticData: {}, getStaticData() { return this._staticData; }, setStaticData(value) { this._staticData = value; } };
  context.ensure(entity, { name: "Mbappé" }, { getStaticData: () => ({ firstName: "Kylian", lastName: "Mbappé", knownAs: "---" }) });
  assert.equal(entity.getStaticData().name, "Mbappé");
  assert.equal(entity.getStaticData().firstName, "Kylian");

  const named = { _staticData: { name: "Mbappé", firstName: "Kylian", lastName: "Mbappé", knownAs: "---" }, getStaticData() { return this._staticData; }, setStaticData(value) { this._staticData = value; } };
  const original = named.getStaticData();
  context.ensure(named, { name: "Other" }, null);
  assert.equal(named.getStaticData(), original);
});

test("Gallery native item clones retain EA names and fill placeholder names", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  class StaticPlayerData {
    generateNameData(firstName, lastName, knownAs) {
      this.firstName = firstName || "---";
      this.lastName = lastName || "---";
      this.knownAs = knownAs || "---";
      this.name = this.knownAs !== "---" ? this.knownAs : this.lastName;
    }
  }
  class Entity {
    constructor(source) { this._staticData = { name: "---", firstName: "---", lastName: "---", knownAs: "---" }; this.definitionId = source.definitionId; }
    getStaticData() { return this._staticData; }
    setStaticData(value) { this._staticData = value; }
  }
  const context = vm.createContext({ UTItemEntity: Entity, UTStaticPlayerItemDataDTO: StaticPlayerData });
  vm.runInContext(`${source.slice(0, source.indexOf("const futGalleryOpenPlayerDetails"))};globalThis.clone=futGalleryCreateNativeItem;`, context);
  const named = { definitionId: 1, entity: { definitionId: 1, _staticData: { name: "Nuno Mendes", firstName: "Nuno Alexandre", lastName: "Tavares Mendes", knownAs: "Nuno Mendes" }, _hyperCosmeticDTOs: { 1: { subtype: 30 } } }, name: "Fallback" };
  const namedClone = context.clone(named);
  assert.equal(namedClone.getStaticData().name, "Nuno Mendes");
  assert.deepEqual(JSON.parse(JSON.stringify(namedClone._hyperCosmeticDTOs)), { 1: { subtype: 30 } });

  const placeholder = { definitionId: 2, entity: { definitionId: 2, _staticData: { name: "---", firstName: "Kylian", lastName: "Mbappé", knownAs: "---" } }, name: "Mbappé" };
  const fallbackClone = context.clone(placeholder);
  assert.equal(fallbackClone.getStaticData().name, "Mbappé");
  const nonLoan = context.clone({ entity: { definitionId: 3, loans: -1, limitedUseType: 1 } });
  assert.equal(nonLoan.loans, -1);
  assert.equal(nonLoan.limitedUseType, 0);
  const timedLoan = context.clone({ entity: { definitionId: 4, loans: -1, limitedUseType: 2, endTime: 12345 } });
  assert.equal(timedLoan.limitedUseType, 2);
  assert.equal(timedLoan.endTime, 12345);
});

test("Gallery uses EA max auction price for extinct concepts and hydrates missing max", async () => {
  let requests = 0;
  const variantPriceRequests = [];
  const extinct = { eaId: 44, itemDefinitionId: 44, entity: { definitionId: 44, _itemPriceLimits: null, getStaticData() { return {}; } }, isVariantItem: true, available: false };
  const api = load({
    getPrice: () => null,
    getPriceItems: () => ({ 44: { price: 0, isExtinct: true } }),
    ensureExtinctPlayerMaxPrice: async entity => { requests += 1; entity._itemPriceLimits = { minimum: 150, maximum: 15000000 }; return 15000000; },
    fetchFutggSignedJson: async path => { variantPriceRequests.push(path); return { data: { currentPrice: { price: 1000000 } } }; },
  });
  assert.ok(Number.isNaN(api.price(extinct)));
  const enriched = await api.enrichVariantPrices([extinct]);
  assert.equal(requests, 1);
  assert.deepEqual(variantPriceRequests, []);
  assert.equal(enriched[0].extinctMaxPrice, 15000000);
  assert.equal(enriched[0].purchaseCost, 15000000);
  assert.equal(enriched[0].variantPriceResolved, true);
  assert.equal(api.price(enriched[0]), 15000000);
});

test("Collection Book uses only the EA maximum for extinct concept prices", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/collection-book.js"), "utf8");
  const start = source.indexOf("const collectionBookGetPrice =");
  const end = source.indexOf("// Players whose price", start);
  const concept = { definitionId: 88, _itemPriceLimits: { minimum: 150, maximum: 15000000 }, getMarketAverage: () => 12000000 };
  const prices = { 88: { price: 0, priceLimitMax: 0, isExtinct: true } };
  const context = vm.createContext({
    getPriceItems: () => prices,
    getPrice: () => 0,
    collectionBookGetConceptIndex: () => new Map([[88, concept]]),
  });
  vm.runInContext(`${source.slice(start, end)};globalThis.getPrice=collectionBookGetPrice;`, context);

  assert.equal(context.getPrice({ eaId: 88 }), 15000000);
  concept._itemPriceLimits = null;
  assert.equal(context.getPrice({ eaId: 88 }), null);
});

test("player hover bonus attribution sums to each paid rounded tag bonus", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/gallery.js"), "utf8");
  const context = vm.createContext({});
  const start = source.indexOf("const futGalleryTagBonusShares =");
  const end = source.indexOf("const futGalleryOptimize =", start);
  vm.runInContext(`${source.slice(start, end)};globalThis.bonus=futGalleryPlayerTagBonus;`, context);
  const players = [player(1, 101), player(2, 102), player(3, 103)];
  const tag = { name: "Gold", paid: true, percent: 10, matchedIds: [1, 2, 3] };
  const outcome = { bonuses: [tag] };
  const shares = players.map(value => context.bonus(outcome, players, value.eaId));
  assert.deepEqual(shares.map(value => value.total), [10, 10, 10]);
  assert.equal(shares.reduce((sum, value) => sum + value.total, 0), 30);
  const unpaid = context.bonus({ bonuses: [{ ...tag, paid: false }] }, players, 1);
  assert.equal(unpaid.total, 0);
  assert.equal(unpaid.tags.length, 0);
});