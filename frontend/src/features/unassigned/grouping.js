const getUnassignedActionGroups = () => {
  if (Array.isArray(window.UNASSIGNED_GROUPS)) {
    return window.UNASSIGNED_GROUPS;
  }
  return [
    { id: "sendToClub", label: "Send to club" },
    { id: "sendToTransferList", label: "Send to transfer list" },
    { id: "quickSell", label: "Quick sell" },
    { id: "listOnTransferMarket", label: "List on transfer market" },
    { id: "sendToStorage", label: "Send to storage" },
  ];
};

const getUnassignedActionLabels = () => {
  const groups = getUnassignedActionGroups();
  const map = new Map(groups.map((g) => [g.id, g.label]));
  map.set("doNothing", "No Rule Match");
  map.set("freeItems", "Free Items");
  return map;
};

const getUnassignedActionOrder = () => {
  const groups = getUnassignedActionGroups().map((g) => g.id);
  return ["freeItems", ...groups, "doNothing"];
};

const groupUnassignedItemsByRules = (items, rules, options = {}) => {
  const {
    includeFreeItems = true,
    includeDoNothing = true,
    matcherOptions = {},
  } = options;
  const normalizedRules = Array.isArray(rules) ? rules : [];
  const order = getUnassignedActionOrder();
  const labelMap = getUnassignedActionLabels();
  const buckets = new Map(order.map((action) => [action, []]));
  const matchesByRule = new Map();

  const addEntry = (action, item, rule, ruleIndex) => {
    if (!buckets.has(action)) {
      buckets.set(action, []);
    }
    const entry = { item, rule, ruleIndex };
    buckets.get(action).push(entry);

    if (ruleIndex != null && ruleIndex >= 0) {
      if (!matchesByRule.has(ruleIndex)) {
        matchesByRule.set(ruleIndex, []);
      }
      matchesByRule.get(ruleIndex).push(entry);
    }
  };

  (items || []).forEach((item) => {
    if (!item) return;

    if (item?.isFreeCoins?.() || item?.isFreePack?.()) {
      if (includeFreeItems) {
        addEntry("freeItems", item, null, -1);
      }
      return;
    }

    let matched = false;
    for (let i = 0; i < normalizedRules.length; i += 1) {
      const rule = normalizedRules[i];
      if (rule?.enabled === false) continue;
      if (matchesUnassignedRule(item, rule, matcherOptions)) {
        addEntry(rule.action || "sendToClub", item, rule, i);
        matched = true;
        break;
      }
    }

    if (!matched && includeDoNothing) {
      addEntry("doNothing", item, null, -1);
    }
  });

  const sections = order
    .map((action) => {
      const entries = buckets.get(action) || [];
      const groupedItems = entries.map((entry) => entry.item).filter(Boolean);
      return {
        action,
        label: labelMap.get(action) || action,
        entries,
        items: groupedItems,
      };
    })
    .filter((section) => section.items.length > 0);

  return {
    order,
    labelMap,
    buckets,
    matchesByRule,
    sections,
  };
};
