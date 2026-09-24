let count;

function pad(n, width, z) {
  z = z || "0";
  n = n + "";
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function countDown() {
  count = Math.max(0, count - 1);
  // Only update counter if it exists
  if (
    typeof counter !== "undefined" &&
    counter !== null &&
    typeof counter.count === "function"
  ) {
    try {
      counter.count(pad(count, 4));
    } catch (error) {
      console.warn("Error updating counter display:", error);
    }
  }
}
var counter;
let failedChallenges;
let countDownInterval;
let logPollInterval;
let createSbc = true;
let activeSolveRunToken = 0;
let activeSolveContext = null;
let lastAppliedInterimSolution = 0;
let lastInterimSquadApplyAt = 0;

const cancelActiveSolveRun = () => {
  activeSolveRunToken += 1;
  createSbc = false;
  createSbcGrind = false;
  activeSolveContext = null;
  lastAppliedInterimSolution = 0;
  lastInterimSquadApplyAt = 0;
  window.__autoSbcHoldLoaderUntilFinal = false;
  window.__autoSbcSolveStatus = null;
  window.__autoSbcSolveRunInBackground = false;
  if (typeof refreshSbcSquadPriceBanners === "function") {
    refreshSbcSquadPriceBanners();
  }
  clearInterval(countDownInterval);
  clearInterval(logPollInterval);
  hideLoader();
};

const isSolveRunActive = (solveRunToken) =>
  solveRunToken === activeSolveRunToken && createSbc === true;

const throwIfSolveRunCancelled = (solveRunToken) => {
  if (!isSolveRunActive(solveRunToken)) {
    const error = new Error("Solve run cancelled");
    error.name = "SolveRunCancelled";
    throw error;
  }
};

// Expose state checkers globally for loader guard
window.__autoSbcIsSolveRunActive = () => isSolveRunActive(activeSolveRunToken);
window.__autoSbcActiveSolveContext = () => activeSolveContext;

let concepts = false;
