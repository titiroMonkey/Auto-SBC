// SBC Settings - SBC Solver Parameters Panel
// Populates the per-SBC/challenge settings tile and the custom rules panel.

let challenges;
let sbcSet;

const getShellUri = (id, ratingTier) => {
  return AssetLocationUtils.getShellUri(
    0,
    1,
    id,
    ratingTier,
    repositories.Rarity._collection[id]?.guid,
  );
};

const populateSbcParamsTile = async (
  sbcParamsTile,
  sbcId,
  challengeId,
  sbcName = null,
  challengeName = null,
) => {
  // Prefer stable name keys over volatile numeric ids.
  if (sbcName) {
    sbcId = sbcName;
  }
  if (challengeName) {
    challengeId = challengeName;
  }
  createDropDown(
    sbcParamsTile,
    "1-click Auto Submit",
    "autoSubmit",
    [
      { name: "Always", id: 1 },
      { name: "Optimal", id: 4 },
      { name: "Never", id: 0 },
    ].map((e) => new UTDataProviderEntryDTO(e.id, e.id, e.name)),
    getSettings(sbcId, challengeId, "autoSubmit"),
    (dropdownAS) => {
      saveSettings(
        sbcId,
        challengeId,
        "autoSubmit",
        parseInt(dropdownAS.getValue()),
      );
    },
    "Controls when SBCs are automatically submitted: Always (any solution), Optimal (only best solutions), or Never (manual submission)",
    false,
    false,
  );
  createNumberSpinner(
    sbcParamsTile,
    "Repeat Count (-1 repeats infinitely)",
    "repeatCount",
    -1,
    100,
    getSettings(sbcId, challengeId, "repeatCount"),
    (numberspinnerRC) => {
      saveSettings(
        sbcId,
        challengeId,
        "repeatCount",
        numberspinnerRC.getValue(),
      );
    },
    "Number of times to repeat this SBC: -1 repeats indefinitely, 0 performs once, positive numbers repeat that many times",
  );
  createToggle(
    sbcParamsTile,
    "Automatically try All Sbcs in Group",
    "sbcAllGroup",
    getSettings(sbcId, challengeId, "sbcAllGroup"),
    (toggleSBC) => {
      saveSettings(
        sbcId,
        challengeId,
        "sbcAllGroup",
        toggleSBC.getToggleState(),
      );
    },
    "When enabled, this SBC will automatically try all sbcs in the group",
  );
  createToggle(
    sbcParamsTile,
    "Automatically try to buy concepts in SBC solution",
    "sbcBuyConcepts",
    getSettings(sbcId, challengeId, "sbcBuyConcepts"),
    (toggleSBC) => {
      saveSettings(
        sbcId,
        challengeId,
        "sbcBuyConcepts",
        toggleSBC.getToggleState(),
      );
    },
    "When enabled, this SBC will automatically try to buy concepts in the solution",
  );
  createNumberSpinner(
    sbcParamsTile,
    "Max Price per player to buy concepts",
    "sbcBuyConceptsMaxPrice",
    100,
    100000,
    getSettings(sbcId, challengeId, "sbcBuyConceptsMaxPrice"),
    (numberspinnerMPCP) => {
      saveSettings(
        sbcId,
        challengeId,
        "sbcBuyConceptsMaxPrice",
        numberspinnerMPCP.getValue(),
      );
    },
    "Maximum price per player to buy concept players for SBC solutions",
  );
  createNumberSpinner(
    sbcParamsTile,
    "Price above value to purchase concepts",
    "sbcBuyConceptsPriceAbove",
    0,
    100000,
    getSettings(sbcId, challengeId, "sbcBuyConceptsPriceAbove"),
    (numberspinnerPAVP) => {
      saveSettings(
        sbcId,
        challengeId,
        "sbcBuyConceptsPriceAbove",
        numberspinnerPAVP.getValue(),
      );
    },
    "Only purchase concept players if their market price is less than this value above their current price",
  );
  createToggle(
    sbcParamsTile,
    "Automatically try SBC on Login",
    "sbcOnLogin",
    getSettings(sbcId, challengeId, "sbcOnLogin"),
    (toggleLOG) => {
      saveSettings(
        sbcId,
        challengeId,
        "sbcOnLogin",
        toggleLOG.getToggleState(),
      );
    },
    "When enabled, this SBC will automatically run when you log into FUT",
  );
  createToggle(
    sbcParamsTile,
    "Auto Apply Quick Solution on open",
    "autoApplyQuickSolutionOnOpen",
    getSettings(sbcId, challengeId, "autoApplyQuickSolutionOnOpen"),
    (toggleASO) => {
      saveSettings(
        sbcId,
        challengeId,
        "autoApplyQuickSolutionOnOpen",
        toggleASO.getToggleState(),
      );
    },
    "When enabled, opening this SBC challenge page will fetch and apply players from the configured quick solution URL",
  );
  createToggle(
    sbcParamsTile,
    "Use Concepts",
    "useConcepts",
    getSettings(sbcId, challengeId, "useConcepts"),
    (toggleUC) => {
      saveSettings(
        sbcId,
        challengeId,
        "useConcepts",
        toggleUC.getToggleState(),
      );
    },
    "When enabled, includes concept players in SBC solutions (requires concept collection to be enabled)",
  );
  createToggle(
    sbcParamsTile,
    "Automatically Open Reward Packs",
    "autoOpenPacks",
    getSettings(sbcId, challengeId, "autoOpenPacks"),
    (toggleAO) => {
      saveSettings(
        sbcId,
        challengeId,
        "autoOpenPacks",
        toggleAO.getToggleState(),
      );
    },
    "When enabled, automatically opens reward packs after SBC completion",
  );
  createToggle(
    sbcParamsTile,
    "Run in Background",
    "runInBackground",
    getSettings(sbcId, challengeId, "runInBackground"),
    (toggleRIB) => {
      saveSettings(
        sbcId,
        challengeId,
        "runInBackground",
        toggleRIB.getToggleState(),
      );
    },
    "When enabled, solve flow avoids opening squad/unassigned views and keeps chained runs in the background",
  );
  createToggle(
    sbcParamsTile,
    "Auto Confirm Pick",
    "autoConfirmPicks",
    getSettings(sbcId, challengeId, "autoConfirmPicks"),
    (toggleAP) => {
      saveSettings(
        sbcId,
        challengeId,
        "autoConfirmPicks",
        toggleAP.getToggleState(),
      );
    },
  );
  createDoubleRangeControl(
    sbcParamsTile,
    "Player Rating Range",
    "ratingRange",
    40,
    99,
    getSettings(sbcId, challengeId, "ratingRange") ?? [40, 99],
    (doubleRangeControl) => {
      saveSettings(sbcId, challengeId, "ratingRange", [
        doubleRangeControl.getMinValue(),
        doubleRangeControl.getMaxValue(),
      ]);
    },
    "Sets player rating range to use in SBC solutions (Allows quicker solving when the range is reduced , but could miss optimal solutions)",
  );
  createToggle(
    sbcParamsTile,
    "Ignore Exclusions & Max Ratings for Storage",
    "useDupes",
    getSettings(sbcId, challengeId, "useDupes"),
    (toggleUD) => {
      saveSettings(sbcId, challengeId, "useDupes", toggleUD.getToggleState());
    },
    "When enabled, duplicate players can be used in SBCs regardless of their rating",
  );
  createNumberSpinner(
    sbcParamsTile,
    "Duplicate Value %",
    "duplicateDiscount",
    0,
    100,
    getSettings(sbcId, challengeId, "duplicateDiscount") ?? 51,
    (spinnerDD) => {
      saveSettings(
        sbcId,
        challengeId,
        "duplicateDiscount",
        spinnerDD.getValue(),
      );
    },
    "Sets how much duplicate players are valued compared to their market price (lower % = more likely to be used)",
  );
  createNumberSpinner(
    sbcParamsTile,
    "Untradeable Value %",
    "untradeableDiscount",
    0,
    100,
    getSettings(sbcId, challengeId, "untradeableDiscount") ?? 80,
    (spinnerUD) => {
      saveSettings(
        sbcId,
        challengeId,
        "untradeableDiscount",
        spinnerUD.getValue(),
      );
    },
    "Sets how much untradeable players are valued compared to their market price (lower % = more likely to be used)",
  );
  createNumberSpinner(
    sbcParamsTile,
    "Concept Premium (e.g. 10 = 10x price)",
    "conceptPremium",
    1,
    100,
    getSettings(sbcId, challengeId, "conceptPremium") ?? 10,
    (spinnerCP) => {
      saveSettings(sbcId, challengeId, "conceptPremium", spinnerCP.getValue());
    },
    "Sets how much concept players are valued compared to their market price (higher = less likely to be used)",
  );
  createNumberSpinner(
    sbcParamsTile,
    "API Max Solve Time",
    "maxSolveTime",
    10,
    990,
    getSettings(sbcId, challengeId, "maxSolveTime"),
    (numberspinnerMST) => {
      saveSettings(
        sbcId,
        challengeId,
        "maxSolveTime",
        numberspinnerMST.getValue(),
      );
    },
    "Maximum time in seconds to spend searching for an optimal SBC solution",
  );
  createNumberSpinner(
    sbcParamsTile,
    "Max Player Price",
    "maxPlayerPrice",
    0,
    15000000,
    getSettings(sbcId, challengeId, "maxPlayerPrice") ?? 0,
    (spinnerMPP) => {
      saveSettings(sbcId, challengeId, "maxPlayerPrice", spinnerMPP.getValue());
    },
    "Maximum price per player to include in the solve (0 = no limit)",
  );
  createToggle(
    sbcParamsTile,
    "Only use Storage Players",
    "onlyStorage",
    getSettings(sbcId, challengeId, "onlyStorage"),
    (toggleOS) => {
      saveSettings(
        sbcId,
        challengeId,
        "onlyStorage",
        toggleOS.getToggleState(),
      );
    },
    "When enabled, only players from your storage will be used in SBC solutions",
  );
  createToggle(
    sbcParamsTile,
    "Do not include Players from other SBC solutions",
    "excludeSbcSquads",
    getSettings(sbcId, challengeId, "excludeSbcSquads"),
    (toggleOS) => {
      saveSettings(
        sbcId,
        challengeId,
        "excludeSbcSquads",
        toggleOS.getToggleState(),
      );
    },
    "When enabled, players pending from other SBC solutions will not be used in SBC solutions",
  );
  createToggle(
    sbcParamsTile,
    "Exclude Objective Players",
    "excludeObjective",
    getSettings(sbcId, challengeId, "excludeObjective"),
    (toggleXO) => {
      saveSettings(
        sbcId,
        challengeId,
        "excludeObjective",
        toggleXO.getToggleState(),
      );
    },
    "When enabled, players earned from objectives will not be used in SBC solutions",
  );
  createToggle(
    sbcParamsTile,
    "Exclude Evolved Players",
    "excludeEvolutions",
    getSettings(sbcId, challengeId, "excludeEvolutions"),
    (toggleXE) => {
      saveSettings(
        sbcId,
        challengeId,
        "excludeEvolutions",
        toggleXE.getToggleState(),
      );
    },
    "When enabled, evolved players will not be used in SBC solutions",
  );
  createToggle(
    sbcParamsTile,
    "Exclude Special Players",
    "excludeSpecial",
    getSettings(sbcId, challengeId, "excludeSpecial"),
    (toggleSP) => {
      saveSettings(
        sbcId,
        challengeId,
        "excludeSpecial",
        toggleSP.getToggleState(),
      );
    },
    "When enabled, special cards (TOTW, TOTS, Heroes, etc.) will not be used in SBC solutions",
  );
  createToggle(
    sbcParamsTile,
    "Exclude Tradable Players",
    "excludeTradable",
    getSettings(sbcId, challengeId, "excludeTradable"),
    (toggleSP) => {
      saveSettings(
        sbcId,
        challengeId,
        "excludeTradable",
        toggleSP.getToggleState(),
      );
    },
    "When enabled, tradable players will not be used in SBC solutions",
  );
  createToggle(
    sbcParamsTile,
    "Exclude SBC Players",
    "excludeSbc",
    getSettings(sbcId, challengeId, "excludeSbc"),
    (toggleXSBC) => {
      saveSettings(
        sbcId,
        challengeId,
        "excludeSbc",
        toggleXSBC.getToggleState(),
      );
    },
    "When enabled, players earned from SBCs will not be used in SBC solutions",
  );
  createToggle(
    sbcParamsTile,
    "Exclude Extinct Players",
    "excludeExtinct",
    getSettings(sbcId, challengeId, "excludeExtinct"),
    (toggleXE) => {
      saveSettings(
        sbcId,
        challengeId,
        "excludeExtinct",
        toggleXE.getToggleState(),
      );
    },
    "When enabled, players that are extinct on the transfer market will not be used in SBC solutions",
  );
  createToggle(
    sbcParamsTile,
    "Convert Rarity Group 'Min X' To Exact X",
    "lockMinOnePlayerRequirements",
    getSettings(sbcId, challengeId, "lockMinOnePlayerRequirements"),
    (toggleMinOne) => {
      saveSettings(
        sbcId,
        challengeId,
        "lockMinOnePlayerRequirements",
        toggleMinOne.getToggleState(),
      );
    },
    "When enabled, rarity group requirements using 'Min X' are solved as 'Exactly X' (for example Any TOTW/TOTS/FOF Min 1 -> Exactly 1, Min 4 -> Exactly 4)",
  );

  let players = [];
  try {
    players = await fetchPlayers();
  } catch (err) {
    console.warn("[SBC] populateSbcParamsTile: failed to fetch players", err);
  }

  const excludeFiltersGrid = document.createElement("div");
  excludeFiltersGrid.classList.add("autosbc-exclude-filters-grid");
  sbcParamsTile.appendChild(excludeFiltersGrid);

  createChoice(
    excludeFiltersGrid,
    "EXCLUDE - Players",
    "excludePlayers",
    players.map((item) => {
      return {
        label: item._staticData.firstName + " " + item._staticData.lastName,
        value: item.definitionId,
        id: item.definitionId,
        customProperties: {
          icon: `<img width="30" src='${getShellUri(
            item.rareflag,
            item.rareflag < 4 ? item.getTier() : ItemRatingTier.NONE,
          )}'/>`,
        },
      };
    }),
    sbcId,
    challengeId,
    "Select specific players to exclude from SBC solutions",
  );

  createChoice(
    excludeFiltersGrid,
    "EXCLUDE - Leagues",
    "excludeLeagues",
    factories.DataProvider.getLeagueDP()
      .filter((f) => f.id > 0)
      .map((m) => {
        return {
          id: m.id,
          value: m.id,
          label: m.label,
          customProperties: {
            icon: `<img width="20" src='${AssetLocationUtils.getLeagueImageUri(
              m.id,
            )}'/>`,
          },
        };
      }),
    sbcId,
    challengeId,
    "Select leagues whose players will be excluded from SBC solutions",
  );

  createChoice(
    excludeFiltersGrid,
    "EXCLUDE - Nations",
    "excludeNations",
    factories.DataProvider.getNationDP()
      .map((m) => {
        return {
          id: m.id,
          value: m.id,
          label: m.label,
          customProperties: {
            icon: `<img width="30" src='${AssetLocationUtils.getFlagImageUri(
              m.id,
            )}'/>`,
          },
        };
      })
      .filter((f) => f.id > 0),
    sbcId,
    challengeId,
    "Select nations whose players will be excluded from SBC solutions",
  );

  createChoice(
    excludeFiltersGrid,
    "EXCLUDE - Teams",
    "excludeTeams",
    factories.DataProvider.getTeamDP()
      .map((m) => {
        return {
          id: m.id,
          value: m.id,
          label:
            m.label +
            " ( " +
            repositories.TeamConfig.leagues._collection[
              repositories.TeamConfig.teams._collection[m.id]?.league
            ]?.name +
            " )",
          customProperties: {
            icon: `<img width="30" src='${AssetLocationUtils.getBadgeImageUri(
              m.id,
            )}'/>`,
          },
        };
      })
      .filter((f) => f.id > 0 && !f.label.includes("*")),
    sbcId,
    challengeId,
    "Select clubs whose players will be excluded from SBC solutions",
  );

  createChoice(
    excludeFiltersGrid,
    "EXCLUDE - Rarity",
    "excludeRarity",
    factories.DataProvider.getItemRarityDP({
      itemSubTypes: [ItemSubType.PLAYER],
      itemTypes: [ItemType.PLAYER],
      quality: SearchLevel.ANY,
      tradableOnly: false,
    })
      .map((m) => {
        return {
          id: m.id,
          value: m.label,
          label: m.label,
          customProperties: {
            icon: `<img width="30" src='${getShellUri(
              m.id,
              m.id < 4 ? ItemRatingTier.GOLD : ItemRatingTier.NONE,
            )}'/>`,
          },
        };
      })
      .filter((f) => f.id > 0 && !f.label.includes("*")),
    sbcId,
    challengeId,
    "Select card rarities that will be excluded from SBC solutions",
  );

  const buildSquadExclusionOptions = async () => {
    const options = [];
    try {
      const squads = await getUserSquads();
      for (const squad of squads) {
        const players = (
          typeof squad.getPlayers === "function"
            ? squad.getPlayers()
            : squad._players || []
        ).filter((p) => p?._item?.id > 0);
        if (!players.length) continue;

        const squadId =
          typeof squad.getId === "function" ? squad.getId() : squad._id;
        const squadName =
          typeof squad.getName === "function" ? squad.getName() : squad._name;
        options.push({
          id: String(squadId),
          value: String(squadId),
          label: squadName || `Squad ${squadId}`,
        });
      }
    } catch (err) {
      console.warn("[SBC] Failed to build squad exclusion options", err);
    }
    return options;
  };

  createChoice(
    excludeFiltersGrid,
    "EXCLUDE - From Squad",
    "excludeFromSquadIds",
    await buildSquadExclusionOptions(),
    sbcId,
    challengeId,
    "Select your saved squads (from Squad Management) whose assigned players will be excluded from SBC solutions",
  );
};

const createSBCCustomRulesPanel = async (parent) => {
  let sbcData = await sbcSets();
  let sbcSelectionToken = 0;

  let SBCList = sbcData.sets
    .sort(function (a, b) {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    })
    .filter((f) => !f.isComplete())
    .map((e) => new UTDataProviderEntryDTO(e.id, e.id, e.name));
  SBCList.unshift(new UTDataProviderEntryDTO(0, 0, "All SBCS"));

  const removeRequirementsView = () => {
    const requirementsView = document.getElementsByClassName(
      "ut-sbc-challenge-requirements-view",
    )[0];
    if (document.contains(requirementsView)) {
      requirementsView.remove();
    }
  };

  createDropDown(
    parent,
    "Choose SBC",
    "sbcId",
    SBCList,
    "0",
    async (dropdown) => {
      const selectionToken = ++sbcSelectionToken;
      const selectedSbcId = Number(dropdown.getValue()) || 0;

      removeRequirementsView();

      let challenge = [];
      if (selectedSbcId !== 0) {
        let allSbcData = await sbcSets();
        if (selectionToken !== sbcSelectionToken) {
          return;
        }

        sbcSet = allSbcData.sets.filter((e) => e.id == selectedSbcId)[0];
        if (!sbcSet) {
          challenge.unshift(new UTDataProviderEntryDTO(0, 0, "All Challenges"));
        } else {
          challenges = await getChallenges(sbcSet);
          if (selectionToken !== sbcSelectionToken) {
            return;
          }

          challenge = challenges.challenges.map(
            (e) => new UTDataProviderEntryDTO(e.id, e.id, e.name),
          );
        }
      }
      challenge.unshift(new UTDataProviderEntryDTO(0, 0, "All Challenges"));

      createDropDown(
        parent,
        "Choose Challenge",
        "sbcChallengeId",
        challenge,
        0,
        async (dropdownChallenge) => {
          if (selectionToken !== sbcSelectionToken) {
            return;
          }

          const challengeForSelectedSbc =
            Number(dropdownChallenge.getValue()) || 0;

          const selectedSbcName =
            selectedSbcId === 0 ? "global" : sbcSet?.name || "global";
          const selectedChallengeName =
            challengeForSelectedSbc === 0
              ? "global"
              : challenges?.challenges?.find(
                  (item) => item.id == challengeForSelectedSbc,
                )?.name || "global";

          if (typeof setCurrentSbcContext === "function") {
            setCurrentSbcContext(selectedSbcName, selectedChallengeName);
          }

          if ((Number(dropdown.getValue()) || 0) !== selectedSbcId) {
            return;
          }

          console.log(
            "SBCId:" + selectedSbcId,
            "ChallengeId:" + challengeForSelectedSbc,
          );
          removeRequirementsView();

          let sbcParamsTile = createSettingsTile(
            parent,
            "SBC Solver Paramaters",
            "submitParams",
          );

          // Create a "Restore to Default" button
          const resetButton = createButton(
            "resetSettings",
            "Restore to Default",
            () => {
              // Get the current SBC and challenge IDs
              const sbcKey = selectedSbcName;
              const challengeKey = selectedChallengeName;

              // Get the current settings
              let settings = getSolverSettings();

              // Check if the settings exist and remove them
              if (
                settings["sbcSettings"] &&
                settings["sbcSettings"][sbcKey] &&
                settings["sbcSettings"][sbcKey][challengeKey]
              ) {
                // Delete the specific challenge settings
                delete settings["sbcSettings"][sbcKey][challengeKey];

                // If this was the only challenge for this SBC, clean up the SBC entry too
                if (Object.keys(settings["sbcSettings"][sbcKey]).length === 0) {
                  delete settings["sbcSettings"][sbcKey];
                }
                initDefaultSettings();
                // Save the updated settings
                setSolverSettings("sbcSettings", settings["sbcSettings"]);

                // Show notification
                showNotification(
                  "Settings restored to default",
                  UINotificationType.POSITIVE,
                );

                // Refresh the view to reflect changes
                let currentController = getCurrentViewController();
                if (currentController) {
                  currentController
                    .getNavigationController()
                    .popViewController();
                  currentController
                    .getNavigationController()
                    .pushViewController(new sbcSettingsController());
                }
              }
            },
          );

          const resetPanel = createPanel();
          resetPanel.appendChild(resetButton);
          sbcParamsTile.appendChild(resetPanel);
          await populateSbcParamsTile(
            sbcParamsTile,
            selectedSbcId,
            challengeForSelectedSbc,
            selectedSbcName,
            selectedChallengeName,
          );
        },
      );
    },
  );
};
