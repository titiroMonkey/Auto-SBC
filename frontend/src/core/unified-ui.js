// Unified UI Wrapper System - Consolidates all overlays into one stacked container

// Add animation styles to document
const addUnifiedUIStyles = () => {
  const styleId = "auto-sbc-unified-ui-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-100%);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .auto-sbc-unified-ui-wrapper {
      position: fixed;
      bottom: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.5rem;
      max-height: 90vh;
      overflow-y: auto;
      z-index: 9998;
      pointer-events: none;
    }

    .auto-sbc-unified-ui-panel {
      animation: slideDown 0.3s ease-out forwards;
      pointer-events: auto;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.45);
    }
  `;
  document.head.appendChild(style);
};

// Global state for unified UI
let unifiedUIContainer = null;
const registeredPanels = new Map(); // Maps panel ID to { element, order }

const getUnifiedUIContainer = () => {
  if (!unifiedUIContainer) {
    addUnifiedUIStyles();
    unifiedUIContainer = document.createElement("div");
    unifiedUIContainer.className = "auto-sbc-unified-ui-wrapper";
    unifiedUIContainer.id = "auto-sbc-unified-ui-wrapper";
    document.body.appendChild(unifiedUIContainer);
  }
  return unifiedUIContainer;
};

// Register a panel in the unified UI
const registerUnifiedUIPanel = (panelId, element, order = 100) => {
  const container = getUnifiedUIContainer();

  // Remove if already exists
  if (registeredPanels.has(panelId)) {
    const existing = registeredPanels.get(panelId);
    if (existing.element.parentNode === container) {
      container.removeChild(existing.element);
    }
  }

  // Add panel class if not present
  if (!element.classList.contains("auto-sbc-unified-ui-panel")) {
    element.classList.add("auto-sbc-unified-ui-panel");
  }

  registeredPanels.set(panelId, { element, order });

  // Re-sort and append all panels
  const sortedPanels = Array.from(registeredPanels.values()).sort(
    (a, b) => a.order - b.order,
  );

  // Clear and re-add in order
  container.innerHTML = "";
  sortedPanels.forEach(({ element }) => {
    container.appendChild(element);
  });
};

// Unregister a panel from the unified UI
const unregisterUnifiedUIPanel = (panelId) => {
  const container = getUnifiedUIContainer();
  if (registeredPanels.has(panelId)) {
    const { element } = registeredPanels.get(panelId);
    if (element.parentNode === container) {
      container.removeChild(element);
    }
    registeredPanels.delete(panelId);
  }
};

// Show/hide a panel in the unified UI
const showUnifiedUIPanel = (panelId) => {
  if (registeredPanels.has(panelId)) {
    registeredPanels.get(panelId).element.style.display = "";
  }
};

const hideUnifiedUIPanel = (panelId) => {
  if (registeredPanels.has(panelId)) {
    registeredPanels.get(panelId).element.style.display = "none";
  }
};

// Update panel order
const updateUnifiedUIPanelOrder = (panelId, order) => {
  if (registeredPanels.has(panelId)) {
    const panel = registeredPanels.get(panelId);
    panel.order = order;

    // Re-sort and append all panels
    const sortedPanels = Array.from(registeredPanels.values()).sort(
      (a, b) => a.order - b.order,
    );

    const container = getUnifiedUIContainer();
    container.innerHTML = "";
    sortedPanels.forEach(({ element }) => {
      container.appendChild(element);
    });
  }
};

// Check if any panels are registered
const hasUnifiedUIPanels = () => {
  return registeredPanels.size > 0;
};

// Clear all panels
const clearAllUnifiedUIPanels = () => {
  const container = getUnifiedUIContainer();
  container.innerHTML = "";
  registeredPanels.clear();
};
