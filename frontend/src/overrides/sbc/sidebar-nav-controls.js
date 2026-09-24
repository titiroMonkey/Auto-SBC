// SBC Settings Controls - re-exports to window and autoSbcConsoleApi
// Function definitions have been moved to features/settings/sbc-settings-controls.js

try {
  const exportCandidates = {
    sideBarNavOverride:
      typeof sideBarNavOverride !== "undefined"
        ? sideBarNavOverride
        : undefined,
    setSolverSettings:
      typeof setSolverSettings !== "undefined" ? setSolverSettings : undefined,
    getSolverSettings:
      typeof getSolverSettings !== "undefined" ? getSolverSettings : undefined,
    generateSbcSolveTab:
      typeof generateSbcSolveTab !== "undefined"
        ? generateSbcSolveTab
        : undefined,
    sbcSettingsController:
      typeof sbcSettingsController !== "undefined"
        ? sbcSettingsController
        : undefined,
    sbcSettingsView:
      typeof sbcSettingsView !== "undefined" ? sbcSettingsView : undefined,
    createSettingsTile:
      typeof createSettingsTile !== "undefined"
        ? createSettingsTile
        : undefined,
    createSBCCustomRulesPanel:
      typeof createSBCCustomRulesPanel !== "undefined"
        ? createSBCCustomRulesPanel
        : undefined,
    populateSbcParamsTile:
      typeof populateSbcParamsTile !== "undefined"
        ? populateSbcParamsTile
        : undefined,
    getShellUri: typeof getShellUri !== "undefined" ? getShellUri : undefined,
    saveSettings:
      typeof saveSettings !== "undefined" ? saveSettings : undefined,
    getSettings: typeof getSettings !== "undefined" ? getSettings : undefined,
    createStopOverlayButton:
      typeof createStopOverlayButton !== "undefined"
        ? createStopOverlayButton
        : undefined,
    createLogOverlayToggle:
      typeof createLogOverlayToggle !== "undefined"
        ? createLogOverlayToggle
        : undefined,
    updateLogOverlay:
      typeof updateLogOverlay !== "undefined" ? updateLogOverlay : undefined,
    pollSolverLogs:
      typeof pollSolverLogs !== "undefined" ? pollSolverLogs : undefined,
    initDefaultSettings:
      typeof initDefaultSettings !== "undefined"
        ? initDefaultSettings
        : undefined,
    migrateMaxRatingSettings:
      typeof migrateMaxRatingSettings !== "undefined"
        ? migrateMaxRatingSettings
        : undefined,
    getUnassignedRules:
      typeof getUnassignedRules !== "undefined"
        ? getUnassignedRules
        : undefined,
    setUnassignedRules:
      typeof setUnassignedRules !== "undefined"
        ? setUnassignedRules
        : undefined,
    normalizeUnassignedRule:
      typeof normalizeUnassignedRule !== "undefined"
        ? normalizeUnassignedRule
        : undefined,
    matchesTriState:
      typeof matchesTriState !== "undefined" ? matchesTriState : undefined,
    getItemTeamId:
      typeof getItemTeamId !== "undefined" ? getItemTeamId : undefined,
    getItemLeagueId:
      typeof getItemLeagueId !== "undefined" ? getItemLeagueId : undefined,
    getItemNationId:
      typeof getItemNationId !== "undefined" ? getItemNationId : undefined,
    getItemRarityId:
      typeof getItemRarityId !== "undefined" ? getItemRarityId : undefined,
    getRarityLabelById:
      typeof getRarityLabelById !== "undefined"
        ? getRarityLabelById
        : undefined,
    getItemRarityLabel:
      typeof getItemRarityLabel !== "undefined"
        ? getItemRarityLabel
        : undefined,
    matchesUnassignedGroup:
      typeof matchesUnassignedGroup !== "undefined"
        ? matchesUnassignedGroup
        : undefined,
    matchesUnassignedRule:
      typeof matchesUnassignedRule !== "undefined"
        ? matchesUnassignedRule
        : undefined,
    isUnassignedGroupingEnabled:
      typeof isUnassignedGroupingEnabled !== "undefined"
        ? isUnassignedGroupingEnabled
        : undefined,
    createUnassignedRulesPanel:
      typeof createUnassignedRulesPanel !== "undefined"
        ? createUnassignedRulesPanel
        : undefined,
    createPanel: typeof createPanel !== "undefined" ? createPanel : undefined,
    createTooltip:
      typeof createTooltip !== "undefined" ? createTooltip : undefined,
    addControl: typeof addControl !== "undefined" ? addControl : undefined,
    setVisibility:
      typeof setVisibility !== "undefined" ? setVisibility : undefined,
    createToggle:
      typeof createToggle !== "undefined" ? createToggle : undefined,
    createNumberSpinner:
      typeof createNumberSpinner !== "undefined"
        ? createNumberSpinner
        : undefined,
    createDropDown:
      typeof createDropDown !== "undefined" ? createDropDown : undefined,
    createDoubleRangeControl:
      typeof createDoubleRangeControl !== "undefined"
        ? createDoubleRangeControl
        : undefined,
    createChoice:
      typeof createChoice !== "undefined" ? createChoice : undefined,
    buildOptions:
      typeof buildOptions !== "undefined" ? buildOptions : undefined,
    createChoiceLocal:
      typeof createChoiceLocal !== "undefined" ? createChoiceLocal : undefined,
    updateRule: typeof updateRule !== "undefined" ? updateRule : undefined,
    renderRules: typeof renderRules !== "undefined" ? renderRules : undefined,
    Counter: typeof Counter !== "undefined" ? Counter : undefined,
    findSBCLogin:
      typeof findSBCLogin !== "undefined" ? findSBCLogin : undefined,
  };

  for (const [name, fn] of Object.entries(exportCandidates)) {
    if (typeof fn === "function") {
      window[name] = fn;
    }
  }

  window.autoSbcConsoleApi = {
    ...(window.autoSbcConsoleApi || {}),
    ...Object.fromEntries(
      Object.entries(exportCandidates).filter(
        ([, fn]) => typeof fn === "function",
      ),
    ),
  };
} catch {}
