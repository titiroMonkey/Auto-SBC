// Club Players cache
// Transforms raw FUT player items (from fetchPlayers) into a lightweight,
// serialisable entry format persisted to localStorage and exposed via
// window.__clubPlayersEntries. Club search is the source of truth for the
// Collection Book, so every (re)read of the club refreshes collection progress
// and records ownership.

const _saveClubPlayersEntries = (entries) => {
  try {
    localStorage.setItem("clubPlayersEntries", JSON.stringify(entries || []));
  } catch {}
};

const _entryKeyFromItem = (item) =>
  String(
    item?.id ?? `${item?.definitionId ?? "0"}:${item?._metaData?.id ?? "0"}`,
  );

const _getLookupMap = (kind) => {
  const cacheKey = `__clubPlayers_${kind}Map`;
  if (window[cacheKey] instanceof Map) return window[cacheKey];

  const map = new Map();
  try {
    const provider = factories?.DataProvider;
    const source =
      kind === "league"
        ? provider?.getLeagueDP?.()
        : kind === "nation"
          ? provider?.getNationDP?.()
          : provider?.getTeamDP?.();

    (Array.isArray(source) ? source : []).forEach((entry) => {
      const id = Number(entry?.id);
      if (!id) return;
      map.set(id, entry?.label || String(id));
    });
  } catch {}

  window[cacheKey] = map;
  return map;
};

const _getLeagueId = (item) =>
  Number(item?.leagueId ?? item?._staticData?.leagueId ?? item?.league?.id) ||
  0;
const _getNationId = (item) =>
  Number(item?.nationId ?? item?._staticData?.nationId ?? item?.nation?.id) ||
  0;
const _getTeamId = (item) =>
  Number(
    item?.teamId ??
      item?.clubId ??
      item?._staticData?.teamId ??
      item?._staticData?.clubId ??
      item?.team?.id ??
      item?.club?.id,
  ) || 0;

const _toSerializable = (value, depth = 0, seen = new WeakSet()) => {
  if (value == null) return value;
  if (depth > 3) return null;

  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  if (t === "function") return undefined;

  if (Array.isArray(value)) {
    return value
      .map((entry) => _toSerializable(entry, depth + 1, seen))
      .filter((entry) => entry !== undefined);
  }

  if (t === "object") {
    if (seen.has(value)) return null;
    seen.add(value);

    const out = {};
    Object.keys(value).forEach((key) => {
      const next = _toSerializable(value[key], depth + 1, seen);
      if (next !== undefined) out[key] = next;
    });
    return out;
  }

  return undefined;
};

// Maps raw FUT player items (from fetchPlayers) into club-players entry format
const setClubPlayersFromItems = (players) => {
  if (!Array.isArray(players)) return;

  const leagueMap = _getLookupMap("league");
  const nationMap = _getLookupMap("nation");
  const teamMap = _getLookupMap("team");

  const entries = players.map((item) => {
    const leagueId = _getLeagueId(item);
    const nationId = _getNationId(item);
    const teamId = _getTeamId(item);

    const name =
      item?._staticData?.name ||
      [item?._staticData?.firstName, item?._staticData?.lastName]
        .filter(Boolean)
        .join(" ") ||
      String(item?.definitionId ?? "Unknown");

    const cardType =
      [
        item?.isSpecial?.()
          ? ""
          : services?.Localization?.localize?.(
              "search.cardLevels.cardLevel" + item?.getTier?.(),
            ) || "",
        services?.Localization?.localize?.("item.raretype" + item?.rareflag) ||
          "",
      ]
        .join(" ")
        .trim() || "—";

    const serializedItem = _toSerializable(item);

    return {
      id: item?.id,
      assetId: item?._metaData?.id,
      definitionId: item?.definitionId,
      name,
      cardType,
      rating: Number(item?.rating) || 0,
      leagueId,
      nationId,
      teamId,
      leagueName: leagueMap.get(leagueId) || item?.league?.name || "—",
      nationName: nationMap.get(nationId) || item?.nation?.name || "—",
      teamName:
        teamMap.get(teamId) || item?.team?.name || item?.club?.name || "—",
      preferredPosition: item?.preferredPosition || "—",
      possiblePositions: Array.isArray(item?.possiblePositions)
        ? item.possiblePositions
        : [],
      sbcPrice: typeof getSBCPrice === "function" ? getSBCPrice(item) : null,
      price: typeof getPrice === "function" ? getPrice(item) : null,
      futggPrice: typeof getPrice === "function" ? getPrice(item) : null,
      maxChem: item?.profile?.maxChem ?? 0,
      isStorage: !!item?.isStorage,
      isDuplicate: !!item?.isDuplicateItem,
      isUntradeable: !(item?.isTradeable?.() ?? true),
      isFixed: typeof isItemFixed === "function" ? isItemFixed(item) : false,
      rarity:
        services?.Localization?.localize?.("item.raretype" + item?.rareflag) ||
        "—",
      tier:
        services?.Localization?.localize?.(
          "search.cardLevels.cardLevel" + item?.getTier?.(),
        ) || "—",
      owners: item?.owners,
      loans: item?.loans,
      contract: item?.contract,
      discardValue: item?.discardValue,
      teamChem: item?.profile?.rules?.[0],
      leagueChem: item?.profile?.rules?.[1],
      nationChem: item?.profile?.rules?.[2],
      itemAttributes: serializedItem,
      __rowKey: _entryKeyFromItem(item),
    };
  });

  window.__clubPlayersEntries = entries;
  _saveClubPlayersEntries(entries);

  // Signal club-player consumers that the full club snapshot is now loaded.
  window.__sbcPlayersReady = true;
  try {
    window.dispatchEvent(
      new CustomEvent("autosbc:club-players-ready", {
        detail: { count: entries.length, timestamp: Date.now() },
      }),
    );
  } catch {}

  // Club search is our source of truth for the Collection Book: whenever the
  // club is (re)read, recompute collection progress from these entries.
  if (typeof collectionBookUpdateFromClub === "function") {
    collectionBookUpdateFromClub();
  }

  // Persist ownership (definitionId + entity id) for every club item so
  // duplicates increment the Collection Book counter and ownership survives
  // pile moves / sessions. Uses the raw EA items (they carry item.id).
  if (typeof collectionBookRecordOwnership === "function") {
    collectionBookRecordOwnership(players);
  }
};
