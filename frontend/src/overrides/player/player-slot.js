const playerSlotOverride = () => {
  const pitchProto = globalThis.UTSquadPitchView?.prototype;
  if (!pitchProto || pitchProto.__autoSbcSlotPricePatched) {
    return;
  }

  const playerSlot = pitchProto.setSlots;

  pitchProto.setSlots = async function (...args) {
    const result = playerSlot.call(this, ...args);
    // Cache the slot entities on the pitch view for recalc in updateSlot
    this.__autoSbcSlotEntities = args[0];
    const squadSlots = buildSquadSlotsFromEntities(args[0], this.getSlotViews());
    appendSlotPrice(squadSlots);
    return result;
  };

  const baseUpdateSlot = pitchProto.updateSlot;

  pitchProto.updateSlot = function (...args) {
    const result = baseUpdateSlot.apply(this, args);
    // args[0] is the updated UTSquadSlotEntity — update cached entry
    const slotData = args[0];
    if (this.__autoSbcSlotEntities && slotData) {
      const idx = this.__autoSbcSlotEntities.findIndex(
        (e) => e.index === slotData.index,
      );
      if (idx >= 0) {
        this.__autoSbcSlotEntities[idx] = slotData;
      }
    }
    const squadSlots = buildSquadSlotsFromEntities(
      this.__autoSbcSlotEntities,
      this.getSlotViews(),
    );
    appendSlotPrice(squadSlots);
    return result;
  };

  pitchProto.__autoSbcSlotPricePatched = true;
};

const buildSquadSlotsFromEntities = (slotEntities, slotViews) => {
  const result = [];
  if (!slotEntities || !slotViews) return result;
  for (const entity of slotEntities) {
    if (!entity?._item || entity._item.definitionId <= 0) continue;
    const sv = slotViews.find((s) => s.getIndex() === entity.index);
    if (sv) {
      result.push({ item: entity._item, rootElement: sv.getRootElement() });
    }
  }
  return result;
};

const appendSlotPrice = async (squadSlots) => {
  if (!squadSlots.length) {
    appendSquadTotal(0);
    return;
  }

  const players = [];
  for (const { item } of squadSlots) {
    players.push(item);
  }

  await fetchPlayerPrices(players);
  let total = 0;
  const duplicateIds = await fetchDuplicateIds();
  getPriceItems();
  for (const { rootElement, item } of squadSlots) {
    if (duplicateIds.includes(item.id)) {
      rootElement.style.opacity = "0.4";
    }

    appendPriceToSlot(rootElement, item);
    total += getPrice(item);
  }

  appendSquadTotal(total);
};

const appendSquadTotal = (total) => {
  window.__autoSbcSquadPriceTotal = Number.isFinite(total) ? total : 0;
  if (typeof refreshSbcSquadPriceBanners === "function") {
    refreshSbcSquadPriceBanners();
  }
};

const appendPriceToSlot = async (rootElement, item) => {
  let priceElement = await getPriceDiv(item);
  if (priceElement) {
    const existing = rootElement.querySelector(":scope > .item-price");
    if (existing) existing.remove();
    rootElement.prepend(priceElement);
  }
};

const getUserPlatform = () => {
  if (services.User.getUser().getSelectedPersona().isPC) {
    return "pc";
  }
  return "ps";
};
