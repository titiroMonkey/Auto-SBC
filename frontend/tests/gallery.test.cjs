const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("Auto complete all respects player source and target grade with concept costs", async () => {
  const solver = vm.createContext({ setTimeout });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/data/gallery.js"), "utf8") + ";globalThis.cheapest=futGalleryCheapest;", solver);
  const context = vm.createContext({ futGalleryCheapest: solver.cheapest, futGalleryEligibility: () => ({ matches: player => player.eligible }) });
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  vm.runInContext(source.slice(source.indexOf("const futGalleryAutoComplete ="), source.indexOf("const futGalleryShowAutoComplete =")) + ";globalThis.complete=futGalleryAutoComplete;", context);
  const item = { requiredCards: 2, grades: [{ name: "D", threshold: 100 }, { name: "S", threshold: 200 }] };
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
  const low = await context.complete(item, [], candidates, "club", "D", options);
  assert.equal(low.reached, true);
  const concepts = await context.complete(item, [], candidates, "concepts", "S", options);
  assert.equal(concepts.reached, true);
  assert.equal(concepts.cost, 500);
  assert.equal(concepts.missing.length, 1);
  assert.equal(concepts.players.some(player => player.eaId === 4), false);
});

test("Gallery player details use native split panel methods and clean up when switching cards", () => {
  const children = new Set();
  const controllers = [];
  const element = () => ({
    classList: { add() {}, remove() {} },
    setAttribute() {}, append() {}, appendChild() {}, remove() {},
  });
  class Details {
    constructor() { controllers.push(this); }
    initWithIterator(iterator) { this.iterator = iterator; }
    enableSwiping(value) { assert.equal(value, false); }
    setNavigationStyle(value) { assert.equal(value, "secondary"); }
    getView() { return { getRootElement: element }; }
    viewWillAppear() {}
    viewDidAppear() { this.visible = true; }
    viewWillDisappear() {}
    viewDidDisappear() { this.visible = false; }
    dealloc() { this.disposed = true; }
  }
  const root = element();
  root.__galleryController = {
    setRightController(controller) { this.rightController = controller; controller.viewDidAppear(); },
    removeRightController() { this.rightController.viewDidDisappear(); this.rightController = null; },
    hideRightPanel(hidden) { this.hidden = hidden; },
    addChildViewController: controller => children.add(controller),
    removeChildViewController: controller => children.delete(controller),
  };
  const context = vm.createContext({
    document: { createElement() { throw new Error("Must use EA split view, not custom DOM"); } },
    UTNavigationBarView: { Style: { SECONDARY: "secondary" } },
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
  assert.equal(root.__galleryController.hidden, false);
  assert.equal(controllers[0].iterator.items[0].id, 123);
  assert.equal(controllers[0].iterator.items[0].pile, 7);
  assert.notEqual(controllers[0].iterator.items[0], entity);
  context.open(root, { entity: { definitionId: 789, concept: true } });
  assert.equal(children.size, 1);
  assert.equal(controllers[0].disposed, true);
  assert.equal(controllers[1].iterator.items[0].concept, true);
  root.__galleryCloseDetails();
  assert.equal(children.size, 0);
  assert.equal(root.__galleryController.hidden, true);
  assert.equal(controllers[1].disposed, true);
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
    ";globalThis.api={evaluate:futGalleryEvaluate,tag:futGalleryEvaluateTag,optimize:futGalleryOptimize,cheapest:futGalleryCheapest,categories:futGalleryCategories,icons:futGalleryIconUrls,eligible:futGalleryEligibility,candidates:futGalleryGetCandidates,loan:futGalleryIsLoan,load:futGalleryLoadCatalogue,isVariant:futGalleryIsVariantItem,price:futGalleryPrice,fetchVariantPrice:futGalleryFetchVariantPrice,addPristineVariants:futGalleryAddPristineVariants,enrichVariantPrices:futGalleryEnrichVariantPrices};", context);
  return context.api;
};
const player = (eaId, score, fields = {}) => ({ eaId, score, rating: 80, positions: [], nationId: 1, clubId: 1, leagueId: 1, rarityId: 0, playerId: eaId, ...fields });
const set = { requiredCards: 2, grades: [{ name: "D", threshold: 200, rewards: [] }, { name: "S", threshold: 300, rewards: [{ type: "event_token_1", count: 1, value: 5 }] }] };
const tag = (type, attribute, bonus = 10, minItems = 2) => ({ id: 1, name: "Test tag", rules: [{ type, attribute, values: ["gold"] }], tiers: [{ minItems, bonus }] });

test("Gallery keeps FUT.GG holographic item prices separate from standard EA prices", async () => {
  const requested = [];
  const globals = {
    getPrice: () => 14000000,
    fetchFutggSignedJson: async path => {
      requested.push(path);
      return { data: { currentPrice: { price: path.includes("67146440") ? 13965000 : 14350000 } } };
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

test("Gallery adds and prices the Pristine item beside the normal candidate", async () => {
  const requested = [];
  const api = load({
    fetchFutggSignedJson: async path => {
      requested.push(path);
      if (path.includes("definition-data")) {
        return { data: [{ eaId: 37576, standardItemEaId: 37576, itemVariants: [{ eaId: 37576, holographicType: null }, { eaId: 67146440, holographicType: "pristine" }] }] };
      }
      return { data: { currentPrice: { price: 13965000 } } };
    },
    searchEaConceptEntitiesByDefIds: async ids => ids.map(definitionId => ({ definitionId, databaseId: 37576, _staticData: { name: "Ronaldo" }, rating: 94, sbsScore: 67500 })),
  });
  const normal = { eaId: 37576, entity: { definitionId: 37576, databaseId: 37576, _staticData: { name: "Ronaldo" } }, name: "Ronaldo", assetId: 37576, itemDefinitionId: 37576, isVariantItem: false, available: false, holographic: false };

  const candidates = await api.enrichVariantPrices([normal]);

  assert.deepEqual(Array.from(candidates, candidate => candidate.eaId), [37576, 67146440]);
  assert.equal(candidates[0].holographicType, undefined);
  assert.equal(candidates[1].holographicType, "pristine");
  assert.equal(candidates[1].holographic, true);
  assert.equal(candidates[1].variantPrice, 13965000);
  assert.equal(candidates[1].available, false);
  assert.equal(requested.filter(path => path.includes("player-prices")).length, 1);
});

test("loan-only club entries do not turn Gallery concepts into seen players", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/collection-book.js"), "utf8");
  const window = { __clubPlayersEntries: [
    { definitionId: 1, itemAttributes: { loans: 7 } },
    { definitionId: 2, loans: 0 },
    { definitionId: 3, itemAttributes: { loans: -1 } },
    { definitionId: 4, itemAttributes: { isLoan: () => true } },
  ], autoSbcConceptPlayers: [1, 2, 3, 4, 5].map(definitionId => ({ definitionId, loans: -1, sbsScore: 100 })) };
  const context = vm.createContext({ window, Map, _collectionBookOwnershipCounts: new Map([[5, 1]]) });
  vm.runInContext(source.slice(source.indexOf("const collectionBookGetOwnedCounts ="), source.indexOf("const collectionBookGetClubCounts =")) + ";globalThis.counts=collectionBookGetOwnedCounts;", context);
  const candidates = load({ window, collectionBookGetOwnedCounts: context.counts }).candidates();
  assert.deepEqual(Array.from(candidates.filter(value => value.available), value => value.eaId), [3, 5]);
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

test("seen first-owner history contributes to Gallery bonuses", () => {
  const concept = { definitionId: 1, sbsScore: 100, rating: 80, loans: -1, owners: 5, possiblePositions: [] };
  const api = load({
    window: { autoSbcConceptPlayers: [concept, { ...concept, definitionId: 2 }], __clubPlayersEntries: [] },
    collectionBookGetOwnedCounts: () => new Map([[1, 1], [2, 1]]),
    collectionBookGetFirstOwnerCounts: () => new Map([[1, 1]]),
  });
  const candidates = api.candidates();
  assert.equal(candidates[0].firstOwner, true);
  assert.equal(candidates[1].firstOwner, false);
  assert.equal(api.tag(tag("COUNT", "FIRST_OWNED", 150, 1), candidates).bonus, 150);
  assert.equal(concept.owners, 5);
});

test("ownership observations retain explicit first-owner status and reject concepts and loans", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/collection-book.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf("const _collectionBookOwnershipPairs"), source.indexOf("// Record ownership for a batch")) + ";globalThis.pairs=_collectionBookOwnershipPairs;", context);
  const pairs = context.pairs([
    { definitionId: 1, id: 11, owners: 1 },
    { definitionId: 2, id: 12, owners: 3 },
    { definitionId: 3, id: 13 },
    { definitionId: 4, id: 14, owners: 1, concept: true },
    { definitionId: 5, id: 15, owners: 1, loans: 2 },
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
  assert.deepEqual(names(context.entries(summaries, "points", true)), ["Zulu", "Beta"]);
  assert.deepEqual(names(context.entries(summaries, "points", false)), ["Alpha", "Zulu", "Beta", "Unknown"]);
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
  assert.equal(context.badge(entry(0, 30, null)).text, "0/30");
  assert.equal(context.badge({ ...entry(30, 30, "S"), error: "Unsupported" }).graded, false);
});

test("set overview sorts completion percentage, points and alphabet in both directions", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/collection-book/gallery-view.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf("const futGalleryShowBonuses")) + ";globalThis.entries=futGalleryOverviewEntries;", context);
  const summaries = [
    { item: { name: "Alpha", requiredCards: 20 }, filled: 10, outcome: { totalScore: 300 } },
    { item: { name: "Beta", requiredCards: 5 }, filled: 5, outcome: { totalScore: 100 } },
    { item: { name: "Gamma", requiredCards: 0 }, filled: 0, outcome: { totalScore: 200 } },
  ];
  for (const [sort, expected] of [["completion", ["Gamma", "Alpha", "Beta"]], ["points", ["Beta", "Gamma", "Alpha"]], ["name", ["Alpha", "Beta", "Gamma"]]]) {
    assert.deepEqual(Array.from(context.entries(summaries, sort, false, true), entry => entry.item.name), expected);
    assert.deepEqual(Array.from(context.entries(summaries, sort, false, false), entry => entry.item.name), [...expected].reverse());
  }
  assert.deepEqual(Array.from(context.entries(summaries, "completion", true, true), entry => entry.item.name), ["Beta"]);
  assert.deepEqual(summaries.map(entry => entry.item.name), ["Alpha", "Beta", "Gamma"]);
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
});