let fetchUnassigned = () => {
  repositories.Item.unassigned.clear();
  repositories.Item.unassigned.reset();

  return new Promise((resolve) => {
    let result = [];
    services.Item.requestUnassignedItems().observe(
      undefined,
      async (sender, response) => {
        result = [...response.response.items];
        fetchPlayerPrices(result, {
          waitForCompletion: false,
          suppressNotification: true,
        });

        // Update the recent-special strip immediately when unassigned items are
        // fetched (don't wait for processUnassigned to run).
        if (typeof window.recordRecentPackedSpecials === "function") {
          window.recordRecentPackedSpecials(result);
        }

        // Detect any newly received Collection Book players (packs land here
        // before they reach the club).
        if (typeof collectionBookScanItems === "function") {
          collectionBookScanItems(result);
        }

        // Persist ownership (definitionId + entity id) so duplicates in the
        // unassigned pile increment the Collection Book counter.
        if (typeof collectionBookRecordOwnership === "function") {
          collectionBookRecordOwnership(result);
        }

        resolve(result);
      },
    );
  });
};

let fetchTransferList = () => {
  return new Promise((resolve) => {
    let result = [];
    services.Item.requestTransferItems().observe(
      undefined,
      async (sender, response) => {
        result = [...response.response.items];

        resolve(result);
      },
    );
  });
};

let clearSoldItems = () => {
  return new Promise((resolve) => {
    services.Item.clearSoldItems().observe(undefined, (sender, response) => {
      resolve(response);
    });
  });
};
let fetchDuplicateIds = () => {
  return new Promise((resolve) => {
    const result = [];
    repositories.Store.setDirty();
    services.Item.requestUnassignedItems().observe(
      undefined,
      (sender, response) => {
        const isChemistryStyleOrManagerLeague = (item) => {
          // Use SearchType for exact classification instead of name matching
          if (typeof item?.getSearchType === "function") {
            const searchType = String(item.getSearchType() || "").toUpperCase();
            // Filter out chemistry styles and manager consumables
            return searchType.includes("CHEMISTRY") || searchType.includes("MANAGER");
          }
          
          // Fallback to name-based detection if getSearchType unavailable
          const name = String(
            item?._staticData?.name || item?.name || "",
          ).toLowerCase();
          return (
            name.includes("chemistry style") ||
            name.includes("manager league") ||
            name.includes("league manager")
          );
        };

        const duplicates = [
           ...response.response.items.filter(
            (item) =>
              item.duplicateId > 0 &&
              !isChemistryStyleOrManagerLeague(item),
           ),
        ];
        result.push(...duplicates.map((duplicate) => duplicate.duplicateId));

        resolve(result);
      },
    );
  });
};
