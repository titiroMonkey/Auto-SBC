// Loader overlay functions for displaying solver progress and status

// Helper to safely get the shield element
const getShield = () => {
  let shield = getElement(".ut-click-shield");
  if (!shield) {
    console.warn("Shield element not found");
  }
  return shield;
};

const AUTO_SBC_BACKGROUND_STATUS_ICON_ID = "autosbc-background-status-icon";

const ensureBackgroundSolveStatusIcon = () => {
  let icon = document.getElementById(AUTO_SBC_BACKGROUND_STATUS_ICON_ID);
  if (!icon) {
    icon = document.createElement("div");
    icon.id = AUTO_SBC_BACKGROUND_STATUS_ICON_ID;
    icon.classList.add("autosbc-background-status-icon");
    icon.setAttribute("aria-label", "Auto SBC background status");
    icon.setAttribute("title", "Auto SBC background run");
    document.body.appendChild(icon);
  }
  return icon;
};

const refreshBackgroundSolveStatusIcon = () => {
  const icon = ensureBackgroundSolveStatusIcon();
  if (!icon) {
    return;
  }

  const status = window.__autoSbcSolveStatus;
  const runInBackground = !!window.__autoSbcSolveRunInBackground;

  icon.classList.remove(
    "autosbc-bg-status--solving",
    "autosbc-bg-status--feasible",
    "autosbc-bg-status--optimal",
  );

  if (!runInBackground || !status) {
    icon.style.display = "none";
    return;
  }

  if (status === "solving") {
    icon.classList.add("autosbc-bg-status--solving");
  } else if (status === "feasible") {
    icon.classList.add("autosbc-bg-status--feasible");
  } else if (status === "optimal") {
    icon.classList.add("autosbc-bg-status--optimal");
  }

  icon.style.display = "flex";
};

window.refreshBackgroundSolveStatusIcon = refreshBackgroundSolveStatusIcon;

// Helper to ensure the .numCounter element exists
const ensureNumCounterExists = () => {
  let numCounter = document.querySelector(".numCounter");
  if (!numCounter) {
    const shield = getShield();
    if (shield) {
      numCounter = document.createElement("div");
      numCounter.classList.add("numCounter");
      numCounter.addEventListener("click", () => {
        if (typeof cancelActiveSolveRun === "function") {
          cancelActiveSolveRun();
        } else {
          createSbc = false;
          hideLoader();
        }
      });
      shield.appendChild(numCounter);
    }
  }
  return numCounter;
};

const addSbcInfo = (sbcName, challengeName) => {
  const shield = getShield();
  if (!shield) return;

  let existingInfo = document.getElementById("sbc-info");
  if (existingInfo) {
    existingInfo.remove();
  }

  if (!sbcName) return;

  let infoDiv = document.createElement("div");
  infoDiv.id = "sbc-info";
  infoDiv.style.position = "fixed";
  infoDiv.style.bottom = "10px";
  infoDiv.style.left = "160px";
  infoDiv.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  infoDiv.style.color = "white";
  infoDiv.style.padding = "10px 20px";
  infoDiv.style.borderRadius = "5px";
  infoDiv.style.fontSize = "1.2rem";
  infoDiv.style.fontWeight = "bold";
  infoDiv.style.textAlign = "center";
  infoDiv.style.zIndex = "9999";

  let title = document.createElement("div");
  title.textContent = sbcName || "SBC";
  infoDiv.appendChild(title);

  if (challengeName && challengeName !== sbcName) {
    let subtitle = document.createElement("div");
    subtitle.textContent = challengeName;
    subtitle.style.fontSize = "1rem";
    subtitle.style.opacity = "0.8";
    infoDiv.appendChild(subtitle);
  }

  shield.appendChild(infoDiv);
};

const clearSbcInfo = () => {
  const sbcNames = document.querySelectorAll("#sbc-info");
  sbcNames.forEach((sbcName) => {
    sbcName.remove();
  });
};

const showLoader = (countdown = false) => {
  refreshBackgroundSolveStatusIcon();

  const clickShield = document.querySelector(".ut-click-shield");
  if (clickShield) {
    clickShield.classList.add("showing");
  }

  const loaderIcon = document.querySelector(".loaderIcon");
  if (loaderIcon) {
    loaderIcon.style.display = "block";
  }

  // Only show overlay details when actively solving an SBC (countdown = true)
  if (countdown) {
    // Ensure numCounter element exists before trying to show it
    ensureNumCounterExists();

    // Show overlay UI controls
    createLogOverlayToggle();
    updateLogOverlay();
    createStopOverlayButton();

    const numCounterElement = document.querySelector(".numCounter");
    if (numCounterElement) {
      numCounterElement.style.display = "block";
    }
  } else {
    // Hide all overlay details when not solving
    clearSbcInfo();

    const stopButtons = document.querySelectorAll("#sbc-stop-overlay");
    const grindActive =
      typeof createSbcGrind !== "undefined" && createSbcGrind;
    stopButtons.forEach((stopButton) => {
      if (grindActive) return; // keep stop button visible while grind is running
      stopButton.remove();
    });

    const toggleContainers = document.querySelectorAll("#sbc-log-toggle");
    toggleContainers.forEach((toggleContainer) => {
      toggleContainer.remove();
    });

    let logOverlay = document.getElementById("sbc-log-overlay");
    if (logOverlay) {
      logOverlay.remove();
    }

    const numCounterElement = document.querySelector(".numCounter");
    if (numCounterElement) {
      numCounterElement.style.display = "none";
    }
  }
};

const hideLoader = () => {
  if (window.__autoSbcHoldLoaderUntilFinal === true) {
    return;
  }

  // Only guard against active solve run / active context when the loader hold
  // is still in effect. Once the solve has cleared the hold (by calling
  // setSolveLoaderHoldUntilFinal(false)) we must allow the loader to hide,
  // even if createSbc/activeSolveContext haven't been torn down yet.
  if (window.__autoSbcHoldLoaderUntilFinal === true) {
    // Don't hide loader during active solve runs (allows interim solutions to update UI)
    if (
      typeof window.__autoSbcIsSolveRunActive === "function" &&
      window.__autoSbcIsSolveRunActive()
    ) {
      return;
    }

    // Also keep loader visible while a solve context exists (interim squad apply
    // navigation can transiently toggle solve-active flags).
    if (
      typeof window.__autoSbcActiveSolveContext === "function" &&
      window.__autoSbcActiveSolveContext()
    ) {
      return;
    }
  }

  const stopButtons = document.querySelectorAll("#sbc-stop-overlay");
  const grindRunning =
    typeof createSbcGrind !== "undefined" && createSbcGrind;
  stopButtons.forEach((stopButton) => {
    if (grindRunning) return; // keep stop button visible while grind is running
    stopButton.remove();
  });
  clearSbcInfo();
  const toggleContainers = document.querySelectorAll("#sbc-log-toggle");
  toggleContainers.forEach((toggleContainer) => {
    toggleContainer.remove();
  });

  let logOverlay = document.getElementById("sbc-log-overlay");
  if (logOverlay) {
    logOverlay.remove();
  }

  // Only clear counter if it exists
  if (typeof counter !== "undefined" && counter !== null) {
    try {
      counter = null;
    } catch (error) {
      console.warn("Error clearing counter:", error);
    }
  }

  document.querySelectorAll(".numCounter").forEach((element) => {
    element.remove();
  });

  const clickShield = document.querySelector(".ut-click-shield");
  if (clickShield) {
    clickShield.classList.remove("showing");
  }

  const loaderIcon = document.querySelector(".loaderIcon");
  if (loaderIcon) {
    loaderIcon.style.display = "none";
  }

  refreshBackgroundSolveStatusIcon();

  // Clear intervals with null checks
  if (typeof logPollInterval !== "undefined" && logPollInterval !== null) {
    clearInterval(logPollInterval);
  }
  if (typeof countDownInterval !== "undefined" && countDownInterval !== null) {
    clearInterval(countDownInterval);
  }
};

const createStopOverlayButton = () => {
  // Don't create a duplicate if already present
  if (document.getElementById("sbc-stop-overlay")) return;

  // When auto grind is running, attach to body so the button persists
  // independently of the shield's visibility between grind cycles.
  const grindActive =
    typeof createSbcGrind !== "undefined" && createSbcGrind;
  const parent = grindActive ? document.body : getShield();
  if (!parent) return;

  const stopButtonContainer = document.createElement("div");
  stopButtonContainer.id = "sbc-stop-overlay";
  stopButtonContainer.style.position = "fixed";
  stopButtonContainer.style.bottom = "45px";
  stopButtonContainer.style.right = "130px";
  stopButtonContainer.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  stopButtonContainer.style.color = "#fff";
  stopButtonContainer.style.padding = "10px";
  stopButtonContainer.style.borderRadius = "5px";
  stopButtonContainer.style.zIndex = "9999";
  stopButtonContainer.style.fontSize = "12px";
  stopButtonContainer.style.fontFamily = "Arial, sans-serif";

  const stopButton = document.createElement("button");
  stopButton.textContent = "STOP";
  stopButton.style.marginLeft = "5px";
  stopButton.style.padding = "5px 10px";
  stopButton.style.border = "none";
  stopButton.style.borderRadius = "3px";
  stopButton.style.cursor = "pointer";
  stopButton.style.backgroundColor = "#ff0000";
  stopButton.style.color = "#000";

  stopButton.addEventListener("click", () => {
    if (typeof cancelActiveSolveRun === "function") {
      cancelActiveSolveRun();
    } else {
      createSbc = false;
      createSbcGrind = false;
      window.__autoSbcHoldLoaderUntilFinal = false;
      hideLoader();
    }
  });

  stopButtonContainer.appendChild(stopButton);
  parent.appendChild(stopButtonContainer);
};

const createLogOverlayToggle = () => {
  const shield = getShield();
  if (!shield) return;

  const toggleContainer = document.createElement("div");
  toggleContainer.id = "sbc-log-toggle";
  toggleContainer.style.position = "fixed";
  toggleContainer.style.bottom = "10px";
  toggleContainer.style.left = "10px";
  toggleContainer.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  toggleContainer.style.color = "#fff";
  toggleContainer.style.padding = "10px";
  toggleContainer.style.borderRadius = "5px";
  toggleContainer.style.zIndex = "9999";
  toggleContainer.style.fontSize = "12px";
  toggleContainer.style.fontFamily = "Arial, sans-serif";

  const toggleLabel = document.createElement("span");
  toggleLabel.textContent = "Show Solver Logs";
  toggleContainer.appendChild(toggleLabel);

  const toggleButton = document.createElement("button");
  toggleButton.textContent = getSettings(0, 0, "showLogOverlay") ? "ON" : "OFF";
  toggleButton.style.marginLeft = "5px";
  toggleButton.style.padding = "5px 10px";
  toggleButton.style.border = "none";
  toggleButton.style.borderRadius = "3px";
  toggleButton.style.cursor = "pointer";
  toggleButton.style.backgroundColor = getSettings(0, 0, "showLogOverlay")
    ? "#00ff00"
    : "#ff0000";
  toggleButton.style.color = "#000";

  toggleButton.addEventListener("click", () => {
    const currentState = getSettings(0, 0, "showLogOverlay");
    saveSettings(0, 0, "showLogOverlay", !currentState);
    toggleButton.textContent = !currentState ? "ON" : "OFF";
    toggleButton.style.backgroundColor = !currentState ? "#00ff00" : "#ff0000";
    updateLogOverlay();
  });

  toggleContainer.appendChild(toggleButton);
  shield.appendChild(toggleContainer);
};

// Create or update the log overlay
const updateLogOverlay = () => {
  const shield = getShield();
  if (!shield) return;

  let logOverlay = document.getElementById("sbc-log-overlay");

  if (getSettings(0, 0, "showLogOverlay")) {
    if (!logOverlay) {
      logOverlay = document.createElement("div");
      logOverlay.id = "sbc-log-overlay";
      logOverlay.style.position = "fixed";
      logOverlay.style.bottom = "75px";
      logOverlay.style.left = "10px";
      logOverlay.style.maxHeight = "15vh";
      logOverlay.style.width = "40vw";
      logOverlay.style.overflowY = "auto";
      logOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
      logOverlay.style.color = "#00ff00";
      logOverlay.style.padding = "10px";
      logOverlay.style.fontSize = "12px";
      logOverlay.style.fontFamily = "monospace";
      logOverlay.style.zIndex = "9999";
      logOverlay.style.borderRadius = "5px";
      logOverlay.style.border = "1px solid #00ff00";

      shield.appendChild(logOverlay);
    }
    logOverlay.style.display = "block";
  } else if (logOverlay) {
    logOverlay.style.display = "none";
  }
};

// Setup a variable to track the last log we've seen
let lastLogIndex = 0;

// Function to poll for solver logs
const pollSolverLogs = async () => {
  try {
    const response = await makeGetRequest(apiUrl + "/solver-logs");
    const data = JSON.parse(response);
    const showOverlay = getSettings(0, 0, "showLogOverlay");

    // Ensure log overlay exists if we need to show logs
    if (showOverlay) {
      updateLogOverlay();
    }

    // We have new logs
    const logOverlay = document.getElementById("sbc-log-overlay");
    if (showOverlay && lastLogIndex === 0 && logOverlay) {
      while (logOverlay.firstChild) {
        logOverlay.removeChild(logOverlay.firstChild);
      }
    }

    if (data.logs && data.logs.length > lastLogIndex) {
      for (let i = lastLogIndex; i < data.logs.length; i++) {
        const log = data.logs[i];
        const resultPayload = log?.result;

        // Handle interim solutions
        if (
          resultPayload &&
          typeof resultPayload === "object" &&
          resultPayload.event === "interim_solution" &&
          typeof window.applyInterimSolverSolutionFromLog === "function"
        ) {
          try {
            await window.applyInterimSolverSolutionFromLog(resultPayload);
          } catch (error) {
            console.error("Error applying interim solution:", error);
          }
        }

        // Add log entry to overlay if visible
        if (showOverlay) {
          const logOverlay = document.getElementById("sbc-log-overlay");
          if (logOverlay) {
            try {
              const timestamp = new Date(log.time * 1000)
                .toISOString()
                .split("T")[1]
                .slice(0, -1);

              const logEntry = document.createElement("div");
              logEntry.className = "solver-log";
              logEntry.style.marginBottom = "5px";

              if (log.message) {
                logEntry.textContent = `${timestamp}: ${log.message}`;
              }

              logOverlay.insertBefore(logEntry, logOverlay.firstChild);

              // Keep only last 100 log entries to avoid performance issues
              while (logOverlay.children.length > 100) {
                logOverlay.removeChild(logOverlay.lastChild);
              }
            } catch (error) {
              console.error("Error adding log entry:", error);
            }
          }
        }
      }

      lastLogIndex = data.logs.length;
    }
  } catch (error) {
    console.error("Error polling solver logs:", error);
  }
};
