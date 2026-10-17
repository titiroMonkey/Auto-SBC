const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/features/solver/quick-solution.js"), "utf8");

test("fut.gg solution retains FIELD position indexes instead of response order", async () => {
  const context = vm.createContext({
    URL,
    console,
    resolveFutGgSetSlug: async () => "marquee-matchups",
    futGgGetJson: async url => url.includes("/api/squads/")
      ? { data: { data: { activeGroupPositions: [
        { group: "FIELD", playerEaId: 78837, positionIdx: 1 },
        { group: "FIELD", playerEaId: 223571, positionIdx: 0 },
        { group: "BENCH", playerEaId: 999, positionIdx: 0 },
      ] } } }
      : { data: { challenges: [{ eaId: 42, cheapestSolutionUrl: "/27/squad-builder/19572a3f-1ae2-4cc3-ac6d-4ba4c2a6a529/" }] } },
  });
  vm.runInContext(source.slice(source.indexOf("const fetchFutGgSolution ="), source.indexOf("async function autoApplyQuickSolutionOnPageOpen")) + ";globalThis.fetchSolution=fetchFutGgSolution;", context);
  const result = await context.fetchSolution(1, 42);
  assert.deepEqual(Array.from(result.positions, position => [position.playerEaId, position.positionIdx]), [[78837, 1], [223571, 0]]);
  assert.equal(result.solutionUrl, "https://www.fut.gg/27/squad-builder/19572a3f-1ae2-4cc3-ac6d-4ba4c2a6a529/");
});

const assignPlayers = (rows, brickIndices = []) => {
  const context = vm.createContext({
    selectionRows: rows,
    sbcData: { brickIndices, formation: [0, 3, 5, 5, 7, 12, 14, 14, 16, 25, 25] },
    UTItemEntity: class {},
    lookupDiagnostics: {},
    console,
  });
  const start = source.indexOf("let solutionSquad =");
  const end = source.indexOf("// ── Concept-to-club swap", start);
  vm.runInContext(source.slice(start, end) + ";globalThis.placed=solutionSquad;", context);
  return context.placed;
};

test("Quick Solution keeps all eleven fut.gg slots including out-of-position players", () => {
  const slots = [1, 6, 8, 7, 0, 9, 5, 2, 10, 3, 4];
  const rows = slots.map((slot, index) => ({
    index,
    definitionId: 100 + slot,
    source: "concept_search",
    player: { definitionId: 100 + slot, possiblePositions: [25] },
    QuickSolutionEntry: { positionIdx: slot },
  }));
  const placed = assignPlayers(rows);
  assert.deepEqual(Array.from(placed, player => player.definitionId), Array.from({ length: 11 }, (_, slot) => 100 + slot));
});

test("Quick Solution fallback fills open slots despite conflicting playable positions", () => {
  const rows = Array.from({ length: 8 }, (_, index) => ({
    index,
    definitionId: 100 + index,
    source: "concept_search",
    player: { definitionId: 100 + index, possiblePositions: [14] },
    QuickSolutionEntry: { positionIdx: null },
  }));
  const placed = assignPlayers(rows, [0, 1, 4]);
  assert.equal(placed.filter(player => player?.definitionId).length, 8);
});

test("Quick Solution logs lookup sources and unmatched slot assignments", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/features/solver/quick-solution.js"), "utf8");
  const bundle = fs.readFileSync(path.join(__dirname, "../../plainJavascript.js"), "utf8");
  for (const content of [source, bundle]) {
    assert.match(content, /autosbc_futgg_cache_v3_/);
    assert.match(content, /challenges\.find\(\(candidate\) =>\s*Number\(candidate\.eaId\) === Number\(challengeId\)/);
    assert.doesNotMatch(content, /challenges\.find\([\s\S]{0,120}\)\s*\|\|\s*challenges\[0\]/);
    assert.match(content, /__autoSbcLastQuickSolutionDiagnostics = lookupDiagnostics/);
    assert.match(content, /solutionUrl,/);
    assert.match(content, /futggDefinitionIds: QuickSolutionEntries\.map/);
    assert.match(content, /clubMatches: matchingIds\(clubPlayersPool\)/);
    assert.match(content, /conceptMatches: matchingIds\(searchedConceptPlayers\)/);
    assert.match(content, /source: row\.source/);
    assert.match(content, /unassignedRows/);
    assert.match(content, /\[Auto-SBC\]\[QuickSolution\] player lookup/);
  }
});