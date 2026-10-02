const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("countdown rebinds after cleanup or navigation and renders the remaining time", () => {
  let element = null;
  let instances = 0;
  const shield = { appendChild(node) { element = node; } };
  const sandbox = vm.createContext({
    window: {},
    console,
    getElement: () => shield,
    document: {
      querySelector: () => element,
      createElement: () => ({ classList: { add() {} }, addEventListener() {} }),
    },
    Counter: class {
      constructor() {
        instances += 1;
        this.DOM = { scope: element };
      }
      count(value) { this.DOM.scope.value = value; }
    },
  });
  const read = file => fs.readFileSync(path.join(__dirname, "../src/", file), "utf8");
  vm.runInContext(read("features/solver/state.js") + read("features/loader/loader.js") +
    ";globalThis.ensure = ensureNumCounterExists;globalThis.tick = countDown;", sandbox);
  vm.runInContext("count = 120;", sandbox);
  sandbox.ensure();
  assert.equal(element.value, "0120");
  sandbox.tick();
  assert.equal(element.value, "0119");
  sandbox.ensure();
  assert.equal(instances, 1);

  vm.runInContext("counter = null;", sandbox);
  element = null;
  sandbox.ensure();
  assert.equal(instances, 2);
  assert.equal(element.value, "0119");
  sandbox.tick();
  assert.equal(element.value, "0118");

  element = null;
  sandbox.ensure();
  assert.equal(instances, 3);
  sandbox.tick();
  assert.equal(element.value, "0117");
});