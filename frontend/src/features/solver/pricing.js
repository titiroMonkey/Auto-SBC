let getSBCPrice = (item, sbcId = 0, challengeId = 0) => {
  if (isItemFixed(item)) {
    return 1;
  }

  // Extinct items have no market listings, so there is no real price to use.
  // Fall back to the EA-imposed maximum auction limit (_itemPriceLimits.maximum)
  // as the worst-case base price for SBC valuation. The limit may live on the
  // live item, or be persisted on the price entry for items the solver rebuilt.
  const priceEntry = getPriceItems()?.[item.definitionId];
  const isExtinct = priceEntry?.isExtinct;
  const extinctMaxLimit = Number(
    item?._itemPriceLimits?.maximum ?? priceEntry?.priceLimitMax,
  );

  let sbcPrice = Math.max(
    isExtinct && Number.isFinite(extinctMaxLimit)
      ? extinctMaxLimit
      : getPrice(item),
    getPrice({ definitionId: item.rating + "_CBR" }),
    100,
  );

  if (!isExtinct && getPrice(item) == -1) {
    return sbcPrice * 1.5;
  }

  if (item.concept) {
    return getSettings(0, 0, "conceptPremium") * sbcPrice;
  }
  if (
    (
      (item.isSpecial()
        ? ""
        : services.Localization.localize(
            "search.cardLevels.cardLevel" + item.getTier(),
          ) + " ") +
      services.Localization.localize("item.raretype" + item.rareflag)
    ).includes("volution")
  ) {
    return getSettings(0, 0, "evoPremium") * sbcPrice;
  }
  sbcPrice = sbcPrice - (100 - item.rating); //Rating Discount

  sbcPrice =
    sbcPrice *
    (item.duplicateId > 0
      ? getSettings(sbcId, challengeId, "duplicateDiscount") / 100
      : 1); // Dupe Discount

  sbcPrice =
    sbcPrice *
    (item?.isStorage
      ? getSettings(sbcId, challengeId, "duplicateDiscount") / 100
      : 1);
  sbcPrice =
    sbcPrice *
    (!item.isTradeable()
      ? getSettings(sbcId, challengeId, "untradeableDiscount") / 100
      : 1);

  return sbcPrice;
};
