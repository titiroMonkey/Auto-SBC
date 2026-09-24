let conceptPlayers = [];
let conceptPlayersCollected = false;
const CONCEPT_RESET_DEFAULT_HOUR = 7;
let conceptPlayersFetchPromise = null;

const exposeConceptPlayersToConsole = (players = []) => {
  try {
    window.autoSbcConceptPlayers = players;
    window.getAutoSbcConceptPlayers = () => window.autoSbcConceptPlayers || [];
    window.logAutoSbcConceptPlayers = (limit = 50) => {
      const list = window.getAutoSbcConceptPlayers();
      const count = Number.isFinite(Number(limit))
        ? Math.max(1, Number(limit))
        : 50;
      const preview = list.slice(0, count).map((item) => ({
        id: item?.id,
        definitionId: item?.definitionId,
        name: item?._staticData?.name || item?.name,
        rating: item?.rating,
        teamId: item?.teamId,
        leagueId: item?.leagueId,
        nationId: item?.nationId,
        concept: !!item?.concept,
      }));

      console.log("[concepts] exposed concept players", {
        total: list.length,
        showing: preview.length,
      });
      console.table(preview);
      return list;
    };
    window.logAllAutoSbcConceptPlayers = () => {
      const list = window.getAutoSbcConceptPlayers();
      const rows = list.map((item) => ({
        id: item?.id,
        definitionId: item?.definitionId,
        name: item?._staticData?.name || item?.name,
        rating: item?.rating,
        teamId: item?.teamId,
        leagueId: item?.leagueId,
        nationId: item?.nationId,
        concept: !!item?.concept,
      }));

      console.log("[concepts] all concept players", {
        total: rows.length,
      });
      console.table(rows);
      return list;
    };
  } catch (error) {
    console.warn("[concepts] failed to expose concept players", error);
  }
};

exposeConceptPlayersToConsole([]);

const getConceptResetHour = () => {
  const hour = Number(getSettings(0, 0, "conceptResetHour"));
  if (!Number.isFinite(hour)) return CONCEPT_RESET_DEFAULT_HOUR;
  return Math.min(23, Math.max(0, Math.floor(hour)));
};

const getCurrentConceptResetTs = (now = new Date()) => {
  const resetHour = getConceptResetHour();
  const reset = new Date(now);
  reset.setHours(resetHour, 0, 0, 0);
  if (now < reset) {
    reset.setDate(reset.getDate() - 1);
  }
  return reset.getTime();
};

const buildPlayerDetails = (item, context = {}) => {
  if (!item) return null;
  const {
    sbcId = 0,
    challengeId = 0,
    duplicateIds = [],
    storageIds = [],
    priceFn,
  } = context;

  if (!item.groups?.length) {
    item.groups = [0];
  }

  const isSpecial =
    (typeof item.isSpecial === "function" && item.isSpecial()) ||
    item?.isSpecial === true;
  const isTradeable =
    (typeof item.isTradeable === "function" && item.isTradeable()) ||
    item?.tradable === true;
  const isTimeLimited =
    typeof item.isTimeLimited === "function" && item.isTimeLimited();
  const isSbcPlayer = !!item?.isSbcPlayer;
  const isDuplicateItem = !!item?.isDuplicateItem;
  const isConceptPlayer =
    !!item?.concept ||
    Number(item?.owners) === 0 ||
    item?.__autoSbcCurrentSquadConcept === true;
  const loans = Number.isFinite(item?.loans) ? item.loans : -1;
  const rarityLabel = services.Localization.localize(
    "item.raretype" + item.rareflag,
  );
  const cardType =
    (isSpecial
      ? ""
      : services.Localization.localize(
          "search.cardLevels.cardLevel" + item.getTier(),
        ) + " ") + rarityLabel;
  const price =
    typeof priceFn === "function"
      ? priceFn(item, sbcId, challengeId)
      : getSBCPrice(item, sbcId, challengeId);

  return {
    id: item.id,
    name: item._staticData?.name || item.name,
    cardType,
    rarityLabel,
    assetId: item._metaData?.id,
    definitionId: item.definitionId,
    rating: item.rating,
    teamId: item.teamId,
    leagueId: item.leagueId,
    nationId: item.nationId,
    rarityId: item.rareflag,
    ratingTier: item.getTier?.() ?? item.ratingTier,
    isUntradeable: item.isTradeable?.(),
    isDuplicate: duplicateIds.includes(item.id),
    isStorage: storageIds.includes(item.id),
    preferredPosition: item.preferredPosition,
    possiblePositions: item.possiblePositions,
    groups: item.groups,
    isFixed: isItemFixed(item),
    concept: isConceptPlayer,
    price: price || -1,
    futggPrice: getPrice(item),
    maxChem: item.profile?.maxChem,
    teamChem: item.profile?.rules?.[0],
    leagueChem: item.profile?.rules?.[1],
    nationChem: item.profile?.rules?.[2],
    normalizeClubId: item.normalizeClubId,
    isSpecial,
    isTradeable,
    isTimeLimited,
    isSbcPlayer,
    isDuplicateItem,
    loans,
    isPlayer:
      (typeof item.isPlayer === "function" && item.isPlayer()) ||
      item?.isPlayer === true,
  };
};

const buildPlayerDetailsList = (items = [], context = {}) =>
  (items || [])
    .map((item) => buildPlayerDetails(item, context))
    .filter(Boolean);

const shouldIncludePlayerDetail = (detail, context = {}) => {
  if (!detail) return false;
  const {
    useDupes,
    ratingRange,
    excludePlayers,
    excludeLeagues,
    excludeNations,
    excludeRarity,
    excludeTeams,
    excludeSbcSquads,
    excludeSbc,
    excludeObjective,
    excludeSpecial,
    excludeTradable,
    excludeExtinct,
    onlyStorage,
    sbcData,
    PriceItems,
  } = context;

  if (useDupes && (detail.isStorage || detail.isDuplicateItem)) {
    return true;
  }

  const priceEntry = PriceItems?.[detail.definitionId] ?? {};

  return (
    detail.loans < 0 &&
    (detail.price ?? 0) < 100000 &&
    detail.rating <= ratingRange[1] &&
    detail.rating >= ratingRange[0] &&
    !excludePlayers.includes(detail.definitionId) &&
    !excludeLeagues.includes(detail.leagueId) &&
    !excludeNations.includes(detail.nationId) &&
    !excludeRarity.includes(detail.rarityLabel) &&
    (!detail.isSbcPlayer || !excludeSbcSquads) &&
    !excludeTeams.includes(detail.teamId) &&
    !detail.isTimeLimited &&
    !(priceEntry?.isSbc && excludeSbc) &&
    !(priceEntry?.isObjective && excludeObjective) &&
    !(detail.isSpecial && excludeSpecial) &&
    !(detail.isTradeable && excludeTradable) &&
    !(priceEntry?.isExtinct && excludeExtinct) &&
    (detail.isStorage || !onlyStorage) &&
    !sbcData.subs.includes(detail.definitionId)
  );
};

// Progress bar utility functions
// Global state to track active progress bars and their positions
const activeProgressBars = [];

const createProgressBar = (id, containerId, labelText = "") => {
  // Remove existing progress bar if it exists
  let existingContainer = document.getElementById(containerId);
  if (existingContainer) {
    existingContainer.parentNode.removeChild(existingContainer);
    // Remove from active bars list
    const index = activeProgressBars.findIndex(
      (item) => item.id === containerId,
    );
    if (index !== -1) {
      activeProgressBars.splice(index, 1);
    }
  }

  const progressBarContainer = document.createElement("div");
  progressBarContainer.id = containerId;
  progressBarContainer.style.position = "fixed";
  progressBarContainer.style.bottom = "10px";
  progressBarContainer.style.right = "130px";
  progressBarContainer.style.width = "300px";
  progressBarContainer.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
  progressBarContainer.style.borderRadius = "2px";
  progressBarContainer.style.zIndex = "9999";
  progressBarContainer.style.transition = "bottom 0.3s ease-in-out";

  // Create label element if label text is provided
  if (labelText) {
    const label = document.createElement("div");
    label.id = `${id}-label`;
    label.textContent = labelText;
    label.style.position = "absolute";
    label.style.top = "-20px";
    label.style.left = "0";
    label.style.width = "100%";
    label.style.color = "#ffffff";
    label.style.textAlign = "center";
    label.style.fontSize = "12px";
    progressBarContainer.appendChild(label);
  }

  // Add a container for the progress bar itself
  const progressBarWrapper = document.createElement("div");
  progressBarWrapper.style.height = "15px";
  progressBarWrapper.style.width = "100%";
  progressBarWrapper.style.position = "relative";
  progressBarWrapper.style.overflow = "hidden";
  progressBarContainer.appendChild(progressBarWrapper);

  const progressBar = document.createElement("div");
  progressBar.id = id;
  progressBar.style.height = "100%";
  progressBar.style.width = "0%";
  progressBar.style.backgroundColor = "#07f468";
  progressBar.style.borderRadius = "2px";
  progressBar.style.transition = "width 0.3s ease-in-out";

  progressBarWrapper.appendChild(progressBar);
  document.body.appendChild(progressBarContainer);

  // Calculate position based on existing progress bars
  const offset = 35; // Height of bar + margin
  const bottomPosition = 10 + activeProgressBars.length * offset;
  progressBarContainer.style.bottom = `${bottomPosition}px`;

  // Add to active progress bars list
  activeProgressBars.push({
    id: containerId,
    element: progressBarContainer,
    position: activeProgressBars.length,
  });

  return progressBarContainer;
};

const removeProgressBar = (containerId, delay = 2000) => {
  setTimeout(() => {
    const progressBarContainer = document.getElementById(containerId);
    if (progressBarContainer) {
      progressBarContainer.style.opacity = "0";
      progressBarContainer.style.transition = "opacity 0.5s ease-in-out";

      setTimeout(() => {
        if (progressBarContainer && progressBarContainer.parentNode) {
          // Remove from active bars list
          const index = activeProgressBars.findIndex(
            (item) => item.id === containerId,
          );
          if (index !== -1) {
            activeProgressBars.splice(index, 1);
          }

          progressBarContainer.parentNode.removeChild(progressBarContainer);

          // Reposition remaining progress bars
          activeProgressBars.forEach((item, idx) => {
            const bottomPosition = 10 + idx * 25;
            item.element.style.bottom = `${bottomPosition}px`;
            item.position = idx;
          });
        }
      }, 500);
    }
  }, delay);
};

const updateProgressBar = (progressBarId, progress) => {
  const progressBar = document.getElementById(progressBarId);
  if (progressBar) {
    progressBar.style.width = `${Math.min(100, progress)}%`;
  }
};

// Add a flag to track if concept players are currently being fetched
let isConceptPlayerFetchInProgress = false;

let getConceptPlayers = async function (playerCount = 999999) {
  if (playerCount > 1 && conceptPlayersCollected && conceptPlayers.length) {
    return conceptPlayers;
  }

  // If already fetching concepts, return the current conceptPlayers array
  if (isConceptPlayerFetchInProgress) {
    if (conceptPlayersFetchPromise) {
      return conceptPlayersFetchPromise;
    }
    return conceptPlayers;
  }

  conceptPlayersFetchPromise = new Promise((resolve, reject) => {
    isConceptPlayerFetchInProgress = true;
    const gatheredPlayers = [];
    const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;

    searchCriteria.offset = 0;
    searchCriteria._sort = 'asc';
    searchCriteria.count = 91;

    // Create progress bar using the extracted utility function
    const uniqueSuffix = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const containerId = `concept-progress-container-${uniqueSuffix}`;
    const progressBarId = `concept-progress-bar-${uniqueSuffix}`;
    createProgressBar(progressBarId, containerId, "Fetching Concepts");

    // Start with 0% progress
    updateProgressBar(progressBarId, 0);

    // Estimate total players to be around 20000 for progress calculation
    // Try to get saved total from localStorage first
    const savedEstimatedTotal = localStorage.getItem("conceptPlayerTotal");
    const estimatedTotal = savedEstimatedTotal
      ? parseInt(savedEstimatedTotal)
      : 26000;

    // Update the total once we have more data
    const updateTotal = (newTotal) => {
      if (newTotal > 1000) {
        // Only save if it seems like a reasonable count
        localStorage.setItem("conceptPlayerTotal", newTotal);
      }
    };

    const getAllConceptPlayers = () => {
      searchConceptPlayers(searchCriteria).observe(
        this,
        async function (sender, response) {
          const returnedItems = (response?.response?.items || []).map((item) => {
            if (!item) return item;
            try {
              item.concept = true;
            } catch {}
            return item;
          });

          if (!returnedItems.length && searchCriteria.offset==0) {
            console.warn(
              "[concepts] No players returned in batch. Retrying in 5 seconds.",
            );
            await sleep(5000);
            getAllConceptPlayers();
            return;
          }

          gatheredPlayers.push(...returnedItems);

          // Update progress based on current offset
          const progress = (searchCriteria.offset / estimatedTotal) * 100;
          updateProgressBar(progressBarId, progress);

          if (
            response.status !== 400 &&
            
            searchCriteria.offset <= Math.min(playerCount,estimatedTotal)
          ) {
            searchCriteria.offset += searchCriteria.count;
            getAllConceptPlayers();
            return;
          }

          if (playerCount > 1) {
            if (gatheredPlayers.length > 0) {
              conceptPlayers = gatheredPlayers;
              conceptPlayersCollected = true;

              exposeConceptPlayersToConsole(conceptPlayers);
              showNotification(
                "Collected All Concept Players",
                UINotificationType.POSITIVE,
              );
            } else {
              console.warn(
                "[concepts] Empty concept fetch result; preserving previous concept cache",
              );
            }
          }

          // Set progress to 100% when complete
          updateProgressBar(progressBarId, 100);
          // Remove progress bar after a delay
          removeProgressBar(containerId);
          // Reset the flag when done
          isConceptPlayerFetchInProgress = false;
          conceptPlayersFetchPromise = null;
          console.table(gatheredPlayers.slice(0, 10));
          resolve(gatheredPlayers);
        },
      );
    };
    getAllConceptPlayers();
  });

  return conceptPlayersFetchPromise;
};
const searchConceptPlayers = (searchCriteria) => {
  return services.Item.searchConceptItems(searchCriteria);
};
let getStoragePlayers = async function () {
  return new Promise((resolve, reject) => {
    const gatheredPlayers = [];
    const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;
    searchCriteria.offset = 0;
    searchCriteria.count = 91;
    const getAllStoragePlayers = () => {
      searchStoragePlayers(searchCriteria).observe(
        this,
        async function (sender, response) {
          gatheredPlayers.push(...response.response.items);
          if (response.status !== 400 && !response.response.endOfList) {
            searchCriteria.offset += searchCriteria.count;

            //console.log('Storages Retrieved',searchCriteria.offset)
            getAllStoragePlayers();
          } else {
            resolve(gatheredPlayers);
          }
        },
      );
    };
    getAllStoragePlayers();
  });
};
const searchStoragePlayers = (searchCriteria) => {
  return services.Item.searchStorageItems(searchCriteria);
};

