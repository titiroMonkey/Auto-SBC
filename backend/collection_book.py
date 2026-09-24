"""fut.gg Collection Book scraper + cache.

Fetches the list of fut.gg collections and the players that belong to each one,
then stores a compact cache to ``backend/collections.json``. The frontend loads
this cache and uses the club as the source of truth for what has been collected.

Public API (used by main.py):
    read_collections_cache() -> dict
    refresh_collections(force=False) -> dict
"""

import json
import logging
import time
from pathlib import Path

import requests

# EA FC game year used by fut.gg asset/API paths (mirrors FUTGG_GAME_YEAR in the
# frontend pricing module).
GAME_YEAR = 27

FUTGG_ORIGIN = "https://www.fut.gg"
COLLECTIONS_LIST_URL = f"{FUTGG_ORIGIN}/api/fut/collections/{GAME_YEAR}/"
COLLECTION_PLAYERS_URL = (
    f"{FUTGG_ORIGIN}/api/fut/collections/{GAME_YEAR}/{{slug}}/players/"
)

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Referer": f"{FUTGG_ORIGIN}/collections/",
}

REQUEST_TIMEOUT = 25
# Polite delay between requests so we do not hammer fut.gg.
REQUEST_DELAY_SECONDS = 0.35
# Consider the cache fresh for this long; refresh() skips network work when the
# cache is younger than this unless force=True.
CACHE_TTL_SECONDS = 6 * 60 * 60


def get_collections_file_path() -> Path:
    """Path to the collections cache file in the backend directory."""
    return Path(__file__).resolve().parent / "collections.json"


def read_collections_cache() -> dict:
    """Read the cache file, returning a default structure if absent/invalid."""
    cache_file = get_collections_file_path()
    if cache_file.exists():
        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception as e:
            logging.error(f"[collections] Failed to read cache: {e}")
    return {"updatedAt": 0, "gameYear": GAME_YEAR, "collections": []}


def _write_collections_cache(data: dict) -> bool:
    try:
        cache_file = get_collections_file_path()
        cache_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return True
    except Exception as e:
        logging.error(f"[collections] Failed to write cache: {e}")
        return False


def _get_json(url: str, params: dict) -> dict | None:
    try:
        resp = requests.get(
            url, params=params, headers=REQUEST_HEADERS, timeout=REQUEST_TIMEOUT
        )
        if resp.status_code != 200:
            logging.warning(f"[collections] {url} -> HTTP {resp.status_code}")
            return None
        return resp.json()
    except Exception as e:
        logging.warning(f"[collections] request failed {url}: {e}")
        return None


def _fetch_collection_list() -> list[dict]:
    """Return every collection with its metadata + full eaId list."""
    collections: list[dict] = []
    page = 1
    total_pages = 1
    while page <= total_pages:
        payload = _get_json(COLLECTIONS_LIST_URL, {"page": page, "page_size": 20})
        if not payload:
            break
        total_pages = int(payload.get("totalPages") or 1)
        for item in payload.get("data") or []:
            slug = item.get("slug")
            if not slug:
                continue
            collections.append(
                {
                    "id": item.get("id"),
                    "name": item.get("name") or slug,
                    "slug": slug,
                    "description": item.get("description") or "",
                    "allPlayerItemEaIds": [
                        int(x)
                        for x in (item.get("allPlayerItemEaIds") or [])
                        if x is not None
                    ],
                    "highlightedPlayerItemEaIds": [
                        int(x)
                        for x in (item.get("highlightedPlayerItemEaIds") or [])
                        if x is not None
                    ],
                }
            )
        page += 1
        time.sleep(REQUEST_DELAY_SECONDS)
    return collections


def _slim_player(p: dict) -> dict:
    """Keep only the fields the frontend needs to render a card."""
    name = (
        p.get("cardName")
        or p.get("nickname")
        or (
            f"{p.get('firstName') or ''} {p.get('lastName') or ''}".strip()
        )
        or str(p.get("eaId"))
    )
    return {
        "eaId": int(p.get("eaId")) if p.get("eaId") is not None else None,
        "name": name,
        "overall": p.get("overall"),
        "position": p.get("position"),
        "positionId": p.get("positionId"),
        "rarityEaId": p.get("rarityEaId"),
        "rarityName": p.get("rarityName"),
        "isIcon": bool(p.get("isIcon")),
        "isHero": bool(p.get("isHero")),
        "clubEaId": p.get("uniqueClubEaId"),
        "nationEaId": (p.get("nation") or {}).get("eaId"),
        "leagueEaId": (p.get("league") or {}).get("eaId"),
        "cardImageUrl": p.get("cardImageUrl"),
    }


def _fetch_collection_players(slug: str) -> list[dict]:
    """Return slimmed player metadata for one collection (all pages)."""
    players: list[dict] = []
    page = 1
    total_pages = 1
    while page <= total_pages:
        payload = _get_json(
            COLLECTION_PLAYERS_URL.format(slug=slug), {"page": page}
        )
        if not payload:
            break
        total_pages = int(payload.get("totalPages") or 1)
        for p in payload.get("data") or []:
            slim = _slim_player(p)
            if slim.get("eaId") is not None:
                players.append(slim)
        page += 1
        time.sleep(REQUEST_DELAY_SECONDS)
    return players


def refresh_collections(force: bool = False) -> dict:
    """Scrape fut.gg and rebuild the cache.

    When ``force`` is False and the existing cache is still within its TTL, the
    network scrape is skipped and the current cache is returned unchanged. New
    collections/players discovered on the site are merged in on every refresh.
    """
    existing = read_collections_cache()
    age = time.time() - float(existing.get("updatedAt") or 0)
    if not force and existing.get("collections") and age < CACHE_TTL_SECONDS:
        logging.info(
            f"[collections] cache fresh ({int(age)}s old); skipping refresh"
        )
        return existing

    logging.info("[collections] refreshing from fut.gg…")
    meta_list = _fetch_collection_list()
    if not meta_list:
        logging.warning("[collections] no collections fetched; keeping old cache")
        return existing

    # Index existing collections by slug so we can preserve player metadata when
    # a per-collection player fetch fails.
    prev_by_slug = {
        c.get("slug"): c for c in existing.get("collections") or [] if c.get("slug")
    }

    collections: list[dict] = []
    for meta in meta_list:
        slug = meta["slug"]
        players = _fetch_collection_players(slug)
        if not players and slug in prev_by_slug:
            # Fall back to previously cached players to avoid data loss.
            players = prev_by_slug[slug].get("players") or []
        # Ensure every eaId from the list endpoint is represented even if the
        # players endpoint omitted it (rare); create a minimal stub.
        by_ea = {p["eaId"]: p for p in players if p.get("eaId") is not None}
        for ea_id in meta.get("allPlayerItemEaIds") or []:
            if ea_id not in by_ea:
                by_ea[ea_id] = {"eaId": ea_id, "name": str(ea_id)}
        ordered = [
            by_ea[ea]
            for ea in (meta.get("allPlayerItemEaIds") or [])
            if ea in by_ea
        ]
        # Append any players the list endpoint did not include (edge case).
        for ea, p in by_ea.items():
            if ea not in (meta.get("allPlayerItemEaIds") or []):
                ordered.append(p)

        collections.append(
            {
                "id": meta.get("id"),
                "name": meta.get("name"),
                "slug": slug,
                "description": meta.get("description"),
                "total": len(ordered),
                "highlightedPlayerItemEaIds": meta.get(
                    "highlightedPlayerItemEaIds"
                )
                or [],
                "players": ordered,
            }
        )
        logging.info(
            f"[collections] {meta.get('name')}: {len(ordered)} players"
        )

    data = {
        "updatedAt": int(time.time()),
        "gameYear": GAME_YEAR,
        "collections": collections,
    }
    _write_collections_cache(data)
    logging.info(
        f"[collections] cached {len(collections)} collections"
    )
    return data
