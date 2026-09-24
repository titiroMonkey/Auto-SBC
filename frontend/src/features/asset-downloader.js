// Asset Downloader — downloads player, card, and pack assets to backend storage
// Runs once per session during init, fetches images from the EA CDN and posts
// them as base64 to the backend /save-asset endpoint for local caching.

const assetDownloaderState = { running: false, done: false };

const downloadAssetToBackend = async (url, folder, filename) => {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return false;
    const blob = await resp.blob();
    const b64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });
    await fetch(apiUrl + "/save-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder, filename, data: b64 }),
    });
    return true;
  } catch {
    return false;
  }
};

const downloadAllAssets = async () => {
  if (assetDownloaderState.done || assetDownloaderState.running) return;
  assetDownloaderState.running = true;

  console.log("[Asset Downloader] Starting asset download...");
  let downloaded = 0;
  let skipped = 0;

  // --- Player Portraits ---
  try {
    const players = repositories.Player?._collection || {};
    const playerIds = Object.keys(players).slice(0, 200); // limit batch
    for (const id of playerIds) {
      const player = players[id];
      if (!player) continue;
      const baseId = player.baseId || player.id || id;
      const portraitUrl = AssetLocationUtils.getPortraitUri(player);
      if (portraitUrl) {
        const ok = await downloadAssetToBackend(
          portraitUrl,
          "portraits",
          `${baseId}.png`,
        );
        if (ok) downloaded++;
        else skipped++;
      }
    }
  } catch (e) {
    console.warn("[Asset Downloader] Player portraits error:", e);
  }

  // --- Card Shells (by rarity) ---
  try {
    const rarities = repositories.Rarity?._collection || {};
    for (const [rfId, rarity] of Object.entries(rarities)) {
      if (!rarity) continue;
      for (const tier of [0, 1, 2, 3]) {
        const shellUrl = AssetLocationUtils.getShellUri(
          0,
          1,
          Number(rfId),
          tier,
          rarity.guid,
        );
        if (shellUrl) {
          const ok = await downloadAssetToBackend(
            shellUrl,
            "shells",
            `shell_${rfId}_${tier}.png`,
          );
          if (ok) downloaded++;
          else skipped++;
        }
      }
    }
  } catch (e) {
    console.warn("[Asset Downloader] Card shells error:", e);
  }

  // --- Nation Flags ---
  try {
    const nations = repositories.Nation?._collection || {};
    for (const [nId] of Object.entries(nations)) {
      const flagUrl = AssetLocationUtils.getFlagImageUri(Number(nId));
      if (flagUrl) {
        const ok = await downloadAssetToBackend(
          flagUrl,
          "flags",
          `${nId}.png`,
        );
        if (ok) downloaded++;
        else skipped++;
      }
    }
  } catch (e) {
    console.warn("[Asset Downloader] Flags error:", e);
  }

  // --- League Badges ---
  try {
    const leagues = repositories.League?._collection || {};
    for (const [lId] of Object.entries(leagues)) {
      const leagueUrl = AssetLocationUtils.getLeagueImageUri(Number(lId));
      if (leagueUrl) {
        const ok = await downloadAssetToBackend(
          leagueUrl,
          "leagues",
          `${lId}.png`,
        );
        if (ok) downloaded++;
        else skipped++;
      }
    }
  } catch (e) {
    console.warn("[Asset Downloader] Leagues error:", e);
  }

  // --- Club Badges ---
  try {
    const clubs = repositories.Club?._collection || {};
    const clubIds = Object.keys(clubs).slice(0, 200);
    for (const cId of clubIds) {
      const badgeUrl = AssetLocationUtils.getBadgeImageUri(Number(cId));
      if (badgeUrl) {
        const ok = await downloadAssetToBackend(
          badgeUrl,
          "badges",
          `${cId}.png`,
        );
        if (ok) downloaded++;
        else skipped++;
      }
    }
  } catch (e) {
    console.warn("[Asset Downloader] Club badges error:", e);
  }

  // --- Pack Images ---
  try {
    const packImages = document.querySelectorAll(
      ".ut-store-pack-details-view img, .ut-pack-item img",
    );
    let packIdx = 0;
    for (const img of packImages) {
      if (img.src && img.src.startsWith("http")) {
        const ext = img.src.split(".").pop().split("?")[0] || "png";
        const ok = await downloadAssetToBackend(
          img.src,
          "packs",
          `pack_${packIdx++}.${ext}`,
        );
        if (ok) downloaded++;
        else skipped++;
      }
    }
  } catch (e) {
    console.warn("[Asset Downloader] Pack images error:", e);
  }

  assetDownloaderState.done = true;
  assetDownloaderState.running = false;
  console.log(
    `[Asset Downloader] Complete. Downloaded: ${downloaded}, Skipped/Failed: ${skipped}`,
  );
};
