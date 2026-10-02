// Collection Book — EA nav screen (tab + controller + view + lazy grid).
//
// Mirrors the SBC Solver pattern (features/settings/sbc-settings-view.js): a
// left-side tab that opens a full EA screen (UTHomeHubViewController). The screen
// renders one section per fut.gg collection; each collection's player cards are
// only fetched + rendered the first time that section is scrolled into view
// (IntersectionObserver). The club is the source of truth for progress: cards for
// players currently in the club are shown in full colour, everything else is
// greyed out like a concept card, with a copy counter badge.

const COLLECTION_BOOK_TAB_TAG = 109;
const FUT_GALLERY_TAB_TAG = 110;

const generateCollectionBookTab = () => {
  const tab = new UTTabBarItemView();
  tab.init();
  tab.setTag(COLLECTION_BOOK_TAB_TAG);
  tab.setText("Collection Book");
  tab.addClass("icon-club");
  return tab;
};

const generateFutGalleryTab = () => {
  const tab = new UTTabBarItemView();
  tab.init();
  tab.setTag(FUT_GALLERY_TAB_TAG);
  tab.setText("FUT Gallery");
  tab.addClass("icon-squad");
  return tab;
};

// --- styles ---------------------------------------------------------------

const collectionBookEnsureStyles = () => {
  if (document.getElementById("collection-book-styles")) return;
  const style = document.createElement("style");
  style.id = "collection-book-styles";
  style.textContent = `
    .ut-split-view > .ut-content:has(.collection-book-container) { max-width: none; }
    .collection-book-container { padding: 16px; overflow-y: auto; height: 100%; }
    .collection-book-topbar { position:sticky; top:0; z-index:30; display:flex; align-items:center; justify-content:space-between; gap:12px; margin:-16px -16px 12px; padding:16px; background:rgba(18,22,30,.96); backdrop-filter:blur(8px); box-shadow:0 2px 8px rgba(0,0,0,.35); }
    .collection-book-topbar h1 { font-size:22px; margin:0; }
    .collection-book-topbar .cb-overall { opacity:.85; font-size:14px; }
    .collection-book-toggle { display:flex; align-items:center; gap:6px; font-size:14px; cursor:pointer; user-select:none; white-space:nowrap; }
    .collection-book-toggle input { cursor:pointer; margin:0; }
    .collection-book-status-select { cursor:pointer; padding:6px 10px; border-radius:6px; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2); color:inherit; font-size:14px; }
    .collection-book-status-select option { color:#111; }
    .collection-book-batch-select { cursor:pointer; padding:6px 10px; border-radius:6px; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2); color:inherit; font-size:14px; max-width:260px; }
    .collection-book-batch-select option, .collection-book-batch-select optgroup { color:#111; }
    .collection-book-refresh { cursor:pointer; padding:6px 12px; border-radius:6px; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2); color:inherit; }
    .collection-book-refresh:hover { background:rgba(255,255,255,.2); }
    .collection-book-section { margin-bottom:28px; }
    .collection-book-section-head { position:sticky; top:var(--cb-head-top, 78px); z-index:20; display:flex; align-items:baseline; gap:12px; margin:0 -16px 10px; padding:8px 16px 6px; background:rgba(18,22,30,.96); backdrop-filter:blur(8px); border-bottom:1px solid rgba(255,255,255,.15); }
    .collection-book-section-head .cb-name { font-size:18px; font-weight:600; }
    .collection-book-section-head .cb-count { font-size:14px; opacity:.85; }
    .collection-book-section-head .cb-bar { flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,.15); overflow:hidden; max-width:220px; }
    .collection-book-section-head .cb-bar > i { display:block; height:100%; background:#38c172; width:0%; transition:width .3s; }
    .collection-book-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:8px 6px; justify-items:center; }
    .collection-book-card { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; width:100%; }
    .collection-book-card .cb-media { width:100%; display:flex; align-items:center; justify-content:center; }
    .collection-book-card .cb-media > * { max-width:100%; margin:0 auto; }
    .collection-book-card img, .collection-book-card canvas { max-width:100%; height:auto; display:block; }
    .collection-book-card .cb-placeholder { width:80%; aspect-ratio:3/4; display:flex; align-items:center; justify-content:center; border-radius:8px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); font-size:13px; }
    .collection-book-card { cursor:pointer; }
    .collection-book-card:hover { filter:brightness(1.12); }
    .collection-book-card .cb-state { align-self:stretch; text-align:center; margin-top:3px; font-size:11px; opacity:.9; }
    .collection-book-card.cb-current .cb-state { color:#38c172; }
    .collection-book-card.cb-seen .cb-state { color:#f0ad4e; }
    .collection-book-card.cb-never .cb-state { color:#aab2bf; }
    .fut-gallery-grid { grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:12px; }
    .fut-gallery-grid .collection-book-card { min-height:210px; }
    .fut-gallery-sets { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
    .fut-gallery-set-card { padding:14px; border:1px solid rgba(255,255,255,.14); border-radius:8px; background:rgba(255,255,255,.07); }
    .fut-gallery-set-card h2 { margin:0 0 10px; font-size:17px; }
    .fut-gallery-set-meta { display:flex; justify-content:space-between; gap:8px; opacity:.85; }
    .fut-gallery-set-card p { margin:8px 0; opacity:.8; font-size:13px; }
    .fut-gallery-set-card button { width:100%; padding:8px; border:0; border-radius:5px; cursor:pointer; background:#38c172; color:#04150c; font-weight:600; }
    .fut-gallery-set-detail { position:fixed; inset:5%; z-index:1001; overflow:auto; padding:18px; background:#12161e; border:1px solid rgba(255,255,255,.2); border-radius:8px; }
    .fut-gallery-set-detail h2 { margin:0 0 12px; }
    .fut-gallery-close { float:right; padding:6px 10px; cursor:pointer; }
    .fut-gallery-set-players { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
    .collection-book-container.cb-status-current .collection-book-card:not(.cb-current), .collection-book-container.cb-status-seen .collection-book-card:not(.cb-seen), .collection-book-container.cb-status-never .collection-book-card:not(.cb-never) { display:none; }
    /* Recolour EA's native loan counter when reused as the copy counter:
       green when the player is in the club, red when only seen before. */
    .collection-book-card .ut-item-player-state-indicator-view.loan { background:#38c172; color:#04150c; }
    .collection-book-card .ut-item-player-state-indicator-view.loan.cb-counter-seen { background:#e3342f; color:#fff; }
    .collection-book-empty { opacity:.7; padding:24px; text-align:center; }
    .collection-book-loading { opacity:.7; padding:16px; }
    /* "Only in club" filter: hide cards for players not currently in the club. */
    .collection-book-container.cb-only-club .collection-book-card:not(.cb-in-club) { display:none; }
  `;
  document.head.appendChild(style);
};

// --- card rendering -------------------------------------------------------

// Shared lazy-mount observer: EA item views are expensive to build, so we only
// create them when a card scrolls near the viewport. Cards start as a light
// placeholder shell and upgrade to a real EA card on demand.
let _collectionBookCardObserver = null;
const collectionBookGetCardObserver = () => {
  if (_collectionBookCardObserver || typeof IntersectionObserver !== "function")
    return _collectionBookCardObserver;
  _collectionBookCardObserver = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const card = entry.target;
        obs.unobserve(card);
        collectionBookMountEaCard(card);
      }
    },
    { root: null, rootMargin: "300px 0px", threshold: 0 },
  );
  return _collectionBookCardObserver;
};

// Replace a card's placeholder with the live EA item view. Reads the player/owned
// state stashed on the element by collectionBookRenderCard.
const collectionBookMountEaCard = (card) => {
  if (!card || card.dataset.cbMounted === "1") return;
  const player = card.__cbPlayer;
  if (!player) return;
  const owned = card.classList.contains("cb-owned");
  const built = collectionBookCreateEaCardElement(
    player,
    owned,
    card.__cbCopies,
    card.__cbInClub,
  );
  const media = card.querySelector(".cb-media");
  if (built?.el && media) {
    media.replaceChildren(built.el);
    card.__cbView = built.view || null;
    card.dataset.cbMounted = "1";
  }
};

// Show a duplicate copy count using EA's *native* loan counter — the bottom-left
// status indicator EA uses for "loan matches remaining" (UTItemPlayerStateIndicatorView
// .setLoan). Reusing it means duplicates get the game's own counter styling rather
// than a bespoke badge. The indicator is reset by the view's own render(), so we
// (re)apply it afterwards. Green when the player is in the club (only for >1
// copies), red (cb-counter-seen) whenever the player is seen-before but no longer
// in the club — shown even for a single copy so departures are always flagged.
const collectionBookApplyCopyCounter = (view, copies, inClub) => {
  const indicator = view?._bottomLeftStatusIndicator;
  if (!indicator) return;
  try {
    const n = Number(copies) || 0;
    const seenNotInClub = !inClub && n > 0;
    if (n > 1 || seenNotInClub) {
      indicator.setLoan(n);
      const el = indicator.getRootElement?.() || indicator.__root;
      if (el) el.classList.toggle("cb-counter-seen", !inClub);
    } else {
      indicator.reset?.();
      const el = indicator.getRootElement?.() || indicator.__root;
      if (el) el.classList.remove("cb-counter-seen");
    }
  } catch {}
};

// Build one card element. The club is the source of truth: owned cards are full
// colour, unowned are greyed (EA renders concept cards grey natively). The EA
// item view is created lazily when the card nears the viewport.
const collectionBookRenderCard = (row) => {
  const { player, owned, copies, inClub } = row;
  const card = document.createElement("div");
  card.classList.add("collection-book-card");
  card.classList.add(owned ? "cb-owned" : "cb-unowned");
  card.classList.toggle("cb-in-club", !!inClub);
  card.classList.add(inClub ? "cb-current" : copies > 0 ? "cb-seen" : "cb-never");
  card.dataset.eaId = String(player.eaId);
  card.__cbPlayer = player;
  // Stashed so the lazy mount can drive EA's native loan counter (see
  // collectionBookApplyCopyCounter) for duplicate copies, coloured by club state.
  card.__cbCopies = copies;
  card.__cbInClub = inClub;
  card.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    collectionBookOpenNativeSidebar(row);
  }, true);

  // Media area starts as a lightweight placeholder; upgraded to an EA card on
  // scroll via the IntersectionObserver.
  const media = document.createElement("div");
  media.classList.add("cb-media");
  const ph = document.createElement("div");
  ph.classList.add("cb-placeholder");
  ph.textContent = `${player.overall ?? ""} ${player.position ?? ""}`.trim();
  media.appendChild(ph);
  card.appendChild(media);
  const state = document.createElement("div");
  state.className = "cb-state";
  state.textContent = inClub ? "Current" : copies > 0 ? "Seen before" : "Not seen";
  card.appendChild(state);

  const obs = collectionBookGetCardObserver();
  if (obs) obs.observe(card);
  else collectionBookMountEaCard(card); // no IO support: mount immediately

  return card;
};

const collectionBookItemsController = function () {
  const Base =
    typeof isPhone === "function" && isPhone()
      ? UTUnassignedItemsViewController
      : UTUnassignedItemsSplitViewController;
  Base.call(this);
};

const collectionBookItemsBase =
  typeof isPhone === "function" && isPhone()
    ? UTUnassignedItemsViewController
    : UTUnassignedItemsSplitViewController;
JSUtils.inherits(collectionBookItemsController, collectionBookItemsBase);

const collectionBookOpenNativeSidebar = (row) => {
  const entity = collectionBookGetItemEntity(row?.player?.eaId);
  if (!entity) return;
  const root = document.getElementById("CollectionBookPanel");
  if (!root?.__galleryController) return;
  try {
    futGalleryEnsureStyles();
    futGalleryOpenPlayerDetails(root, { entity });
  } catch (error) {
    console.warn("[CollectionBook] could not open native item controller", error);
    root.__galleryCloseDetails?.();
  }
};

const collectionBookEnsureNativePlayerName = (entity, player, conceptEntity) => {
  const current = entity?.getStaticData?.() || entity?._staticData;
  const hasName = current?.hasNameData?.() ?? !!(current?.firstName || current?.lastName || current?.name);
  if (hasName && current?.name && current.name !== "---") return;
  if (typeof UTStaticPlayerItemDataDTO !== "function") return;

  const source = conceptEntity?.getStaticData?.() || {};
  const usable = value => value && value !== "---" ? value : "";
  const firstName = usable(current?.firstName) || usable(source.firstName) || usable(player.firstName);
  const lastName = usable(current?.lastName) || usable(source.lastName) || usable(player.lastName);
  const knownAs = usable(current?.knownAs) || usable(source.knownAs) || usable(player.nickname) || usable(player.name);
  if (!firstName && !lastName && !knownAs) return;

  const staticData = new UTStaticPlayerItemDataDTO();
  staticData.generateNameData(firstName, lastName, knownAs);
  entity.setStaticData?.(staticData);
};

// Build a live EA item view (UTItemViewFactory) from the collection metadata,
// the same way the club/squad views create cards. Greyed via the concept flag
// when the player is not owned in the club.
const collectionBookCreateEaCardElement = (player, owned, copies, inClub) => {
  const Factory = globalThis.UTItemViewFactory;
  if (!Factory || typeof createUtItemEntity !== "function") return null;

  const defId = Number(player.eaId);
  const conceptEntity = collectionBookGetConceptIndex().get(defId);

  // Prefer a REAL EA item entity (owned club copy, else concept-pool item) so
  // the card renders the game's own rating + face stats. The fut.gg metadata
  // often has overall == null, which is what produced the 0-rating / 0-stat
  // cards; only fall back to the synthetic payload when no entity exists.
  let entity = owned && typeof window.collectionBookGetItemEntity === "function"
    ? window.collectionBookGetItemEntity(defId)
    : null;

  if (entity) {
    // Reuse the real entity, but reflect this collection slot's ownership:
    // greyed concept card when unowned, full-colour when owned.
    try {
      const sourceEntity = entity;
      entity = new UTItemEntity(sourceEntity);
      entity.setStaticData?.(sourceEntity.getStaticData?.() || conceptEntity?.getStaticData?.());
      entity.authenticity = sourceEntity.authenticity || conceptEntity?.authenticity;
      entity.cosmetics = sourceEntity.cosmetics || conceptEntity?.cosmetics;
      entity._hyperCosmeticDTOs = sourceEntity._hyperCosmeticDTOs || conceptEntity?._hyperCosmeticDTOs || {};
      entity.holographicType = sourceEntity.holographicType || conceptEntity?.holographicType || null;
      entity.concept = false;
      if (entity.definitionId == null) entity.definitionId = defId;
    } catch {}
  } else {
    // Real EA face stats from the concept pool, so cards don't render 0s.
    const attributeArray =
      conceptEntity && typeof conceptEntity.getAttributes === "function"
        ? conceptEntity.getAttributes()
        : typeof window.collectionBookGetFaceStats === "function"
        ? window.collectionBookGetFaceStats(defId)
        : [];
    const payload = {
      id: Number(conceptEntity?.id || 0),
      resourceId: defId,
      definitionId: defId,
      itemType: globalThis.ItemType?.PLAYER || 1,
      assetId: Number(conceptEntity?.databaseId || conceptEntity?._metaData?.id || defId),
      rating: Number(conceptEntity?.rating || player.overall || 0),
      rareflag: Number(conceptEntity?.rareflag || player.rarityEaId || 0),
      owners: Number(conceptEntity?.owners || 0),
      nation: Number(conceptEntity?.nationId || player.nationEaId || 0),
      leagueId: Number(conceptEntity?.leagueId || player.leagueEaId || 0),
      teamId: Number(conceptEntity?.teamId || player.clubEaId || 0),
      preferredPosition: conceptEntity?.getStaticData?.()?.preferredPosition != null
        ? PlayerPosition?.[conceptEntity.getStaticData().preferredPosition] || conceptEntity.getStaticData().preferredPosition
        : PlayerPosition?.[normalizeEaPosition(player.position)] || player.position,
      attributeArray,
      statsArray: Array.isArray(conceptEntity?.getStats?.())
        ? conceptEntity.getStats().map((value) => Number(value))
        : [],
      baseTraits: [],
      plusRoles: [],
      groups: [],
      possiblePositions: (conceptEntity?.getBasePossiblePositions?.() || [normalizeEaPosition(player.position)])
        .map(position => PlayerPosition?.[position] || position),
      loans: -1,
      limitedUseType: globalThis.LimitedUseType?.NONE ?? 0,
      firstName: conceptEntity?.getStaticData?.()?.firstName || player.firstName || "",
      lastName: conceptEntity?.getStaticData?.()?.lastName || player.lastName || player.name || "",
      knownAs: conceptEntity?.getStaticData?.()?.knownAs || player.nickname || "",
      authenticity: !!conceptEntity?.authenticity,
      holographicType: conceptEntity?.holographicType || null,
      hyperCosmeticDTOs: conceptEntity?._hyperCosmeticDTOs || {},
      _hyperCosmeticDTOs: conceptEntity?._hyperCosmeticDTOs || {},
      concept: !owned,
    };

    entity = createUtItemEntity(payload);
    if (!entity) return null;
    entity.concept = true;
    entity.definitionId = defId;
    if (conceptEntity) {
      entity.setStaticData?.(conceptEntity.getStaticData?.());
      entity.authenticity = conceptEntity.authenticity;
      entity.cosmetics = conceptEntity.cosmetics;
      entity._hyperCosmeticDTOs = conceptEntity._hyperCosmeticDTOs || {};
      entity.holographicType = conceptEntity.holographicType || null;
    }
  }
  collectionBookEnsureNativePlayerName(entity, player, conceptEntity);

  const view =
    typeof Factory.createLargeItem === "function"
      ? Factory.createLargeItem(entity)
      : null;
  if (!view) return null;
  try {
    view.init?.();
    view.render?.(entity);
  } catch {
    return null;
  }
  collectionBookApplyCopyCounter(view, copies, inClub);
  const el = view.getRootElement?.() || null;
  return el ? { el, view } : null;
};

// --- view state -----------------------------------------------------------

// Registry of rendered sections so club updates can restyle without re-fetching.
const _collectionBookSections = new Map(); // slug -> { players, gridEl, headEl }

const collectionBookRenderSectionGrid = (slug, players) => {
  const section = _collectionBookSections.get(slug);
  if (!section) return;
  const { rows, owned, total } = collectionBookComputeProgress(players);
  section.players = players;

  const grid = section.gridEl;
  grid.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.classList.add("collection-book-empty");
    empty.textContent = "No players found for this collection.";
    grid.appendChild(empty);
  } else {
    const frag = document.createDocumentFragment();
    for (const row of rows) frag.appendChild(collectionBookRenderCard(row));
    grid.appendChild(frag);
  }
  collectionBookUpdateSectionHead(slug, owned, total);

  // Some players have no EA price (0). Fetch those from fut.gg in the
  // background, then re-render this section so the resolved prices show and the
  // cards re-sort by value.
  if (typeof collectionBookFetchMissingPrices === "function") {
    collectionBookFetchMissingPrices(players).then((queued) => {
      if (!queued) return;
      const current = _collectionBookSections.get(slug);
      if (current && current.players === players) {
        collectionBookRenderSectionGrid(slug, players);
      }
    });
  }
};

const collectionBookUpdateSectionHead = (slug, owned, total) => {
  const section = _collectionBookSections.get(slug);
  if (!section?.headEl) return;
  const countEl = section.headEl.querySelector(".cb-count");
  const barEl = section.headEl.querySelector(".cb-bar > i");
  if (countEl) countEl.textContent = `${owned} / ${total}`;
  if (barEl) barEl.style.width = total ? `${(owned / total) * 100}%` : "0%";
};

// Pull the club so ownership reflects the player's *current* collection rather
// than a stale (or empty) `__clubPlayersEntries` snapshot. Ownership is derived
// solely from club entries, and nothing else forces a club read when the book is
// opened, so a freshly-earned player (or a first-of-session visit) would show as
// unowned until some other feature happened to fetch the club. fetchPlayers()
// repopulates `__clubPlayersEntries` via setClubPlayersFromItems(), which in turn
// calls collectionBookUpdateFromClub() to restyle any already-rendered cards.
// Fire-and-forget: the fut.gg grid still builds immediately and owned cards flip
// in when the club resolves.
let _collectionBookClubLoadInFlight = null;
const collectionBookEnsureClubLoaded = () => {
  if (_collectionBookClubLoadInFlight) return _collectionBookClubLoadInFlight;
  if (typeof fetchPlayers !== "function") return null;
  _collectionBookClubLoadInFlight = Promise.resolve()
    .then(() => fetchPlayers({ showProgress: false }))
    .catch((err) => {
      console.warn("[CollectionBook] club load failed", err);
    })
    .finally(() => {
      _collectionBookClubLoadInFlight = null;
    });
  return _collectionBookClubLoadInFlight;
};

// Re-apply club-derived ownership to already rendered sections (no re-fetch).
window.__collectionBookOnClubUpdate = (ownedCounts) => {
  let grandOwned = 0;
  let grandTotal = 0;
  for (const [slug, section] of _collectionBookSections.entries()) {
    if (!section.players) continue;
    const { rows, owned, total } = collectionBookComputeProgress(
      section.players,
      ownedCounts,
    );
    grandOwned += owned;
    grandTotal += total;
    // Re-render cards whose ownership changed (concept flag is baked into the
    // EA item view, so a class toggle isn't enough — rebuild the card).
    for (const row of rows) {
      const el = section.gridEl.querySelector(
        `.collection-book-card[data-ea-id="${row.player.eaId}"]`,
      );
      if (!el) continue;
      const wasOwned = el.classList.contains("cb-owned");
      if (wasOwned !== row.owned) {
        if (_collectionBookCardObserver) _collectionBookCardObserver.unobserve(el);
        const fresh = collectionBookRenderCard(row);
        el.replaceWith(fresh);
      } else {
        // Ownership unchanged: just refresh the duplicate count on the already
        // mounted EA card (or stash it for when the card lazily mounts).
        el.__cbCopies = row.copies;
        el.__cbInClub = row.inClub;
        el.classList.toggle("cb-in-club", !!row.inClub);
        if (el.__cbView)
          collectionBookApplyCopyCounter(el.__cbView, row.copies, row.inClub);
      }
    }
    collectionBookUpdateSectionHead(slug, owned, total);
  }
  const overall = document.querySelector(".collection-book-topbar .cb-overall");
  if (overall && grandTotal) {
    overall.textContent = `${grandOwned} / ${grandTotal} collected`;
  }
};

// --- build the page -------------------------------------------------------

// localStorage key for the last-selected batch, so the choice sticks across the
// page rebuild that happens on every visit.
const COLLECTION_BOOK_SELECTED_KEY = "collectionBook.selectedBatch.v1";
const COLLECTION_BOOK_ALL_COLLECTIONS = "__collections__";
const COLLECTION_BOOK_ONLY_CLUB_KEY = "collectionBook.onlyInClub.v1";

// Build one section shell (head + empty grid) and register it. Shared by fut.gg
// collections (lazy-loaded) and rarity batches (players bundled up front).
const collectionBookCreateSection = (batch) => {
  const section = document.createElement("div");
  section.classList.add("collection-book-section");
  section.dataset.slug = batch.slug;

  const head = document.createElement("div");
  head.classList.add("collection-book-section-head");
  head.innerHTML = `
    <span class="cb-name"></span>
    <span class="cb-count">0 / ${batch.total}</span>
    <span class="cb-bar"><i></i></span>`;
  head.querySelector(".cb-name").textContent = batch.name;

  const grid = document.createElement("div");
  grid.classList.add("collection-book-grid");
  const placeholder = document.createElement("div");
  placeholder.classList.add("collection-book-loading");
  placeholder.textContent = "Loading…";
  grid.appendChild(placeholder);

  section.appendChild(head);
  section.appendChild(grid);

  _collectionBookSections.set(batch.slug, {
    players: null,
    gridEl: grid,
    headEl: head,
    total: batch.total,
    isRarityBatch: !!batch.isRarityBatch,
  });
  return section;
};

// Show only the selected batch. "All Collections" shows every fut.gg collection
// (but hides the rarity batches, which would otherwise duplicate the players);
// any other value shows just that one section.
const collectionBookApplySelectedBatch = (root, value) => {
  root.querySelectorAll(".collection-book-section").forEach((sec) => {
    const slug = sec.dataset.slug || "";
    const isSynthetic = slug.startsWith("rarity:") || slug.startsWith("rating:");
    const show =
      value === COLLECTION_BOOK_ALL_COLLECTIONS ? !isSynthetic : slug === value;
    sec.style.display = show ? "" : "none";
  });
  // Lazily load a collection section the first time it is selected.
  if (
    value !== COLLECTION_BOOK_ALL_COLLECTIONS &&
    !value.startsWith("rarity:") && !value.startsWith("rating:")
  ) {
    const section = _collectionBookSections.get(value);
    if (section && !section.players) collectionBookLoadSection(value);
  }
  try {
    localStorage.setItem(COLLECTION_BOOK_SELECTED_KEY, value);
  } catch {}
};

const collectionBookBuildPage = async (root, { force = false } = {}) => {
  const build = {};
  root.__collectionBookBuild = build;
  collectionBookEnsureStyles();
  _collectionBookSections.clear();
  root.innerHTML = "";

  // Hydrate persisted ownership counts (club + unassigned, deduped by entity id)
  // so cards render with the correct owned state on first paint.
  if (typeof collectionBookFetchOwnership === "function") {
    await collectionBookFetchOwnership();
  }
  if (root.__collectionBookBuild !== build) return;

  const topbar = document.createElement("div");
  topbar.classList.add("collection-book-topbar");
  const heading = document.createElement("div");
  heading.innerHTML =
    '<h1>Collection Book</h1><div class="cb-overall">Loading…</div>';
  const select = document.createElement("select");
  select.classList.add("collection-book-batch-select");

  // "Only in club" filter: hide cards for players not currently in the club.
  const onlyClubLabel = document.createElement("label");
  onlyClubLabel.classList.add("collection-book-toggle");
  const onlyClubCb = document.createElement("input");
  onlyClubCb.type = "checkbox";
  let onlyClub = false;
  try {
    onlyClub = localStorage.getItem(COLLECTION_BOOK_ONLY_CLUB_KEY) === "1";
  } catch {}
  onlyClubCb.checked = onlyClub;
  root.classList.toggle("cb-only-club", onlyClub);
  onlyClubLabel.appendChild(onlyClubCb);
  onlyClubLabel.appendChild(document.createTextNode("Only in club"));
  onlyClubCb.addEventListener("change", () => {
    root.classList.toggle("cb-only-club", onlyClubCb.checked);
    try {
      localStorage.setItem(
        COLLECTION_BOOK_ONLY_CLUB_KEY,
        onlyClubCb.checked ? "1" : "0",
      );
    } catch {}
  });

  const statusSelect = document.createElement("select");
  statusSelect.className = "collection-book-status-select";
  statusSelect.innerHTML = '<option value="all">All players</option><option value="current">Current in club</option><option value="seen">Seen before</option><option value="never">Not seen</option>';
  statusSelect.addEventListener("change", () => {
    root.classList.remove("cb-status-current", "cb-status-seen", "cb-status-never");
    if (statusSelect.value !== "all") root.classList.add(`cb-status-${statusSelect.value}`);
  });

  const refresh = document.createElement("button");
  refresh.classList.add("collection-book-refresh");
  refresh.textContent = "Refresh";
  refresh.addEventListener("click", () => {
    // Explicit refresh: dirty EA's club cache and re-pull so players earned
    // since the last fetch are picked up, then rebuild the fut.gg grid.
    _collectionBookClubLoadInFlight = null;
    if (typeof refreshClubPlayers === "function") {
      refreshClubPlayers({ showProgress: false }).catch((err) => {
        console.warn("[CollectionBook] club refresh failed", err);
      });
    } else {
      collectionBookEnsureClubLoaded();
    }
    collectionBookBuildPage(root, { force: true });
  });
  topbar.appendChild(heading);
  topbar.appendChild(select);
  topbar.appendChild(onlyClubLabel);
  topbar.appendChild(statusSelect);
  topbar.appendChild(refresh);
  root.appendChild(topbar);

  const loading = document.createElement("div");
  loading.classList.add("collection-book-loading");
  loading.textContent = "Fetching collections…";
  root.appendChild(loading);

  let collections = [];
  try {
    collections = await collectionBookFetchList({ force });
  } catch {
    if (root.__collectionBookBuild !== build) return;
    loading.textContent =
      "Failed to load collections from fut.gg. Try Refresh.";
    return;
  }
  if (root.__collectionBookBuild !== build) return;
  loading.remove();

  if (!collections.length) {
    const empty = document.createElement("div");
    empty.classList.add("collection-book-empty");
    empty.textContent = "No collections available.";
    root.appendChild(empty);
    return;
  }

  // Rarity batches: every collected player grouped by rarity type. Their player
  // lists are bundled (from the prefetched cache), so they render immediately.
  const rarityBatches =
    typeof collectionBookBuildRarityBatches === "function"
      ? collectionBookBuildRarityBatches()
      : [];
  const ratingBatches =
    typeof collectionBookBuildRatingBatches === "function"
      ? collectionBookBuildRatingBatches()
      : [];

  // Populate the batch dropdown: All Collections + each collection + each rarity.
  select.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = COLLECTION_BOOK_ALL_COLLECTIONS;
  optAll.textContent = "All Collections";
  select.appendChild(optAll);

  const colGroup = document.createElement("optgroup");
  colGroup.label = "Collections";
  for (const col of collections) {
    const o = document.createElement("option");
    o.value = col.slug;
    o.textContent = col.name;
    colGroup.appendChild(o);
  }
  select.appendChild(colGroup);

  if (rarityBatches.length) {
    const rarGroup = document.createElement("optgroup");
    rarGroup.label = "Rarity";
    for (const b of rarityBatches) {
      const o = document.createElement("option");
      o.value = b.slug;
      o.textContent = `${b.name} (${b.total})`;
      rarGroup.appendChild(o);
    }
    select.appendChild(rarGroup);
  }

  if (ratingBatches.length) {
    const ratingGroup = document.createElement("optgroup");
    ratingGroup.label = "Rating";
    for (const batch of ratingBatches) {
      const option = document.createElement("option");
      option.value = batch.slug;
      option.textContent = `${batch.name} (${batch.total})`;
      ratingGroup.appendChild(option);
    }
    select.appendChild(ratingGroup);
  }

  select.addEventListener("change", () => {
    collectionBookApplySelectedBatch(root, select.value);
  });

  // Create a section per collection (loaded lazily below).
  for (const col of collections) {
    root.appendChild(collectionBookCreateSection(col));
  }
  // Create + immediately render a section per rarity batch (players bundled).
  for (const b of rarityBatches) {
    root.appendChild(collectionBookCreateSection(b));
    collectionBookRenderSectionGrid(b.slug, b.players);
  }
  for (const batch of ratingBatches) {
    root.appendChild(collectionBookCreateSection(batch));
    collectionBookRenderSectionGrid(batch.slug, batch.players);
  }

  // Kick off the background prefetch for any collections not yet cached, then
  // render every collection section (cached ones resolve immediately; the rest
  // fill in as the prefetch fetches them).
  collectionBookPrefetchAll();
  for (const col of collections) collectionBookLoadSection(col.slug, force);

  // Restore the last-selected batch (default: All Collections).
  let selected = COLLECTION_BOOK_ALL_COLLECTIONS;
  try {
    const stored = localStorage.getItem(COLLECTION_BOOK_SELECTED_KEY);
    if (stored && select.querySelector(`option[value="${CSS.escape(stored)}"]`)) {
      selected = stored;
    }
  } catch {}
  select.value = selected;
  collectionBookApplySelectedBatch(root, selected);

  // Offset the sticky section heads so they park just below the sticky topbar.
  requestAnimationFrame(() => {
    try {
      const h = topbar.getBoundingClientRect().height;
      if (h) root.style.setProperty("--cb-head-top", `${Math.round(h)}px`);
    } catch {}
  });

  // Prime the overall counter from whatever club data already exists.
  collectionBookUpdateFromClub();
};

window.addEventListener("autosbc:concepts-ready", () => {
  const root = document.getElementById("CollectionBookPanel");
  if (!root || !root.dataset.cbBuilt) return;
  collectionBookBuildPage(root, { force: false }).catch((err) => {
    console.warn("[CollectionBook] concept rating refresh failed", err);
  });
});

// When the background prefetch finishes a collection, render it into the open
// page if that section hasn't been populated yet.
window.__collectionBookOnSectionFetched = (slug) => {
  const section = _collectionBookSections.get(slug);
  if (section && !section.players) collectionBookLoadSection(slug);
};

const collectionBookLoadSection = async (slug, force = false) => {
  const section = _collectionBookSections.get(slug);
  if (!section || section.players) return;
  try {
    const players = await collectionBookFetchPlayers(slug, { force });
    // Guard against a concurrent load having populated it already.
    if (_collectionBookSections.get(slug)?.players) return;
    collectionBookRenderSectionGrid(slug, players);
  } catch {
    section.gridEl.innerHTML =
      '<div class="collection-book-empty">Failed to load players. Refresh to retry.</div>';
  }
};

// --- EA controller / view -------------------------------------------------

const collectionBookController = function () {
  UTSplitViewController.call(this);
};
JSUtils.inherits(collectionBookController, UTSplitViewController);

const collectionBookMountNativeContent = (owner) => {
  if (!owner.collectionContentController) {
    const content = new EAViewController();
    content._getViewInstanceFromData = () => owner.createCollectionContentView();
    content.init();
    owner.addChildViewController(content);
    owner.collectionContentController = content;
  }
  owner.collectionContentController.getView().addClass(enums.UILayout.LEFT);
  owner.setLeftController(owner.collectionContentController);
  owner.hideRightPanel(!owner.rightController);
  return owner.collectionContentController.getView().getRootElement();
};

collectionBookController.prototype.createCollectionContentView = function () {
  return new collectionBookView();
};
collectionBookController.prototype.viewDidAppear = function () {
  UTSplitViewController.prototype.viewDidAppear.call(this);
  this.getNavigationController().setNavigationVisibility(true, true);
  // Ownership comes only from the club, so pull it on every visit — otherwise a
  // first-of-session open (or a club changed since the last fetch) shows owned
  // players as unowned. The fetch repopulates __clubPlayersEntries and triggers
  // collectionBookUpdateFromClub() when it resolves, flipping owned cards in.
  collectionBookEnsureClubLoaded();
  // Build (or rebuild) on every visit so club-based progress stays current.
  const root = collectionBookMountNativeContent(this);
  if (root) root.__galleryController = this;
  if (root && !root.dataset.cbBuilt) {
    root.dataset.cbBuilt = "1";
    collectionBookBuildPage(root);
  } else {
    // Already built: just refresh counters from the club.
    collectionBookUpdateFromClub();
  }
};
collectionBookController.prototype.viewWillDisappear = function () {
  UTSplitViewController.prototype.viewWillDisappear.call(this);
  this.getNavigationController().setNavigationVisibility(false, false);
};
collectionBookController.prototype.getNavigationTitle = function () {
  return "Collection Book";
};

const collectionBookView = function () {
  EAView.call(this);
};
JSUtils.inherits(collectionBookView, EAView);

collectionBookView.prototype.destroyGeneratedElements =
  function destroyGeneratedElements() {
    this.__root?.__galleryCloseDetails?.();
    DOMKit.remove(this.__root);
    this.__root = null;
  };

collectionBookView.prototype._generate = function _generate() {
  const wrap = document.createElement("div");
  wrap.classList.add("collection-book-container");
  wrap.setAttribute("id", "CollectionBookPanel");
  this.__root = wrap;
  this._generated = true;
};

try {
  window.generateCollectionBookTab = generateCollectionBookTab;
  window.generateFutGalleryTab = generateFutGalleryTab;
  window.collectionBookController = collectionBookController;
  window.collectionBookView = collectionBookView;
} catch {}

const futGalleryController = function () {
  UTSplitViewController.call(this);
};
JSUtils.inherits(futGalleryController, UTSplitViewController);

const futGalleryView = function () {
  EAView.call(this);
};
JSUtils.inherits(futGalleryView, EAView);

futGalleryController.prototype.createCollectionContentView = function () {
  return new futGalleryView();
};
futGalleryController.prototype.viewDidAppear = function () {
  UTSplitViewController.prototype.viewDidAppear.call(this);
  this.getNavigationController().setNavigationVisibility(true, true);
  collectionBookEnsureClubLoaded();
  ensureConceptCacheInit();
  const root = collectionBookMountNativeContent(this);
  if (root) root.__galleryController = this;
  if (root && !root.dataset.galleryBuilt) {
    root.dataset.galleryBuilt = "1";
    futGalleryBuildPage(root);
  }
};
futGalleryController.prototype.viewWillDisappear = function () {
  UTSplitViewController.prototype.viewWillDisappear.call(this);
  this.getNavigationController().setNavigationVisibility(false, false);
};
futGalleryController.prototype.getNavigationTitle = function () {
  return "FUT Gallery";
};

futGalleryView.prototype.destroyGeneratedElements = function () {
  this.__root?.__galleryDispose?.();
  DOMKit.remove(this.__root);
  this.__root = null;
};
futGalleryView.prototype._generate = function () {
  const root = document.createElement("div");
  root.className = "collection-book-container fut-gallery-container";
  root.id = "FutGalleryPanel";
  this.__root = root;
  this._generated = true;
};

const futGalleryBuildPage = (root) => {
  collectionBookEnsureStyles();
  return futGalleryMountPage(root);
};

try {
  window.futGalleryController = futGalleryController;
  window.futGalleryView = futGalleryView;
} catch {}
