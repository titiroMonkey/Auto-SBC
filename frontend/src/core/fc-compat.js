// FC 27 compatibility layer — must load first.
//
// FC 27 minified the global `JSUtils` helper and stopped exposing the EA
// view/controller classes the rest of this userscript subclasses and patches.
// This module restores the globals downstream modules expect by resolving them
// from the live runtime via feature fingerprints, and installs safe
// placeholders for classes that are not yet resolvable so module load never
// throws a ReferenceError. Real per-class resolution is layered on top of this
// as the FC 27 migration progresses.
(function fcCompat() {
  const W = window;

  const hasFns = (o, fns) => {
    if (!o) return false;
    for (const f of fns) {
      try {
        if (typeof o[f] !== "function") return false;
      } catch (_) {
        return false;
      }
    }
    return true;
  };

  const hasKeys = (o, keys) => {
    if (!o || typeof o !== "object") return false;
    return keys.every((k) => k in o);
  };

  // Find the first global (object or function) matching a predicate.
  const scanGlobals = (pred) => {
    for (const k of Object.getOwnPropertyNames(W)) {
      let v;
      try {
        v = W[k];
      } catch (_) {
        continue;
      }
      if (v == null) continue;
      try {
        if (pred(v, k)) return v;
      } catch (_) {
        /* ignore hostile getters */
      }
    }
    return null;
  };

  // 1) JSUtils — the EA JS utility helper (isObject/isNumber/.../inherits).
  if (!(W.JSUtils && typeof W.JSUtils.inherits === "function")) {
    const util = scanGlobals(
      (v) =>
        (typeof v === "object" || typeof v === "function") &&
        hasFns(v, [
          "isObject",
          "isNumber",
          "isString",
          "isValid",
          "isEmpty",
          "inherits",
        ]),
    );
    if (util) W.JSUtils = util;
  }

  // 2) ItemPile — pile id enum (PURCHASED=6, TRANSFER=5, CLUB=7, ...).
  if (typeof W.ItemPile === "undefined") {
    const ip = scanGlobals((v) => hasKeys(v, ["PURCHASED", "TRANSFER", "CLUB"]));
    if (ip) W.ItemPile = ip;
  }

  // 3) UINotificationType — notification severity enum (POSITIVE/NEGATIVE).
  if (typeof W.UINotificationType === "undefined") {
    const nt = scanGlobals(
      (v) => hasKeys(v, ["POSITIVE", "NEGATIVE"]) && !hasFns(v, ["inherits"]),
    );
    if (nt) W.UINotificationType = nt;
  }

  // 3b) Resolve EA classes that FC 27 still exposes as globals under minified
  //     names, matched by unique prototype-method / static fingerprints. These
  //     are boot-loaded, so assigning them here (before init runs) lets the
  //     existing overrides patch the real classes.
  const ownsProto = (fn, m) => {
    try {
      return Object.getOwnPropertyNames(fn.prototype).includes(m);
    } catch (_) {
      return false;
    }
  };
  const staticPath = (fn, path) => {
    try {
      let o = fn;
      for (const k of path) {
        o = o[k];
        if (o == null) return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  };
  const scanClasses = (pred) => {
    const hits = [];
    for (const k of Object.getOwnPropertyNames(W)) {
      let v;
      try {
        v = W[k];
      } catch (_) {
        continue;
      }
      if (typeof v !== "function") continue;
      try {
        if (pred(v)) hits.push(v);
      } catch (_) {
        /* ignore */
      }
    }
    return hits;
  };
  // Only assign when a fingerprint matches exactly one global (avoids
  // mis-binding to a sibling/subclass).
  const resolveUnique = (name, pred) => {
    if (W.__fcCompatIsReal && W.__fcCompatIsReal(name)) return true;
    const hits = scanClasses(pred);
    if (hits.length === 1) {
      W[name] = hits[0];
      return true;
    }
    return false;
  };

  const classFingerprints = {
    PopupQueueViewController: (f) =>
      hasFns(f.prototype, ["displayPopup", "closeActivePopup"]),
    UTSBCFavoriteButtonControl: (f) => hasFns(f.prototype, ["watchSBCSet"]),
    UTUnassignedItemsViewModel: (f) => staticPath(f, ["SECTION", "ITEMS"]),
    UTStoreViewController: (f) =>
      ownsProto(f, "eOpenPack") && hasFns(f.prototype, ["getStorePacks"]),
  };

  W.__fcResolvedClasses = W.__fcResolvedClasses || {};
  for (const [name, pred] of Object.entries(classFingerprints)) {
    if (resolveUnique(name, pred)) W.__fcResolvedClasses[name] = true;
  }

  // 3c) Resolve classes reachable through a live repository/service singleton
  //     rather than as standalone globals.
  const resolveFromInstance = (name, instance) => {
    try {
      if (instance && instance.constructor) {
        W[name] = instance.constructor;
        W.__fcResolvedClasses[name] = true;
        return true;
      }
    } catch (_) {
      /* ignore */
    }
    return false;
  };
  // UTServerSettingsRepository exposes the SQUAD_RATING_FLOAT_CALCULATION_ENABLED
  // key enum used by the SBC rating logic.
  if (!(W.__fcCompatIsReal && W.__fcCompatIsReal("UTServerSettingsRepository"))) {
    try {
      const ss = W.repositories && W.repositories.ServerSettings;
      if (ss && ss.constructor && ss.constructor.KEY) {
        resolveFromInstance("UTServerSettingsRepository", ss);
      }
    } catch (_) {
      /* ignore */
    }
  }
  // UTItemEntity is no longer a global; the item factory still builds real
  // instances, so derive the constructor from one.
  if (!(W.__fcCompatIsReal && W.__fcCompatIsReal("UTItemEntity"))) {
    try {
      const item =
        W.factories &&
        W.factories.Item &&
        typeof W.factories.Item.createItem === "function"
          ? W.factories.Item.createItem({})
          : null;
      resolveFromInstance("UTItemEntity", item);
    } catch (_) {
      /* ignore */
    }
  }

  // 4) Safe placeholders for EA classes that may be briefly undefined at module
  //    load, so top-level `JSUtils.inherits(child, Legacy)` and
  //    `Legacy.prototype.x = …` do not throw. On FC 27 every class the overrides
  //    patch (UTStoreView, UTSquadPitchView, UTSBCSetTileView, UTHomeHubView,
  //    UTGameTabBarController, …) is a real global, so this list only needs the
  //    handful of names still referenced defensively at load time.
  const placeholderClasses = [
    "UTHomeHubViewController",
    "UTHomeHubView",
    "UTPlayerItemView",
    "UTUnassignedItemsViewController",
    "UTNavigationBarView",
    "UTCurrencyNavigationBarView",
    "UTSquadSummaryBannerView",
  ];

  W.__fcCompatPlaceholders = W.__fcCompatPlaceholders || {};
  for (const name of placeholderClasses) {
    if (typeof W[name] === "undefined") {
      const Placeholder = function FCCompatPlaceholder() {};
      Placeholder.__fcCompatPlaceholder = true;
      // Some call sites read static enums (e.g. UTNavigationBarView.Style).
      Placeholder.Style = { PRIMARY: 1, SECONDARY: 0 };
      W[name] = Placeholder;
      W.__fcCompatPlaceholders[name] = Placeholder;
    }
  }

  // Returns true when a global is a real EA class rather than a compat stub.
  W.__fcCompatIsReal = (name) =>
    typeof W[name] !== "undefined" && !W[name].__fcCompatPlaceholder;

  W.__fcCompat = {
    jsUtils: !!(W.JSUtils && W.JSUtils.inherits),
    itemPile: typeof W.ItemPile !== "undefined",
    uiNotify: typeof W.UINotificationType !== "undefined",
    resolvedClasses: Object.keys(W.__fcResolvedClasses || {}),
    placeholders: Object.keys(W.__fcCompatPlaceholders),
  };

  try {
    console.log("[FC27-compat]", JSON.stringify(W.__fcCompat));
  } catch (_) {
    /* console may be unavailable */
  }
})();
