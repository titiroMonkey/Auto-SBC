let priceCacheMinutes = 60;
let PRICE_ITEMS_KEY = "futggPrices";
let cachedPriceItems;
let hasShownFetchPlayersProgressBar = false;

const isConceptLikePriceItem = (item) =>
  !!item?.concept || Number(item?.owners) === 0;

const clearConceptStateOnOwnedItem = (item) => {
  if (!item || typeof item !== "object") return;

  try {
    item.concept = false;
    item.__autoSbcCurrentSquadConcept = false;
    item.__autoSbcForceIncludeCurrentSolution = false;

    const owners = Number(item?.owners);
    if (!Number.isFinite(owners) || owners <= 0) {
      item.owners = 1;
    }

    if (item._staticData && typeof item._staticData === "object") {
      item._staticData.concept = false;
    }
  } catch {}
};

const clearConceptStateOnOwnedItems = (items) => {
  const list = Array.isArray(items) ? items : [items];
  list.forEach((item) => clearConceptStateOnOwnedItem(item));
};

const patchMoveToClubClearsConceptState = () => {
  if (window.__autoSbcMoveToClubConceptPatchApplied) return true;
  if (!services?.Item?.move) return false;

  const originalMove = services.Item.move;
  services.Item.move = function (items, pile, ...args) {
    if (Number(pile) === 7) {
      clearConceptStateOnOwnedItems(items);
    }
    return originalMove.call(this, items, pile, ...args);
  };

  window.__autoSbcMoveToClubConceptPatchApplied = true;
  return true;
};

patchMoveToClubClearsConceptState();

const normalizePriceType = (rawType) => {
  if (rawType === null || rawType === undefined || rawType === "") {
    return "PLAYER";
  }

  if (
    typeof rawType === "number" &&
    typeof SearchType !== "undefined" &&
    rawType === SearchType.PLAYER
  ) {
    return "PLAYER";
  }

  const normalized = rawType.toString().toUpperCase();
  if (normalized === "ANY") {
    return "PLAYER";
  }
  return normalized;
};

let isPriceOld = function (item) {
  let PriceItems = getPriceItems();
  if (!(item?.definitionId in PriceItems)) {
    return true;
  }
  const entry = PriceItems[item.definitionId];
  // Extinct players have no market listings, so avoid re-checking them
  // repeatedly: only treat their price as stale once at least 10 minutes
  // have passed since the last refresh (and never sooner than the normal cache).
  let cacheMin = entry?.isExtinct
    ? Math.max(getSettings(0, 0, "priceCacheMinutes"), 10)
    : getSettings(0, 0, "priceCacheMinutes");
  let timeStamp = new Date(entry?.timeStamp);

  let now = new Date(Date.now());
  let cacheDate = timeStamp.getTime() + cacheMin * 60 * 1000;
  if (entry && entry?.timeStamp && cacheDate < now) {
    return true;
  }
  return false;
};
let getPrice = function (item) {
  if (!item?.definitionId) {
    return null;
  }

  let PriceItems = getPriceItems();

  if (!(item.definitionId in PriceItems)) {
    return null;
  }

  const entry = PriceItems[item.definitionId];
  const isCbrKey =
    typeof item.definitionId === "string" && item.definitionId.includes("_CBR");

  if (!isCbrKey) {
    const rawType =
      (typeof item.getSearchType === "function" && item.getSearchType()) ||
      item.type ||
      null;
    const normalizedType = normalizePriceType(rawType);
    const skipTypeValidation = isConceptLikePriceItem(item);

    if (
      !skipTypeValidation &&
      entry?.type &&
      normalizedType &&
      entry.type !== normalizedType
    ) {
      return null;
    }
  }

  return entry?.price;

  //console.log(PriceItems[item.definitionId])
  let cacheMin = item.concept ? 1440 : getSettings(0, 0, "priceCacheMinutes");
  let timeStamp = new Date(PriceItems[item.definitionId]?.timeStamp);

  let now = new Date(Date.now());

  if (
    PriceItems[item.definitionId] &&
    PriceItems[item.definitionId]?.timeStamp &&
    cacheDate < now
  ) {
    //console.log('Cache is old',PriceItems[item.definitionId],item)
    return null;
  }
  let fbPrice = PriceItems[item.definitionId]?.price;
  return fbPrice;
};

// Function to update minimum prices for CBR (Common Base Rating)
const updateCBRMinPrice = () => {
  const PriceItems = getPriceItems();
  if (!PriceItems) return {};

  const now = new Date();

  // Drop entries that lack a type (non-CBR) and normalize type casing
  for (const key of Object.keys(PriceItems)) {
    const entry = PriceItems[key];
    const isCbr = key.toString().includes("_CBR");

    if (!entry) {
      delete PriceItems[key];
      continue;
    }

    if (isCbr) {
      if (!entry.type) {
        const inferredType = key.split("_")[0]?.toUpperCase();
        if (inferredType) {
          entry.type = inferredType;
        }
      } else {
        entry.type = entry.type.toString().toUpperCase();
      }
      continue;
    }

    if (!entry.type) {
      delete PriceItems[key];
      continue;
    }

    entry.type = entry.type.toString().toUpperCase();
  }

  // Build maps for rating-only and type+rating minimums
  const minByRating = new Map();
  const minByTypeRating = new Map();

  for (const key of Object.keys(PriceItems)) {
    if (key.endsWith("_CBR")) continue;
    const entry = PriceItems[key];
    const rating = Number(entry?.rating);
    const type = entry?.type;

    if (!Number.isFinite(rating) || !type) continue;
    if (!entry.price || entry.isExtinct) continue;

    const currentRatingMin = minByRating.get(rating) ?? Infinity;
    if (entry.price < currentRatingMin) {
      minByRating.set(rating, entry.price);
    }

    const typeRatingKey = `${type}|${rating}`;
    const currentTypeMin = minByTypeRating.get(typeRatingKey) ?? Infinity;
    if (entry.price < currentTypeMin) {
      minByTypeRating.set(typeRatingKey, entry.price);
    }
  }

  const upsert = (key, payload) => {
    const existing = PriceItems[key] || {};
    PriceItems[key] = {
      ...existing,
      ...payload,
      timeStamp: now,
      isExtinct: false,
    };
  };

  for (const [rating, minPrice] of minByRating.entries()) {
    const cbrKey = `${rating}_CBR`;
    upsert(cbrKey, {
      eaId: cbrKey,
      rating,
      price: minPrice,
      type: "PLAYER",
    });
  }

  for (const [typeRatingKey, minPrice] of minByTypeRating.entries()) {
    const [type, ratingStr] = typeRatingKey.split("|");
    const rating = Number(ratingStr);
    const cbrKey = `${type}_${rating}_CBR`;
    upsert(cbrKey, {
      eaId: cbrKey,
      rating,
      price: minPrice,
      type,
    });
  }

  savePriceItems();
  cachedPriceItems = PriceItems;
  return cachedPriceItems;
};
let PriceItem = function (items) {
  //  console.log(item, price, lastUpdated)

  cachedPriceItems = getPriceItems() || {};
  let timeStamp = new Date(Date.now());

  for (let key in items) {
    const payload = { ...items[key] };
    const eaId = payload?.eaId ?? key;
    if (!eaId) continue;

    const isCbr = eaId.toString().includes("_CBR");
    const normalizedType = payload?.type
      ? payload.type.toString().toUpperCase()
      : isCbr
        ? eaId.toString().split("_")[0]?.toUpperCase()
        : null;

    if (!isCbr && !normalizedType) {
      delete cachedPriceItems[eaId];
      continue;
    }

    payload.timeStamp = timeStamp;
    payload.type = normalizedType;

    cachedPriceItems[eaId] = {
      ...(cachedPriceItems[eaId] || {}),
      ...payload,
    };
  }

  updateCBRMinPrice();
};

globalThis.__autoSbcDbVersion = Number(globalThis.__autoSbcDbVersion || 4);

const openPriceItemsDb = (onSuccess, onError) => {
  const dbName = "futSBCDatabase";
  const storeName = "priceItems";

  const ensureStore = (db) => {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: "id" });
    }
  };

  // Open at current DB version first to avoid VersionError when the existing
  // DB is newer than our expected version.
  const openRequest = indexedDB.open(dbName);

  openRequest.onsuccess = function (event) {
    const db = event.target.result;

    if (db.objectStoreNames.contains(storeName)) {
      onSuccess(db);
      return;
    }

    const nextVersion = Number(db.version || 0) + 1;
    db.close();

    const upgradeRequest = indexedDB.open(dbName, nextVersion);

    upgradeRequest.onupgradeneeded = function (upgradeEvent) {
      ensureStore(upgradeEvent.target.result);
    };

    upgradeRequest.onsuccess = function (upgradeEvent) {
      const upgradeDb = upgradeEvent.target.result;
      if (!upgradeDb.objectStoreNames.contains(storeName)) {
        onError?.(new Error("priceItems store missing after upgrade"));
        return;
      }
      onSuccess(upgradeDb);
    };

    upgradeRequest.onerror = function (upgradeEvent) {
      onError?.(upgradeEvent.target.error);
    };
  };

  openRequest.onerror = function (event) {
    onError?.(event.target.error);
  };
};

let getPriceItems = function () {
  if (cachedPriceItems) {
    return cachedPriceItems;
  }
  cachedPriceItems = {};
  function getFromIndexedDB() {
    return new Promise((resolve) => {
      const storeName = "priceItems";
      openPriceItemsDb(
        (db) => {
          let transaction;
          let store;
          try {
            transaction = db.transaction([storeName], "readonly");
            store = transaction.objectStore(storeName);
          } catch (error) {
            console.error("Error creating read transaction for IndexedDB:", error);
            resolve({});
            return;
          }

          // Get the single entry that contains all price items
          const getAllRequest = store.get("allPriceItems");

          getAllRequest.onsuccess = function (event) {
            if (event.target.result && event.target.result.data) {
              resolve(event.target.result.data || {});
            } else {
              resolve({});
            }
          };

          transaction.onerror = function () {
            console.error("Error reading from IndexedDB");
            resolve({});
          };
        },
        (error) => {
          console.error("Error opening IndexedDB:", error);
          resolve({});
        },
      );
    });
  }

  getFromIndexedDB().then((idbItems) => {
    cachedPriceItems = idbItems || {};
  });
  return cachedPriceItems;
};

const listLowestPricePlayersByRating = async ({
  minRating = 40,
  maxRating = 99,
  includeConcepts = true,
  includeStorage = true,
  refreshPrices = false,
} = {}) => {
  const nameOf = (p) =>
    p?._staticData?.name ||
    [p?._staticData?.firstName, p?._staticData?.lastName]
      .filter(Boolean)
      .join(" ") ||
    String(p?.definitionId ?? "Unknown");

  const club = (await fetchPlayers({ count: Infinity })) || [];
  const storage = includeStorage ? (await getStoragePlayers()) || [] : [];
  const storageIds = new Set(storage.map((p) => p?.id).filter(Boolean));

  let conceptsArr = [];
  if (includeConcepts) {
    try {
      if (!conceptPlayersCollected) {
        conceptPlayers = await getConceptPlayers();
      }
      conceptsArr = (conceptPlayersCollected ? conceptPlayers : []) || [];
    } catch (e) {
      console.warn("Concept players not available", e);
    }
  }

  const pool = [...club, ...storage, ...conceptsArr].filter((p) => {
    const isPlayer =
      (typeof p?.isPlayer === "function" && p.isPlayer()) ||
      p?.isPlayer === true;
    return (
      p &&
      isPlayer &&
      Number(p.rating) >= minRating &&
      Number(p.rating) <= maxRating &&
      Number(p.definitionId) > 0
    );
  });

  const needPrices = pool.filter(
    (p) => refreshPrices || getPrice(p) == null || isPriceOld(p),
  );
  if (needPrices.length) await fetchPlayerPrices(needPrices);

  const priceItems = getPriceItems();
  const bestByRating = new Map();

  for (const p of pool) {
    const entry = priceItems?.[p.definitionId];
    if (entry?.isExtinct) continue;

    const price = getPrice(p);
    if (!Number.isFinite(price) || price <= 0) continue;

    const rating = Number(p.rating);
    const current = bestByRating.get(rating);

    const info = {
      rating,
      price,
      definitionId: p.definitionId,
      id: p.id,
      name: nameOf(p),
      concept: !!p.concept,
      storage: storageIds.has(p.id),
      item: p,
    };

    if (!current || price < current.price) {
      bestByRating.set(rating, { price, players: [info] });
    } else if (price === current.price) {
      current.players.push(info);
    }
  }

  const result = Array.from(bestByRating.entries())
    .sort(([a], [b]) => a - b)
    .map(([rating, { price, players }]) => ({
      rating,
      price,
      players: players.map((x) => ({
        name: x.name,
        definitionId: x.definitionId,
        source: x.concept ? "concept" : x.storage ? "storage" : "club",
      })),
    }));

  console.table(
    result.map((r) => ({
      rating: r.rating,
      price: r.price,
      players: r.players.map((p) => `${p.name} (${p.source})`).join(" | "),
    })),
  );

  const lowestItems = Array.from(bestByRating.values()).flatMap((v) =>
    (v.players || []).map((p) => p.item).filter(Boolean),
  );

  if (lowestItems.length) {
    await goToUnassignedView(lowestItems);
  }

  return result;
};

window.listLowestPricePlayersByRating = listLowestPricePlayersByRating;
let isFodder = function (item, itemType, itemRating, debug = false) {
  const log = (...args) => {
    if (debug) console.log(...args);
  };

  if (!item) {
    log("[isFodder] false: no item");
    return false;
  }

  const PriceItems = getPriceItems();

  const rating =
    Number.isFinite(itemRating) && itemRating > 0
      ? itemRating
      : Number(item?.rating ?? item?._staticData?.rating ?? 0);

  const type = (itemType ?? item.getSearchType?.() ?? "PLAYER")
    .toString()
    .toUpperCase();

  const priceEntry = PriceItems[item.definitionId] ?? {};
  const price = getPrice(item);

  const typeKey = `${type}_${rating}_CBR`;
  const ratingKey = `${rating}_CBR`;
  const fallbackLimits = item?._itemPriceLimits?.minimum || 0;

  const typeFodder = getPrice({ definitionId: typeKey }) || 0;
  const ratingFodder = getPrice({ definitionId: ratingKey }) || 0;

  const fodderPrice = Math.max(typeFodder || ratingFodder || 0, fallbackLimits);

  const tiers = UTCurrencyInputControl?.PRICE_TIERS;

  const tier = Number.isFinite(price)
    ? tiers.reduce(
        (best, t) => (price >= t.min && (!best || t.min > best.min) ? t : best),
        null,
      )
    : null;

  const tierInc = (tier || tiers[0]).inc;

  const threshold = Number.isFinite(fodderPrice) ? fodderPrice * 1.1 : NaN;
  const diff =
    Number.isFinite(price) && Number.isFinite(fodderPrice)
      ? Math.abs(price - fodderPrice)
      : NaN;
  const withinTierBand = Number.isFinite(diff) ? diff <= tierInc * 2 : false;

  if (debug) {
    console.groupCollapsed(
      `[isFodder] ${item?._staticData?.name ?? item.definitionId} => evaluating`,
    );
    log({ definitionId: item.definitionId, rating, type });
    log({ priceEntry, price });
    log({
      typeKey,
      ratingKey,
      typeFodder,
      ratingFodder,
      fallbackLimits,
      fodderPrice,
    });
    log({ threshold_110pct: threshold, tierInc, diff, withinTierBand });
  }

  if (!rating) {
    log("[isFodder] false: rating missing/0");
    debug && console.groupEnd();
    return false;
  }

  if (priceEntry.isExtinct || priceEntry.isObjective) {
    log("[isFodder] false: excluded (extinct/objective)");
    debug && console.groupEnd();
    return false;
  }

  if (!Number.isFinite(price)) {
    log("[isFodder] false: price missing/invalid");
    debug && console.groupEnd();
    return false;
  }

  if (fodderPrice === 0) {
    log("[isFodder] false: fodderPrice computed as 0");
    debug && console.groupEnd();
    return false;
  }

  if (price <= threshold) {
    log("[isFodder] true: price <= fodderPrice * 1.1", { price, threshold });
    debug && console.groupEnd();
    return true;
  }

  const result = withinTierBand;
  log(`[isFodder] ${result}: |price - fodderPrice| <= tierInc * 2`, {
    price,
    fodderPrice,
    diff,
    tierInc,
    tierBand: tierInc * 2,
  });

  debug && console.groupEnd();
  return result;
};

window.isFodder = isFodder;

let savePriceItems = function () {
  function saveToIndexedDB() {
    const storeName = "priceItems";
    openPriceItemsDb(
      (db) => {
        let transaction;
        let store;
        try {
          transaction = db.transaction([storeName], "readwrite");
          store = transaction.objectStore(storeName);
        } catch (error) {
          console.error("Error creating write transaction for IndexedDB:", error);
          localStorage.setItem(PRICE_ITEMS_KEY, JSON.stringify(cachedPriceItems));
          return;
        }

        // First clear existing data
        store.clear().onsuccess = function () {
          // Store the entire price items collection in a single entry
          const allItems = {
            id: "allPriceItems",
            data: cachedPriceItems,
          };

          store.put(allItems);
        };

        transaction.oncomplete = function () {
          console.log("Price items saved to IndexedDB");
        };

        transaction.onerror = function (error) {
          console.error("Error saving to IndexedDB:", error);
          // Fallback to localStorage if IndexedDB fails
          localStorage.setItem(PRICE_ITEMS_KEY, JSON.stringify(cachedPriceItems));
        };
      },
      (error) => {
        console.error("IndexedDB error:", error);
        // Fallback to localStorage if IndexedDB cannot be opened
        localStorage.setItem(PRICE_ITEMS_KEY, JSON.stringify(cachedPriceItems));
      },
    );
  }

  // Call the function to save the data
  saveToIndexedDB();
};

// Hard cap for any single fut.gg HTTP request. Without this, a stalled
// GM_xmlhttpRequest never settles, permanently blocking futggPriceFetchChain
// and any awaited fetchPlayerPrices call (which stalls the unassigned process).
const FUTGG_REQUEST_TIMEOUT_MS = 20000;

function makeGetRequest(url) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url: url,
      timeout: FUTGG_REQUEST_TIMEOUT_MS,
      onload: function (response) {
        const status = Number(response?.status || 0);
        if (status >= 200 && status < 300) {
          resolve(response.responseText);
          return;
        }
        reject({
          status,
          responseText: response?.responseText,
          url,
        });
      },
      onerror: function (error) {
        reject(error);
      },
      ontimeout: function () {
        reject({ status: 0, timeout: true, url });
      },
      onabort: function () {
        reject({ status: 0, aborted: true, url });
      },
    });
  });
}

// Current EA FC game year used by fut.gg API paths.
const FUTGG_GAME_YEAR = 27;
const FUTGG_ORIGIN = "https://www.fut.gg";
const FUTGG_SIGN_ENDPOINT = `${FUTGG_ORIGIN}/api/fut/price-access/sign/`;
const FUTGG_PRICE_BATCH_SIZE_MAX = 50;
const FUTGG_PRICE_BATCH_SIZE_DEFAULT = 50;
const FUTGG_PRICE_REQUEST_DELAY_MS_DEFAULT = 1300;
const FUTGG_PRICE_ERROR_BACKOFF_MS_DEFAULT = 3000;
const FUTGG_CONCEPT_PRICE_BATCH_SIZE_DEFAULT = 50;
const FUTGG_CONCEPT_PRICE_REQUEST_DELAY_MS_DEFAULT = 550;
const FUTGG_CONCEPT_PRICE_ERROR_BACKOFF_MS_DEFAULT = 1800;
const FUTGG_429_BASE_BACKOFF_MS_DEFAULT = 2500;
const FUTGG_429_MAX_BACKOFF_MS_DEFAULT = 90000;
const FUTGG_PRICE_BLOCK_UNTIL_KEY = "futggPriceBlockUntil";

let futggPriceFetchChain = Promise.resolve();

const sleepMs = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

const getNextLocalMidnightMs = () => {
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime();
};

const getFutggPriceBlockUntil = () => {
  const raw = Number(localStorage.getItem(FUTGG_PRICE_BLOCK_UNTIL_KEY));
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }

  if (raw <= Date.now()) {
    localStorage.removeItem(FUTGG_PRICE_BLOCK_UNTIL_KEY);
    return 0;
  }

  return raw;
};

const setFutggPriceBlockedUntilNextDay = () => {
  const blockUntil = getNextLocalMidnightMs();
  localStorage.setItem(FUTGG_PRICE_BLOCK_UNTIL_KEY, String(blockUntil));
  return blockUntil;
};

// fut.gg now gates price endpoints behind a short-lived signed `verify` token.
// Flow: POST the relative price path to the sign endpoint, then GET the signed
// URL it returns (token expires in ~120s, so sign immediately before fetching).
function makeSignedPostRequest(url, data) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "POST",
      url: url,
      timeout: FUTGG_REQUEST_TIMEOUT_MS,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: data,
      onload: function (response) {
        const status = Number(response?.status || 0);
        if (status >= 200 && status < 300) {
          resolve(response.responseText);
          return;
        }
        reject({
          status,
          responseText: response?.responseText,
          url,
        });
      },
      onerror: function (error) {
        reject(error);
      },
      ontimeout: function () {
        reject({ status: 0, timeout: true, url });
      },
      onabort: function () {
        reject({ status: 0, aborted: true, url });
      },
    });
  });
}

// Sign a relative fut.gg price path and fetch it, returning the parsed JSON.
async function fetchFutggSignedJson(relativePath) {
  const signResponse = await makeSignedPostRequest(
    FUTGG_SIGN_ENDPOINT,
    JSON.stringify({ url: relativePath }),
  );
  const signed = JSON.parse(signResponse);
  const signedPath = signed?.data?.url;
  if (!signedPath) {
    throw new Error("fut.gg price sign failed: missing signed url");
  }
  const body = await makeGetRequest(`${FUTGG_ORIGIN}${signedPath}`);
  return JSON.parse(body);
}

function makePostRequest(url, data) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: "POST",
      body: data,
    })
      .then((response) => {
        // 1. check response.ok
        if (response.ok) {
          return response.json();
        }
        return Promise.reject(response); // 2. reject instead of throw
      })
      .then((json) => {
        resolve(json);
      })
      .catch((error) => {
        console.log(error);
        if (getSettings(0, 0, "playSounds")) {
          wompSound.play();
        }
        showNotification(
          `Please check backend API is running`,
          UINotificationType.NEGATIVE,
        );
        clearInterval(logPollInterval);
        clearInterval(countDownInterval);
        hideLoader();
      });
  });
}
const convertAbbreviatedNumber = (number) => {
  let base = parseFloat(number);
  if (number.toLowerCase().match(/k/)) {
    return Math.round(base * 1000);
  } else if (number.toLowerCase().match(/m/)) {
    return Math.round(base * 1000000);
  }
  return number * 1;
};

let priceResponse;
const fetchLowestPriceByRating = async () => {
  let PriceItems = getPriceItems();
  let timeStamp = new Date(Date.now());

  for (let i = 45; i <= 81; i++) {
    PriceItems[i + "_CBR"] = {
      price: i < 75 ? 200 : 400,
      timestamp: timeStamp,
      rating: i,
      type: "PLAYER",
    };
  }
  cachedPriceItems = PriceItems;
  let highestRating = await getConceptPlayers(1);
  updateCBRMinPrice();
  for (let i = 81; i <= Math.max(...highestRating.map((m) => m.rating)); i++) {
    if (isPriceOld({ definitionId: i + "_CBR" })) {
      await fetchSingleCheapest(i);
    }
    await fetchSingleCheapest(i);
  }
  updateCBRMinPrice();
};
const fetchSingleCheapest = async (rating) => {
  return; //this doesnt work any more since futgg changed their site
  const futggSingleCheapestByRatingResponse = await makeGetRequest(
    `https://www.fut.gg/players/?overall__gte=${rating}&overall__lte=${rating}&price__gte=100&sorts=current_price&market_players=1`,
  );

  const doc = new DOMParser().parseFromString(
    futggSingleCheapestByRatingResponse,
    "text/html",
  );

  try {
    let playerLink = doc
      .getElementsByClassName("fut-card-container")[0]
      .href?.split("25-")[1]
      .replace("/", "");

    const futggResponse = await makeGetRequest(
      `https://www.fut.gg/api/fut/player-prices/25/?ids=${playerLink}`,
    );
    //  console.log(rating,doc,`https://www.fut.gg/api/fut/player-prices/25/?ids=${playerLink}`, doc.getElementsByClassName("fut-card-container")[0].href)

    priceResponse = JSON.parse(futggResponse);
    priceResponse = priceResponse.data;
  } catch (error) {
    console.error(error, doc);

    return;
  }
  let PriceItems = getPriceItems();
  let timeStamp = new Date(Date.now());
  for (let key in priceResponse) {
    priceResponse[key]["timeStamp"] = timeStamp;
    priceResponse[key]["rating"] = rating;
    PriceItems[rating + "_CBR"] = priceResponse[key];
  }
  cachedPriceItems = PriceItems;
  console.log(rating, PriceItems[rating + "_CBR"]);
};

// Populate `_itemPriceLimits` for an item by asking EA for its market data.
// Club / extinct items that have never been opened on the transfer market have
// no price limits until this runs. Resolves to the item's price limits (or null).
let ensureItemMarketData = (item) =>
  new Promise((resolve) => {
    const current = item?._itemPriceLimits;
    const hasMin = Number.isFinite(Number(current?.minimum));
    const hasMax = Number.isFinite(Number(current?.maximum));
    // Already populated -> skip the network call.
    if (hasMin && hasMax) {
      resolve(current);
      return;
    }
    if (!item || typeof services?.Item?.requestMarketData !== "function") {
      resolve(current || null);
      return;
    }

    const isExtinct = Boolean(getPriceItems()?.[item?.definitionId]?.isExtinct);
    const cardInfo = {
      defId: item?.definitionId,
      name:
        item?._staticData?.name ||
        item?._staticData?.lastName ||
        item?.name ||
        item?.definitionId,
      rating: item?.rating ?? item?._staticData?.rating,
      isExtinct,
    };
    console.log(
      "[itemPriceLimits] extinct card needs price limits, requesting market data",
      cardInfo,
    );

    try {
      services.Item.requestMarketData(item).observe(
        undefined,
        (_sender, response) => {
          const limits = item?._itemPriceLimits || null;
          if (response?.success === false) {
            console.warn("[itemPriceLimits] request failed", {
              ...cardInfo,
              status: response?.status,
            });
          } else {
            console.log("[itemPriceLimits] loaded", {
              ...cardInfo,
              minimum: limits?.minimum ?? null,
              maximum: limits?.maximum ?? null,
            });
          }
          resolve(limits);
        },
      );
    } catch (err) {
      console.warn("[itemPriceLimits] error", { ...cardInfo, error: String(err) });
      resolve(item?._itemPriceLimits || null);
    }
  });

let fetchLivePlayerPrice = async (player, options = {}) => {
  const {
    onCandidate,
    suppressNotification = false,
    excludeTradeIds = [],
    excludeItemIds = [],
  } = options || {};
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const t0 = performance.now();

  const log = () => {};

  if (!player) {
    log("warn", "guard:no-player");
    return null;
  }

  const rawSearchType =
    (typeof player?.getSearchType === "function" && player.getSearchType()) ||
    player?.type ||
    "";
  const normalizedSearchType = String(rawSearchType).toUpperCase();
  if (normalizedSearchType === "ANY") {
    log("info", "guard:skip-any-type", { rawSearchType });
    return null;
  }

  log("info", "start");

  const DEFAULT_TIERS = [
    { min: 0, inc: 50 },
    { min: 1000, inc: 100 },
    { min: 10000, inc: 250 },
    { min: 50000, inc: 500 },
    { min: 100000, inc: 1000 },
    { min: 200000, inc: 2000 },
    { min: 500000, inc: 5000 },
    { min: 1000000, inc: 10000 },
  ];

  const tiers =
    Array.isArray(UTCurrencyInputControl?.PRICE_TIERS) &&
    UTCurrencyInputControl.PRICE_TIERS.length
      ? [...UTCurrencyInputControl.PRICE_TIERS].sort((a, b) => a.min - b.min)
      : DEFAULT_TIERS;

  const MAX_RESULTS = 21;
  const MAX_CAP_LIMIT = 15000000;
  const MAX_SEARCH_CALLS = 18;
  let searchCallCount = 0;

  log("info", "tiers:init", {
    tiersCount: tiers.length,
    maxResults: MAX_RESULTS,
    maxCapLimit: MAX_CAP_LIMIT,
  });

  let bestListing = null;
  let bestPrice = Number.POSITIVE_INFINITY;

  const excludedTradeIds = new Set(
    (excludeTradeIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  );
  const excludedItemIds = new Set(
    (excludeItemIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  );

  const getListingTradeId = (listing) =>
    Number(listing?._auction?.tradeId ?? listing?._auction?.id ?? 0);
  const getListingItemId = (listing) => Number(listing?.id ?? 0);
  const isListingExcluded = (listing) => {
    const tradeId = getListingTradeId(listing);
    if (Number.isFinite(tradeId) && tradeId > 0 && excludedTradeIds.has(tradeId)) {
      return true;
    }

    const itemId = getListingItemId(listing);
    if (Number.isFinite(itemId) && itemId > 0 && excludedItemIds.has(itemId)) {
      return true;
    }

    return false;
  };

  const registerCandidate = (price, item, meta = {}) => {
    if (!Number.isFinite(price) || !item) return;
    if (price < bestPrice || !bestListing) {
      bestPrice = price;
      bestListing = item;
      try {
        if (typeof onCandidate === "function") {
          onCandidate({
            price: bestPrice,
            listing: bestListing,
            player,
            meta,
          });
        }
      } catch (err) {
        log("warn", "candidate:callback-failed", { error: String(err) });
      }
      log("info", "candidate:update", {
        price: bestPrice,
        ...meta,
      });
    }
  };

  const persistLivePrice = (listing, isExtinct = false) => {
    const defId = player?.definitionId;
    if (!defId) return;

    const rating = Number.isFinite(player?.rating)
      ? player.rating
      : Number(player?._staticData?.rating ?? 0);

    let normalizedPrice = null;
    if (!isExtinct) {
      const listingPrice = Number(listing?._auction?.buyNowPrice);
      if (Number.isFinite(listingPrice)) {
        normalizedPrice = Math.max(0, Math.floor(listingPrice));
      } else if (Number.isFinite(bestPrice)) {
        normalizedPrice = Math.max(0, Math.floor(bestPrice));
      }
    }

    if (!isExtinct && !Number.isFinite(normalizedPrice)) return;

    const priceLimitMax = Number(player?._itemPriceLimits?.maximum);
    const priceLimitMin = Number(player?._itemPriceLimits?.minimum);

    const itemPayload = {
      [defId]: {
        eaId: defId,
        rating,
        price: isExtinct ? 0 : normalizedPrice,
        isExtinct: Boolean(isExtinct),
        ...(Number.isFinite(priceLimitMax) ? { priceLimitMax } : {}),
        ...(Number.isFinite(priceLimitMin) ? { priceLimitMin } : {}),
        name:
          player?._staticData?.name ||
          player?._staticData?.lastName ||
          player?.name ||
          player?.definitionId,
        source: "liveSearch",
        type: (player.getSearchType?.() || "player").toString().toUpperCase(),
      },
    };

    log("info", "persist", {
      isExtinct,
      persistedPrice: itemPayload[defId].price,
      persistedType: itemPayload[defId].type,
    });

    PriceItem(itemPayload);
    updateCBRMinPrice();
  };

  const finishSuccess = (reason) => {
    const price = Number.isFinite(bestPrice)
      ? bestPrice
      : Number(bestListing?._auction?.buyNowPrice);
    log("info", "finish:success", { reason, bestPrice: price });

    try {
      if (
        !suppressNotification &&
        typeof showNotification === "function" &&
        !isFodder(player)
      ) {
        showNotification(
          `${player?._staticData?.name || player?.name || player?.definitionId}: ${
            Number.isFinite(price) ? price.toLocaleString() : "N/A"
          }`,
          UINotificationType.POSITIVE,
        );
      }
    } catch (e) {
      log("warn", "notify:success:failed", { error: String(e) });
    }

    persistLivePrice(bestListing, false);
    return bestListing;
  };

  const finishExtinct = (reason = "no-results") => {
    log("warn", "finish:extinct", { reason });
    try {
      if (!suppressNotification && typeof showNotification === "function") {
        showNotification(
          `${player?._staticData?.name || player?.name || player?.definitionId} appears to be extinct`,
          UINotificationType.NEGATIVE,
        );
      }
    } catch (e) {
      log("warn", "notify:extinct:failed", { error: String(e) });
    }
    persistLivePrice(null, true);
    return null;
  };

  const getIncrement = (price) => {
    let inc = tiers[0]?.inc || 50;
    for (const tier of tiers) {
      if (price >= tier.min) inc = tier.inc;
      else break;
    }
    return inc || 50;
  };

  const alignDown = (price) => {
    if (!Number.isFinite(price) || price <= 0) return 0;
    const inc = getIncrement(price);
    return Math.max(0, Math.floor(price / inc) * inc);
  };

  const alignUp = (price) => {
    if (!Number.isFinite(price) || price <= 0) return 0;
    const inc = getIncrement(price);
    return Math.max(0, Math.ceil(price / inc) * inc);
  };

  // Make sure EA-imposed price limits are loaded for unopened/extinct items.
  await ensureItemMarketData(player);

  const limits = player._itemPriceLimits || {};
  const MIN_CAP = alignDown(Math.max(0, limits.minimum || 0));
  const MAX_CAP = Math.min(
    MAX_CAP_LIMIT,
    alignUp(Math.max(limits.maximum || MAX_CAP_LIMIT, MIN_CAP || 0)),
  );

  const cachedPriceEntry = getPriceItems()?.[player?.definitionId] || null;
  const hintedLimitMin = Number(cachedPriceEntry?.priceLimitMin);
  const hintedLimitMax = Number(cachedPriceEntry?.priceLimitMax);
  const effectiveMinCap = Number.isFinite(hintedLimitMin) && hintedLimitMin > 0
    ? Math.max(MIN_CAP, alignDown(hintedLimitMin))
    : MIN_CAP;
  const effectiveMaxCap = Number.isFinite(hintedLimitMax) && hintedLimitMax > 0
    ? Math.min(MAX_CAP, alignUp(hintedLimitMax))
    : MAX_CAP;

  log("info", "caps:init", {
    limits: { min: limits.minimum, max: limits.maximum },
    hintedLimits: {
      min: Number.isFinite(hintedLimitMin) ? hintedLimitMin : null,
      max: Number.isFinite(hintedLimitMax) ? hintedLimitMax : null,
    },
    MIN_CAP,
    MAX_CAP,
    effectiveMinCap,
    effectiveMaxCap,
  });

  const ensurePlayerFilter = (criteria) => {
    criteria.defId = [player.definitionId];
    criteria.type = player.getSearchType?.() || "player";
    return criteria;
  };

  const searchViewModel = new UTBucketedItemSearchViewModel();
  const evalCache = new Map();

  const getBaseCriteria = () => {
    const base = searchViewModel.searchCriteria || {};
    searchViewModel.searchCriteria = ensurePlayerFilter(base);
    return searchViewModel.searchCriteria;
  };

  const buildCriteria = (maxBuy, minBuy = null) => {
    const criteria = getBaseCriteria();

    // Set minimum buy price if specified
    if (typeof minBuy === "number" && Number.isFinite(minBuy) && minBuy >= 0) {
      criteria.minBuy = Math.floor(minBuy);
    } else {
      delete criteria.minBuy;
    }

    // Set maximum buy price if specified
    if (typeof maxBuy === "number" && Number.isFinite(maxBuy) && maxBuy > 0) {
      criteria.maxBuy = Math.floor(maxBuy);
    } else {
      delete criteria.maxBuy;
    }

    return criteria;
  };

  const stepDown = (price) => {
    if (!Number.isFinite(price) || price <= 0) return 0;
    let current = alignDown(price);
    let guard = 0;
    while (current > MIN_CAP && guard < 5) {
      const inc = getIncrement(current);
      const next = alignDown(Math.max(MIN_CAP, current - inc));
      if (next !== current) return Math.max(next, MIN_CAP);
      current = Math.max(MIN_CAP, current - inc);
      guard += 1;
    }
    return MIN_CAP;
  };

  const stepUp = (price) => {
    const base = Math.max(0, Number(price) || 0);
    let current = alignUp(base);
    let guard = 0;
    while (guard < 5) {
      const inc = getIncrement(current || base || 0);
      const next = alignUp(current + inc);
      if (next > current) return Math.min(next, MAX_CAP);
      current = Math.min(current + inc, MAX_CAP);
      guard += 1;
    }
    return Math.min(current, MAX_CAP);
  };

  // Use bigger sequential jumps while searching for the right cap window.
  const nextLowerProbeCap = (price, depth = 0) => {
    const base = Math.max(MIN_CAP, Number(price) || MIN_CAP);
    const ratioBase = base > 1000000 ? 0.55 : base > 250000 ? 0.68 : 0.82;
    const ratio = Math.max(0.45, ratioBase - Math.min(depth, 6) * 0.04);
    const candidate = alignDown(Math.max(MIN_CAP, Math.floor(base * ratio)));
    if (candidate < base) return candidate;
    return stepDown(base);
  };

  const nextUpperProbeCap = (price, depth = 0) => {
    const base = Math.max(MIN_CAP, Number(price) || MIN_CAP);
    const growthBase = base < 100000 ? 2.1 : base < 500000 ? 1.8 : 1.45;
    const growth = Math.max(1.2, growthBase - Math.min(depth, 5) * 0.08);
    const candidate = alignUp(Math.min(MAX_CAP, Math.floor(base * growth)));
    if (candidate > base) return candidate;
    return stepUp(base);
  };

  let doSearchBackoffSeconds = 0;

  const doSearch = async (maxBuy, minBuy = null) =>
    new Promise((resolve) => {
      if (searchCallCount >= MAX_SEARCH_CALLS) {
        log("warn", "search:budget-reached", {
          maxSearchCalls: MAX_SEARCH_CALLS,
          searchCallCount,
          hasBestListing: !!bestListing,
        });
        resolve(bestListing ? [bestListing] : []);
        return;
      }

      searchCallCount += 1;
      services.Item.clearTransferMarketCache();
      const criteria = buildCriteria(maxBuy, minBuy);

      log("info", "search:request", {
        minBuy: criteria.minBuy ?? null,
        maxBuy: criteria.maxBuy ?? null,
      });

      services.Item.searchTransferMarket(criteria, 1).observe(
        undefined,
        async (_s, response) => {
          const failed =
            response?.success === false ||
            (typeof response?.status === "number" &&
              Math.floor(response.status / 100) !== 2);

          if (failed) {
            doSearchBackoffSeconds += 1;
            const delayMs = doSearchBackoffSeconds * 1000;

            log("warn", "search:failed", {
              status: response?.status,
              success: response?.success,
              backoffSeconds: doSearchBackoffSeconds,
              delayMs,
            });

            await new Promise((r) => setTimeout(r, delayMs));
            resolve([]);
            return;
          }

          doSearchBackoffSeconds = 0;

          const items = Array.isArray(response?.data?.items)
            ? response.data.items
                .filter(
                  (item) =>
                    item._auction && item._auction.tradeState === "active",
                )
                .filter((item) => !isListingExcluded(item))
            : [];

          log("info", "search:response", {
            status: response?.status,
            returned: Array.isArray(response?.data?.items)
              ? response.data.items.length
              : 0,
            active: items.length,
          });

          resolve(items);
        },
      );
    });

  const extractBuy = (item) =>
    item && item._auction && typeof item._auction.buyNowPrice === "number"
      ? item._auction.buyNowPrice
      : Number.POSITIVE_INFINITY;

  const evaluate = async (cap, minBuy = null) => {
    let bounded = cap;
    if (bounded !== undefined && bounded !== null) {
      bounded = Math.min(MAX_CAP, Math.max(MIN_CAP, bounded));
    }

    const cacheKey = `${bounded ?? "none"}:${minBuy ?? "none"}`;
    if (evalCache.has(cacheKey)) {
      const cached = evalCache.get(cacheKey);
      log("info", "evaluate:cache-hit", {
        cap: bounded ?? null,
        minBuy: minBuy ?? null,
        count: cached?.count ?? 0,
        min: Number.isFinite(cached?.min) ? cached.min : null,
      });
      return cached;
    }

    log("info", "evaluate:start", {
      cap: bounded ?? null,
      minBuy: minBuy ?? null,
    });

    const rawEntries = await doSearch(bounded, minBuy);
    const entries = Array.isArray(rawEntries) ? rawEntries : [];

    let minItem = null;
    let minPrice = Number.POSITIVE_INFINITY;

    for (const entry of entries) {
      const price = extractBuy(entry);
      if (!Number.isFinite(price)) continue;
      if (price < minPrice) {
        minPrice = price;
        minItem = entry;
      }
    }

    if (entries.length) {
      registerCandidate(minPrice, minItem, {
        source: "evaluate",
        cap: bounded ?? null,
      });
    }

    log("info", "evaluate:done", {
      cap: bounded ?? null,
      minBuy: minBuy ?? null,
      count: entries.length,
      min: Number.isFinite(minPrice) ? minPrice : null,
    });

    const result = {
      count: entries.length,
      min: entries.length ? minPrice : Number.POSITIVE_INFINITY,
      item: minItem,
    };

    evalCache.set(cacheKey, result);
    return result;
  };

  const refineBetween = async (emptyCap, filledCap) => {
    log("info", "refineBetween:start", { emptyCap, filledCap });

    let low = Math.max(MIN_CAP, emptyCap || MIN_CAP);
    let high = Math.max(low + getIncrement(filledCap || low), filledCap);
    high = Math.min(high, MAX_CAP);
    let guard = 0;

    while (low + getIncrement(high) < high && guard < 12) {
      const rawMid = Math.floor((low + high) / 2);
      let mid = alignUp(rawMid);
      if (mid <= low) mid = alignUp(low + getIncrement(low || high));
      if (mid >= high) mid = alignDown(high - getIncrement(high));
      if (mid <= low || mid >= high) break;

      log("info", "refineBetween:probe", { low, mid, high, guard });

      const midEval = await evaluate(mid);
      guard += 1;

      if (midEval.count === 0) {
        low = mid;
      } else {
        if (midEval.count < MAX_RESULTS) {
          log("info", "refineBetween:done", {
            reason: "mid<count",
            mid,
            min: midEval.min,
          });
          return Number.isFinite(bestPrice)
            ? bestPrice
            : Number.isFinite(midEval.min)
              ? midEval.min
              : Number.POSITIVE_INFINITY;
        }
        high = mid;
      }
    }

    log("info", "refineBetween:done", { reason: "exhausted", bestPrice });
    return Number.isFinite(bestPrice) ? bestPrice : Number.POSITIVE_INFINITY;
  };

  const DEFAULT_INITIAL_CAP = 15000000; // 15 million - default starting point for unknown prices

  const deriveStartCapFromAuctionWindow = () => {
    const cachedPrice = Number(cachedPriceEntry?.price);
    if (Number.isFinite(cachedPrice) && cachedPrice > 0) {
      return Math.min(effectiveMaxCap, Math.max(effectiveMinCap, alignUp(cachedPrice)));
    }

    if (effectiveMaxCap > effectiveMinCap) {
      const span = effectiveMaxCap - effectiveMinCap;
      const floorBand = Math.max(getIncrement(effectiveMinCap || 0) * 8, 4000);
      const offset = Math.min(Math.floor(span * 0.22), floorBand);
      return Math.min(
        effectiveMaxCap,
        Math.max(effectiveMinCap, alignUp(effectiveMinCap + offset)),
      );
    }

    return Math.min(MAX_CAP, DEFAULT_INITIAL_CAP);
  };

  const ensureResults = async (cap) => {
    log("info", "ensureResults:start", { cap });

    // Start with stored cap, or use 15m as default initial search range for unknown prices
    let initialCap =
      cap !== null ? cap : Math.min(MAX_CAP, DEFAULT_INITIAL_CAP);
    let upper = alignUp(Math.max(initialCap, MIN_CAP));
    let evalResult = await evaluate(upper);

    if (evalResult.count === 0) {
      log("warn", "ensureResults:empty-at-cap", { upper });

      // If no results at initial cap, step up to MAX_CAP to find extinct items
      let low = upper;
      let high = upper;
      let guard = 0;

      while (evalResult.count === 0 && guard < 6 && high <= MAX_CAP) {
        low = high;
        high = nextUpperProbeCap(high, guard);
        evalResult = await evaluate(high);
        guard += 1;
        log("info", "ensureResults:stepUp", {
          guard,
          low,
          high,
          count: evalResult.count,
        });
      }

      if (evalResult.count === 0) {
        log("warn", "ensureResults:still-empty -> fallback(undefined)");
        const fallback = await evaluate(undefined);
        if (!fallback.count) return { cap: null, eval: fallback };
        if (fallback.count < MAX_RESULTS) return { cap: null, eval: fallback };

        upper = alignUp(fallback.min);
        evalResult = await evaluate(upper);
        if (!evalResult.count) {
          const stepped = stepUp(upper);
          evalResult = await evaluate(stepped);
          return { cap: stepped, eval: evalResult };
        }
        return { cap: upper, eval: evalResult };
      }

      return { cap: high, lowerBound: low, eval: evalResult };
    }

    return { cap: upper, eval: evalResult };
  };

  const stored = getPrice(player);
  const derivedStartCap = deriveStartCapFromAuctionWindow();
  const startCap =
    Number.isFinite(stored) && stored > 0
      ? Math.min(effectiveMaxCap, Math.max(effectiveMinCap, alignUp(stored)))
      : derivedStartCap;

  log("info", "startCap", {
    storedPrice: stored ?? null,
    cachedPrice: Number(cachedPriceEntry?.price) || null,
    derivedStartCap,
    startCap,
  });

  let {
    cap: upperCap,
    lowerBound,
    eval: upperEval,
  } = await ensureResults(startCap);

  if (upperEval.count === 0) {
    return finishExtinct("ensureResults:no-results");
  }

  if (upperEval.count < MAX_RESULTS) {
    return finishSuccess("upper-cap");
  }

  // If we are saturated at the upper cap, probe once at auction floor. When
  // floor still has active listings, we can finish without extended stepping.
  if (effectiveMinCap > 0) {
    const floorEval = await evaluate(effectiveMinCap);
    if (floorEval.count > 0) {
      return finishSuccess("auction-floor");
    }
  }

  if (!upperCap || !Number.isFinite(upperCap)) {
    log("warn", "upperCap:missing -> alignUp(min)", {
      upperMin: upperEval.min,
    });
    upperCap = alignUp(upperEval.min);
    upperEval = await evaluate(upperCap);
    if (upperEval.count === 0) {
      const stepped = stepUp(upperCap);
      upperCap = stepped;
      upperEval = await evaluate(upperCap);
      if (upperEval.count === 0)
        return finishExtinct("upperCap:missing:stepped:no-results");
      if (upperEval.count < MAX_RESULTS) return finishSuccess("stepped-upper");
    }
    if (upperEval.count < MAX_RESULTS) return finishSuccess("aligned-upper");
  }

  let best = upperEval.min;
  let lowerCapValue = lowerBound ?? nextLowerProbeCap(upperCap, 0);
  if (effectiveMinCap > 0) {
    lowerCapValue = Math.max(effectiveMinCap, lowerCapValue);
  }
  let lowerEval = await evaluate(lowerCapValue);
  let guardDown = 0;

  log("info", "downwardScan:start", {
    upperCap,
    lowerCapValue,
    lowerBound: lowerBound ?? null,
  });

  while (lowerCapValue > effectiveMinCap && lowerEval.count > 0 && guardDown < 8) {
    best = Math.min(best, lowerEval.min);
    if (lowerEval.count < MAX_RESULTS) {
      return finishSuccess("downward-window");
    }
    upperCap = lowerCapValue;
    upperEval = lowerEval;
    lowerCapValue = nextLowerProbeCap(lowerCapValue, guardDown + 1);
    lowerEval = await evaluate(lowerCapValue);
    guardDown += 1;

    log("info", "downwardScan:step", {
      guardDown,
      upperCap,
      nextLowerCap: lowerCapValue,
      count: lowerEval.count,
      min: Number.isFinite(lowerEval.min) ? lowerEval.min : null,
    });
  }

  if (lowerEval.count === 0) {
    const refined = await refineBetween(lowerCapValue, upperCap);
    if (Number.isFinite(refined)) return finishSuccess("refined-window");
    if (Number.isFinite(best)) return finishSuccess("refined-fallback");
    return finishExtinct("refined:no-price");
  }

  const finalBest = Math.min(best, lowerEval.min);
  if (Number.isFinite(finalBest)) {
    return finishSuccess("final");
  }

  return finishExtinct("final:no-best");
};

// expose as global to avoid "declared but its value is never read" warnings
window.fetchLivePlayerPrice = fetchLivePlayerPrice;

const fetchPlayerPricesInternal = async (players, options = {}) => {
  const suppressNotification = Boolean(options?.suppressNotification);
  const forceRefresh = Boolean(options?.force);
  const useConceptThrottleProfile = options?.throttleProfile === "concept";
  const futggBlockedUntil = getFutggPriceBlockUntil();

  const formatEta = (ms) => {
    const totalSeconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (futggBlockedUntil > Date.now()) {
    console.warn("[fetchPlayerPrices] fut.gg fetch blocked until", {
      blockedUntil: new Date(futggBlockedUntil).toISOString(),
    });
    return;
  }

  const configuredBatchSize = Number(
    getSettings(
      0,
      0,
      useConceptThrottleProfile
        ? "futggConceptPriceBatchSize"
        : "futggPriceBatchSize",
    ),
  );
  const batchSize =
    Number.isFinite(configuredBatchSize) && configuredBatchSize > 0
      ? Math.min(
          FUTGG_PRICE_BATCH_SIZE_MAX,
          Math.max(1, Math.floor(configuredBatchSize)),
        )
      : useConceptThrottleProfile
        ? FUTGG_CONCEPT_PRICE_BATCH_SIZE_DEFAULT
        : FUTGG_PRICE_BATCH_SIZE_DEFAULT;

  const configuredDelayMs = Number(
    getSettings(
      0,
      0,
      useConceptThrottleProfile
        ? "futggConceptPriceDelayMs"
        : "futggPriceDelayMs",
    ),
  );
  const requestDelayMs =
    Number.isFinite(configuredDelayMs) && configuredDelayMs >= 0
      ? configuredDelayMs
      : useConceptThrottleProfile
        ? FUTGG_CONCEPT_PRICE_REQUEST_DELAY_MS_DEFAULT
        : FUTGG_PRICE_REQUEST_DELAY_MS_DEFAULT;

  const configuredErrorBackoffMs = Number(
    getSettings(
      0,
      0,
      useConceptThrottleProfile
        ? "futggConceptPriceErrorBackoffMs"
        : "futggPriceErrorBackoffMs",
    ),
  );
  const errorBackoffMs =
    Number.isFinite(configuredErrorBackoffMs) && configuredErrorBackoffMs >= 0
      ? configuredErrorBackoffMs
      : useConceptThrottleProfile
        ? FUTGG_CONCEPT_PRICE_ERROR_BACKOFF_MS_DEFAULT
        : FUTGG_PRICE_ERROR_BACKOFF_MS_DEFAULT;

  const configured429BaseBackoffMs = Number(
    getSettings(
      0,
      0,
      useConceptThrottleProfile
        ? "futggConceptPrice429BaseBackoffMs"
        : "futggPrice429BaseBackoffMs",
    ),
  );
  const backoff429BaseMs =
    Number.isFinite(configured429BaseBackoffMs) && configured429BaseBackoffMs >= 0
      ? configured429BaseBackoffMs
      : FUTGG_429_BASE_BACKOFF_MS_DEFAULT;

  const configured429MaxBackoffMs = Number(
    getSettings(
      0,
      0,
      useConceptThrottleProfile
        ? "futggConceptPrice429MaxBackoffMs"
        : "futggPrice429MaxBackoffMs",
    ),
  );
  const backoff429MaxMs =
    Number.isFinite(configured429MaxBackoffMs) && configured429MaxBackoffMs > 0
      ? configured429MaxBackoffMs
      : FUTGG_429_MAX_BACKOFF_MS_DEFAULT;

  // Filter out players that need price updates
  const playerByDefinitionId = new Map(
    (players || []).map((player) => [String(player?.definitionId), player]),
  );

  let idsArray = Array.from(
    new Set(
      players
        .filter(
          (f) =>
            (forceRefresh || isPriceOld(f)) &&
            Number(f?.definitionId) > 0 &&
            ((typeof f?.isPlayer === "function" && f.isPlayer()) ||
              f?.isPlayer === true ||
              isConceptLikePriceItem(f)),
        )
        .map((p) => p.definitionId),
    ),
  );

  // If no prices to fetch, return early
  if (idsArray.length === 0) return;

  let totalPrices = idsArray.length;
  let fetched = 0;
  let consecutive429Count = 0;

  // Show the progress bar whenever we're fetching more than 100 players
  const progressBarId = "prices-progress-bar";
  const containerId = "prices-progress-container";
  const showProgressBar = totalPrices > 100;
  const totalBatches = Math.max(1, Math.ceil(totalPrices / batchSize));
  let completedBatches = 0;
  let accumulatedBatchRequestMs = 0;
  let etaEndAtMs = 0;
  let etaIntervalId = null;

  const updatePriceProgressLabel = (statusText = "") => {
    if (!showProgressBar) return;
    const labelEl = document.getElementById(`${progressBarId}-label`);
    if (!labelEl) return;

    const remainingMs = Math.max(0, etaEndAtMs - Date.now());
    const progressText = `(${fetched}/${totalPrices})`;
    const statusSuffix = statusText ? ` - ${statusText}` : "";
    labelEl.textContent = `Fetching Player Prices ${progressText} - ETA ${formatEta(remainingMs)}${statusSuffix}`;
  };

  if (showProgressBar) {
    createProgressBar(progressBarId, containerId, "Fetching Player Prices");
    updateProgressBar(progressBarId, 0);
    hasShownFetchPlayersProgressBar = true;

    const configuredExpectedBatchMs = Number(
      getSettings(
        0,
        0,
        useConceptThrottleProfile
          ? "futggConceptPriceExpectedBatchMs"
          : "futggPriceExpectedBatchMs",
      ),
    );
    const expectedBatchMs =
      Number.isFinite(configuredExpectedBatchMs) && configuredExpectedBatchMs > 0
        ? configuredExpectedBatchMs
        : useConceptThrottleProfile
          ? 900
          : 1200;

    etaEndAtMs =
      Date.now() +
      totalBatches * expectedBatchMs +
      Math.max(0, totalBatches - 1) * requestDelayMs;

    updatePriceProgressLabel();
    etaIntervalId = setInterval(() => {
      updatePriceProgressLabel();
    }, 1000);
  }
  try {
    while (idsArray.length) {
      const playersIdArray = idsArray.splice(0, batchSize);
      const requestStartedAt = Date.now();

      try {
        const futggJson = await fetchFutggSignedJson(
          `/api/fut/player-prices/${FUTGG_GAME_YEAR}/?ids=${playersIdArray}`,
        );

        // Successful batch resets rate-limit streak.
        consecutive429Count = 0;

        const requestElapsedMs = Math.max(0, Date.now() - requestStartedAt);
        completedBatches += 1;
        accumulatedBatchRequestMs += requestElapsedMs;

        let priceResponse = futggJson.data;
        // Add rating and name information to the price response
        for (let key in priceResponse) {
          // Find the matching player in the players array
          const matchingPlayer = playerByDefinitionId.get(
            String(priceResponse[key]["eaId"]),
          );
          const rawType =
            (typeof matchingPlayer?.getSearchType === "function" &&
              matchingPlayer.getSearchType()) ||
            matchingPlayer?.type ||
            "PLAYER";

          priceResponse[key].rating = matchingPlayer?.rating;
          priceResponse[key].name = matchingPlayer?._staticData?.name || "";
          priceResponse[key].type = normalizePriceType(rawType);
        }
        PriceItem(priceResponse);

        // Update progress (only when the bar is shown)
        fetched += playersIdArray.length;
        if (showProgressBar) {
          const progress = (fetched / totalPrices) * 100;
          updateProgressBar(progressBarId, progress);

          const remainingBatches = Math.ceil(idsArray.length / batchSize);
          const avgBatchRequestMs =
            completedBatches > 0
              ? accumulatedBatchRequestMs / completedBatches
              : 1200;
          etaEndAtMs =
            Date.now() +
            remainingBatches * avgBatchRequestMs +
            Math.max(0, remainingBatches - 1) * requestDelayMs;
          updatePriceProgressLabel();
        }
      } catch (error) {
        if (Number(error?.status) === 403) {
          const blockedUntil = setFutggPriceBlockedUntilNextDay();

          if (showProgressBar) {
            updatePriceProgressLabel("Paused until tomorrow");
            removeProgressBar(containerId);
          }

          console.warn(
            "[fetchPlayerPrices] fut.gg returned 403; blocking until",
            {
              blockedUntil: new Date(blockedUntil).toISOString(),
            },
          );

          if (!suppressNotification) {
            showNotification(
              "FUT.GG returned 403. Price fetch is paused until tomorrow.",
              UINotificationType.NEGATIVE,
            );
          }
          return;
        }

        if (Number(error?.status) === 429) {
          consecutive429Count += 1;
          const exponentialMultiplier = Math.pow(2, Math.max(0, consecutive429Count - 1));
          const backoff429Ms = Math.min(
            backoff429MaxMs,
            Math.round(backoff429BaseMs * exponentialMultiplier),
          );

          if (showProgressBar) {
            etaEndAtMs = Math.max(etaEndAtMs, Date.now()) + backoff429Ms;
            updatePriceProgressLabel(
              `429 received - backoff x${consecutive429Count}`,
            );
          }

          console.warn("[fetchPlayerPrices] fut.gg returned 429; exponential backoff", {
            consecutive429Count,
            backoff429Ms,
          });

          await sleepMs(backoff429Ms);
          continue;
        }

        console.error(error);
        if (showProgressBar) {
          etaEndAtMs = Math.max(etaEndAtMs, Date.now()) + errorBackoffMs;
          updatePriceProgressLabel("Retrying");
        }
        await sleepMs(errorBackoffMs);
        continue;
      }
      updateCBRMinPrice();

      if (idsArray.length > 0) {
        if (showProgressBar) {
          updatePriceProgressLabel("Throttling");
        }
        await sleepMs(requestDelayMs);
      }
    }
  } finally {
    if (etaIntervalId) {
      clearInterval(etaIntervalId);
    }

    // Remove progress bar after completion (only when the bar was shown)
    if (showProgressBar) {
      removeProgressBar(containerId);
    }
  }

  if (!suppressNotification && totalPrices > 0) {
    showNotification(
      `Fetched ${totalPrices} player prices`,
      UINotificationType.POSITIVE,
    );
  }
};

let fetchPlayerPrices = (players, options = {}) => {
  const playerCount = Array.isArray(players) ? players.length : 0;
  const requestedWait = options?.waitForCompletion === true;
  // Keep player-pick style calls synchronous when explicitly requested, but
  // never block on large batches (thousands of players).
  const shouldWaitForCompletion = requestedWait && playerCount > 0 && playerCount <= 50;

  if (shouldWaitForCompletion) {
    return fetchPlayerPricesInternal(players, options);
  }

  const job = futggPriceFetchChain
    .then(() => fetchPlayerPricesInternal(players, options))
    .catch((error) => {
      console.error("[fetchPlayerPrices] job failed", error);
    });

  futggPriceFetchChain = job.then(
    () => undefined,
    () => undefined,
  );

  return Promise.resolve();
};
let sound = new Audio(
  "https://raw.githubusercontent.com/Yousuke777/sound/main/kansei.mp3",
);
let wompSound = new Audio(
  "https://www.myinstants.com/media/sounds/downer_noise.mp3",
);
let nopeSound = new Audio(
  "https://www.myinstants.com/media/sounds/engineer_no01.mp3",
);
