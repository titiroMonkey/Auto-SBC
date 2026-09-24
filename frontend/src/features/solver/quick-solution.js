const AUTO_QuickSolution_APPLY_COOLDOWN_MS = 20000;
const QuickSolution_PARSE_DEBUG_MAX_CHARS = 4000;

const toBaseDefinitionId = (value) => {
  const numericId = Number(value);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return NaN;
  }

  const EA_RESOURCE_ID_BLOCK = 16777216;
  if (numericId > EA_RESOURCE_ID_BLOCK) {
    const normalized = numericId % EA_RESOURCE_ID_BLOCK;
    return normalized > 0 ? normalized : numericId;
  }

  return numericId;
};

const extractFirstNumericId = (text, patterns) => {
  const sourceText = String(text || "");
  for (const pattern of patterns || []) {
    const match = sourceText.match(pattern);
    if (!match) {
      continue;
    }
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
};

const decodeRepeatedly = (value, maxIterations = 3) => {
  let output = String(value || "");
  for (let i = 0; i < maxIterations; i++) {
    try {
      const decoded = decodeURIComponent(output);
      if (decoded === output) {
        break;
      }
      output = decoded;
    } catch {
      break;
    }
  }
  return output;
};

const decodeHtmlEntities = (value) => {
  const rawValue = String(value || "");
  if (!rawValue) {
    return "";
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = rawValue;
  return textarea.value;
};

const collectImageSourceCandidates = (imageElement) => {
  if (!imageElement) {
    return [];
  }

  const candidates = [
    imageElement.getAttribute("src"),
    imageElement.getAttribute("srcset"),
    imageElement.getAttribute("data-src"),
    imageElement.currentSrc,
  ]
    .filter(Boolean)
    .map((value) => String(value));

  return Array.from(new Set(candidates));
};

const extractPlayerDefinitionIdFromHref = (hrefValue) => {
  const rawHref = String(hrefValue || "").trim();
  const variants = [
    rawHref,
    decodeHtmlEntities(rawHref),
    decodeRepeatedly(rawHref),
    decodeRepeatedly(decodeHtmlEntities(rawHref)),
  ];

  for (const candidateHref of variants) {
    const playerMatch = String(candidateHref).match(
      /\/player\/(?:[^/?#]+)\/(\d+)(?:[/?#]|$)/i,
    );
    if (playerMatch) {
      const id = Number(playerMatch[1]);
      if (Number.isFinite(id) && id > 0) {
        return id;
      }
    }
  }

  return null;
};

const parseRarityInfo = (text) => {
  const rawText = String(text || "");
  const sourceVariants = [
    rawText,
    decodeRepeatedly(rawText),
    decodeRepeatedly(decodeRepeatedly(rawText)),
  ];

  for (const sourceText of sourceVariants) {
    const rarityPairMatch = String(sourceText).match(
      /e_(\d+)_\d+(?:\.[a-z0-9]+)*(?:[?&#"'\s]|$)/i,
    );
    if (rarityPairMatch) {
      const firstId = Number(rarityPairMatch[1]);
      if (Number.isFinite(firstId)) {
        return {
          rarityId: firstId,
          rarityText: null,
          rarityIsRare: null,
        };
      }
    }
  }

  const fallbackRarityId = extractFirstNumericId(rawText, [
    /rarity(?:%2f|\/|\\\/)[^\s"']*?e_(\d+)_\d+/i,
    /e_(\d+)_\d+/i,
  ]);

  if (
    Number.isFinite(Number(fallbackRarityId)) &&
    Number(fallbackRarityId) >= 0
  ) {
    return {
      rarityId: Number(fallbackRarityId),
      rarityText: null,
      rarityIsRare: null,
    };
  }

  if (/\brare\b/.test(rawText)) {
    return { rarityId: null, rarityText: "rare", rarityIsRare: true };
  }
  if (/\bcommon\b/.test(rawText)) {
    return { rarityId: null, rarityText: "common", rarityIsRare: false };
  }
  return { rarityId: null, rarityText: null, rarityIsRare: null };
};

const extractIdFromAssetUrl = (assetUrl, assetType) => {
  const source = decodeRepeatedly(assetUrl);
  const type = String(assetType || "").toLowerCase();
  if (!source || !type) {
    return null;
  }

  const directMatch = source.match(
    new RegExp(
      `(?:https?:\\/\\/[^\\s"']+)?\\/${type}\\/(?:[^\\/]+\\/)?(\\d+)(?:\\.png|\\b)`,
      "i",
    ),
  );
  if (directMatch) {
    const id = Number(directMatch[1]);
    if (Number.isFinite(id) && id > 0) {
      return id;
    }
  }

  const encodedParamMatch = source.match(/(?:\?|&)url=([^&"'\s]+)/i);
  if (encodedParamMatch) {
    const decodedParam = decodeRepeatedly(encodedParamMatch[1]);
    const nestedMatch = decodedParam.match(
      new RegExp(`\\/${type}\\/(?:[^\\/]+\\/)?(\\d+)(?:\\.png|\\b)`, "i"),
    );
    if (nestedMatch) {
      const id = Number(nestedMatch[1]);
      if (Number.isFinite(id) && id > 0) {
        return id;
      }
    }
  }

  return null;
};

const extractAssetIdFromImage = (imageElement, assetType) => {
  if (!imageElement) {
    return null;
  }

  const candidates = collectImageSourceCandidates(imageElement);

  for (const candidate of candidates) {
    const id = extractIdFromAssetUrl(candidate, assetType);
    if (Number.isFinite(id) && id > 0) {
      return id;
    }
  }

  return null;
};

const collectAssetImageCandidatesFromContainer = (container, assetType) => {
  const type = String(assetType || "").toLowerCase();
  const imageSelectors = [
    `img[alt="${type}_image"]`,
    `img[alt*="${type}_image"]`,
    `img[src*="/${type}/"]`,
    `img[src*="%2F${type}%2F"]`,
    `img[srcset*="/${type}/"]`,
    `img[srcset*="%2F${type}%2F"]`,
  ];

  const debugRows = [];
  for (const selector of imageSelectors) {
    const imageElement = container?.querySelector?.(selector);
    if (!imageElement) {
      continue;
    }
    debugRows.push({
      selector,
      candidates: collectImageSourceCandidates(imageElement),
    });
  }

  return debugRows;
};

const extractAssetIdFromContainer = (container, snippet, assetType) => {
  const type = String(assetType || "").toLowerCase();
  const imageSelectors = [
    `img[alt="${type}_image"]`,
    `img[alt*="${type}_image"]`,
    `img[src*="/${type}/"]`,
    `img[src*="%2F${type}%2F"]`,
    `img[srcset*="/${type}/"]`,
    `img[srcset*="%2F${type}%2F"]`,
  ];

  for (const selector of imageSelectors) {
    const imageElement = container?.querySelector?.(selector);
    const id = extractAssetIdFromImage(imageElement, type);
    if (Number.isFinite(id) && id > 0) {
      return id;
    }
  }

  const fallbackText = String(snippet || "");
  return extractFirstNumericId(fallbackText, [
    new RegExp(
      `(?:https?:\\/\\/[^\\s"']+)?\\/${type}\\/(?:[^\\/]+\\/)?(\\d+)(?:\\.png|\\b)`,
      "i",
    ),
    new RegExp(`%2F${type}%2F(?:[^%]+%2F)?(\\d+)(?:\\.png|%2Epng|\\b)`, "i"),
    new RegExp(`${type}Id["':=\\s]+(\\d+)`, "i"),
    new RegExp(`data-${type}-id=["']?(\\d+)`, "i"),
  ]);
};

const parseQuickSolutionEntries = (html) => {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(String(html || ""), "text/html");
  const playerAnchors = Array.from(
    documentNode.querySelectorAll('a[href*="/player/"]'),
  );

  const entries = [];
  const seenKeys = new Set();

  for (const anchor of playerAnchors) {
    const href = String(anchor.getAttribute("href") || "");
    const extractedPlayerDefinitionId = extractPlayerDefinitionIdFromHref(href);
    if (!Number.isFinite(extractedPlayerDefinitionId)) {
      continue;
    }

    const rawDefinitionId = Number(extractedPlayerDefinitionId);
    const definitionId = toBaseDefinitionId(rawDefinitionId);
    if (!Number.isFinite(definitionId)) {
      continue;
    }

    const container =
      anchor.closest("li, article, tr, .player-card, .card, .solution") ||
      anchor.parentElement ||
      anchor;
    const snippet = [
      container?.outerHTML || "",
      anchor.outerHTML || "",
      anchor.textContent || "",
    ].join(" ");

    const clubId = extractAssetIdFromContainer(container, snippet, "club");
    const leagueId = extractAssetIdFromContainer(container, snippet, "league");
    const nationId = extractAssetIdFromContainer(container, snippet, "nation");
    const { rarityId, rarityText, rarityIsRare } = parseRarityInfo(snippet);

    const missingParseFields = [];
    if (!Number.isFinite(clubId)) {
      missingParseFields.push("teamId");
    }
    if (!Number.isFinite(leagueId)) {
      missingParseFields.push("leagueId");
    }
    if (!Number.isFinite(nationId)) {
      missingParseFields.push("nationId");
    }
    if (!Number.isFinite(rarityId)) {
      missingParseFields.push("rarityId");
    }

    if (missingParseFields.length) {
      console.warn("[Auto-SBC][QuickSolution] Missing required parsed IDs", {
        missingParseFields,
        playerPath: href,
        rawDefinitionId,
        definitionId,
        parsedIds: {
          teamId: clubId,
          leagueId,
          nationId,
          rarityId,
        },
        imageCandidates: {
          team: collectAssetImageCandidatesFromContainer(container, "club"),
          league: collectAssetImageCandidatesFromContainer(container, "league"),
          nation: collectAssetImageCandidatesFromContainer(container, "nation"),
        },
        parseSourceSnippet: String(snippet || "").slice(
          0,
          QuickSolution_PARSE_DEBUG_MAX_CHARS,
        ),
      });
    }

    const dedupeKey = [
      definitionId,
      clubId ?? "",
      leagueId ?? "",
      nationId ?? "",
      rarityId ?? "",
      rarityText ?? "",
    ].join("|");
    if (seenKeys.has(dedupeKey)) {
      continue;
    }
    seenKeys.add(dedupeKey);

    entries.push({
      index: entries.length,
      playerPath: href,
      rawDefinitionId,
      definitionId,
      clubId,
      leagueId,
      nationId,
      rarityId,
      rarityText,
      rarityIsRare,
    });
  }

  return entries;
};

function hasPlayersInCurrentSquad() {
  const controller = getControllerInstance();
  const challengeSquadPlayers = controller?._challenge?.squad?._players;
  const activeSquadPlayers = controller?._squad?._players;
  const squadPlayers = Array.isArray(activeSquadPlayers)
    ? activeSquadPlayers
    : Array.isArray(challengeSquadPlayers)
      ? challengeSquadPlayers
      : [];

  return squadPlayers.some((slot) => {
    const item = slot?._item || slot?.item;
    if (!item) {
      return false;
    }
    if (typeof item.isValid === "function") {
      return item.isValid();
    }
    return (
      Number(item.id) > 0 ||
      Number(item.definitionId) > 0 ||
      Number(item?._metaData?.id) > 0
    );
  });
}

// ── fut.gg quick-solution resolver ───────────────────────────────────────
// fut.gg exposes each SBC challenge's cheapest solution as a squad-builder
// UUID; the squad API returns the exact player EA (definition) IDs, so no HTML
// scraping is needed. Resolves an EA setId/challengeId to that ID list.
const FUTGG_SBC_GAME = 27;

const futGgGetJson = async (url) => {
  const text = await makeGetRequest(url);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const resolveFutGgSetSlug = async (setId) => {
  const wanted = Number(setId);
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 20) {
    const idx = await futGgGetJson(
      `https://www.fut.gg/api/fut/sbc/?game=${FUTGG_SBC_GAME}&page=${page}`,
    );
    if (!idx) break;
    totalPages = Number(idx.totalPages || 1);
    const match = (idx.data || []).find((s) => Number(s.eaId) === wanted);
    if (match?.slug) return match.slug;
    page += 1;
  }
  return null;
};

const fetchFutGgSolution = async (setId, challengeId) => {
  const result = { definitionIds: [], solutionUrl: null };
  const slug = await resolveFutGgSetSlug(setId);
  if (!slug) return result;

  const detail = await futGgGetJson(`https://www.fut.gg/api/fut/sbc/${slug}/`);
  const challenges = detail?.data?.challenges || [];
  const challenge =
    challenges.find((c) => Number(c.eaId) === Number(challengeId)) ||
    challenges[0];
  const solutionPath =
    challenge?.cheapestSolutionUrl || challenge?.cheapestSolutionPcUrl || "";
  const uuid = String(solutionPath).match(/squad-builder\/([0-9a-f-]{36})/i)?.[1];
  if (!uuid) return result;
  result.solutionUrl = `https://www.fut.gg${solutionPath}`;

  const squad = await futGgGetJson(`https://www.fut.gg/api/squads/${uuid}/`);
  const positions = squad?.data?.data?.activeGroupPositions || [];
  result.definitionIds = positions
    .map((p) => Number(p.playerEaId))
    .filter((n) => Number.isFinite(n) && n > 0);
  return result;
};

async function autoApplyQuickSolutionOnPageOpen(options = {}) {
  try {
    const { force = false, suppressNavigation = false } = options;
    const controller = getControllerInstance();
    const controllerChallenge = controller?._challenge;
    // Allow callers (e.g. pre-solve from the SBC tab) to supply the SBC
    // identifiers directly so we don't depend on being inside a squad screen.
    const challenge = {
      setId: options.setId ?? controllerChallenge?.setId,
      id: options.challengeId ?? controllerChallenge?.id,
    };
    if (!challenge.setId || !challenge.id) {
      return;
    }

    const enabled = !!getSettings(
      challenge.setId,
      challenge.id,
      "autoApplyQuickSolutionOnOpen",
    );
    if (!enabled && !force) {
      return;
    }

    if (!force && hasPlayersInCurrentSquad()) {
      return;
    }

    const toSlug = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const sbcData = await fetchSBCData(challenge.setId, challenge.id);
    if (!sbcData) {
      showNotification("Could not load SBC data", UINotificationType.NEGATIVE);
      return;
    }

    window.__autoSbcQuickSolutionApplyState ??= {
      running: new Set(),
      lastRunAt: {},
    };

    const state = window.__autoSbcQuickSolutionApplyState;
    const key = `${challenge.setId}:${challenge.id}`;
    const lsKey = `autosbc_futgg_cache_${key}`;
    const now = Date.now();
    const lastRunAt = Number(state.lastRunAt[key] || 0);

    if (state.running.has(key)) {
      return;
    }
    if (!force && now - lastRunAt < AUTO_QuickSolution_APPLY_COOLDOWN_MS) {
      return;
    }

    state.running.add(key);
    state.lastRunAt[key] = now;

    // Resolve the cheapest fut.gg solution's player definition IDs for this
    // SBC challenge (fut.gg "View Solution" → squad-builder → /api/squads).
    let definitionIds = [];
    try {
      const cached = localStorage.getItem(lsKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.definitionIds)) {
          definitionIds = parsed.definitionIds;
        }
      }
    } catch {}

    if (!definitionIds.length) {
      const resolved = await fetchFutGgSolution(challenge.setId, challenge.id);
      definitionIds = resolved.definitionIds;
      window.__autoSbcLastQuickSolutionUrl = resolved.solutionUrl;
      if (definitionIds.length) {
        try {
          localStorage.setItem(
            lsKey,
            JSON.stringify({
              definitionIds,
              fetchedAt: now,
              solutionUrl: resolved.solutionUrl,
            }),
          );
        } catch {}
      }
    }

    // fut.gg supplies exact player EA IDs, so each entry needs only the
    // definition id; metadata fields stay null and the matcher falls back to
    // a definition-id match.
    const QuickSolutionEntries = definitionIds.map((rawId, index) => ({
      index,
      playerEaId: Number(rawId),
      definitionId: toBaseDefinitionId(rawId),
      clubId: null,
      leagueId: null,
      nationId: null,
      rarityId: null,
      rarityText: null,
      rarityIsRare: null,
    }));
    window.__autoSbcLastQuickSolutionParsedEntries = QuickSolutionEntries;

    if (!QuickSolutionEntries.length) {
      showNotification(
        "No fut.gg solution found for this SBC challenge",
        UINotificationType.NEGATIVE,
      );
      return;
    }

    const uniqueDefinitionIds = Array.from(
      new Set(definitionIds.filter((id) => Number.isFinite(id) && id > 0)),
    );

    const searchedConceptPlayers = await new Promise((resolve) => {
      if (!uniqueDefinitionIds.length || !services?.Item?.searchConceptItems) {
        resolve([]);
        return;
      }

      const observerContext = getControllerInstance() || this;
      try {
        const dto = new UTSearchCriteriaDTO();
        dto.offset = 0;
        dto.count = Math.max(50, uniqueDefinitionIds.length * 10);
        dto.defId = uniqueDefinitionIds;
        if (typeof SearchType !== "undefined") {
          dto.type = SearchType.PLAYER;
        }

        services.Item.searchConceptItems(dto).observe(
          observerContext,
          function (sender, response) {
            try {
              sender?.unobserve?.(observerContext);
            } catch {}
            const items = response?.response?.items;
            resolve(Array.isArray(items) ? items : []);
          },
        );
      } catch {
        resolve([]);
      }
    });

    window.__autoSbcLastQuickSolutionConceptSearchResults =
      searchedConceptPlayers;

    const clubPlayersPool =
      typeof fetchPlayers === "function"
        ? (((await fetchPlayers({ showProgress: false })) || []).filter(
            (item) => Number(item?.loans ?? -1) < 0,
          ) || [])
        : [];
    window.__autoSbcLastQuickSolutionClubSearchResults = clubPlayersPool;

    const usedClubPoolIndexes = new Set();
    const usedConceptPoolIndexes = new Set();
    const getPlayerMeta = (item) => ({
      teamId:
        Number(item?.teamId ?? item?.teamIdId ?? item?._staticData?.teamId) ||
        0,
      leagueId: Number(item?.leagueId ?? item?._staticData?.leagueId) || 0,
      nationId: Number(item?.nationId ?? item?._staticData?.nationId) || 0,
      rarityId: Number(item?._rareflag) || 0,
    });

    const isExactMetadataMatch = (item, QuickSolutionEntry) => {
      const required = [
        QuickSolutionEntry.clubId,
        QuickSolutionEntry.leagueId,
        QuickSolutionEntry.nationId,
      ];
      const hasMetadata =
        required.every(
          (value) => Number.isFinite(Number(value)) && Number(value) > 0,
        ) &&
        Number.isFinite(Number(QuickSolutionEntry.rarityId)) &&
        Number(QuickSolutionEntry.rarityId) >= 0;
      // fut.gg entries carry the exact player EA id, so the definition-id match
      // done by the caller is authoritative when no metadata is present.
      if (!hasMetadata) {
        return true;
      }

      const playerMeta = getPlayerMeta(item);
      return (
        Number(QuickSolutionEntry.clubId) === Number(playerMeta.teamId) &&
        Number(QuickSolutionEntry.leagueId) === Number(playerMeta.leagueId) &&
        Number(QuickSolutionEntry.nationId) === Number(playerMeta.nationId) &&
        Number(QuickSolutionEntry.rarityId) === Number(playerMeta.rarityId)
      );
    };

    const pickPlayerByDefinitionId = (
      definitionId,
      pool,
      QuickSolutionEntry,
      usedPoolIndexes,
    ) => {
      const numericId = Number(definitionId);
      const selected = (pool || [])
        .map((item, poolIndex) => ({ item, poolIndex }))
        .find(({ item, poolIndex }) => {
          if (!item || usedPoolIndexes.has(poolIndex)) return false;
          if (toBaseDefinitionId(item.definitionId) !== numericId) return false;
          return isExactMetadataMatch(item, QuickSolutionEntry);
        });

      if (!selected) {
        return null;
      }

      usedPoolIndexes.add(selected.poolIndex);
      return selected.item;
    };

    const selectionRows = QuickSolutionEntries.map(
      (QuickSolutionEntry, index) => {
        const clubPlayer = pickPlayerByDefinitionId(
          QuickSolutionEntry.definitionId,
          clubPlayersPool,
          QuickSolutionEntry,
          usedClubPoolIndexes,
        );

        const conceptPlayer = clubPlayer
          ? null
          : pickPlayerByDefinitionId(
              QuickSolutionEntry.definitionId,
              searchedConceptPlayers,
              QuickSolutionEntry,
              usedConceptPoolIndexes,
            );

        const player = clubPlayer || conceptPlayer;
        return {
          index,
          definitionId: QuickSolutionEntry.definitionId,
          QuickSolutionEntry,
          source: clubPlayer
            ? "club"
            : conceptPlayer
              ? "concept_search"
              : "missing",
          player: player || null,
        };
      },
    );

    const selectedPlayers = selectionRows
      .map((row) => row.player)
      .filter(Boolean);
    if (!selectedPlayers.length) {
      showNotification("No matching QuickSolution players found", UINotificationType.NEGATIVE);
      return;
    }

    // Build the initial squad array (concepts in their slots, bricks filled).
    let solutionSquad = [...Array(11)];
    sbcData.brickIndices.forEach((index) => {
      solutionSquad[index] = new UTItemEntity();
    });

    const openSlots = [];
    for (let idx = 0; idx < solutionSquad.length; idx++) {
      if (solutionSquad[idx] == undefined) {
        openSlots.push(idx);
      }
    }

    // Maps selectionRows index → solutionSquad index
    const rowToSquadSlot = {};
    for (
      let idx = 0;
      idx < openSlots.length && idx < selectionRows.length;
      idx++
    ) {
      const selected = selectionRows[idx]?.player;
      if (selected) {
        solutionSquad[openSlots[idx]] = selected;
        rowToSquadSlot[idx] = openSlots[idx];
      }
    }

    // ── Concept-to-club swap using EA's own chemistry calculator ─────────
    // For each concept slot we:
    //  1. Run chemCalculator.calculate() on the current squad (concept in place)
    //     to get the baseline slot chem – mirrors EA's swap preview exactly.
    //  2. For each club candidate (sorted cheapest first, then highest rated):
    //     a. Rating within ±2 OVR.
    //     b. Price ≤ PRICE_FACTOR_MAX × concept price.
    //     c. FULL squad-level constraint check: after substituting the candidate
    //        in place of the concept, every binding SBC constraint must still be
    //        satisfied by enough players in the whole squad (≥ required count).
    //        This is stronger than the old per-slot check and catches cases where
    //        multiple slots together cover a threshold.
    //     d. Chem check (EA logic): candidateSlotChem ≥ baselineSlotChem.
    //  3. The first candidate that passes all gates is accepted (cheapest valid).

    const constraints = sbcData?.constraints || [];

    // ── SBC settings filters ─────────────────────────────────────────────
    // Read the same per-SBC settings that solveSBC uses so swap candidates
    // obey exclude lists, price caps, rarity filters, etc.
    const _sbcId      = challenge.setId;
    const _challengeId = challenge.id;
    const _gs = (key) => getSettings(_sbcId, _challengeId, key);

    const sw_excludePlayers  = _gs("excludePlayers")  || [];
    const sw_excludeLeagues  = _gs("excludeLeagues")  || [];
    const sw_excludeNations  = _gs("excludeNations")  || [];
    const sw_excludeTeams    = _gs("excludeTeams")    || [];
    const sw_excludeRarity   = _gs("excludeRarity")   || [];
    const sw_excludeSbc      = !!_gs("excludeSbc");
    const sw_excludeObjective= !!_gs("excludeObjective");
    const sw_excludeSpecial  = !!_gs("excludeSpecial");
    const sw_excludeTradable = !!_gs("excludeTradable");
    const sw_excludeExtinct  = !!_gs("excludeExtinct");
    const sw_onlyStorage     = !!_gs("onlyStorage");
    const sw_excludeSbcSquads= !!_gs("excludeSbcSquads");
    const sw_maxPlayerPrice  = Number(_gs("maxPlayerPrice") || 0);
    const sw_ratingRange     = _gs("ratingRange") ?? [0, 99];
    const _PriceItems        = (typeof getPriceItems === "function") ? (getPriceItems() || {}) : {};

    const candidatePassesSettings = (item) => {
      try {
        const defId    = Number(item?.definitionId);
        const leagueId = Number(item?.leagueId ?? item?._staticData?.leagueId ?? 0);
        const nationId = Number(item?.nationId ?? item?._staticData?.nationId ?? 0);
        const teamId   = Number(item?.teamId   ?? item?._staticData?.teamId   ?? 0);
        const rating   = getItemRating(item);
        const priceEntry = _PriceItems[defId] || {};

        if (sw_excludePlayers.includes(defId))                          return false;
        if (sw_excludeLeagues.includes(leagueId))                       return false;
        if (sw_excludeNations.includes(nationId))                       return false;
        if (sw_excludeTeams.includes(teamId))                           return false;
        if (rating < sw_ratingRange[0] || rating > sw_ratingRange[1])   return false;
        if (sw_excludeExtinct   && priceEntry.isExtinct)                return false;
        if (sw_excludeSbc       && priceEntry.isSbc)                    return false;
        if (sw_excludeObjective && priceEntry.isObjective)              return false;
        if (sw_onlyStorage      && !item?.isStorage)                    return false;
        if (sw_excludeSbcSquads && item?.isSbcPlayer)                   return false;

        if (sw_excludeSpecial) {
          try { if (typeof item?.isSpecial === "function" && item.isSpecial()) return false; }
          catch { /* skip */ }
        }
        if (sw_excludeTradable) {
          try { if (typeof item?.isTradeable === "function" && item.isTradeable()) return false; }
          catch { /* skip */ }
        }
        if (sw_excludeRarity.length) {
          try {
            const rarityLabel = (
              (typeof item?.isSpecial === "function" && item.isSpecial()
                ? ""
                : services.Localization.localize("search.cardLevels.cardLevel" + (typeof item?.getTier === "function" ? item.getTier() : "")) + " ") +
              services.Localization.localize("item.raretype" + (item?._rareflag ?? item?.rareflag ?? 0))
            ).trim();
            if (sw_excludeRarity.includes(rarityLabel)) return false;
          } catch { /* skip rarity label check on error */ }
        }
        if (sw_maxPlayerPrice > 0 && getItemPrice(item) > sw_maxPlayerPrice) return false;

        return true;
      } catch {
        return true; // don't block on unexpected errors
      }
    };
    // ─────────────────────────────────────────────────────────────────────

    // Use SBC pricing (CBR floor, concept premium, extinct handling) so the
    // cheapest-first sort and price guard match how the solver values players.
    const getItemPrice = (item) => {
      try {
        if (typeof getSBCPrice === "function") return Number(getSBCPrice(item) || 0);
        if (typeof getPrice    === "function") return Number(getPrice(item)    || 0);
        return 0;
      } catch { return 0; }
    };
    const getItemRating = (item) => Number(item?.rating ?? item?._staticData?.rating ?? 0);
    const getItemTeam   = (item) => Number(item?.teamId   ?? item?._staticData?.teamId   ?? 0);
    const getItemLeague = (item) => Number(item?.leagueId ?? item?._staticData?.leagueId ?? 0);
    const getItemNation = (item) => Number(item?.nationId ?? item?._staticData?.nationId ?? 0);
    const getItemRarity = (item) => Number(item?._rareflag ?? item?.rareflag ?? item?._staticData?.rareflag ?? 0);
    const getItemRarityGroups = (item) => {
      const g = item?.groups ?? item?._staticData?.groups ?? [];
      return Array.isArray(g) ? g.map(Number) : [Number(g)].filter(Boolean);
    };
    const getItemTier = (item) => {
      try {
        if (typeof item?.getTier === "function") {
          return item.getTier();
        }
        return Number(item?.ratingTier ?? item?._staticData?.ratingTier ?? NaN);
      } catch {
        return null;
      }
    };

    const isConstraintEligiblePlayer = (item) => {
      if (!item) {
        return false;
      }
      try {
        if (typeof item.isValid === "function") {
          return !!item.isValid();
        }
      } catch {}
      return (
        Number(item?.id) > 0 ||
        Number(item?.definitionId) > 0 ||
        Number(item?._metaData?.id) > 0
      );
    };

    const compareByScope = (actual, expected, scope, defaultScope = "GREATER") => {
      const normalizedScope = String(scope || defaultScope).toUpperCase();
      if (normalizedScope === "LOWER") {
        return actual <= expected;
      }
      if (normalizedScope === "EXACT") {
        return actual === expected;
      }
      return actual >= expected;
    };

    const countByKey = (players, keySelector) => {
      const counts = new Map();
      for (const player of players) {
        const key = Number(keySelector(player));
        if (!Number.isFinite(key) || key <= 0) {
          continue;
        }
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return counts;
    };

    // Whether a single player item satisfies a single per-player constraint.
    const itemSatisfiesConstraint = (item, c) => {
      if (!item) return false;
      const key    = String(c?.requirementKey || "");
      const values = Array.isArray(c?.eligibilityValues) ? c.eligibilityValues : [];
      const scope  = String(c?.scope || "");
      const count  = Number(c?.count ?? 0);
      if (!key || count <= 0) return true; // non-binding
      if (
        key === "TEAM_RATING" ||
        key === "CHEMISTRY_POINTS" ||
        key === "ALL_PLAYERS_CHEMISTRY_POINTS" ||
        key === "SAME_CLUB_COUNT" ||
        key === "SAME_LEAGUE_COUNT" ||
        key === "SAME_NATION_COUNT" ||
        key === "CLUB_COUNT" ||
        key === "LEAGUE_COUNT" ||
        key === "NATION_COUNT"
      ) {
        return true;
      }
      switch (key) {
        case "CLUB_ID":   return values.map(Number).includes(getItemTeam(item));
        case "LEAGUE_ID": return values.map(Number).includes(getItemLeague(item));
        case "NATION_ID": return values.map(Number).includes(getItemNation(item));
        case "PLAYER_RARITY": return values.map(Number).includes(getItemRarity(item));
        case "PLAYER_RARITY_GROUP": {
          const g = getItemRarityGroups(item);
          return values.map(Number).some((v) => g.includes(v));
        }
        case "PLAYER_LEVEL": return values.map(Number).includes(getItemTier(item));
        case "PLAYER_QUALITY":
          if (scope === "GREATER" || scope === "EXACT") return getItemTier(item) >= values[0];
          if (scope === "LOWER") return getItemTier(item) <= values[0];
          return true;
        case "PLAYER_EXACT_OVR": return values.map(Number).includes(getItemRating(item));
        case "PLAYER_MIN_OVR":
          if (scope === "GREATER" || scope === "EXACT") return getItemRating(item) >= Number(values[0]);
          return true;
        case "PLAYER_MAX_OVR":
          if (scope === "LOWER"   || scope === "EXACT") return getItemRating(item) <= Number(values[0]);
          return true;
        default: return true;
      }
    };

    // Whether the live game uses the float (decimal) squad-rating formula.
    // Current FC titles enable this, which produces a LOWER squad rating than
    // the old integer approximation – if we don't mirror it, rating-dropping
    // concept→club swaps slip past the gate and the SBC rating requirement
    // fails after the swap is applied.
    const squadRatingFloatEnabled = (() => {
      try {
        return !!services.Configuration.checkFeatureEnabled(
          UTServerSettingsRepository.KEY.SQUAD_RATING_FLOAT_CALCULATION_ENABLED,
        );
      } catch {
        return false;
      }
    })();

    // Full squad-level constraint check: given a squad array, verify every
    // binding constraint still has enough satisfying players.
    // For TEAM_RATING we replicate EA's squad rating formula from
    // UTSquadEntity._calculateRating exactly, honouring the float-calculation
    // feature flag so the value matches what the live game will compute.
    // Returns the (possibly decimal) squad rating; constraint passes when it
    // reaches the required value.
    const calcSquadRating = (squad) => {
      const field = squad.filter(Boolean).slice(0, 11);
      const r = field.length;
      if (!r) return 0;
      let n = field.reduce((acc, p) => acc + getItemRating(p), 0);
      if (squadRatingFloatEnabled) {
        // Float path: non-floored average threshold, then Math.round.
        let o = n / r;
        o = Math.min(o, 99);
        let a = n;
        for (const p of field) {
          const rating = getItemRating(p);
          if (rating > o) a += rating - o; // all SBC players are field players
        }
        n = Math.round(a);
      } else {
        // Integer path: floored average threshold.
        const s = Math.min(Math.floor(n / r), 99);
        for (const p of field) {
          const rating = getItemRating(p);
          if (rating > s) n += rating - s;
        }
      }
      // EA formats the final rating to at most 2 decimals; match that so the
      // >= comparison against an integer requirement lines up with the game.
      const rated = Math.min(Math.max(n / r, 0), 99);
      return Math.round(rated * 100) / 100;
    };

    const chemistrySnapshotForSquad = (squad) => {
      if (!chemCalc) {
        return null;
      }
      try {
        const vo = chemCalc.calculate(formationProxy, squad, emptyManager);
        if (!vo) {
          return null;
        }
        const slotChem = [];
        for (let idx = 0; idx < squad.length; idx++) {
          slotChem[idx] = Number(vo.getSlotChemistry(idx)?.points ?? 0);
        }
        return {
          totalChem: Number(vo.totalChemistryPoints ?? vo.getTotalChemistry?.() ?? 0),
          slotChem,
        };
      } catch {
        return null;
      }
    };

    const squadMeetsAllConstraints = (squad) => {
      const eligiblePlayers = squad.filter((player) => isConstraintEligiblePlayer(player));
      const eligibleCount = eligiblePlayers.length;
      const teamCounts = countByKey(eligiblePlayers, getItemTeam);
      const leagueCounts = countByKey(eligiblePlayers, getItemLeague);
      const nationCounts = countByKey(eligiblePlayers, getItemNation);
      const chemSnapshot = chemistrySnapshotForSquad(squad);

      return constraints.every((c) => {
        const required = Number(c?.count ?? c?.eligibilityValues?.[0] ?? 0);
        const key      = String(c?.requirementKey || "");
        const scope    = String(c?.scope || "GREATER").toUpperCase();
        const values   = Array.isArray(c?.eligibilityValues) ? c.eligibilityValues : [];

        if (!key) {
          return true;
        }

        // TEAM_RATING is a squad-aggregate constraint, not a per-player count.
        if (key === "TEAM_RATING") {
          const target = Number(values[0] ?? 0);
          const sqRating = calcSquadRating(squad);
          return compareByScope(sqRating, target, scope);
        }

        if (key === "CHEMISTRY_POINTS") {
          const target = Number(values[0] ?? 0);
          if (!Number.isFinite(target) || target <= 0) {
            return true;
          }
          if (!chemSnapshot) {
            return true;
          }
          return compareByScope(Number(chemSnapshot.totalChem || 0), target, scope);
        }

        if (key === "ALL_PLAYERS_CHEMISTRY_POINTS") {
          const target = Number(values[0] ?? 0);
          if (!Number.isFinite(target) || target <= 0) {
            return true;
          }
          if (!chemSnapshot) {
            return true;
          }
          const slotChemValues = eligiblePlayers.map((player) => {
            const slotIndex = squad.indexOf(player);
            return Number(chemSnapshot.slotChem?.[slotIndex] ?? 0);
          });
          if (scope === "LOWER") {
            return slotChemValues.every((chemValue) => chemValue <= target);
          }
          if (scope === "EXACT") {
            return slotChemValues.every((chemValue) => chemValue === target);
          }
          return slotChemValues.every((chemValue) => chemValue >= target);
        }

        if (key === "SAME_CLUB_COUNT") {
          if (!required) {
            return true;
          }
          const maxSameClub = teamCounts.size ? Math.max(...teamCounts.values()) : 0;
          if (scope === "LOWER") {
            return maxSameClub <= required;
          }
          if (scope === "EXACT") {
            return maxSameClub === required;
          }
          return maxSameClub >= required;
        }

        if (key === "SAME_LEAGUE_COUNT") {
          if (!required) {
            return true;
          }
          const maxSameLeague = leagueCounts.size ? Math.max(...leagueCounts.values()) : 0;
          if (scope === "LOWER") {
            return maxSameLeague <= required;
          }
          if (scope === "EXACT") {
            return maxSameLeague === required;
          }
          return maxSameLeague >= required;
        }

        if (key === "SAME_NATION_COUNT") {
          if (!required) {
            return true;
          }
          const maxSameNation = nationCounts.size ? Math.max(...nationCounts.values()) : 0;
          if (scope === "LOWER") {
            return maxSameNation <= required;
          }
          if (scope === "EXACT") {
            return maxSameNation === required;
          }
          return maxSameNation >= required;
        }

        if (key === "CLUB_COUNT") {
          if (!required) {
            return true;
          }
          return compareByScope(teamCounts.size, required, scope);
        }

        if (key === "LEAGUE_COUNT") {
          if (!required) {
            return true;
          }
          return compareByScope(leagueCounts.size, required, scope);
        }

        if (key === "NATION_COUNT") {
          if (!required) {
            return true;
          }
          return compareByScope(nationCounts.size, required, scope);
        }

        // All other constraints: count how many squad players satisfy them.
        if (!required) {
          return true;
        }
        const satisfying = eligiblePlayers.filter((p) => itemSatisfiesConstraint(p, c)).length;
        return compareByScope(satisfying, required, scope);
      });
    };

    // Build chemistry calculator – same setup as in solveSBC.
    let chemCalc = null;
    try {
      chemCalc = new UTSquadChemCalculatorUtils();
      chemCalc.chemService    = services.Chemistry;
      chemCalc.teamConfigRepo = repositories.TeamConfig;
    } catch (e) {
      console.warn("[QuickSolution swap] Could not create UTSquadChemCalculatorUtils:", e);
    }

    // Formation proxy wraps sbcData.formation so chemCalc.calculate() can call
    // formation.getPosition(idx) – same interface as the squad entity uses.
    const formationProxy = {
      getPosition: (idx) => {
        const typeId = sbcData.formation?.[idx];
        return (typeId != null && typeId !== -1) ? { typeId } : null;
      },
    };

    // Empty manager (SBC squads have none; canContribute = false → skipped by EA).
    let emptyManager = null;
    try { emptyManager = factories.Item.createItem(); } catch { emptyManager = null; }

    // Sort cheapest first; among equal price prefer higher-rated (more chem potential).
    const clubPoolSorted = clubPlayersPool
      .map((item, idx) => ({ item, idx }))
      .sort((a, b) => {
        const priceDiff = getItemPrice(a.item) - getItemPrice(b.item);
        if (priceDiff !== 0) return priceDiff;
        return getItemRating(b.item) - getItemRating(a.item); // higher rated first on tie
      });

    const RATING_TOLERANCE = 2;
    const PRICE_FACTOR_MAX = 2.0;

    // Process concept slots one at a time so each accepted swap immediately
    // updates solutionSquad – subsequent slots see the real live squad state.
    for (let rowIdx = 0; rowIdx < selectionRows.length; rowIdx++) {
      const row = selectionRows[rowIdx];
      if (row.source !== "concept_search" || !row.player) continue;

      const concept      = row.player;
      const squadSlotIdx = rowToSquadSlot[rowIdx];
      if (squadSlotIdx == null) continue;

      const conceptRating = getItemRating(concept);
      const conceptPrice  = getItemPrice(concept);

      // ── Gate 1: verify the current squad (with concept) still meets all
      //    constraints; if not, something is already broken – skip this slot.
      if (!squadMeetsAllConstraints(solutionSquad)) {
        console.warn(`[QuickSolution swap] squad already fails constraints before slot ${squadSlotIdx} swap`);
      }

      // ── Baseline chem for this slot (concept in place).
      let baselineSlotChem = 0;
      if (chemCalc) {
        try {
          const vo = chemCalc.calculate(formationProxy, solutionSquad, emptyManager);
          baselineSlotChem = vo.getSlotChemistry(squadSlotIdx)?.points ?? 0;
        } catch { /* keep 0 – conservative: any candidate with chem ≥ 0 accepted */ }
      }

      // ── Find cheapest club player that passes all four gates.
      for (const { item, idx } of clubPoolSorted) {
        if (usedClubPoolIndexes.has(idx)) continue;

        // Gate 0 – SBC settings filters (exclude lists, rarity, price cap, etc.)
        if (!candidatePassesSettings(item)) continue;

        // Gate 1 – rating tolerance.
        if (Math.abs(getItemRating(item) - conceptRating) > RATING_TOLERANCE) continue;

        // Gate 2 – price guard (don't introduce an expensive upgrade).
        if (conceptPrice > 0 && getItemPrice(item) > conceptPrice * PRICE_FACTOR_MAX) continue;

        // Gate 3 – full squad constraints: place candidate in squad and check
        //   every SBC constraint is still satisfied by enough squad players.
        const squadWithCandidate = solutionSquad.map((p, si) =>
          si === squadSlotIdx ? item : p,
        );
        if (!squadMeetsAllConstraints(squadWithCandidate)) continue;

        // Gate 4 – chemistry (EA's own logic): slot chem must not decrease.
        let candidateSlotChem = baselineSlotChem; // default: assume equal if calc unavailable
        if (chemCalc) {
          try {
            const vo = chemCalc.calculate(formationProxy, squadWithCandidate, emptyManager);
            candidateSlotChem = vo.getSlotChemistry(squadSlotIdx)?.points ?? 0;
          } catch { /* keep equal → accept */ }
        }
        if (candidateSlotChem < baselineSlotChem) continue;

        // ── All gates passed – accept this candidate.
        usedClubPoolIndexes.add(idx);
        solutionSquad[squadSlotIdx] = item;
        selectionRows[rowIdx] = { ...row, player: item, source: "club_swap" };

        console.log(
          `[QuickSolution swap] slot ${squadSlotIdx}: concept → club`,
          `price=${conceptPrice}→${getItemPrice(item)}`,
          `chem=${baselineSlotChem}→${candidateSlotChem}`,
          `rating=${conceptRating}→${getItemRating(item)}`,
          `league=${getItemLeague(concept)}→${getItemLeague(item)}`,
          `nation=${getItemNation(concept)}→${getItemNation(item)}`,
        );
        break;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const allSbcData = await sbcSets();
    const sbcSet = allSbcData?.sets?.find((set) => set.id == challenge.setId);
    if (!sbcSet) {
      showNotification("Could not locate SBC set", UINotificationType.NEGATIVE);
      return;
    }

    let newSbcSquad = new UTSBCSquadOverviewViewController();
    newSbcSquad.initWithSBCSet(sbcSet, challenge.id);
    let { _squad, _challenge } = newSbcSquad;

    _squad.removeAllItems();
    _squad.setPlayers(solutionSquad, true);

    await loadChallenge(_challenge);
    // When called as part of a solve run we skip the screen navigation so no
    // squad screen pops up; the caller consumes the returned players instead.
    if (!suppressNavigation && typeof reloadSbcScreen === "function") {
      await reloadSbcScreen(sbcSet, challenge.id);
    }

    const missingCount = selectionRows.filter(
      (row) => row.source === "missing",
    ).length;
    const matchedFromClub = selectionRows.filter(
      (row) => row.source === "club" || row.source === "club_swap",
    ).length;
    const matchedFromConcepts = selectionRows.filter(
      (row) => row.source === "concept_search",
    ).length;
    showNotification(
      `Applied quick solution (${matchedFromClub} club, ${matchedFromConcepts} concepts, ${missingCount} missing)`,
      missingCount === 0
        ? UINotificationType.POSITIVE
        : UINotificationType.NEUTRAL,
    );

    const appliedPlayers = solutionSquad.filter(
      (item) => item && Number(item?.definitionId) > 0,
    );
    return { appliedPlayers, solutionSquad, selectionRows };
  } catch (error) {
    console.warn("[Auto-SBC] QuickSolution apply on open failed", error);
  } finally {
    try {
      const controller = getControllerInstance();
      const challenge = controller?._challenge;
      if (challenge?.setId && challenge?.id) {
        const key = `${challenge.setId}:${challenge.id}`;
        window.__autoSbcQuickSolutionApplyState?.running?.delete?.(key);
      }
    } catch {}
  }
}

window.autoSbcConsoleApi = {
  ...(window.autoSbcConsoleApi || {}),
  hasPlayersInCurrentSquad,
  autoApplyQuickSolutionOnPageOpen,
};
