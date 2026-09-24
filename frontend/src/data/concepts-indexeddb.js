const searchEaConceptEntitiesByDefIds = async (definitionIds, options = {}) => {
  const uniqueDefIds = Array.from(
    new Set(
      (definitionIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );

  if (!uniqueDefIds.length) return [];
  if (!services?.Item?.searchConceptItems || typeof UTSearchCriteriaDTO === "undefined") {
    return [];
  }

  const controller =
    options.controller ||
    (typeof getControllerInstance === "function" && getControllerInstance()) ||
    globalThis;

  const dto = new UTSearchCriteriaDTO();
  dto.offset = 0;
  dto.count = Math.min(Math.max(Number(options.count) || 200, 50), 200);
  dto.defId = uniqueDefIds;
  if (typeof SearchType !== "undefined") {
    dto.type = SearchType.PLAYER;
  }

  const gathered = [];
  const maxItems = Math.max(uniqueDefIds.length * 10, dto.count);

  const step = () =>
    new Promise((resolve) => {
      services.Item.searchConceptItems(dto).observe(
        controller,
        function (sender, response) {
          try {
            sender?.unobserve?.(controller);
          } catch {}

          if (response?.status === 400) {
            resolve({ done: true, items: [] });
            return;
          }

          const items = Array.isArray(response?.response?.items)
            ? response.response.items
            : [];
          const done = !!response?.response?.endOfList;
          resolve({ done, items });
        },
      );
    });

  while (gathered.length < maxItems) {
    const { done, items } = await step();
    if (items.length) gathered.push(...items);
    if (done || !items.length) break;
    dto.offset += dto.count;
  }

  return gathered;
};

const createConceptEntityFromEaSearch = (eaEntity, futggPlayer, playerName = "Unknown") => {
  if (!eaEntity) return null;

  const enriched = enrichConceptEntity(eaEntity);
  const staticData = enriched?._staticData || (enriched._staticData = {});
  const futggDefId = Number(futggPlayer?.eaId || 0);

  if (!Number(enriched.resourceId) && futggDefId > 0) {
    enriched.resourceId = futggDefId;
  }
  if (!Number(enriched.definitionId) && futggDefId > 0) {
    enriched.definitionId = futggDefId;
  }
  if (!Number(staticData.id) && futggDefId > 0) {
    staticData.id = futggDefId;
  }

  if (!staticData.name && playerName) {
    staticData.name = playerName;
  }
  if (!staticData.firstName && futggPlayer?.firstName) {
    staticData.firstName = futggPlayer.firstName;
  }
  if (!staticData.lastName && futggPlayer?.lastName) {
    staticData.lastName = futggPlayer.lastName;
  }

  return enriched;
};

let conceptCacheInitPromise = null;

const getFutSbcDbVersion = () => {
  const version = Number(globalThis.__autoSbcDbVersion || 4);
  globalThis.__autoSbcDbVersion = version;
  return version;
};

const openConceptsDb = () => {
  const dbName = "futSBCDatabase";
  const storeName = "conceptsStore";

  return new Promise((resolve, reject) => {
    // Open at the current DB version to avoid VersionError when this browser
    // already has a newer futSBCDatabase version than our default.
    const openRequest = indexedDB.open(dbName);

    openRequest.onsuccess = function (event) {
      const db = event.target.result;

      if (db.objectStoreNames.contains(storeName)) {
        resolve(db);
        return;
      }

      const nextVersion = Number(db.version || 0) + 1;
      globalThis.__autoSbcDbVersion = nextVersion;
      db.close();

      const upgradeRequest = indexedDB.open(dbName, nextVersion);

      upgradeRequest.onupgradeneeded = function (upgradeEvent) {
        const upgradeDb = upgradeEvent.target.result;
        if (!upgradeDb.objectStoreNames.contains(storeName)) {
          upgradeDb.createObjectStore(storeName, { keyPath: "id" });
        }
      };

      upgradeRequest.onsuccess = function (upgradeEvent) {
        resolve(upgradeEvent.target.result);
      };

      upgradeRequest.onerror = function (upgradeEvent) {
        reject(upgradeEvent.target.error);
      };
    };

    openRequest.onerror = function (event) {
      reject(event.target.error);
    };
  });
};

const waitForClubPlayersReady = async (maxWaitMs = 30000, intervalMs = 250) => {
  if (window.__sbcPlayersReady) {
    return true;
  }

  console.log("[concepts-cache] Waiting for club players to finish loading before concept init");
  const start = Date.now();

  while (!window.__sbcPlayersReady && Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const ready = !!window.__sbcPlayersReady;
  if (!ready) {
    console.warn("[concepts-cache] Club players readiness timeout; continuing concept init");
  }

  return ready;
};

const toSerializableConcept = (item) => {
  if (!item) return null;

  const definitionId = Number(
    item?.resourceId ||
      item?.definitionId ||
      item?.eaId ||
      item?._staticData?.id ||
      0,
  );
  if (!Number.isFinite(definitionId) || definitionId <= 0) return null;

  const sd = item?._staticData || {};

  const payload = {
    v: 4,
    // Identity
    id: Number(item?.id || item?.itemId || 0),
    resourceId: definitionId,
    assetId: Number(item?.assetId || definitionId || 0),
    // Item classification
    itemType: Number(item?.itemType || globalThis.ItemType?.PLAYER || 1),
    concept: !!item?.concept,
    untradeable: !!item?.untradeable || !!item?.untrade,
    sourceApi: item?.sourceApi || "eafc",
    // Core attributes
    rating: Number(item?.rating || sd?.rating || 0),
    owners: Number(item?.owners || 0),
    rareflag: Number(item?._rareflag || item?.rareflag || sd?.rareflag || 0),
    // Card properties
    cardsubtypeid: Number(item?.cardsubtypeid || 0),
    playStyle: Number(item?.playStyle || 0),
    // Classification
    nation: Number(item?.nation || item?.nationId || sd?.nationId || 0),
    teamId: Number(item?.teamId || sd?.teamId || item?.teamIdId || 0),
    leagueId: Number(item?.leagueId || sd?.leagueId || 0),
    // Player-specific
    firstName: item?.firstName || sd?.firstName || "",
    lastName: item?.lastName || sd?.lastName || "",
    preferredPosition: item?.preferredPosition || sd?.preferredPosition || "",
    preferredfoot: Number(item?.preferredfoot || sd?.preferredfoot || 0),
    skillmoves: Number(item?.skillmoves || sd?.skillmoves || 0),
    weakfootabilitytypecode: Number(item?.weakfootabilitytypecode || sd?.weakfootabilitytypecode || 0),
    // Player stats
    attributeArray: Array.isArray(item?.attributeArray)
      ? item.attributeArray.map((v) => Number(v))
      : Array.isArray(sd?.attributeArray)
        ? sd.attributeArray.map((v) => Number(v))
        : [],
    statsArray: Array.isArray(item?.statsArray)
      ? item.statsArray.map((v) => Number(v))
      : Array.isArray(sd?.statsArray)
        ? sd.statsArray.map((v) => Number(v))
        : [],
    lifetimeStatsArray: Array.isArray(item?.lifetimeStatsArray)
      ? item.lifetimeStatsArray.map((v) => Number(v))
      : Array.isArray(sd?.lifetimeStatsArray)
        ? sd.lifetimeStatsArray.map((v) => Number(v))
        : [],
    baseTraits: Array.isArray(item?.baseTraits)
      ? item.baseTraits.map((v) => Number(v))
      : Array.isArray(sd?.baseTraits)
        ? sd.baseTraits.map((v) => Number(v))
        : [],
    plusRoles: Array.isArray(item?.plusRoles)
      ? item.plusRoles.map((v) => Number(v))
      : Array.isArray(sd?.plusRoles)
        ? sd.plusRoles.map((v) => Number(v))
        : [],
    groups: Array.isArray(item?.groups)
      ? item.groups.map((v) => Number(v))
      : Array.isArray(sd?.groups)
        ? sd.groups.map((v) => Number(v))
        : [],
    possiblePositions: Array.isArray(item?.possiblePositions)
      ? item.possiblePositions.slice()
      : Array.isArray(sd?.possiblePositions)
        ? sd.possiblePositions.slice()
        : [],
    // Consumable/injury
    contract: Number(item?.contract || sd?.contract || 0),
    injuryType: item?.injuryType || sd?.injuryType || "none",
    injuryGames: Number(item?.injuryGames || sd?.injuryGames || 0),
    // Account state
    itemState: item?.itemState || sd?.itemState || "free",
    pile: Number(item?.pile || sd?.pile || 0),
    formation: item?.formation || sd?.formation || "",
    // Market data
    marketDataMinPrice: Number(item?.marketDataMinPrice || 0),
    marketDataMaxPrice: Number(item?.marketDataMaxPrice || 0),
    marketAverage: Number(item?.marketAverage || 0),
    discardValue: Number(item?.discardValue || sd?.discardValue || 0),
    // Rewards
    loyaltyBonus: Number(item?.loyaltyBonus || sd?.loyaltyBonus || 0),
    lastSalePrice: Number(item?.lastSalePrice || 0),
    // Game/resource
    resourceGameYear: Number(item?.resourceGameYear || 2027),
    timestamp: Number(item?.timestamp || 0),
    gender: Number(item?.gender || 0),
  };

  const compact = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "number" && value === 0 && key !== "id" && key !== "resourceId" && key !== "assetId") continue;
    if (typeof value === "string" && value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    compact[key] = value;
  }

  return compact;
};

const hasUtItemEntityFunctions = (item) => {
  if (!item || typeof item !== "object") return false;
  return (
    typeof item.getSearchType === "function" ||
    typeof item.isTraining === "function" ||
    typeof item.isPlayer === "function"
  );
};

const createUtItemEntity = (factoryPayload) => {
  const Factory = globalThis.UTItemEntityFactory;
  if (!Factory) return null;

  try {
    if (typeof Factory === "function") {
      const factoryInstance = new Factory();
      if (typeof factoryInstance?.createItem === "function") {
        return factoryInstance.createItem(factoryPayload);
      }
    }
  } catch (_err) {
    // Fall through to prototype method invocation attempt.
  }

  const createItem = Factory?.prototype?.createItem;
  if (typeof createItem !== "function") return null;

  try {
    return createItem.call(Factory.prototype, factoryPayload);
  } catch (_err) {
    return null;
  }
};

const rehydrateConceptEntity = (rawItem) => {
  if (!rawItem) return null;

  const defId = Number(
    rawItem?.resourceId || rawItem?.definitionId || rawItem?.eaId || 0,
  );
  if (!Number.isFinite(defId) || defId <= 0) return null;

  // Use the full cached payload structure (v4) to reconstruct via factory
  const factoryPayload = {
    id: Number(rawItem?.id || 0),
    resourceId: defId,
    itemType: rawItem?.itemType || globalThis.ItemType?.PLAYER || 1,
    // Full item structure from cache
    assetId: Number(rawItem?.assetId || defId || 0),
    rating: Number(rawItem?.rating || 0),
    owners: Number(rawItem?.owners || 0),
    untradeable: !!rawItem?.untradeable,
    rareflag: Number(rawItem?.rareflag || 0),
    nation: Number(rawItem?.nation || 0),
    teamId: Number(rawItem?.teamId || 0),
    leagueId: Number(rawItem?.leagueId || 0),
    cardsubtypeid: Number(rawItem?.cardsubtypeid || 0),
    playStyle: Number(rawItem?.playStyle || 0),
    firstName: rawItem?.firstName || "",
    lastName: rawItem?.lastName || "",
    preferredPosition: rawItem?.preferredPosition || "",
    preferredfoot: Number(rawItem?.preferredfoot || 0),
    skillmoves: Number(rawItem?.skillmoves || 0),
    weakfootabilitytypecode: Number(rawItem?.weakfootabilitytypecode || 0),
    attributeArray: Array.isArray(rawItem?.attributeArray) ? rawItem.attributeArray : [],
    statsArray: Array.isArray(rawItem?.statsArray) ? rawItem.statsArray : [],
    lifetimeStatsArray: Array.isArray(rawItem?.lifetimeStatsArray) ? rawItem.lifetimeStatsArray : [],
    baseTraits: Array.isArray(rawItem?.baseTraits) ? rawItem.baseTraits : [],
    plusRoles: Array.isArray(rawItem?.plusRoles) ? rawItem.plusRoles : [],
    groups: Array.isArray(rawItem?.groups) ? rawItem.groups : [],
    possiblePositions: Array.isArray(rawItem?.possiblePositions) ? rawItem.possiblePositions : [],
    contract: Number(rawItem?.contract || 0),
    injuryType: rawItem?.injuryType || "none",
    injuryGames: Number(rawItem?.injuryGames || 0),
    itemState: rawItem?.itemState || "free",
    pile: Number(rawItem?.pile || 0),
    formation: rawItem?.formation || "",
    marketDataMinPrice: Number(rawItem?.marketDataMinPrice || 0),
    marketDataMaxPrice: Number(rawItem?.marketDataMaxPrice || 0),
    marketAverage: Number(rawItem?.marketAverage || 0),
    discardValue: Number(rawItem?.discardValue || 0),
    loyaltyBonus: Number(rawItem?.loyaltyBonus || 0),
    lastSalePrice: Number(rawItem?.lastSalePrice || 0),
    resourceGameYear: Number(rawItem?.resourceGameYear || 2027),
    timestamp: Number(rawItem?.timestamp || 0),
    gender: Number(rawItem?.gender || 0),
    concept: !!rawItem?.concept,
    sourceApi: rawItem?.sourceApi || "eafc",
  };

  try {
    const entity = createUtItemEntity(factoryPayload);
    if (!entity || !hasUtItemEntityFunctions(entity)) return null;

    // Concepts loaded from this cache path must always remain concept entities.
    entity.concept = true;

    // Ensure definitionId is set
    if (!Number(entity?.definitionId)) {
      entity.definitionId = defId;
    }

    const finalDefinitionId = Number(entity?.definitionId || defId || 0);
    const finalRating = Number(entity?.rating || factoryPayload?.rating || 0);

    if (finalRating > 0 && Number(entity?.rating || 0) <= 0) {
      entity.rating = finalRating;
    }
    if (finalRating > 0 && entity?._staticData && Number(entity._staticData?.rating || 0) <= 0) {
      entity._staticData.rating = finalRating;
    }

    const hasCoreData = finalDefinitionId > 0 && finalRating > 0;
    if (!hasCoreData) {
      return null;
    }

    return entity;
  } catch (err) {
    console.warn("[concepts-cache] UTItemEntityFactory createItem failed:", err);
    return null;
  }
};

// Ensure EA FC API concepts have full entity structure when cached
const enrichConceptEntity = (eaEntity) => {
  if (!eaEntity) return null;
  if (!eaEntity._staticData) {
    eaEntity._staticData = {};
  }
  if (!Number(eaEntity.rating) && Number(eaEntity._staticData?.rating)) {
    eaEntity.rating = Number(eaEntity._staticData.rating);
  }
  if (!Number(eaEntity._staticData?.rating) && Number(eaEntity.rating)) {
    eaEntity._staticData.rating = Number(eaEntity.rating);
  }
  if (!eaEntity._staticData?.name && eaEntity?.name) {
    eaEntity._staticData.name = eaEntity.name;
  }
  if (!eaEntity._staticData?.lastName && eaEntity?.name) {
    eaEntity._staticData.lastName = eaEntity.name;
  }
  eaEntity.concept = true;
  eaEntity.sourceApi = eaEntity.sourceApi || "eafc";
  return eaEntity;
};

const getConceptsFromIndexedDB = () => {
  return new Promise((resolve) => {
    const storeName = "conceptsStore";

    openConceptsDb().then((db) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);

      // Get the single entry that contains all concept players
      const getRequest = store.get("allConcepts");

      getRequest.onsuccess = function (event) {
        if (event.target.result && event.target.result.data) {
          const cachedRaw = event.target.result.data || [];
          let missingCoreCount = 0;
          const cached = cachedRaw
            .map((rawItem) => {
              const hydrated = rehydrateConceptEntity(rawItem);
              if (!hydrated) {
                missingCoreCount += 1;
              }
              return hydrated;
            })
            .filter(Boolean);
          if (missingCoreCount > 0) {
            console.warn(
              `[concepts-cache] Rehydration missing core data for ${missingCoreCount} entries`,
            );
          }
          if (cached.length !== cachedRaw.length) {
            console.warn(
              `[concepts-cache] Dropped ${cachedRaw.length - cached.length} cached concepts that could not be restored as UTItemEntity`,
            );
          }
          console.log(`[concepts-cache] Loaded ${cached.length} UTItemEntity concepts from IndexedDB`);
          resolve(cached);
        } else {
          resolve([]);
        }
      };

      transaction.onerror = function () {
        console.warn("[concepts-cache] IndexedDB read error, falling back to API");
        resolve([]);
      };
    }).catch((error) => {
      console.warn("[concepts-cache] Cannot open IndexedDB:", error);
      resolve([]);
    });
  });
};

const getConceptsFetchMetadata = () => {
  return new Promise((resolve) => {
    const storeName = "conceptsStore";

    openConceptsDb().then((db) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);

      const getRequest = store.get("conceptsFetchMeta");

      getRequest.onsuccess = function (event) {
        resolve(event.target.result || {});
      };

      transaction.onerror = function () {
        resolve({});
      };
    }).catch(() => {
      resolve({});
    });
  });
};

const saveConceptsFetchMetadata = (lastFetchDate) => {
  const storeName = "conceptsStore";

  openConceptsDb().then((db) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    store.put({
      id: "conceptsFetchMeta",
      lastFetchDate: lastFetchDate,
      lastFetchTS: new Date().toISOString(),
    });
  }).catch((error) => {
    console.warn("[concepts-cache] Cannot save concepts metadata:", error);
  });
};

const shouldRefreshConceptsToday = async () => {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Only refresh if past 6am
  if (currentHour < 6) {
    return false;
  }

  // Get last fetch metadata
  const meta = await getConceptsFetchMetadata();
  
  // Get today's date at 6am (reset time)
  const today = new Date();
  today.setHours(6, 0, 0, 0);
  const todayAtSixAmMs = today.getTime();
  
  if (!meta.lastFetchDate) {
    // Never fetched, refresh now
    console.log("[concepts-cache] Never fetched before, will refresh");
    return true;
  }

  const lastFetchMs = new Date(meta.lastFetchDate).getTime();
  
  // If last fetch is before today at 6am, refresh
  if (lastFetchMs < todayAtSixAmMs) {
    console.log(`[concepts-cache] Last fetch was ${meta.lastFetchDate}, refreshing for new concepts`);
    return true;
  }

  return false;
};

const saveConceptsToIndexedDB = (concepts) => {
  const storeName = "conceptsStore";

  openConceptsDb().then((db) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    // Persist as plain data; UTItemEntity methods are restored via createItem on read.
    const serializedConcepts = concepts
      .map((concept) => toSerializableConcept(concept))
      .filter(Boolean);

    // Clear and save new concepts
    store.clear().onsuccess = function () {
      const allConcepts = {
        id: "allConcepts",
        data: serializedConcepts,
        savedAt: new Date().toISOString(),
      };

      store.put(allConcepts);
      
      // Save fetch metadata
      store.put({
        id: "conceptsFetchMeta",
        lastFetchDate: new Date().toISOString(),
        lastFetchTS: new Date().toISOString(),
      });
    };

    transaction.oncomplete = function () {
      console.log(`[concepts-cache] Saved ${concepts.length} concepts to IndexedDB`);
    };

    transaction.onerror = function (error) {
      console.warn("[concepts-cache] IndexedDB save error:", error);
    };
  }).catch((error) => {
    console.warn("[concepts-cache] Cannot open IndexedDB:", error);
  });
};

// Fetch new players from fut.gg API and merge with cache
const fetchNewPlayersFromFutgg = async () => {
  try {
    console.log("[concepts-cache] Starting incremental fut.gg fetch");
    showNotification("Fetching new concept players from fut.gg...", UINotificationType.PENDING);
    
    // Get current cache
    const cachedConcepts = await getConceptsFromIndexedDB();
    const cacheDefinitionIds = new Set(
      cachedConcepts.map(p => p.definitionId || p.id).filter(Boolean)
    );
    console.log(`[concepts-cache] Current cache has ${cacheDefinitionIds.size} players`);
    showNotification(`Cache has ${cacheDefinitionIds.size} players, checking for new ones...`, UINotificationType.PENDING);
    
    let newPlayerCount = 0;
    let pageNum = 1;
    let foundCachedPlayer = false;
    
    while (!foundCachedPlayer && pageNum <= 10) {
      try {
        const url = `https://www.fut.gg/api/fut/players/v2/27/?page=${pageNum}&sorts=-created_at`;
        console.log(`[concepts-cache] Fetching page ${pageNum} from fut.gg`);
        showNotification(`Fetching fut.gg page ${pageNum}... (${newPlayerCount} new players so far)`, UINotificationType.PENDING);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const responseData = await response.json();
        
        // fut.gg API returns 'data' array with player objects
        const players = (responseData.data || []);
        
        if (!players.length) {
          console.log("[concepts-cache] No player definitions on this page, stopping");
          showNotification(`Page ${pageNum} returned no players, stopping fetch.`, UINotificationType.PENDING);
          break;
        }
        console.log(`[concepts-cache] Page ${pageNum} returned ${players.length} player definitions`);
        
        const pendingFutggPlayers = [];

        // Build list of new fut.gg definitions not yet in cache.
        for (const futggPlayer of players) {
          const defId = Number(futggPlayer?.eaId || 0);
          const playerName =
            futggPlayer.cardName ||
            futggPlayer.commonName ||
            `${futggPlayer.firstName || ""} ${futggPlayer.lastName || ""}`.trim() ||
            "Unknown";

          if (!defId) continue;

          if (cacheDefinitionIds.has(defId)) {
            console.log(`[concepts-cache] Found cached player ${playerName} (${defId}), stopping fetch`);
            foundCachedPlayer = true;
            break;
          }

          pendingFutggPlayers.push({ futggPlayer, defId, playerName });
        }

        if (pendingFutggPlayers.length) {
          const eaConceptEntities = await searchEaConceptEntitiesByDefIds(
            pendingFutggPlayers.map((entry) => entry.defId),
          );

          const eaByDefId = new Map();
          for (const entity of eaConceptEntities) {
            const entityDefId = Number(
              entity?.resourceId ||
                entity?.definitionId ||
                entity?.eaId ||
                entity?._staticData?.id ||
                entity?.id ||
                0,
            );
            if (!entityDefId) continue;

            // Prefer entities that already contain rating/static metadata.
            const existing = eaByDefId.get(entityDefId);
            const existingRating = Number(existing?.rating || existing?._staticData?.rating || 0);
            const candidateRating = Number(entity?.rating || entity?._staticData?.rating || 0);
            if (!existing || candidateRating > existingRating) {
              eaByDefId.set(entityDefId, entity);
            }
          }

          for (const entry of pendingFutggPlayers) {
            const realEntity = eaByDefId.get(entry.defId);
            const conceptPlayer = createConceptEntityFromEaSearch(
              realEntity,
              entry.futggPlayer,
              entry.playerName,
            );

            if (!conceptPlayer) {
              console.warn(
                `[concepts-cache] Player ${entry.playerName} (${entry.defId}) not found in EA concept search, skipping`,
              );
              continue;
            }

            cachedConcepts.push(conceptPlayer);
            cacheDefinitionIds.add(entry.defId);
            newPlayerCount++;

            if (newPlayerCount % 25 === 0) {
              showNotification(
                `Found ${newPlayerCount} new concept players from fut.gg...`,
                UINotificationType.PENDING,
              );
            }
          }

          console.log(
            `[concepts-cache] Page ${pageNum} matched ${eaByDefId.size}/${pendingFutggPlayers.length} fut.gg players via EA concept search`,
          );
        }
        
        if (!foundCachedPlayer) {
          pageNum++;
        }
      } catch (pageErr) {
        console.warn(`[concepts-cache] Error fetching page ${pageNum}:`, pageErr);
        if (pageNum === 1) {
          // First page failed, don't continue
          break;
        }
      }
    }
    
    if (newPlayerCount > 0) {
      console.log(`[concepts-cache] Found ${newPlayerCount} new players, updating cache`);
      showNotification(`Found ${newPlayerCount} new players! Saving to cache...`, UINotificationType.PENDING);
      await saveConceptsToIndexedDB(cachedConcepts);
      showNotification(`✓ Added ${newPlayerCount} new concept players from fut.gg`, UINotificationType.POSITIVE);
      return { newPlayerCount, totalCount: cachedConcepts.length };
    } else {
      console.log(`[concepts-cache] No new players found from fut.gg`);
      showNotification("No new players found on fut.gg (all cached)", UINotificationType.POSITIVE);
      return { newPlayerCount: 0, totalCount: cachedConcepts.length };
    }
  } catch (err) {
    console.warn("[concepts-cache] fut.gg fetch error:", err);
    showNotification(`✗ fut.gg fetch error: ${err.message}`, UINotificationType.NEGATIVE);
    return { newPlayerCount: 0, error: err.message };
  }
};

// Immediately load cached concepts, and trigger background fetch to update if past 6am
const loadCachedConceptsOnInit = async () => {
  try {
    console.log("[concepts-cache] loadCachedConceptsOnInit starting");
    await waitForClubPlayersReady();

    // Always load cache first (fast)
    const cached = await getConceptsFromIndexedDB();
    if (cached && cached.length > 0) {
      conceptPlayers = cached;
      conceptPlayersCollected = true;
      exposeConceptPlayersToConsole(conceptPlayers);
      console.log(`[concepts-cache] Initialized with ${cached.length} cached concepts`);
      
      // Trigger background refresh if past 6am on a new day (don't block init)
      const shouldRefresh = await shouldRefreshConceptsToday();
      if (shouldRefresh) {
        console.log("[concepts-cache] Triggering daily background fetch to update cache");
        // Background fetch new players from fut.gg without awaiting
        fetchNewPlayersFromFutgg().catch(err => {
          console.warn("[concepts-cache] Background fut.gg refresh failed:", err);
          showNotification(`✗ Background concept refresh failed: ${err.message}`, UINotificationType.NEGATIVE);
        });
      } else {
        console.log("[concepts-cache] Cache is fresh (already refreshed today), skipping daily fetch");
      }
      
      return true;
    }
    
    // Cache is empty - do initial bulk load from EA FC API (more efficient for thousands)
    console.log("[concepts-cache] Cache empty, performing initial bulk load from EA FC API");
    const initialLoad = await originalGetConceptPlayers(999999);
    
    if (initialLoad && initialLoad.length > 0) {
      conceptPlayers = initialLoad;
      conceptPlayersCollected = true;
      exposeConceptPlayersToConsole(conceptPlayers);
      console.log(`[concepts-cache] Initial load: ${initialLoad.length} concepts from EA FC`);
      
      // Save to cache for future loads
      await saveConceptsToIndexedDB(initialLoad);
      
      return true;
    }
    
    console.warn("[concepts-cache] Initial load returned no concepts");
    return false;
  } catch (err) {
    console.warn("[concepts-cache] Init error:", err);
  }
  
  return false;
};

// Hook original concept fetch to save to cache when done
const originalGetConceptPlayers = getConceptPlayers;
getConceptPlayers = async function (playerCount = 999999) {
  if (playerCount > 1 && !conceptPlayersCollected) {
    try {
      console.log("[concepts-cache] Bootstrapping cache from getConceptPlayers call");
      await ensureConceptCacheInit();
    } catch (err) {
      console.warn("[concepts-cache] Lazy bootstrap failed, falling back to original concept fetch:", err);
    }
  }

  // Check cache first
  if (playerCount > 1 && conceptPlayersCollected && conceptPlayers.length) {
    return conceptPlayers;
  }

  // Fetch from API
  const result = await originalGetConceptPlayers(playerCount);
  
  // Save to IndexedDB after collection
  if (result && result.length > 0) {
    saveConceptsToIndexedDB(result);
  }
  
  return result;
};

// Manual fallback refresh using original EA FC API (on-demand)
const manualRefreshConceptsFromEA = async () => {
  try {
    console.log("[concepts-cache] Starting manual EA FC concept refresh");
    const result = await originalGetConceptPlayers(999999);
    
    if (result && result.length > 0) {
      console.log(`[concepts-cache] Refreshed ${result.length} concepts from EA FC`);
      showNotification(
        `Updated ${result.length} concept players`,
        UINotificationType.POSITIVE
      );
      return { success: true, count: result.length };
    } else {
      console.warn("[concepts-cache] EA FC fetch returned no players");
      showNotification("No concepts received from EA FC", UINotificationType.NEGATIVE);
      return { success: false, error: "Empty result" };
    }
  } catch (err) {
    console.warn("[concepts-cache] Manual EA FC refresh failed:", err);
    showNotification(
      `Failed to refresh concepts: ${err.message}`,
      UINotificationType.NEGATIVE
    );
    return { success: false, error: err.message };
  }
};

// Test function: Verify fut.gg incremental fetch works
const testFutggIncrementalFetch = async () => {
  console.log("\n=== Testing fut.gg Incremental Fetch ===");
  console.log("Starting test... this may take a minute\n");
  
  try {
    // Show loading notification
    showNotification("Testing fut.gg incremental fetch...", UINotificationType.PENDING);
    
    const result = await fetchNewPlayersFromFutgg();
    
    console.log("\n--- Test Results ---");
    console.log(`New Players Found: ${result.newPlayerCount || 0}`);
    console.log(`Total Cached: ${result.totalCount || 0}`);
    console.log(`Error: ${result.error || "None"}`);
    
    if (result.error) {
      console.log("\n❌ ERROR: " + result.error);
      showNotification("✗ Test failed: " + result.error, UINotificationType.NEGATIVE);
    } else {
      console.log("\n✓ SUCCESS: fut.gg incremental fetch is working");
      console.log(`Found ${result.newPlayerCount} new players to add to cache`);
      showNotification(`✓ Incremental fetch working (${result.newPlayerCount} new players)`, UINotificationType.POSITIVE);
    }
    
    console.log("=== Test Complete ===\n");
    return result;
  } catch (err) {
    console.error("Test failed with exception:", err);
    showNotification("✗ Signing test failed: " + err.message, UINotificationType.NEGATIVE);
    return { error: err.message };
  }
};

// Expose test function to console and as global for manual testing
if (typeof window !== "undefined") {
  window.testFutggIncrementalFetch = testFutggIncrementalFetch;
  console.log("[concepts-cache] Test function available: window.testFutggIncrementalFetch() or testFutggIncrementalFetch()");
}

const ensureConceptCacheInit = () => {
  if (!conceptCacheInitPromise) {
    console.log("[concepts-cache] Scheduling concept cache init");
    conceptCacheInitPromise = loadCachedConceptsOnInit().catch((err) => {
      conceptCacheInitPromise = null;
      throw err;
    });
  }

  return conceptCacheInitPromise;
};

ensureConceptCacheInit().catch((err) => {
  console.warn("[concepts-cache] Failed to load cached concepts:", err);
});

const diagnoseRehydrateFailure = (rawItem) => {
  const details = {
    reasons: [],
    lookup: {
      resourceId: Number(rawItem?.resourceId || 0),
      definitionId: Number(rawItem?.definitionId || 0),
      eaId: Number(rawItem?.eaId || 0),
      id: Number(rawItem?.id || 0),
    },
    rawRating: Number(rawItem?.rating || 0),
    factoryAvailable: !!globalThis.UTItemEntityFactory,
  };

  if (!rawItem) {
    details.reasons.push("rawEntryMissing");
    return details;
  }

  const defId = Number(
    rawItem?.resourceId || rawItem?.definitionId || rawItem?.eaId || 0,
  );
  if (!Number.isFinite(defId) || defId <= 0) {
    details.reasons.push("invalidDefinitionId");
    return details;
  }

  const factoryPayload = {
    id: Number(rawItem?.id || 0),
    resourceId: defId,
    itemType: rawItem?.itemType || globalThis.ItemType?.PLAYER || 1,
    owners: 0,
    untrade: 1,
    loans: Number.isFinite(Number(rawItem?.loans)) ? Number(rawItem.loans) : -1,
  };

  const entity = createUtItemEntity(factoryPayload);
  if (!entity) {
    details.reasons.push("createUtItemEntityReturnedNull");
    return details;
  }

  details.entityHasPrototypeMethods = hasUtItemEntityFunctions(entity);
  if (!details.entityHasPrototypeMethods) {
    details.reasons.push("missingUtItemEntityPrototypeMethods");
  }

  if (!Number(entity?.definitionId)) {
    entity.definitionId = defId;
  }

  const staticData = entity?._staticData || {};
  const entityRatingBefore = Number(entity?.rating || 0);
  const staticRatingBefore = Number(staticData?.rating || 0);

  const derivedRating = Number(
    entity?.rating || staticData?.rating || rawItem?.rating || 0,
  );
  const derivedDefinitionId = Number(entity?.definitionId || defId || 0);

  if (derivedRating > 0 && Number(entity?.rating || 0) <= 0) {
    entity.rating = derivedRating;
  }
  if (derivedRating > 0 && Number(staticData?.rating || 0) <= 0) {
    staticData.rating = derivedRating;
  }

  const entityRatingAfter = Number(entity?.rating || 0);
  const staticRatingAfter = Number(staticData?.rating || 0);

  details.derived = {
    definitionId: derivedDefinitionId,
    rating: derivedRating,
    entityRatingBefore,
    staticRatingBefore,
    entityRatingAfter,
    staticRatingAfter,
    hasCoreDataGatePassed: derivedDefinitionId > 0 && derivedRating > 0,
  };

  if (derivedDefinitionId <= 0) {
    details.reasons.push("definitionIdMissingAfterRehydrate");
  }
  if (derivedRating <= 0) {
    details.reasons.push("ratingMissingAfterRehydrate");
  }
  if (!(derivedDefinitionId > 0 && derivedRating > 0)) {
    details.reasons.push("coreDataGateFailed");
  }
  if (derivedRating > 0 && entityRatingAfter <= 0 && staticRatingAfter <= 0) {
    details.reasons.push("ratingWriteDidNotStickOnEntity");
  }

  return details;
};

// Build one UTItemEntity from cache by id/definitionId/resourceId.
// Usage: await createutitemfromcache(239085)
const createUtItemFromCache = async (id) => {
  const lookupId = Number(id);
  if (!Number.isFinite(lookupId) || lookupId <= 0) {
    console.warn("[concepts-cache] createUtItemFromCache: invalid id", id);
    return null;
  }

  try {
    const db = await openConceptsDb();
    const cacheHit = await new Promise((resolve) => {
      const tx = db.transaction(["conceptsStore"], "readonly");
      const store = tx.objectStore("conceptsStore");
      const getRequest = store.get("allConcepts");

      getRequest.onsuccess = function (event) {
        const all = event.target.result?.data || [];
        const matchedIndex = all.findIndex((r) => {
          return (
            Number(r?.resourceId) === lookupId ||
            Number(r?.definitionId) === lookupId ||
            Number(r?.eaId) === lookupId
          );
        });
        if (matchedIndex < 0) {
          resolve({ rawEntry: null });
          return;
        }
        resolve({ rawEntry: all[matchedIndex] });
      };

      getRequest.onerror = function () {
        resolve({ rawEntry: null });
      };
    });

    const rawEntry = cacheHit.rawEntry;

    if (!rawEntry) {
      console.warn(`[concepts-cache] createUtItemFromCache: id ${lookupId} not found in cache`);
      return null;
    }

    const entity = rehydrateConceptEntity(rawEntry);
    if (!entity) {
      const diagnostics = diagnoseRehydrateFailure(rawEntry);
      console.warn(
        `[concepts-cache] createUtItemFromCache: id ${lookupId} found in cache but failed rehydration`,
        diagnostics,
      );
      return null;
    }

    return entity;
  } catch (err) {
    console.warn("[concepts-cache] createUtItemFromCache failed:", err);
    return null;
  }
};

if (typeof window !== "undefined") {
  window.createUtItemFromCache = createUtItemFromCache;
  window.createutitemfromcache = createUtItemFromCache;
  window.fetchNewPlayersFromFutgg = fetchNewPlayersFromFutgg;
}

// Diagnostic: compare a cached/rehydrated entity vs one returned by searchConceptItems.
// Usage: window.diffConceptEntity(defId) — e.g. diffConceptEntity(239085)
window.diffConceptEntity = async (defId) => {
  const numId = Number(defId);
  if (!numId) { console.error("[diffConceptEntity] invalid defId"); return; }

  // 1. Find the raw serialized entry from IndexedDB
  const db = await openConceptsDb();
  const rawEntry = await new Promise((resolve) => {
    const tx = db.transaction(["conceptsStore"], "readonly");
    tx.objectStore("conceptsStore").get("allConcepts").onsuccess = (e) => {
      const all = e.target.result?.data || [];
      resolve(all.find((r) => Number(r?.resourceId) === numId || Number(r?.id) === numId) || null);
    };
  });

  // 2. Rehydrate from cache (what the system currently does)
  const cached = rawEntry ? rehydrateConceptEntity(rawEntry) : null;

  // 3. Fetch live from searchConceptItems
  const live = await new Promise((resolve) => {
    if (!services?.Item?.searchConceptItems || typeof UTSearchCriteriaDTO === "undefined") {
      return resolve(null);
    }
    const dto = new UTSearchCriteriaDTO();
    dto.offset = 0;
    dto.count = 5;
    dto.defId = [numId];
    if (typeof SearchType !== "undefined") dto.type = SearchType.PLAYER;
    const ctx = getControllerInstance?.() || globalThis;
    services.Item.searchConceptItems(dto).observe(ctx, function (sender, response) {
      try { sender?.unobserve?.(ctx); } catch {}
      const items = response?.response?.items || [];
      resolve(items[0] || null);
    });
  });

  const snapshot = (item) => {
    if (!item) return null;
    const sd = item?._staticData || {};
    return {
      definitionId: item?.definitionId,
      rating: item?.rating,
      nationId: item?.nationId,
      teamId: item?.teamId,
      leagueId: item?.leagueId,
      _rareflag: item?._rareflag,
      name: item?.name || sd?.name,
      firstName: sd?.firstName,
      lastName: sd?.lastName,
      _staticData: { ...sd },
      hasGetSearchType: typeof item?.getSearchType === "function",
      hasIsPlayer: typeof item?.isPlayer === "function",
      hasIsTradeable: typeof item?.isTradeable === "function",
    };
  };

  const cachedSnap = snapshot(cached);
  const liveSnap = snapshot(live);

  // Find fields where cached differs from live
  const diff = {};
  if (cachedSnap && liveSnap) {
    const allKeys = new Set([...Object.keys(cachedSnap), ...Object.keys(liveSnap)]);
    for (const key of allKeys) {
      if (key === "_staticData") continue;
      const c = cachedSnap[key];
      const l = liveSnap[key];
      if (JSON.stringify(c) !== JSON.stringify(l)) diff[key] = { cached: c, live: l };
    }
    // Also diff _staticData fields
    const sdKeys = new Set([
      ...Object.keys(cachedSnap._staticData || {}),
      ...Object.keys(liveSnap._staticData || {}),
    ]);
    for (const k of sdKeys) {
      const c = cachedSnap._staticData?.[k];
      const l = liveSnap._staticData?.[k];
      if (JSON.stringify(c) !== JSON.stringify(l)) diff[`_staticData.${k}`] = { cached: c, live: l };
    }
  }

  console.log("[diffConceptEntity] defId:", numId);
  console.log("[diffConceptEntity] rawCached:", rawEntry);
  console.log("[diffConceptEntity] cachedEntity:", cachedSnap);
  console.log("[diffConceptEntity] liveEntity:", liveSnap);
  console.log("[diffConceptEntity] DIFF (fields that differ):", diff);

  return { rawEntry, cached: cachedSnap, live: liveSnap, diff };
};
