const antiDebugOverride = () => {
  if (globalThis.__autoSbcAntiDebugPatched) {
    return;
  }

  const nativeSetInterval = globalThis.setInterval?.bind(globalThis);
  const nativeSetTimeout = globalThis.setTimeout?.bind(globalThis);
  const nativeEval = globalThis.eval;
  const nativeFunctionConstructor = Function.prototype.constructor;

  const hasDebuggerStatement = (source) =>
    typeof source === "string" && /\bdebugger\b/.test(source);

  const neutralizeDebuggerStatements = (source) =>
    source.replace(/\bdebugger\b\s*;?/g, "return null;");

  const callbackSource = (callback) => {
    if (typeof callback === "function") {
      try {
        return Function.prototype.toString.call(callback);
      } catch {
        return "";
      }
    }

    return typeof callback === "string" ? callback : "";
  };

  const createSafeTimer = (nativeTimer, label) => {
    if (typeof nativeTimer !== "function") {
      return nativeTimer;
    }

    const safeTimer = (callback, delay, ...args) => {
      const source = callbackSource(callback);
      if (hasDebuggerStatement(source)) {
        console.warn(`[antiDebugOverride] Blocked ${label} debugger callback`);
        return 0;
      }

      return nativeTimer(callback, delay, ...args);
    };

    safeTimer.__autoSbcNativeTimer = nativeTimer;
    return safeTimer;
  };

  const safeFunctionConstructor = function (...args) {
    const bodyIndex = args.length - 1;
    if (bodyIndex >= 0 && hasDebuggerStatement(args[bodyIndex])) {
      console.warn("[antiDebugOverride] Neutralized Function constructor debugger body");
      args[bodyIndex] = neutralizeDebuggerStatements(args[bodyIndex]);
    }

    return nativeFunctionConstructor.apply(this, args);
  };

  safeFunctionConstructor.prototype = nativeFunctionConstructor.prototype;

  globalThis.setInterval = createSafeTimer(nativeSetInterval, "setInterval");
  globalThis.setTimeout = createSafeTimer(nativeSetTimeout, "setTimeout");

  if (typeof nativeEval === "function") {
    globalThis.eval = function (source) {
      if (hasDebuggerStatement(source)) {
        console.warn("[antiDebugOverride] Neutralized eval debugger body");
        return nativeEval.call(this, neutralizeDebuggerStatements(source));
      }

      return nativeEval.call(this, source);
    };
  }

  globalThis.Function = safeFunctionConstructor;
  Function.prototype.constructor = safeFunctionConstructor;
  globalThis.__autoSbcAntiDebugPatched = true;
};

// Apply immediately at bundle load time rather than waiting on the gated
// init() sequence (which stalls until services.Localization is ready) —
// by then the page's own debug-protection interval already captured the
// native setInterval/eval references and our override would arrive too late.
antiDebugOverride();