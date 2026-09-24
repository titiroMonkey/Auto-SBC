const futHomeOverride = async () => {
  const homeHubInit = UTHomeHubView.prototype.init;
  UTHomeHubView.prototype.init = async function () {
    const isSbcSettingsScreen =
      typeof sbcSettingsView !== "undefined" && this instanceof sbcSettingsView;

    const isFirstLoad = !window.__sbcPlayersReady;
    if (isFirstLoad) {
      services.Notification.queue([
        "Fetching club players — SBC Solver will start when ready…",
        UINotificationType.NEUTRAL,
      ]);
    }
    players = await fetchPlayers();
    let storage = await getStoragePlayers();

    let conceptFetchPromise = null;
    if (!isSbcSettingsScreen && !conceptPlayersCollected) {
      conceptFetchPromise = getConceptPlayers(999999);
    }

    players = players.filter(
      (f) => !storage.map((m) => m.definitionId).includes(f.definitionId),
    );
    players = players.concat(storage);
    // await fetchLowestPriceByRating();
    //    await fetchPlayerPrices(players);
    createSBCTab();
    window.__sbcPlayersReady = true;
    try {
      window.dispatchEvent(
        new CustomEvent("autosbc:club-players-ready", {
          detail: { count: players.length, timestamp: Date.now() },
        }),
      );
    } catch {}
    // Show sidebar tabs that were deferred until players loaded
    document.querySelectorAll('.sbc-tab-deferred').forEach((el) => {
      el.style.display = '';
      el.classList.remove('sbc-tab-deferred');
    });
    if (isFirstLoad) {
      services.Notification.queue([
        `SBC Solver ready — ${players.length} players loaded`,
        UINotificationType.POSITIVE,
      ]);
    }
    let sbcs = await sbcSets();
    fetchPlayerPrices(
      sbcs.sets.filter((s) => s.awards[0]?.item).map((s) => s.awards[0]?.item),
      { waitForCompletion: false, suppressNotification: true },
    );
    homeHubInit.call(this);
    const sbcSettingsLogin = findSBCLogin(getSolverSettings(), "sbcOnLogin");

    const setsById = new Map(
      sbcs.sets.map((set) => [String(set.id), set]),
    );
    const setsByName = new Map(
      sbcs.sets.map((set) => [String(set.name || "").toLowerCase(), set]),
    );

    const resolveSetId = (rawSetRef) => {
      if (rawSetRef === undefined || rawSetRef === null || rawSetRef === "") {
        return null;
      }

      const setRef = String(rawSetRef).trim();
      if (!setRef) {
        return null;
      }

      if (setsById.has(setRef)) {
        return setRef;
      }

      const byName = setsByName.get(setRef.toLowerCase());
      if (byName?.id !== undefined && byName?.id !== null) {
        return String(byName.id);
      }

      return null;
    };

    const challengeEntriesBySet = new Map();
    (sbcSettingsLogin || []).forEach((entry) => {
      const setId = resolveSetId(entry?.parents?.[1]);
      const challengeRef = entry?.parents?.[2];
      if (!setId || challengeRef === undefined || challengeRef === null) {
        return;
      }

      const existing = challengeEntriesBySet.get(setId) || [];
      existing.push({ challengeRef, rawEntry: entry });
      challengeEntriesBySet.set(setId, existing);
    });

    const resolvedLoginEntries = [];
    for (const [setId, entries] of challengeEntriesBySet.entries()) {
      const set = setsById.get(String(setId));
      if (!set) {
        continue;
      }

      let challenges = [];
      try {
        const challengeResponse = await getChallenges(set);
        challenges = Array.isArray(challengeResponse?.challenges)
          ? challengeResponse.challenges
          : [];
      } catch {
        challenges = [];
      }

      const challengeById = new Map(
        challenges.map((challenge) => [String(challenge.id), challenge]),
      );
      const challengeByName = new Map(
        challenges.map((challenge) => [String(challenge.name || "").toLowerCase(), challenge]),
      );

      let setResolvedAnyChallenge = false;

      entries.forEach(({ challengeRef }) => {
        const refText = String(challengeRef).trim();
        if (!refText) {
          return;
        }

        let resolvedChallengeId = null;
        if (challengeById.has(refText)) {
          resolvedChallengeId = refText;
        } else {
          const byName = challengeByName.get(refText.toLowerCase());
          if (byName?.id !== undefined && byName?.id !== null) {
            resolvedChallengeId = String(byName.id);
          }
        }

        if (!resolvedChallengeId) {
          return;
        }

        setResolvedAnyChallenge = true;

        resolvedLoginEntries.push({
          setId: String(setId),
          challengeId: resolvedChallengeId,
          sbcName: set.name,
        });
      });

      // If challenge metadata is unavailable (e.g. transient EA API failures),
      // still queue this set so login automation can start.
      if (!setResolvedAnyChallenge && entries.length > 0) {
        resolvedLoginEntries.push({
          setId: String(setId),
          challengeId: "0",
          sbcName: set.name,
        });
      }
    }

    const savedOrder = getSettings(0, 0, "loginSbcOrder");
    const savedOrderNames = Array.isArray(savedOrder)
      ? savedOrder
          .map((entry) => {
            const rawValue = String(entry || "").trim();
            if (!rawValue) {
              return null;
            }

            if (setsById.has(rawValue)) {
              return setsById.get(rawValue)?.name || null;
            }

            return setsByName.get(rawValue.toLowerCase())?.name || null;
          })
          .filter(Boolean)
      : [];

    const baseSetNames = [];
    resolvedLoginEntries.forEach((entry) => {
      const sbcName = String(entry.sbcName || "").trim();
      if (sbcName && !baseSetNames.some((name) => String(name).toLowerCase() === sbcName.toLowerCase())) {
        baseSetNames.push(sbcName);
      }
    });

    const orderedSetNames = [
      ...savedOrderNames.filter((name) =>
        baseSetNames.some((baseName) => String(baseName).toLowerCase() === String(name).toLowerCase()),
      ),
      ...baseSetNames.filter(
        (name) =>
          !savedOrderNames.some(
            (savedName) => String(savedName).toLowerCase() === String(name).toLowerCase(),
          ),
      ),
    ];

    if (
      orderedSetNames.length !== savedOrderNames.length ||
      orderedSetNames.some((name, index) => name !== savedOrderNames[index])
    ) {
      saveSettings("global", "global", "loginSbcOrder", orderedSetNames);
    }

    const incompleteSbcByName = new Map(
      sbcs.sets
        .filter((sbc) => !sbc.isComplete())
        .map((sbc) => [String(sbc.name || "").toLowerCase(), sbc]),
    );

    orderedSetNames.forEach((sbcName) => {
      const sbc = incompleteSbcByName.get(String(sbcName).toLowerCase());
      if (!sbc) {
        return;
      }

      resolvedLoginEntries
        .filter(
          (entry) =>
            String(entry.sbcName || "").toLowerCase() === String(sbcName).toLowerCase(),
        )
        .forEach((entry) => {
          sbcLogin.push([entry.setId, entry.challengeId, entry.sbcName || sbc.name]);
        });
    });

    if (sbcLogin.length > 0) {
      // Create progress bar for login SBCs

      // Track total SBCs to complete
      const totalSbcs = sbcLogin.length;
      let completedSbcs = 0;

      const processNextSbc = () => {
        console.log("Processing next SBC:", sbcLogin);
        if (sbcLogin.length === 0) {
          return;
        }

        let sbcToTry = sbcLogin.shift();
        sbcLogin = sbcLogin.slice();

        services.Notification.queue([
          `${sbcToTry[2]} SBC Started (${completedSbcs}/${totalSbcs})`,
          UINotificationType.POSITIVE,
        ]);

        solveSBC(sbcToTry[0], sbcToTry[1], true, null, false, false, true);
      };

      processNextSbc();
    }

    if (conceptFetchPromise) {
      // Start concept collection and pricing in background — don't block solve startup
      conceptFetchPromise.then((concepts) => {
        if (concepts && concepts.length > 0) {
          // Price concepts in background without blocking
          fetchPlayerPrices(concepts, {
            waitForCompletion: false,
            suppressNotification: true,
            throttleProfile: "concept",
          });
        }
      }).catch((err) => {
        console.error('[futHomeOverride] Concept fetch error:', err);
      });
    }
  };
};
