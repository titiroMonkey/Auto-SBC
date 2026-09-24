// ============================================================================
// Vendored: PlayStyle Evo Helper — FC26  (v2.1.2)
// Source:  https://github.com/nezygis/fc26-playstyle-evo-helper
// License: MIT © nezygis (attribution retained per license).
// Integrated into Auto-SBC as a self-contained module. Self-boots on load;
// uses only EA `window` service/repository objects + localStorage (no @grant,
// no Auto-SBC globals). UserScript metadata header stripped (bundle has its own).
// ============================================================================

/*
 * PlayStyle Evo Helper — batch-apply PlayStyle / PlayStyle+ evolutions to one player.
 *
 * Install: Tampermonkey → new script → paste this file → save. Open the EA FC 26
 * web app, go to the Evolutions (Academy) hub. A floating panel appears.
 * Usage: search a player (search defaults to evo-eligible rarities), pick a
 * Position+Role and hit ✨ Suggest (or tick evos by hand), then Apply selected.
 *
 * ⚠ Automating the FC web app is against EA's Terms of Service and can get your
 * account banned. Use at your own risk.
 *
 * How it works: drives the web app's OWN service objects (state-safe), not raw HTTP.
 *   services.Academy.addItemToSlot(slotId, itemId)  -> apply an evo
 *   services.Academy.claimSlot(slotId)              -> claim/finish it
 *   repositories.Item.getClub().items               -> club players
 * PlayStyle traitId = rewardId - 301. Caps: 5 PS+ / 8 basic per player.
 * Console helpers on window.FCEvo: scrapeRarities(), clubRaritiesDump(),
 * eligibleRarities(slotId).
 */
(function () {
  "use strict";

  const CAP_PLUS = 5, CAP_BASIC = 8, TRAIT_OFFSET = 301; // traitId = rewardId - 301 (icon classes run 0..35)
  // Glory Hunters cards (Festival of Football rarity 109, or 104 "Red") can hold a
  // 4th PS+ via account-specific reward evos — everyone else caps at 3.
  const GH_RARITIES = new Set([104, 109]);
  const isGH = (it) => { try { return !!it && GH_RARITIES.has(it.rareflag); } catch (_) { return false; } };
  const capPlus = (_it) => CAP_PLUS;

  // Catalog: n=name, s=slotId, r=rewardId(=traitId+301), g=gk-only
  const PS = [{"n":"Finesse Shot","s":2141,"r":301,"g":0},{"n":"Far Throw","s":2142,"r":331,"g":1},{"n":"Enforcer","s":2143,"r":330,"g":0},{"n":"Intercept","s":2144,"r":317,"g":0},{"n":"Whipped Pass","s":2145,"r":313,"g":0},{"n":"Long Ball Pass","s":2146,"r":311,"g":0},{"n":"Incisive Pass","s":2147,"r":309,"g":0},{"n":"Deflector","s":2148,"r":336,"g":1},{"n":"Quick Step","s":2149,"r":326,"g":0},{"n":"Trickster","s":2150,"r":324,"g":0},{"n":"Slide Tackle","s":2151,"r":319,"g":0},{"n":"Aerial Fortress","s":2152,"r":320,"g":0},{"n":"Tiki Taka","s":2153,"r":312,"g":0},{"n":"Gamechanger","s":2154,"r":308,"g":0},{"n":"Chip Shot","s":2155,"r":302,"g":0},{"n":"Cross Claimer","s":2156,"r":333,"g":1},{"n":"Bruiser","s":2157,"r":329,"g":0},{"n":"Precision Header","s":2158,"r":305,"g":0},{"n":"Acrobatic","s":2159,"r":306,"g":0},{"n":"Long Throw","s":2160,"r":328,"g":0},{"n":"Press Proven","s":2161,"r":325,"g":0},{"n":"Block","s":2162,"r":316,"g":0},{"n":"Pinged Pass","s":2163,"r":310,"g":0},{"n":"Inventive","s":2164,"r":314,"g":0},{"n":"Power Shot","s":2165,"r":303,"g":0},{"n":"1v1 Close Down","s":2166,"r":334,"g":1},{"n":"Relentless","s":2167,"r":327,"g":0},{"n":"Rapid","s":2168,"r":322,"g":0},{"n":"Jockey","s":2169,"r":315,"g":0},{"n":"Anticipate","s":2170,"r":318,"g":0},{"n":"Low Driven Shot","s":2171,"r":307,"g":0},{"n":"Dead Ball","s":2172,"r":304,"g":0},{"n":"Far Reach","s":2173,"r":335,"g":1},{"n":"Footwork","s":2174,"r":332,"g":1},{"n":"Technical","s":2175,"r":321,"g":0},{"n":"First Touch","s":2176,"r":323,"g":0}];
  const PSP = [{"n":"Far Reach+","s":2181,"r":335,"g":1},{"n":"Technical+","s":2184,"r":321,"g":0},{"n":"Intercept+","s":2185,"r":317,"g":0},{"n":"Tiki Taka+","s":2186,"r":312,"g":0},{"n":"Low Driven Shot+","s":2187,"r":307,"g":0},{"n":"Footwork+","s":2188,"r":332,"g":1},{"n":"Jockey+","s":2191,"r":315,"g":0},{"n":"Anticipate+","s":2196,"r":318,"g":0},{"n":"Finesse Shot+","s":2200,"r":301,"g":0},{"n":"Incisive Pass+","s":2203,"r":309,"g":0},{"n":"Quick Step+","s":2210,"r":326,"g":0},{"n":"Rapid+","s":2211,"r":322,"g":0},{"n":"Pinged Pass+","s":2213,"r":310,"g":0},{"n":"Bruiser+","s":2189,"r":329,"g":0},{"n":"Relentless+","s":2183,"r":327,"g":0},{"n":"Long Ball Pass+","s":2192,"r":311,"g":0},{"n":"Inventive+","s":2197,"r":314,"g":0},{"n":"Cross Claimer+","s":2198,"r":333,"g":1},{"n":"First Touch+","s":2201,"r":323,"g":0},{"n":"1v1 Close Down+","s":2204,"r":334,"g":1},{"n":"Trickster+","s":2206,"r":324,"g":0},{"n":"Press Proven+","s":2207,"r":325,"g":0},{"n":"Block+","s":2212,"r":316,"g":0},{"n":"Gamechanger+","s":2214,"r":308,"g":0},{"n":"Deflector+","s":2215,"r":336,"g":1},{"n":"Power Shot+","s":2216,"r":303,"g":0},{"n":"Enforcer+","s":2182,"r":330,"g":0},{"n":"Chip Shot+","s":2190,"r":302,"g":0},{"n":"Acrobatic+","s":2193,"r":306,"g":0},{"n":"Dead Ball+","s":2194,"r":304,"g":0},{"n":"Slide Tackle+","s":2195,"r":319,"g":0},{"n":"Long Throw+","s":2199,"r":328,"g":0},{"n":"Aerial Fortress+","s":2202,"r":320,"g":0},{"n":"Far Throw+","s":2205,"r":331,"g":1},{"n":"Whipped Pass+","s":2208,"r":313,"g":0},{"n":"Precision Header+","s":2209,"r":305,"g":0}];
  PS.forEach((x) => (x.kind = "PS"));
  PSP.forEach((x) => (x.kind = "PS+"));
  // Sort both grids into one shared order (alphabetical by base name) so every
  // playstyle sits in the same cell on the PlayStyle and PlayStyle+ tabs.
  const baseName = (x) => x.n.replace(/\+$/, "");
  const byBaseName = (a, b) => baseName(a).localeCompare(baseName(b));
  PS.sort(byBaseName);
  PSP.sort(byBaseName);
  const ALL = PS.concat(PSP);
  // Glory Hunters "4th PS+" reward evos: account-specific Academy slots (category 9,
  // slotName "GH 4th <PlayStyle>+"). Loaded live on demand — one-time consumables
  // with duplicates per playstyle, so the grid dedupes by playstyle.
  const GH = []; // {n, s(slotId), r(rewardId), kind:"PS+", g:0, gh:true}
  let ghLoaded = false, ghLoading = false, ghLoadPromise = null;
  // EA groups PlayStyles into these six categories in the in-game UI; the grid
  // mirrors that grouping (and order) so it matches the player's mental model.
  const CAT_ORDER = ["Finishing", "Passing", "Defending", "Ball Control", "Physical", "Goalkeeping"];
  const CAT_OF = {
    "Finesse Shot": "Finishing", "Chip Shot": "Finishing", "Power Shot": "Finishing", "Dead Ball": "Finishing",
    "Precision Header": "Finishing", "Acrobatic": "Finishing", "Low Driven Shot": "Finishing", "Gamechanger": "Finishing",
    "Incisive Pass": "Passing", "Pinged Pass": "Passing", "Long Ball Pass": "Passing", "Tiki Taka": "Passing",
    "Whipped Pass": "Passing", "Inventive": "Passing",
    "Jockey": "Defending", "Block": "Defending", "Intercept": "Defending", "Anticipate": "Defending",
    "Slide Tackle": "Defending", "Aerial Fortress": "Defending",
    "Technical": "Ball Control", "Rapid": "Ball Control", "First Touch": "Ball Control", "Trickster": "Ball Control", "Press Proven": "Ball Control",
    "Quick Step": "Physical", "Relentless": "Physical", "Long Throw": "Physical", "Bruiser": "Physical", "Enforcer": "Physical",
    "Far Throw": "Goalkeeping", "Footwork": "Goalkeeping", "Cross Claimer": "Goalkeeping", "1v1 Close Down": "Goalkeeping",
    "Far Reach": "Goalkeeping", "Deflector": "Goalkeeping",
  };
  const traitName = {}; // traitId -> display name (base name, no '+')
  PS.forEach((x) => (traitName[x.r - TRAIT_OFFSET] = x.n));

  // Recommended playstyles per position/role. Top 3 -> PS+, rest -> base.
  const ROLES = {"ST":{"Advanced Forward":["Finesse Shot","Low Driven Shot","Rapid","Incisive Pass","Gamechanger","Quick Step","Technical","Tiki Taka","First Touch","Press Proven","Enforcer"],"Target Forward":["Finesse Shot","Enforcer","Precision Header","Low Driven Shot","Incisive Pass","Rapid","First Touch","Gamechanger","Tiki Taka","Press Proven","Pinged Pass"],"Poacher":["Finesse Shot","Low Driven Shot","Rapid","Incisive Pass","First Touch","Gamechanger","Quick Step","Technical","Press Proven","Pinged Pass","Enforcer"],"False 9":["Finesse Shot","Incisive Pass","Low Driven Shot","Gamechanger","Rapid","Tiki Taka","Technical","Pinged Pass","Quick Step","Inventive","First Touch"]},"RW / LW":{"Inside Forward":["Finesse Shot","Low Driven Shot","Rapid","Quick Step","Technical","Gamechanger","Incisive Pass","Pinged Pass","Tiki Taka","First Touch","Inventive"],"Winger":["Rapid","Finesse Shot","Pinged Pass","Quick Step","Technical","Low Driven Shot","Gamechanger","Incisive Pass","Tiki Taka","First Touch","Inventive"],"Wide Playmaker":["Finesse Shot","Incisive Pass","Technical","Tiki Taka","Pinged Pass","Rapid","Low Driven Shot","Gamechanger","Press Proven","First Touch","Inventive"]},"CAM":{"Shadow Striker":["Finesse Shot","Incisive Pass","Rapid","Low Driven Shot","Technical","Quick Step","Tiki Taka","Gamechanger","First Touch","Pinged Pass","Inventive"],"Playmaker":["Finesse Shot","Incisive Pass","Low Driven Shot","Tiki Taka","Pinged Pass","Technical","Gamechanger","First Touch","Press Proven","Quick Step","Inventive"],"Classic 10":["Finesse Shot","Incisive Pass","Technical","Tiki Taka","Pinged Pass","Low Driven Shot","Gamechanger","First Touch","Press Proven","Quick Step","Inventive"],"Half Winger":["Incisive Pass","Rapid","Technical","Tiki Taka","Pinged Pass","Gamechanger","Quick Step","First Touch","Press Proven","Inventive","Low Driven Shot"]},"CM":{"Box to Box":["Incisive Pass","Pinged Pass","Intercept","Finesse Shot","Tiki Taka","Bruiser","Anticipate","Quick Step","Technical","Relentless","Press Proven"],"Playmaker":["Incisive Pass","Pinged Pass","Finesse Shot","Tiki Taka","Technical","Intercept","Low Driven Shot","Anticipate","First Touch","Quick Step","Inventive"],"Deep Lying Playmaker":["Intercept","Pinged Pass","Bruiser","Tiki Taka","Incisive Pass","Anticipate","Jockey","Quick Step","First Touch","Press Proven","Long Ball Pass"],"Holding":["Intercept","Pinged Pass","Bruiser","Tiki Taka","Anticipate","Jockey","Incisive Pass","Quick Step","First Touch","Press Proven","Long Ball Pass"],"Half Winger":["Pinged Pass","Intercept","Quick Step","Tiki Taka","Incisive Pass","Finesse Shot","Anticipate","Technical","Jockey","Bruiser","Rapid"]},"RM / LM":{"Inside Forward":["Finesse Shot","Low Driven Shot","Rapid","Quick Step","Technical","Gamechanger","Incisive Pass","Pinged Pass","Tiki Taka","First Touch","Inventive"],"Winger":["Rapid","Finesse Shot","Pinged Pass","Quick Step","Technical","Low Driven Shot","Gamechanger","Incisive Pass","Tiki Taka","First Touch","Inventive"],"Wide Playmaker":["Finesse Shot","Incisive Pass","Technical","Tiki Taka","Pinged Pass","Rapid","Low Driven Shot","Gamechanger","Press Proven","First Touch","Inventive"],"Wide Midfielder":["Rapid","Quick Step","Pinged Pass","Tiki Taka","Incisive Pass","Intercept","Anticipate","Relentless","Whipped Pass","Jockey","Press Proven"]},"CDM":{"Holding":["Intercept","Pinged Pass","Bruiser","Tiki Taka","Anticipate","Jockey","Incisive Pass","Quick Step","First Touch","Press Proven","Long Ball Pass"],"Deep Lying Playmaker":["Intercept","Pinged Pass","Bruiser","Tiki Taka","Incisive Pass","Anticipate","Jockey","Quick Step","First Touch","Press Proven","Long Ball Pass"],"Box Crasher":["Incisive Pass","Intercept","Pinged Pass","Finesse Shot","Tiki Taka","Quick Step","Bruiser","Anticipate","Technical","Press Proven","Relentless"],"Centre Half":["Intercept","Bruiser","Jockey","Anticipate","Quick Step","Block","Tiki Taka","Pinged Pass","Aerial Fortress","Slide Tackle","Long Ball Pass"],"Wide Half":["Bruiser","Intercept","Quick Step","Jockey","Anticipate","Incisive Pass","Block","Tiki Taka","Pinged Pass","Press Proven","Relentless"]},"RB / LB":{"Fullback":["Bruiser","Intercept","Quick Step","Jockey","Anticipate","Incisive Pass","Block","Tiki Taka","Pinged Pass","Press Proven","Relentless"],"Wingback":["Intercept","Pinged Pass","Quick Step","Anticipate","Bruiser","Tiki Taka","Jockey","Incisive Pass","Rapid","Relentless","Press Proven"],"Falseback":["Intercept","Pinged Pass","Anticipate","Jockey","Tiki Taka","Incisive Pass","Bruiser","Quick Step","First Touch","Press Proven","Long Ball Pass"],"Inverted Wingback":["Incisive Pass","Tiki Taka","Quick Step","Intercept","Anticipate","Rapid","Pinged Pass","Jockey","Press Proven","Relentless","Bruiser"],"Attacking Wingback":["Rapid","Quick Step","Pinged Pass","Tiki Taka","Incisive Pass","Intercept","Anticipate","Relentless","Jockey","First Touch","Bruiser"]},"CB":{"Defender":["Intercept","Bruiser","Anticipate","Jockey","Quick Step","Block","Pinged Pass","Aerial Fortress","Slide Tackle","Tiki Taka","Press Proven"],"Stopper":["Intercept","Bruiser","Anticipate","Jockey","Quick Step","Block","Slide Tackle","Tiki Taka","Pinged Pass","Relentless","Aerial Fortress"],"Wide Back":["Intercept","Anticipate","Quick Step","Jockey","Bruiser","Block","Pinged Pass","Aerial Fortress","Slide Tackle","Tiki Taka","Press Proven"],"Ball Playing Defender":["Intercept","Bruiser","Anticipate","Jockey","Quick Step","Block","Pinged Pass","Tiki Taka","First Touch","Press Proven","Aerial Fortress"]},"GK":{"Goalkeeper":["Far Reach","Footwork","1v1 Close Down","Deflector","Cross Claimer","Far Throw","Pinged Pass","Long Ball Pass","Tiki Taka","Press Proven","First Touch"],"Ball Playing":["Far Reach","Footwork","1v1 Close Down","Deflector","Cross Claimer","Pinged Pass","Far Throw","Long Ball Pass","Tiki Taka","Press Proven","First Touch"],"Sweeper Keeper":["Far Reach","Footwork","1v1 Close Down","Deflector","Cross Claimer","Pinged Pass","Far Throw","Long Ball Pass","Tiki Taka","Press Proven","First Touch"]}};
  const psByName = {}, pspByName = {};
  PS.forEach((x) => (psByName[x.n] = x));
  PSP.forEach((x) => (pspByName[x.n.replace(/\+$/, "")] = x)); // keyed by base name

  // ==========================================================================
  // getSubAttributes() returns [{type, rating}]; this type->key map was confirmed
  // by matching every value against the in-game Attributes panel (all 34 line up).
  // Used by the readAttrs() console diagnostic (FCEvo.dumpEntity()).
  const SUB_ATTR = {
    0: "acceleration", 1: "sprintspeed", 2: "agility", 3: "balance", 4: "jumping", 5: "stamina",
    6: "strength", 7: "reactions", 8: "aggression", 9: "composure", 10: "interceptions",
    11: "positioning", 12: "vision", 13: "ballcontrol", 14: "crossing", 15: "dribbling",
    16: "finishing", 17: "fkaccuracy", 18: "heading", 19: "longpassing", 20: "shortpassing",
    21: "defaware", 22: "shotpower", 23: "longshots", 24: "standtackle", 25: "slidetackle",
    26: "volleys", 27: "curve", 28: "penalties",
    29: "gkdiving", 30: "gkhandling", 31: "gkkicking", 32: "gkreflexes", 33: "gkpositioning",
  };
  const FACE_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"];
  // Read a card's attributes as normalized 0..1 values. Prefers the fine-grained
  // sub-attributes (getSubAttributes); falls back to the 6 face stats, then to none
  // (scoring then uses role consensus only). _coverage reflects what resolved.
  function readAttrs(it) {
    const out = {}, norm = (v) => Math.max(0, Math.min(1, v / 99));
    let subFound = 0;
    try {
      const subs = it && it.getSubAttributes && it.getSubAttributes();
      if (Array.isArray(subs)) subs.forEach((s) => {
        const k = SUB_ATTR[s && s.type];
        if (k && s.rating > 0) { out[k] = norm(s.rating); subFound++; }
      });
    } catch (_) {}
    let faceFound = 0, face = null;
    try { face = it && it.getAttributes && it.getAttributes(); } catch (_) {}
    if (!(face && face.length >= 6)) { try { face = it && it.attributes; } catch (_) {} }
    if (face && face.length >= 6) FACE_KEYS.forEach((k, i) => { const v = +face[i]; if (v > 0) { out[k] = norm(v); faceFound++; } });
    out._sub = subFound > 0;
    out._coverage = subFound > 0 ? Math.min(1, subFound / 29) : faceFound / 6;
    return out;
  }

  // rareflag ids these evos can be applied to (defaults the club-search filter).
  // This is only a fallback baseline — the real list is read live from EA's
  // Academy slots (see refreshEligibleRarities) so new promos the evo accepts
  // (e.g. FUTTIES = 16) are picked up automatically without editing this file.
  const DEFAULT_ELIGIBLE_RARITIES = [30,94,98,103,109]; // 103 = FoF National Pride Red (untradeable)
  const ELIGIBLE_RARITIES = DEFAULT_ELIGIBLE_RARITIES.slice();
  // Reward ids granted by the PlayStyle / PlayStyle+ evos (traitId + 301). Used to
  // recognise a "grants a PlayStyle" evo slot among all the loaded academy slots.
  const EVO_REWARD_IDS = new Set();
  ALL.forEach((e) => { if (e && e.r != null) EVO_REWARD_IDS.add(Number(e.r)); });
  // Resolve EA's AcademyEligibilityAttribute.RARITY enum value (a page-scope global
  // in the web-app bundle) so we can pick the rarity requirement off a slot.
  function academyRarityAttr() {
    try { if (typeof AcademyEligibilityAttribute !== "undefined" && AcademyEligibilityAttribute) return AcademyEligibilityAttribute.RARITY; } catch (_) {}
    try { return window.AcademyEligibilityAttribute && window.AcademyEligibilityAttribute.RARITY; } catch (_) {}
    return undefined;
  }
  // True if the slot's rewards include one of our PlayStyle trait reward ids — i.e.
  // this evo grants a PlayStyle (vs. an unrelated stat/rarity-only evo). Restricting
  // to these keeps commons/golds evos from ballooning the club filter.
  function slotGrantsPlayStyle(slot) {
    try {
      const rewards = slot.getAllSlotRewards ? slot.getAllSlotRewards() : [];
      return rewards.some((rw) => rw && EVO_REWARD_IDS.has(Number(rw.type)));
    } catch (_) { return false; }
  }
  // Pull the eligible rarities straight from EA's evolution data: each evo's
  // Academy slot carries eligibilityRequirements, and the one with attribute
  // === RARITY lists every rareflag the evo accepts (targets). We union those
  // across all loaded PlayStyle evo slots, merged onto the baseline above, so the
  // club-search filter always matches the evo's real rarity requirements.
  function refreshEligibleRarities() {
    const found = new Set(DEFAULT_ELIGIBLE_RARITIES);
    GH_RARITIES.forEach((r) => found.add(r)); // Glory Hunters (4th PS+) cards
    const RAR = academyRarityAttr();
    try {
      const repo = acadRepo();
      const slots = (repo && repo.getSlots && repo.getSlots()) || [];
      slots.forEach((slot) => {
        if (!slot || !slotGrantsPlayStyle(slot)) return;
        const reqs = slot.eligibilityRequirements;
        if (!Array.isArray(reqs)) return;
        let req = null;
        if (RAR !== undefined) {
          req = reqs.find((r) => r && r.attribute === RAR && Array.isArray(r.targets) && r.targets.length);
        }
        // Fallback when the enum global isn't reachable: use EA's own accessor to
        // find the first rarity id, then the requirement carrying it (all targets).
        if (!req && typeof slot.getRarityRequirement === "function") {
          try {
            const rar = slot.getRarityRequirement();
            const id = rar && (typeof rar.id === "number" ? rar.id : rar.rarityId);
            if (id != null) req = reqs.find((r) => r && Array.isArray(r.targets) && r.targets[0] === id);
          } catch (_) {}
        }
        if (req && Array.isArray(req.targets)) {
          req.targets.forEach((t) => { const n = Number(t); if (Number.isFinite(n)) found.add(n); });
        }
      });
    } catch (_) {}
    ELIGIBLE_RARITIES.length = 0;
    found.forEach((r) => ELIGIBLE_RARITIES.push(r));
    ELIGIBLE_RARITIES.sort((a, b) => a - b);
    return ELIGIBLE_RARITIES;
  }

  // position id (UTLocalizationUtil) -> role group
  const POS_GROUP = {
    0: "GK", 1: "CB", 2: "RB / LB", 3: "RB / LB", 4: "CB", 5: "CB", 6: "CB", 7: "RB / LB", 8: "RB / LB",
    9: "CDM", 10: "CDM", 11: "CDM", 12: "RM / LM", 13: "CM", 14: "CM", 15: "CM", 16: "RM / LM",
    17: "CAM", 18: "CAM", 19: "CAM", 20: "RW / LW", 21: "ST", 22: "RW / LW", 23: "RW / LW",
    24: "ST", 25: "ST", 26: "ST", 27: "RW / LW",
  };

  // rareflag -> name (EA obfuscates in-app names). Editable via data/rarities.json.
  const RARITIES = {"0":"Common","1":"Rare","3":"Team of the Week","5":"Team of the Year","8":"Star Performer","11":"Team of the Season","12":"Icon","14":"Knockout Royalty Hero","15":"Knockout Royalty ICON","16":"FUTTIES","18":"Festival of Football ICON","20":"FoF: Answer the Call","21":"Prime Hero","22":"Ratings Reload","23":"Future Stars Hero","26":"UCL Primetime Hero","27":"UWCL Primetime Hero","28":"Festival of Football: Captains","30":"FUT Birthday","31":"UEFA Women's Champions League Primetime","32":"UEFA Women's Champions League Road to the Final","33":"Thunderstruck","34":"FC Pro Live","35":"Winter Wildcards ICON","36":"Journey of Nations","46":"UEFA Europa League Primetime","49":"Winter Wildcards Hero","50":"UEFA Champions League Primetime","55":"Knockout Royalty","57":"Showdown Upgrade","58":"Showdown","62":"Festival of Football Showdown","63":"Festival of Football Showdown Upgrade","64":"TOTY Honourable Mentions","65":"TOTS Honourable Mentions","69":"World Tour Silver Superstar","71":"Future Stars","72":"Heroes","76":"Trophy Titans ICON","77":"Trophy Titans Hero","81":"Classic XI Hero","82":"Unbreakables","83":"Unbreakables Hero","85":"Unbreakables ICON","88":"Unbreakables Evolution","90":"Moments","91":"World Tour","94":"Festival of Football: Star Performer","96":"Joga Bonito","97":"Joga Bonito Hero","98":"Festival of Football: National Pride","103":"Festival of Football: National Pride Red","104":"Festival of Football: Glory Hunters Red","105":"UEFA Conference League Primetime","107":"Festival of Football: Path to Glory","108":"Time Warp","109":"Festival of Football: Glory Hunters","111":"Fantasy FC","112":"Time Warp ICON","116":"Festival of Football: Captains ICON","117":"Winter Wildcards","120":"TOTS Breakthrough","124":"UEFA Champions League Road to the Final","125":"UEFA Europa League Road to the Final","126":"UEFA Conference League Road to the Final","130":"Festival of Football: Greats of the Game Hero","131":"Festival of Football: Greats of the Game ICON","132":"TOTY HM Evolution","135":"Fantasy FC Hero","139":"FUTTIES ICON","147":"FUT Birthday EVO","148":"FUT Birthday Hero","149":"FUT Birthday ICON","150":"Cornerstones","151":"Ultimate Scream","154":"FUTTIES Hero","155":"Team of the Year ICON","157":"Thunderstruck ICON","168":"Ultimate Scream Hero","170":"Future Stars ICON"};

  const state = {
    mode: "single", // "single" (manual, one player) | "auto" (bulk auto-resolve)
    item: null, // selected club item entity
    selected: new Set(), // slotIds
    queue: [], // auto-mode: [{ item, role:{pos,role}, slots:[slotIds] }] — click a player to add
    running: false, abort: false,
    rarities: new Set(), // allowed rareflags for club search; empty = all
    clubItems: null, // players we loaded ourselves (full club / eligible rarities)
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ACAD = () => (window.services && window.services.Academy) || (typeof services !== "undefined" ? services.Academy : null);
  const CLUB = () => { try { return window.repositories.Item.getClub(); } catch (_) { return null; } };

  // Preference persistence via localStorage (keeps the script at @grant none —
  // no Tampermonkey storage privileges needed). All keys namespaced under fcevo:.
  const PREFS_KEY = "fcevo:prefs";
  function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (_) { return {}; } }
  function savePrefs(patch) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.assign(loadPrefs(), patch))); } catch (_) {}
  }
  const prefs = loadPrefs();
  // Randomize the gap between applies by ±35% so the cadence isn't a fixed
  // machine-perfect interval. Purely a timing tweak; does not change what runs.
  const jitter = (ms) => Math.max(120, Math.round(ms * (0.65 + Math.random() * 0.7)));

  // --- Engine ---------------------------------------------------------------
  function svcObserve(observable) {
    return new Promise((resolve, reject) => {
      if (!observable || typeof observable.observe !== "function") return reject(new Error("not an observable"));
      let done = false;
      observable.observe(window, function (obs, res) {
        if (done) return; done = true;
        try { obs.unobserve(window); } catch (_) {}
        if (res && res.success) resolve(res); else reject(res || new Error("call failed"));
      });
    });
  }
  const applyEvo = (slotId, itemId) => svcObserve(ACAD().addItemToSlot(slotId, itemId, undefined));
  const claimEvo = (slotId) => svcObserve(ACAD().claimSlot(slotId));

  const acadRepo = () => { try { return window.repositories.Academy; } catch (_) { return null; } };
  const getSlot = (id) => { try { return acadRepo().getSlotById(Number(id)); } catch (_) { return null; } };

  // Page the whole Rewards category (id 9) — the GH 4th reward slots are paginated,
  // so we keep requesting pages until the loaded count stops growing — then rebuild
  // the GH catalog from every slot whose name starts "GH 4th ".
  async function loadGHEvos() {
    if (ghLoaded) return GH;
    if (ghLoadPromise) return ghLoadPromise; // concurrent callers await the in-flight load
    ghLoadPromise = (async () => {
      ghLoading = true;
      let completed = false;
      try {
        const S = ACAD(), R = acadRepo();
        // Fetch the Rewards category (id 9) directly — no need for the user to open
        // anything in the web app. Page until the loaded count stops growing.
        if (S && R && S.requestSlotsByCategory) {
          let prev = -1, off = 0; const COUNT = 60;
          completed = true;
          for (let i = 0; i < 12; i++) {
            try { await svcObserve(S.requestSlotsByCategory({ categoryId: 9, offset: off, count: COUNT, sort: 0 })); }
            catch (_) { completed = false; break; } // a page failed -> leave unloaded so it retries
            const n = (R.getSlots() || []).filter((s) => s.categoryId === 9).length;
            if (n === prev) break; // no new slots -> category fully loaded (or cache returned all)
            prev = n; off += COUNT;
          }
        }
        rebuildGH();
        if (completed) ghLoaded = true; // only lock in on a real successful load; else retry next call
      } finally { ghLoading = false; ghLoadPromise = null; }
      return GH;
    })();
    return ghLoadPromise;
  }
  function rebuildGH() {
    const R = acadRepo(); if (!R) return;
    GH.length = 0;
    (R.getSlots() || []).forEach((s) => {
      if (!s.slotName || s.slotName.indexOf("GH 4th ") !== 0) return;
      let r; try { r = s.getAllSlotRewards()[0].type; } catch (_) {}
      if (r == null) return;
      GH.push({ n: s.slotName.slice(7).trim(), s: s.id, r, kind: "PS+", g: 0, gh: true });
    });
    GH.forEach((g) => { if (!ALL.includes(g)) ALL.push(g); }); // make GH slots resolvable via byId()
  }
  // Dedupe GH reward slots by playstyle for the grid. Each tile picks a slot the
  // player is actually eligible for — canApplyTo enforces rarity 109 AND already-3-PS+,
  // so a tile only lights up on a Glory Hunters card that has exactly 3 PS+.
  function ghForPlayer(it) {
    const byPs = new Map();
    GH.forEach((g) => { if (!byPs.has(g.n)) byPs.set(g.n, []); byPs.get(g.n).push(g); });
    const out = [];
    byPs.forEach((list) => {
      let chosen = null, applicable = false;
      for (const g of list) {
        const slot = getSlot(g.s);
        // slot.meetsRequirements(player) evaluates the slot's eligibility rules
        // (rarity 109 + already-3-PS+). (item.canApplyTo is a consumable-item method,
        // unrelated to Academy slots — it always returns false for a player.)
        let ok = false; try { ok = !!it && !!slot && slot.meetsRequirements(it); } catch (_) {}
        // Fail closed: these are one-time reward slots, so an unknown availability
        // (missing slot or hasSlottedPlayer throwing) must NOT count as free.
        let free = false; try { free = !!slot && !slot.hasSlottedPlayer(); } catch (_) {}
        if (ok && free) { chosen = g; applicable = true; break; }
        if (!chosen) chosen = g;
      }
      const entry = Object.assign({}, chosen);
      entry.disGH = !applicable; // grey out if not currently applicable to this card
      out.push(entry);
    });
    out.sort((a, b) => baseName(a).localeCompare(baseName(b)));
    return out;
  }

  // Core apply loop for one player. Returns { ok, fail, done } and does NOT own
  // state.running or the post-apply reload — the caller (runBatch / runDispatch)
  // handles those, so it can be reused for both single and multi-player runs.
  async function applySlots(item, slotIds, opts, prefix) {
    const itemId = item.id; let ok = 0, fail = 0; const done = [];
    prefix = prefix || "";
    // Apply base PlayStyles first, PlayStyle+ last.
    slotIds = [...slotIds].sort((a, b) => ((byId(a) && byId(a).kind === "PS+") ? 1 : 0) - ((byId(b) && byId(b).kind === "PS+") ? 1 : 0));
    for (let i = 0; i < slotIds.length; i++) {
      if (state.abort) { log(`${prefix}⏹ Aborted.`, "warn"); break; }
      const evo = byId(slotIds[i]);
      const tag = `${prefix}[${i + 1}/${slotIds.length}] ${evo ? evo.n : slotIds[i]}`;
      try {
        const res = await applyEvo(slotIds[i], itemId);
        if (res.data && res.data.isMaximumNumberOfSlotsReached) log(`⚠ ${tag}: max active slots — claim needed`, "warn");
        if (opts.claim) { try { await claimEvo(slotIds[i]); } catch (ce) { log(`   (claim skipped: ${errMsg(ce)})`, "dim"); } }
        ok++; done.push(slotIds[i]); log(`✔ ${tag}`, "ok");
      } catch (e) { fail++; log(`✗ ${tag} — ${errMsg(e)}`, "err"); }
      if (i < slotIds.length - 1 && !state.abort) await sleep(jitter(opts.delayMs));
    }
    return { ok, fail, done };
  }

  // Single-player run (Single mode). Applies to state.item, then refreshes it.
  async function runBatch(slotIds, opts) {
    if (state.running) return;
    if (!state.item) return log("✋ No player selected.", "warn");
    if (!slotIds.length) return log("✋ Nothing selected.", "warn");
    state.running = true; state.abort = false; setRunning(true);
    const itemId = state.item.id;
    log(`▶ ${slotIds.length} evo(s) → ${playerName(state.item)} (delay ${opts.delayMs}ms, claim=${opts.claim})`, "head");
    const { ok, fail, done } = await applySlots(state.item, slotIds, opts);
    // Applied evos are now owned; drop them from the selection so the count and cap
    // projection don't double-count them against the fresh entity.
    done.forEach((s) => state.selected.delete(s));
    refreshClub();
    try {
      const fresh = freshItemById(itemId);
      if (fresh) {
        state.item = fresh;
        if (state.clubItems && state.clubItems.length) {
          state.clubItems = state.clubItems.map((x) => (x && (x.id === itemId || x.id === Number(itemId)) ? fresh : x));
        }
      }
    } catch (_) {}
    renderPreview(); renderGrid(); updateCount();
    // In-place read can still be stale — EA only reflects an applied evo after a
    // server re-fetch. Always reload so the freshest playstyles/counts render,
    // whether or not any evo reported success.
    try { await reloadAndReselect(itemId); } catch (_) {}
    renderPreview(); renderGrid(); updateCount();
    state.running = false; setRunning(false);
    log(`■ Done: ${ok} ok, ${fail} failed.`, "head");
  }

  // Apply entry point for the Run button. Single mode -> runBatch. Auto mode ->
  // apply the queue (each entry already carries its resolved evo slots), after a confirm.
  async function runDispatch(opts) {
    if (state.mode !== "auto") return runBatch([...state.selected], opts);
    if (state.running) return;
    if (!state.queue.length) return log("✋ Queue is empty — click players to add them.", "warn");
    const entries = state.queue.map((q) => ({ item: q.item, slots: q.slots }));
    const totalEvos = entries.reduce((s, e) => s + e.slots.length, 0);
    state.running = true; state.abort = false; setRunning(true);
    let totalOk = 0, totalFail = 0;
    const multi = entries.length > 1;
    log(`▶▶ Evolving ${entries.length} player${multi ? "s" : ""}, ~${totalEvos} evos`, "head");
    for (let p = 0; p < entries.length; p++) {
      if (state.abort) { log("⏹ Aborted.", "warn"); break; }
      const { item, slots } = entries[p];
      log(`━━ ${p + 1}/${entries.length}: ${playerName(item)} (${item.rating}) — ${slots.length} evo(s) ━━`, "head");
      const res = await applySlots(item, slots, opts, `[${playerName(item)}] `);
      totalOk += res.ok; totalFail += res.fail;
      if (multi && p < entries.length - 1 && !state.abort) await sleep(opts.delayMs * 2);
    }
    refreshClub();
    // Always re-fetch from club after the run finishes, regardless of success.
    const focusId = state.item ? state.item.id : entries[0].item.id;
    try { await reloadAndReselect(focusId); } catch (_) {}
    state.queue = []; // done — clear the queue
    renderList(); renderQueue(); renderPreview(); renderGrid(); updateCount(); updateRunBtn();
    state.running = false; setRunning(false);
    log(`■ Done: ${totalOk} ok, ${totalFail} failed across ${entries.length} player${multi ? "s" : ""}.`, "head");
  }

  // Mirror what the app's own academy flow does after an apply, so views pick up
  // the change without a page reload (the addItemToSlot service already updated
  // the club/squad item entities).
  function refreshClub() {
    try {
      const pile = (window.ItemPile && window.ItemPile.CLUB != null) ? window.ItemPile.CLUB : 7;
      window.repositories.Item.setDirty(pile);
      window.repositories.Academy.requiresHubCall = true;
    } catch (_) {}
  }
  const CODE = { 458: "captcha required", 460: "ineligible (already has it, maxed, or rarity/OVR not allowed)", 461: "permission denied", 426: "feature disabled", 470: "not enough currency" };
  function errMsg(e) {
    if (!e) return "?";
    const code = (e.error && e.error.code) || e.status;
    if (code && CODE[code]) return `${code} — ${CODE[code]}`;
    if (e.error && e.error.message) return `${e.error.code || ""} ${e.error.message}`.trim();
    return code ? "status=" + code : (e.message || String(e));
  }
  const byId = (s) => ALL.find((x) => x.s === s);

  // --- Player helpers -------------------------------------------------------
  // Memoized: the source array reference + length change whenever the club is
  // (re)loaded, so this recomputes exactly when it needs to and is otherwise free
  // for the many render paths that call it per keystroke.
  let _cpSrc, _cpLen = -1, _cpOut = null;
  function clubPlayers() {
    // Prefer the items we loaded ourselves (full / eligible); fall back to whatever
    // the app has cached (usually just the active squad).
    let items = state.clubItems;
    if (!items || !items.length) { const c = CLUB(); items = (c && (c.items || (c.getItems ? c.getItems() : []))) || []; }
    items = items || [];
    if (items === _cpSrc && items.length === _cpLen && _cpOut) return _cpOut;
    _cpOut = items.filter((it) => { try { return it && it.isPlayer && it.isPlayer(); } catch (_) { return false; } });
    _cpSrc = items; _cpLen = items.length;
    return _cpOut;
  }
  // Build a club search criteria (UTSearchCriteriaDTO), optionally rarity-filtered.
  function makeClubCriteria(offset, count, rarities) {
    const Ctor = window.UTSearchCriteriaDTO;
    if (!Ctor) return null;
    const c = new Ctor();
    try { c.type = (window.SearchType && window.SearchType.PLAYER) || "player"; } catch (_) {}
    try { c.count = count; } catch (_) {}
    try { c.offset = offset; } catch (_) {}
    if (rarities && rarities.length) { try { c.rarities = rarities.slice(); } catch (_) {} }
    return c;
  }
  function setClubStatus(text, cls) {
    if (els.clubstat) { els.clubstat.textContent = text; els.clubstat.className = "clubstat " + (cls || ""); }
  }
  // The active squad being loaded is a good "app is ready for club searches" signal.
  function getActiveSquad() {
    const R = window.repositories, S = window.services;
    const tries = [
      () => R.Squad && R.Squad.getActiveSquad && R.Squad.getActiveSquad(),
      () => R.Squad && R.Squad.getCurrentSquad && R.Squad.getCurrentSquad(),
      () => S.Squad && S.Squad.getActiveSquad && S.Squad.getActiveSquad(),
      () => R.Squad && R.Squad.activeSquad,
    ];
    for (const f of tries) { try { const sq = f(); if (sq) return sq; } catch (_) {} }
    return null;
  }
  function squadReady() {
    const sq = getActiveSquad();
    if (!sq) return false;
    try { if (typeof sq.getPlayers === "function") return sq.getPlayers().filter(Boolean).length >= 1; } catch (_) {}
    try { if (Array.isArray(sq.players)) return sq.players.filter(Boolean).length >= 1; } catch (_) {}
    return true; // squad object exists even if we can't read players
  }
  // Load club players via paginated search. With `rarities`, only those load.
  // Throws if the FIRST page fails (app not ready) so the caller can retry.
  // The first page is fetched alone (readiness probe); the rest are fetched in
  // parallel batches, which is the bulk of the speedup over one-at-a-time.
  async function loadClub(rarities) {
    if (!(window.services && window.services.Club && window.services.Club.search)) throw new Error("Club service unavailable");
    const PAGE = 91, BATCH = 4;
    const all = [], seen = new Set();
    const add = (res) => {
      const items = (res && res.response && res.response.items) || (res && res.data && res.data.items) || [];
      for (const it of items) { const id = it && it.id; if (id != null && !seen.has(id)) { seen.add(id); all.push(it); } }
      return items.length;
    };
    const fetchPage = (offset) => {
      const crit = makeClubCriteria(offset, PAGE, rarities);
      if (!crit) throw new Error("no UTSearchCriteriaDTO");
      return svcObserve(window.services.Club.search(crit));
    };
    // First page alone so an app-not-ready failure propagates to the retry wrapper.
    let done = add(await fetchPage(0)) < PAGE;
    let offset = PAGE, guard = 0;
    while (!done && guard++ < 40) {
      const offsets = [];
      for (let b = 0; b < BATCH; b++) { offsets.push(offset); offset += PAGE; }
      // A mid-run page failure yields null (skip that page, keep the rest) rather
      // than aborting the whole load.
      const results = await Promise.all(offsets.map((o) => fetchPage(o).catch(() => null)));
      for (const res of results) {
        if (!res) continue;
        if (add(res) < PAGE) done = true; // a short/empty page means we hit the end
      }
      state.clubItems = all.slice();
      setClubStatus("Club: loading… " + all.length + " players", "load");
      if (!done) await sleep(80);
    }
    state.clubItems = all;
    if (els.rarpanel) els.rarpanel.dataset.built = ""; // rebuild rarity list with real counts
    renderList();
    return all.length;
  }
  // Retry wrapper: waits/retries until the club search is accepted by the app.
  let clubLoading = false;
  async function startClubLoad(attempt, manual) {
    if (clubLoading && !manual) return;
    clubLoading = true;
    setClubStatus("Club: loading…" + (attempt > 1 ? " (retry " + attempt + ")" : ""), "load");
    try {
      const n = await loadClub(null);
      if (!n) throw new Error("0 players returned");
      setClubStatus("Club: " + n + " players loaded · click to reload", "ok");
      clubLoading = false;
    } catch (e) {
      clubLoading = false;
      if (attempt < 8) {
        setClubStatus("Club: app not ready, retrying (" + attempt + ")…", "load");
        setTimeout(() => startClubLoad(attempt + 1), 2500);
      } else {
        setClubStatus("Club: load failed (" + errMsg(e) + ") — click to retry", "err");
      }
    }
  }
  function findItemById(id) { return clubPlayers().find((it) => it.id === id || it.id === Number(id)); }
  // After an evo is applied the game mutates the entity it holds authoritatively —
  // the one in the live club repo, and the one behind the open detail panel. Our
  // own loaded snapshot (state.clubItems, from services.Club.search) can be a
  // different, now-stale instance, so pull the freshest copy for this id.
  function freshItemById(id) {
    const nid = Number(id), same = (it) => it && (it.id === id || it.id === nid);
    try { const e = openEntity(); if (same(e)) return e; } catch (_) {}
    try {
      const c = CLUB(), items = c && (c.items || (c.getItems ? c.getItems() : []));
      const hit = items && items.find(same);
      if (hit) return hit;
    } catch (_) {}
    return findItemById(id) || null;
  }
  // Applied evos are only reflected in the local item model after the club is
  // re-fetched from the server (the same effect as the "click to reload" status).
  // Reload, then re-select the player by id so the new playstyles/counts render.
  async function reloadAndReselect(itemId) {
    if (!(window.services && window.services.Club && window.services.Club.search)) return false;
    setClubStatus("Club: refreshing after apply…", "load");
    try {
      const n = await loadClub(null);
      setClubStatus("Club: " + n + " players loaded · click to reload", "ok");
      const again = findItemById(itemId);
      if (again) state.item = again;
      return true;
    } catch (e) {
      setClubStatus("Club: refresh failed (" + errMsg(e) + ") — click to reload", "err");
      return false;
    }
  }
  function playerName(it) {
    try { const sd = it.getStaticData ? it.getStaticData() : it._staticData; if (sd && sd.name) return sd.name; } catch (_) {}
    return "Player";
  }
  function rarityName(it) {
    const n = RARITIES[it.rareflag];
    return n || ("Rarity " + it.rareflag);
  }

  // Scrape rareflag -> name from the open transfer-market rarity filter DOM
  // (bg url cards_bg_e_1_{id}_N.png + label). Merges into RARITIES live and logs
  // a JSON block to paste into data/rarities.json. Open TM search > rarity first.
  function scrapeRarities() {
    const found = {};
    document.querySelectorAll("li.with-icon, ul.inline-list li").forEach((li) => {
      let bg = "";
      try { bg = li.style.backgroundImage || getComputedStyle(li).backgroundImage; } catch (_) {}
      const m = bg && bg.match(/cards_bg_e_1_(\d+)_/);
      const name = (li.textContent || "").trim();
      if (m && name && name.toLowerCase() !== "any") found[m[1]] = name;
    });
    const n = Object.keys(found).length;
    if (n) { Object.assign(RARITIES, found); renderList(); renderPreview(); }
    log(n ? `↻ Scraped ${n} rarities (applied live).` : "✋ No rarity dropdown found — open TM search → rarity filter first.", n ? "head" : "warn");
    console.log("[FCEvo] rarities for data/rarities.json:\n" + JSON.stringify(found));
    return found;
  }

  // List every distinct rarity present in the club (id, name, count).
  function clubRaritiesDump() {
    const rs = clubRarities();
    console.log("[FCEvo] club rarities (id \\t name \\t count):\n" + rs.map((r) => `${r.rf}\t${r.name}\t×${r.count}`).join("\n"));
    return rs;
  }
  // Empirically find which rarities an evo accepts, via the app's canApplyTo().
  function eligibleRarities(slotId) {
    let slot = null;
    try { slot = window.repositories.Academy.getSlotById(Number(slotId)); } catch (_) {}
    if (!slot) { log("✋ Slot " + slotId + " not loaded — open the Academy hub (that category) first.", "warn"); return null; }
    const players = clubPlayers();
    const byRf = {};
    let tested = 0, eligible = 0, threw = 0;
    players.forEach((it) => {
      if (typeof it.canApplyTo !== "function") return;
      tested++;
      let ok = false;
      try { ok = !!it.canApplyTo(slot); } catch (_) { threw++; return; }
      if (ok) { eligible++; const rf = it.rareflag; (byRf[rf] = byRf[rf] || { rf, name: rarityName(it), count: 0 }).count++; }
    });
    const res = Object.values(byRf).sort((a, b) => b.count - a.count);
    log(`canApplyTo(${slotId}): ${eligible}/${tested} eligible across ${res.length} rarities${threw ? " (" + threw + " errored)" : ""}.`, "head");
    console.log("[FCEvo] eligible rarities for slot " + slotId + ":\n" + res.map((r) => `${r.rf}\t${r.name}\t×${r.count}`).join("\n") + "\n\nids: " + JSON.stringify(res.map((r) => r.rf)));
    return res;
  }
  const isGKItem = (it) => { try { return !!it.isGK(); } catch (_) { return false; } };
  // Player's role groups from current positions (preferred first, then alts), deduped.
  function playerPositionGroups(it) {
    let ids = null;
    try { if (Array.isArray(it.possiblePositions)) ids = it.possiblePositions; } catch (_) {}
    if (!ids) { try { ids = it.getBasePossiblePositions(); } catch (_) {} }
    ids = ids || [];
    const groups = [];
    [it.preferredPosition].concat(ids).forEach((id) => {
      if (id == null) return;
      const g = POS_GROUP[id];
      if (g && !groups.includes(g)) groups.push(g);
    });
    return groups;
  }
  const numBasic = (it) => { try { return it.getNumBasicPlayStyles(); } catch (_) { return null; } };
  const numPlus = (it) => { try { return it.getNumPlusPlayStyles(); } catch (_) { return null; } };
  function hasEvo(it, evo) {
    const t = evo.r - TRAIT_OFFSET;
    try { return evo.kind === "PS+" ? !!it.hasPlusPlayStyle(t) : !!it.hasBasePlayStyle(t); } catch (_) { return false; }
  }
  const evoTrait = (evo) => evo.r - TRAIT_OFFSET;
  // A few base-trait glyphs are blank in EA's icon font (e.g. Intercept = 16);
  // fall back to the icontrait glyph (same symbol, colored by our CSS) so the
  // card/chip isn't empty.
  const MISSING_BASE_GLYPHS = new Set([16]);
  const iconClass = (kindIsPlus, traitId) =>
    (kindIsPlus || MISSING_BASE_GLYPHS.has(traitId) ? "icon_icontrait" : "icon_basetrait") + traitId;
  function currentPlayStyles(it) { try { return it.getPlayStyles() || []; } catch (_) { return []; } }
  // Distinct rarities present in the club: [{rf, name, count}]
  function clubRarities() {
    const m = new Map();
    clubPlayers().forEach((it) => {
      const rf = it.rareflag;
      if (!m.has(rf)) m.set(rf, { rf, name: rarityName(it), count: 0 });
      m.get(rf).count++;
    });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  const rarityAllowed = (it) => !state.rarities.size || state.rarities.has(it.rareflag);
  // True when this card itself already carries an evolution. Such a card is NOT
  // dead — you can keep adding PlayStyles to it (up to caps). It's the player's
  // one allowed evo version.
  const isEvoed = (it) => {
    try { if (it.canRemoveEvolution && it.canRemoveEvolution()) return true; } catch (_) {}
    try { if (it.isAcademyGraduateWithStatUpgrade && it.isAcademyGraduateWithStatUpgrade()) return true; } catch (_) {}
    return false;
  };
  // EA allows only ONE evolved copy per player. If an evolved copy of a card
  // (matched by definitionId) already exists, the CLEAN duplicates of that same
  // card can't be evolved — so hide those, but keep the evolved one.
  function pickable(it) {
    if (!rarityAllowed(it)) return false;
    if (isEvoed(it)) return true; // the allowed evo version — keep it
    return !blockedDefs().has(it.definitionId); // clean dupe of an evolved card -> hide
  }
  // Memoized set of definitionIds that have an evolved copy in the club. Recomputes
  // when the club (re)loads — keyed on the source array reference + length.
  let _bdSrc, _bdLen = -1, _bdOut = null;
  function blockedDefs() {
    const src = clubPlayers();
    if (src === _bdSrc && src.length === _bdLen && _bdOut) return _bdOut;
    _bdSrc = src; _bdLen = src.length;
    _bdOut = new Set();
    src.forEach((it) => { if (isEvoed(it) && it.definitionId != null) _bdOut.add(it.definitionId); });
    return _bdOut;
  }

  // EA's own name for "1v1 Close Down" is "Rush Out"; alias it for display only —
  // internal keys, ROLES and icon mapping keep the catalog name.
  const ALIAS = { "1v1 Close Down": "Rush Out" };
  const dispName = (base) => ALIAS[base] || base;
  // One-line PlayStyle explanations (FC 26) for tooltips.
  const PS_DESC = {
    "Finesse Shot": "Finesse shots are faster, curl harder and land more accurately.",
    "Chip Shot": "Chips and lobs dip more sharply with better accuracy and pace.",
    "Power Shot": "Power shots wind up faster and fly flatter and harder.",
    "Dead Ball": "Direct free kicks get a shot-aim aid, extra curve and power.",
    "Precision Header": "Headed shots, passes and clearances are faster and more accurate.",
    "Acrobatic": "Volleys and acrobatic finishes are quicker and more reliable.",
    "Low Driven Shot": "Driven shots stay low and skid, harder for keepers to reach.",
    "Gamechanger": "Shots from outside the box are faster and more accurate.",
    "Incisive Pass": "Through balls are faster and more accurate, splitting defences.",
    "Pinged Pass": "Driven ground passes are faster and more accurate.",
    "Long Ball Pass": "Long and lofted passes are faster and more accurate at range.",
    "Tiki Taka": "Short ground passes are quicker, tighter and first-time capable.",
    "Whipped Pass": "Crosses carry more pace, curve and accuracy.",
    "Inventive": "Flair passes (scoop, no-look) land more reliably.",
    "Jockey": "Faster, more responsive jockeying to contain attackers.",
    "Block": "Wider, more effective blocks of shots and passes.",
    "Intercept": "Greater reach and success reading and cutting out passes.",
    "Anticipate": "Cleaner, safer standing tackles that win the ball at the feet.",
    "Slide Tackle": "Longer-range, more accurate slide tackles.",
    "Aerial Fortress": "Wins more aerial duels with better jump, reach and timing.",
    "Technical": "Tighter close control and quicker, cleaner dribble touches.",
    "Rapid": "Accelerates faster while sprint-dribbling with the ball.",
    "First Touch": "Cleaner traps with less error, keeping the ball close.",
    "Trickster": "Performs skill moves faster while keeping the ball tight.",
    "Press Proven": "Holds up under pressure, losing less control when challenged.",
    "Quick Step": "Explosive acceleration off the ball to burst into space.",
    "Relentless": "Loses stamina slower and recovers more at halftime.",
    "Long Throw": "Throw-ins travel much farther, right into the box.",
    "Bruiser": "Wins more physical battles with stronger shoulder challenges.",
    "Enforcer": "Stronger in duels and quicker to recover after tackles.",
    "Far Throw": "Keeper throws travel farther and faster to launch attacks.",
    "Footwork": "Quicker keeper footwork and sharper reflex saves.",
    "Cross Claimer": "Commands the box and claims crosses more reliably.",
    "1v1 Close Down": "Rushes out faster and smothers one-on-ones (a.k.a. Rush Out).",
    "Far Reach": "Extra reach on dives to keep out shots bound for the corners.",
    "Deflector": "Parries shots into safer areas with stronger deflections.",
  };
  const psDesc = (base) => PS_DESC[base] || "";

  // ==========================================================================
  // UI
  // ==========================================================================
  let els = {}, tab = "PS+", searchQ = "";
  let _armTimer = null; // in-panel two-step confirm for the Evolve button
  let rarQ = ""; // rarity dropdown filter query

  function css() {
    const s = document.createElement("style");
    s.textContent = `
    #fcevo{--ink:#0b0f14;--char:#141b23;--char2:#1d2732;--line:#28323d;--line2:#394653;
      --bone:#e7edf3;--ash:#a4b3c1;--acc:#33d6c1;--acc-ink:#052420;--good:#4fd08a;--bad:#ff6b6b;--warn:#f2c14e;
      --gold1:#f6d879;--gold2:#c9942f;--grot:-apple-system,"Helvetica Neue",Arial,sans-serif;--mono:var(--grot);
      position:fixed;top:54px;right:16px;width:min(384px, calc(100vw - 20px));max-height:90vh;z-index:2147483647;background:var(--ink);color:var(--bone);
      font:12.5px/1.45 var(--grot);border:1px solid var(--line2);box-shadow:0 26px 64px -24px #000;display:flex;flex-direction:column;overflow:hidden}
    #fcevo *{box-sizing:border-box}
    /* Auto-SBC: embedded (own-screen) mode — fill the nav content area instead of floating. */
    #fcevo.fcevo-embedded{position:static;top:auto;right:auto;left:auto;width:100%;max-width:940px;height:100%;max-height:none;margin:0 auto;border:0;box-shadow:none;z-index:auto}
    #fcevo.fcevo-embedded header{cursor:default}
    #fcevo.fcevo-embedded header [data-act="min"]{display:none}
    #fcevo.fcevo-embedded.min .body{display:flex}
    #fcevo.fcevo-embedded .body{max-height:none;flex:1}
    /* readability: keep the HUD look, but no ALL-CAPS / wide tracking (mixed case reads faster) */
    #fcevo, #fcevo *{text-transform:none !important;letter-spacing:normal !important}
    #fcevo select,#fcevo input{min-width:0}
    #fcevo header{display:flex;align-items:center;gap:9px;padding:12px 13px;background:var(--char);border-bottom:1px solid var(--line);cursor:move;user-select:none}
    #fcevo header .wm{font-weight:800;font-size:12px;letter-spacing:.16em;text-transform:uppercase}
    #fcevo header .dia{width:7px;height:7px;background:var(--acc);transform:rotate(45deg);display:inline-block}
    #fcevo header .sp{flex:1}
    #fcevo header button{background:transparent;color:var(--ash);border:1px solid var(--line2);padding:4px 9px;cursor:pointer;font:600 11px/1 var(--mono);display:flex;align-items:center}
    #fcevo header button:hover{color:var(--ink);background:var(--acc);border-color:var(--acc)}
    #fcevo .chev{pointer-events:none;transform:rotate(0);transition:transform .32s cubic-bezier(.2,.7,.2,1)}
    #fcevo .setpanel{position:absolute;top:44px;right:12px;z-index:6;background:var(--char);border:1px solid var(--line2);padding:10px 12px;display:flex;flex-direction:column;gap:9px;box-shadow:0 16px 38px -14px #000;font:11px/1.3 var(--mono);color:var(--ash);text-transform:uppercase;letter-spacing:.06em}
    #fcevo .setpanel label{display:flex;align-items:center;gap:7px;white-space:nowrap;cursor:pointer}
    #fcevo .setpanel input[type=checkbox]{accent-color:var(--acc);cursor:pointer;margin:0}
    #fcevo .setpanel input[type=number]{font-family:var(--mono);background:var(--ink);color:var(--bone);border:1px solid var(--line2);padding:2px 4px}
    #fcevo.min .chev{transform:rotate(180deg)}
    #fcevo .body{padding:11px 13px;overflow:auto;display:flex;flex-direction:column;gap:10px}
    #fcevo.min .body{display:none}
    #fcevo input,#fcevo select{background:var(--ink);border:1px solid var(--line2);color:var(--bone);border-radius:0;padding:6px 8px;font:11px/1.3 var(--grot);accent-color:var(--acc)}
    #fcevo input:focus,#fcevo select:focus{outline:none;border-color:var(--acc)}
    #fcevo input::placeholder{color:var(--ash)}
    #fcevo input[type=text]{width:100%}
    #fcevo .row{display:flex;gap:6px;align-items:center}
    #fcevo .srow{align-items:stretch}
    #fcevo .srow .rarbtn{display:flex;align-items:center}
    #fcevo .sec{background:transparent;border:0;padding:0}
    #fcevo .sec h4{margin:0 0 11px;font:600 10px/1 var(--mono);color:var(--ash);text-transform:uppercase;letter-spacing:.2em;
      display:flex;align-items:baseline;gap:9px;padding-bottom:9px;border-bottom:1px solid var(--line)}
    #fcevo .sec h4 .ix{color:var(--acc);font-weight:700;letter-spacing:.06em}
    #fcevo .rhint{padding:8px 9px;font:10px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.1em;color:var(--ash)}
    #fcevo .rarpanel{position:fixed;z-index:2147483647;display:none;flex-direction:column;max-height:300px;overflow:hidden;
      background:var(--char);border:1px solid var(--line2);box-shadow:0 20px 46px -18px #000}
    #fcevo .rarpanel.open{display:flex}
    #fcevo .rarhead{flex:none;display:flex;flex-direction:column;gap:7px;padding:8px;border-bottom:1px solid var(--line2)}
    #fcevo .rarsearch{width:100%}
    #fcevo .rarhead .allrar{padding:3px 3px 1px;border:0;font-weight:700}
    #fcevo .rarlist{flex:1;overflow-y:auto}
    #fcevo .rarpanel label{display:flex;align-items:center;gap:10px;font-size:12px;padding:8px 11px;cursor:pointer;border-bottom:1px solid var(--line);color:var(--bone)}
    #fcevo .rarlist label:last-child{border-bottom:0}
    #fcevo .rarpanel label:hover{background:var(--char2)}
    #fcevo .rarpanel label .rc{margin-left:auto;color:var(--ash);font:10px/1 var(--mono);font-variant-numeric:tabular-nums}
    #fcevo input[type=checkbox]{width:14px;height:14px;padding:0;border:0;background:none;accent-color:var(--acc);cursor:pointer;flex:none}
    #fcevo .pr{display:flex;align-items:center;gap:9px;padding:8px 6px;border:0;border-bottom:1px solid var(--line);cursor:pointer;background:transparent}
    #fcevo .pr:hover{background:var(--char2)}
    #fcevo .pr:focus{outline:none;background:var(--char2);box-shadow:inset 2px 0 0 var(--acc)}
    #fcevo .pr .ov{font:800 15px/1 var(--grot);color:var(--bone);min-width:26px;text-align:center;font-variant-numeric:tabular-nums}
    #fcevo .pr .nm{flex:1;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #fcevo .pr .gk{font:10px/1.5 var(--grot);color:var(--acc);border:1px solid var(--line2);padding:1px 5px}
    #fcevo .pr .psc{display:flex;gap:5px;white-space:nowrap;font-family:var(--mono);flex:none}
    #fcevo .pr .pchip{font-size:10px;font-weight:700;padding:1px 5px;border:1px solid;font-variant-numeric:tabular-nums}
    #fcevo .pr .pchip.room{color:var(--good);border-color:#2f5a2a}
    #fcevo .pr .pchip.full{color:var(--bad);border-color:#5a2b24}
    #fcevo .card{display:flex;gap:13px;align-items:center}
    #fcevo .card .ov{font:800 30px/.85 var(--grot);color:var(--bone);min-width:44px;text-align:left;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
    #fcevo .card .meta{flex:1}
    #fcevo .card .meta .pn{font-weight:800;font-size:15px;letter-spacing:-.01em}
    #fcevo .caps{display:flex;gap:0;margin-top:11px;border:1px solid var(--line)}
    #fcevo .cap{flex:1;background:transparent;border:0;border-right:1px solid var(--line);padding:7px 8px;text-align:left}
    #fcevo .cap:last-child{border-right:0}
    #fcevo .cap b{font:800 17px/1 var(--grot);font-variant-numeric:tabular-nums}#fcevo .cap.full b{color:var(--bad)}
    #fcevo .cap small{color:var(--ash);display:block;font:10.5px/1.5 var(--grot)}
    #fcevo .modetabs{display:flex;gap:0;padding:0 12px;border-bottom:1px solid var(--line);background:var(--char)}
    #fcevo .modetabs button{flex:1;background:transparent;border:0;border-bottom:2px solid transparent;color:var(--ash);padding:9px 6px;cursor:pointer;
      font:700 11px/1 var(--grot);text-transform:uppercase;letter-spacing:.16em;margin-bottom:-1px}
    #fcevo .modetabs button:hover{color:var(--bone)}
    #fcevo .modetabs button.on{color:var(--bone);border-bottom-color:var(--acc)}
    #fcevo .plist{display:flex;flex-direction:column;max-height:210px;overflow-y:auto;margin-top:8px;border-top:1px solid var(--line)}
    #fcevo .plist .pr input{margin:0 2px 0 0;cursor:pointer;accent-color:var(--acc)}
    #fcevo .pr.hasps .nm{color:var(--warn)}
    #fcevo .pr.on{background:var(--char2);box-shadow:inset 2px 0 0 var(--acc)}
    #fcevo .rolechip{font:10px/1.4 var(--mono);color:var(--good);border:1px solid var(--line2);padding:1px 5px;white-space:nowrap;text-transform:uppercase;letter-spacing:.04em;min-width:0;overflow:hidden;text-overflow:ellipsis}
    #fcevo .tabs{display:flex;gap:0;border-bottom:1px solid var(--line)}
    #fcevo .tabs button{flex:1;background:transparent;border:0;border-bottom:2px solid transparent;color:var(--ash);padding:8px 6px;cursor:pointer;
      font:600 10px/1 var(--mono);text-transform:uppercase;letter-spacing:.12em;margin-bottom:-1px}
    #fcevo .tabs button:hover{color:var(--bone)}
    #fcevo .tabs button.on{color:var(--bone);border-bottom-color:var(--acc)}
    #fcevo .tabs button.disabled{opacity:.38;cursor:help}
    #fcevo .tabs button.disabled:hover{color:var(--ash)}
    #fcevo .queue-list{display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto}
    #fcevo .qi{background:var(--char);border:1px solid var(--line);padding:7px 8px}
    #fcevo .qi-head{display:flex;align-items:center;gap:8px}
    #fcevo .qi-head .ov{font:800 14px/1 var(--grot);color:var(--bone);min-width:26px;font-variant-numeric:tabular-nums}
    #fcevo .qi-head .nm{flex:1;font-size:12px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #fcevo .qi-head .rolechip{flex:none}
    #fcevo .qi .qx{background:none;border:0;color:var(--ash);cursor:pointer;font-size:14px;padding:0 2px;line-height:1}
    #fcevo .qi .qx:hover{color:var(--bad)}
    #fcevo .qps{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
    #fcevo .qps .chip{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid var(--line2);background:var(--char2);color:var(--bone)}
    #fcevo .qps .chip i{font-family:'UltimateTeam-Icons',sans-serif;font-style:normal;font-weight:400;font-size:14px;line-height:1}
    #fcevo .qps .chip.noglyph::after{content:attr(data-ini);font:800 8px var(--grot);color:var(--bone)}
    #fcevo .qps .chip.ic{border-color:#7d6320;background:rgba(155,120,25,.14);color:var(--gold1)}
    #fcevo .grid{display:flex;flex-direction:column;gap:8px}
    #fcevo .gcat-h{font:700 10.5px/1 var(--grot);color:var(--acc);margin:0 0 5px;padding-bottom:4px;border-bottom:1px solid var(--line)}
    #fcevo .gcat-row{display:flex;flex-wrap:wrap;gap:3px 2px}
    #fcevo .mlist{display:flex;flex-direction:column;gap:0;max-height:230px;overflow:auto}
    #fcevo .mrow{display:grid;grid-template-columns:1fr 44px 26px;grid-template-areas:"n bar sc" "why bar sc";gap:0 9px;align-items:center;padding:7px 2px;border:0;border-bottom:1px solid var(--line)}
    #fcevo .mrow.dim{opacity:.42}
    #fcevo .mrow .mn{grid-area:n;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #fcevo .mrow .mbar{grid-area:bar;height:3px;background:var(--line);overflow:hidden;align-self:center}
    #fcevo .mrow .mbar i{display:block;height:100%;background:var(--acc)}
    #fcevo .mrow .msc{grid-area:sc;text-align:right;font:800 15px/1 var(--grot);color:var(--bone);font-variant-numeric:tabular-nums}
    #fcevo .mrow .mwhy{grid-area:why;font:9px/1.3 var(--mono);color:var(--ash);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    /* Evo icons: the PlayStyle glyph is the star — big icon in a light rounded
       container (thin border, subtle fill). PlayStyle+ carries a gold accent so
       it still reads apart from base; owned dims; selected lights up with a glow. */
    #fcevo .ec{position:relative;width:50px;padding:3px 1px 2px;cursor:pointer;text-align:center;transition:background .1s}
    #fcevo .ec:hover{background:var(--char2)}
    #fcevo .ec.dis{opacity:.24;cursor:not-allowed}
    #fcevo .ec.owned{opacity:.5}
    #fcevo .noglyph i{display:none}
    #fcevo .ec .ico{position:relative;width:38px;height:38px;margin:0 auto 3px;display:flex;align-items:center;justify-content:center;
      border-radius:9px;border:1px solid var(--line2);background:var(--char2)}
    #fcevo .ec .ico i{font-family:'UltimateTeam-Icons',sans-serif;font-style:normal;font-weight:400;font-size:23px;line-height:1;color:var(--bone)}
    #fcevo .ec .ico.noglyph::after{content:attr(data-ini);font:800 13px var(--grot);color:var(--bone)}
    /* PlayStyle+ = gold accent */
    #fcevo .ec.psp .ico{border-color:#7d6320;background:rgba(155,120,25,.14)}
    #fcevo .ec.psp .ico i,#fcevo .ec.psp .ico.noglyph::after{color:var(--gold1)}
    /* owned recedes */
    #fcevo .ec.owned .ico i,#fcevo .ec.owned .ico.noglyph::after{color:var(--ash)}
    /* selected lights up */
    #fcevo .ec.sel .ico{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc) inset,0 0 9px -2px var(--acc)}
    #fcevo .ec.psp.sel .ico{border-color:var(--gold1);box-shadow:0 0 0 1px var(--gold1) inset,0 0 9px -2px var(--gold1)}
    #fcevo .ec .nm{font-size:10.5px;line-height:1.15;color:#c2ccd6;max-height:22px;overflow:hidden}
    #fcevo .ec.sel .nm{color:var(--bone)}#fcevo .ec.psp.sel .nm{color:var(--gold1)}
    /* owned marker: a small recessed check badge */
    #fcevo .ec .own{position:absolute;top:1px;right:8px;width:14px;height:14px;background:var(--ink);border:1px solid var(--line2);border-radius:4px;
      display:flex;align-items:center;justify-content:center;font:9px/1 var(--grot);color:var(--ash)}
    #fcevo .ec .own::after{content:"\\2713"}
    /* preview: player's current playstyles — same light container, matched style */
    #fcevo .psrow{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
    #fcevo .psrow .chip{width:32px;height:32px;display:flex;align-items:center;justify-content:center;
      border-radius:8px;border:1px solid var(--line2);background:var(--char2);color:var(--bone)}
    #fcevo .psrow .chip i{font-family:'UltimateTeam-Icons',sans-serif;font-style:normal;font-weight:400;font-size:19px;line-height:1}
    #fcevo .psrow .chip.noglyph::after{content:attr(data-ini);font:800 11px var(--grot);color:var(--bone)}
    #fcevo .psrow .chip.ic{border-color:#7d6320;background:rgba(155,120,25,.14);color:var(--gold1)}
    #fcevo .opts{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:10px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--ash)}
    #fcevo .opts input[type=number]{font-family:var(--mono)}
    #fcevo .go{background:var(--acc);color:var(--acc-ink);border:0;border-radius:0;padding:12px;cursor:pointer;
      font:800 11px/1 var(--grot);text-transform:uppercase;letter-spacing:.16em}
    #fcevo .go:hover{filter:brightness(1.06)}
    #fcevo .go:disabled{opacity:.4}#fcevo .stop{background:var(--bad);color:#160b09}
    #fcevo .go.armed{background:var(--warn);color:#211803}
    #fcevo .mini{background:transparent;color:var(--ash);border:1px solid var(--line2);border-radius:0;padding:6px 9px;cursor:pointer;
      font:600 10px/1 var(--mono);text-transform:uppercase;letter-spacing:.1em;white-space:nowrap}
    #fcevo .mini:hover{color:var(--bone);border-color:var(--ash)}
    #fcevo .status{font:12px/1.4 var(--grot);color:var(--ash);padding:3px 0 2px;min-height:18px;white-space:normal;overflow-wrap:anywhere}
    #fcevo .status.ok{color:var(--good)}#fcevo .status.err{color:var(--bad)}#fcevo .status.warn{color:var(--warn)}#fcevo .status.head{color:var(--acc)}#fcevo .status.dim{color:var(--ash)}
    #fcevo .count{color:var(--bone);font-weight:700;font-variant-numeric:tabular-nums}#fcevo .count.over{color:var(--bad)}#fcevo .muted{color:var(--ash)}
    #fcevo .clubstat{margin-top:8px;padding:7px 9px;font:10px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.08em;background:var(--char);border:1px solid var(--line);border-left:2px solid var(--line2);cursor:pointer}
    #fcevo .clubstat.load{color:var(--warn);border-left-color:var(--warn)}#fcevo .clubstat.ok{color:var(--good);border-left-color:var(--good)}#fcevo .clubstat.err{color:var(--bad);border-left-color:var(--bad)}
    /* accent diamond = a Suggest pick; help badge */
    #fcevo .sug{display:inline-block;width:6px;height:6px;background:var(--acc);transform:rotate(45deg);margin:0 3px 0 6px;vertical-align:middle}
    #fcevo .tag-own{font:8px/1 var(--mono);text-transform:uppercase;letter-spacing:.1em;color:var(--ash);border:1px solid var(--line2);padding:1px 4px;margin-left:7px;vertical-align:middle}
    /* tooltip (attached to body so the panel's overflow can't clip it) */
    #fcevo-tip{position:fixed;z-index:2147483647;max-width:232px;background:#0b0f14;border:1px solid #394653;
      padding:9px 11px;pointer-events:none;box-shadow:0 16px 38px -14px #000;font:11px/1.45 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#c4ccd4}
    #fcevo-tip b{display:block;font:700 10px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:#33d6c1;margin-bottom:5px}
    #fcevo-tip span{display:block}
    `;
    document.head.appendChild(s);
  }

  function build() {
    css();
    const root = document.createElement("div");
    root.id = "fcevo";
    root.innerHTML = `
      <header><b class="wm">Evo&nbsp;Helper</b><i class="dia" aria-hidden="true"></i><span class="sp"></span><button data-act="settings" class="hbtn" title="Settings">⚙</button><button data-act="min" title="Collapse"><svg class="chev" viewBox="0 0 14 9" width="12" height="8" aria-hidden="true"><path d="M1 6.5L7 1.5L13 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></header>
      <div class="setpanel" id="fcevo-settings" style="display:none">
        <label title="Add the player to each slot, then claim/finish it so the PlayStyle is locked in."><input type="checkbox" id="fcevo-claim" checked> claim &amp; finish</label>
        <label>delay <input type="number" id="fcevo-delay" value="300" min="200" step="100" style="width:54px"> ms</label>
        <label title="When on, the panel loads collapsed each time you open the web app."><input type="checkbox" id="fcevo-startmin"> start minimized</label>
      </div>
      <div class="modetabs">
        <button data-mode="single" class="on">Single</button>
        <button data-mode="auto">Bulk</button>
      </div>
      <div class="body">
        <div class="sec">
          <h4><span class="ix">01</span> <span id="fcevo-pickhdr">Select from club</span></h4>
          <div class="row srow">
            <input type="text" id="fcevo-search" placeholder="search club by name…">
            <button class="mini rarbtn" data-act="rar" id="fcevo-rarbtn">Rarity: all ▾</button>
          </div>
          <div class="rarpanel" id="fcevo-rarpanel"></div>
          <div class="clubstat" id="fcevo-clubstat" data-act="reloadclub" title="Click to reload the club">Club: waiting for app…</div>
          <div class="plist" id="fcevo-list"></div>
        </div>

        <div class="sec" id="fcevo-auto" style="display:none">
          <h4>Queue · <span id="fcevo-qcount">0</span></h4>
          <div class="queue-list" id="fcevo-qlist"></div>
        </div>

        <div class="sec" id="fcevo-preview" style="display:none"></div>

        <div class="sec" id="fcevo-evosec">
          <h4><span class="ix">02</span> Choose evolutions</h4>
          <div class="row">
            <select id="fcevo-pos" style="flex:1"></select>
            <select id="fcevo-role" style="flex:1.3"></select>
            <button class="mini" data-act="suggest" data-tip="Suggest|Preselects this role's recommended playstyles — the top 5 as PlayStyle+, the rest as basic — skipping any the player already owns and respecting the caps. Tweak freely afterward.">Suggest</button>
          </div>
          <div class="tabs" style="margin-top:9px">
            <button data-tab="PS+">PlayStyle+ (36)</button>
            <button data-tab="PS">PlayStyle (36)</button>
            <button data-tab="GH4" class="gh4tab disabled" data-tip="4th PlayStyle+|Glory Hunters cards can hold a 4th PS+ via reward evos — only for a GH card that already has 3 PS+.">4th PS+</button>
          </div>
          <div class="row" style="margin:7px 0;justify-content:flex-end">
            <button class="mini" data-act="none">Clear selection</button>
          </div>
          <div class="grid" id="fcevo-grid"></div>
        </div>

        <div class="opts">
          <span class="count" id="fcevo-count">0 selected</span>
        </div>
        <div class="row">
          <button class="go" data-act="run" id="fcevo-runbtn" style="flex:1">Apply selected</button>
          <button class="mini" data-act="clearsel" id="fcevo-clearsel" style="display:none">Clear</button>
          <button class="go stop" data-act="stop" style="display:none;flex:1">Stop</button>
        </div>
        <div class="status" id="fcevo-status">Ready.</div>
      </div>`;
    document.body.appendChild(root);
    els = {
      root, search: q("#fcevo-search"), preview: q("#fcevo-preview"), grid: q("#fcevo-grid"),
      count: q("#fcevo-count"), status: q("#fcevo-status"), run: q('[data-act="run"]'), stop: q('[data-act="stop"]'),
      claim: q("#fcevo-claim"), delay: q("#fcevo-delay"),
      settings: q("#fcevo-settings"), startmin: q("#fcevo-startmin"),
      rarbtn: q("#fcevo-rarbtn"), rarpanel: q("#fcevo-rarpanel"), clubstat: q("#fcevo-clubstat"),
      pos: q("#fcevo-pos"), role: q("#fcevo-role"),
      runbtn: q("#fcevo-runbtn"), clearsel: q("#fcevo-clearsel"), pickhdr: q("#fcevo-pickhdr"),
      evosec: q("#fcevo-evosec"), list: q("#fcevo-list"),
      queuesec: q("#fcevo-auto"), qlist: q("#fcevo-qlist"), qcount: q("#fcevo-qcount"),
    };
    function q(s) { return root.querySelector(s); }
    // Keep the panel fully within the viewport (guards against a stale saved
    // position or a small/mobile screen leaving it partly off-screen).
    function clampPanel() {
      const w = root.offsetWidth, h = root.offsetHeight || 60, m = 8;
      const r = root.getBoundingClientRect();
      let left = r.left, top = r.top, fix = false;
      const maxLeft = Math.max(m, window.innerWidth - w - m);
      const maxTop = Math.max(m, window.innerHeight - Math.min(h, 60));
      if (left > maxLeft) { left = maxLeft; fix = true; }
      if (left < m) { left = m; fix = true; }
      if (top > maxTop) { top = maxTop; fix = true; }
      if (top < m) { top = m; fix = true; }
      if (fix) { root.style.right = "auto"; root.style.left = left + "px"; root.style.top = top + "px"; }
    }

    root.addEventListener("click", onClick);
    let searchTimer = null;
    q("#fcevo-search").addEventListener("input", (e) => {
      const v = e.target.value.trim().toLowerCase();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { searchQ = v; renderList(); }, 150);
    });
    // A prior pick leaves the player's name in the box; select it so typing
    // immediately searches for a different player instead of appending.
    q("#fcevo-search").addEventListener("focus", (e) => { if (state.item) e.target.select(); });
    els.pos.addEventListener("change", populateRoles);
    // Re-check glyphs once the EA icon font finishes loading (avoids a flash of
    // initials on first paint before the font is ready).
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(markGlyphs); } catch (_) {}
    populatePositions();
    makeDraggable(root, root.querySelector("header"));
    initTips();
    // Default to all rarities so the full club is available in the builder.
    setTab("PS+");
    setMode("single");
    updateGHTab(); // paint the always-visible 4th-PS+ tab in its locked state

    // Restore persisted preferences (localStorage — persists across sessions).
    if (Number.isFinite(prefs.delay)) els.delay.value = prefs.delay;
    if (typeof prefs.claim === "boolean") els.claim.checked = prefs.claim;
    if (prefs.pos && prefs.pos.left) { root.style.right = "auto"; root.style.left = prefs.pos.left; root.style.top = prefs.pos.top; }
    clampPanel(); // keep the panel fully on-screen (stale saved pos, small/mobile screens)
    if (prefs.startMin) { root.classList.add("min"); const mb = root.querySelector('[data-act="min"]'); if (mb) mb.title = "Expand"; }
    els.delay.addEventListener("change", () => savePrefs({ delay: +els.delay.value }));
    els.claim.addEventListener("change", () => savePrefs({ claim: els.claim.checked }));
    els.startmin.checked = !!prefs.startMin;
    els.startmin.addEventListener("change", () => savePrefs({ startMin: els.startmin.checked }));

    // Close the rarity dropdown if the panel scrolls or resizes.
    root.querySelector(".body").addEventListener("scroll", () => closeRar(), { passive: true });
    window.addEventListener("resize", () => { closeRar(); clampPanel(); });
    // Close the rarity dropdown / settings when clicking outside them.
    document.addEventListener("mousedown", (e) => {
      if (els.rarpanel.classList.contains("open") && !els.rarpanel.contains(e.target) && !els.rarbtn.contains(e.target)) closeRar();
      if (els.settings.style.display !== "none" && !els.settings.contains(e.target) && !e.target.closest('[data-act="settings"]')) closeSettings();
    });
    root.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!state.running) requestRun({ delayMs: +els.delay.value, claim: els.claim.checked });
      } else if (e.key === "Escape" && state.running) { state.abort = true; }
    });
    log("Ready.", "head");
    log("Search includes all rarities by default (adjust via Rarity ▾).", "dim");
  }

  function onClick(e) {
    const act = e.target.getAttribute("data-act");
    const t = e.target.getAttribute("data-tab");
    const m = e.target.getAttribute("data-mode");
    if (m) return setMode(m);
    if (t) return setTab(t);
    if (act === "min") { const mn = els.root.classList.toggle("min"); e.target.closest("button").title = mn ? "Expand" : "Collapse"; if (mn) closeSettings(); return; }
    if (act === "settings") { els.settings.style.display = els.settings.style.display === "none" ? "" : "none"; return; }
    if (act === "reloadclub") return startClubLoad(1, true);
    if (act === "rar") return toggleRarPanel();
    if (act === "suggest") return suggest();
    if (act === "none") { current().forEach((x) => state.selected.delete(x.s)); return (renderGrid(), updateCount()); }
    if (act === "run") return requestRun({ delayMs: +els.delay.value, claim: els.claim.checked });
    if (act === "stop") return (state.abort = true);
    if (act === "clearsel") return clearQueue();
    const qrm = e.target.getAttribute("data-qrm");
    if (qrm) return removeFromQueue(Number(qrm));
  }

  const current = () => (tab === "GH4" ? ghForPlayer(state.item) : tab === "PS+" ? PSP : PS);
  function setTab(t) { if (t === "GH4" && ghDisabledReason()) return; tab = t; els.root.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.getAttribute("data-tab") === t)); renderGrid(); }

  // ---- rarity multi-select ----
  // Anchor the rarity dropdown under its button (right-aligned, since the button
  // sits at the right of the row), clamped to the viewport.
  function positionRar() {
    const r = els.rarbtn.getBoundingClientRect(), p = els.rarpanel, w = 244;
    let left = r.right - w;
    if (left < 8) left = 8;
    p.style.left = Math.round(left) + "px";
    p.style.top = Math.round(r.bottom + 3) + "px";
    p.style.width = w + "px";
  }
  function closeRar() { els.rarpanel.classList.remove("open"); }
  function closeSettings() { if (els.settings) els.settings.style.display = "none"; }
  function toggleRarPanel() {
    const open = els.rarpanel.classList.toggle("open");
    if (!open) return;
    if (!els.rarpanel.dataset.built) renderRarPanel(); else renderRarList();
    positionRar();
    const s = els.rarpanel.querySelector(".rarsearch");
    if (s) s.focus();
  }
  // All rarities (full map ∪ club ids), with club counts, sorted by name.
  function allRaritiesList() {
    const counts = {};
    clubPlayers().forEach((it) => { counts[it.rareflag] = (counts[it.rareflag] || 0) + 1; });
    const ids = new Set([...Object.keys(RARITIES).map(Number), ...Object.keys(counts).map(Number)]);
    return [...ids].map((id) => ({ rf: id, name: RARITIES[id] || ("Rarity " + id), count: counts[id] || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  function renderRarPanel() {
    els.rarpanel.dataset.built = "1";
    els.rarpanel.innerHTML =
      `<div class="rarhead">` +
        `<input type="text" class="rarsearch" placeholder="filter rarities…">` +
        `<label class="allrar"><input type="checkbox" id="fcevo-rarall" ${state.rarities.size ? "" : "checked"}> all rarities</label>` +
      `</div><div class="rarlist"></div>`;
    const s = els.rarpanel.querySelector(".rarsearch");
    s.value = rarQ;
    s.addEventListener("input", (e) => { rarQ = e.target.value.trim().toLowerCase(); renderRarList(); });
    s.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeRar(); } });
    els.rarpanel.querySelector("#fcevo-rarall").addEventListener("change", onRarChange);
    renderRarList();
  }
  function renderRarList() {
    const box = els.rarpanel.querySelector(".rarlist");
    const rs = allRaritiesList().filter((r) => !rarQ || r.name.toLowerCase().includes(rarQ));
    box.innerHTML = rs.length
      ? rs.map((r) => `<label><input type="checkbox" data-rf="${r.rf}" ${state.rarities.has(r.rf) ? "checked" : ""}> ${esc(r.name)}<span class="rc">${r.count ? "×" + r.count : ""}</span></label>`).join("")
      : `<div class="rhint">No rarity matches &ldquo;${esc(rarQ)}&rdquo;</div>`;
    box.querySelectorAll("input").forEach((cb) => cb.addEventListener("change", onRarChange));
  }
  function onRarChange(e) {
    const cb = e.target;
    if (cb.id === "fcevo-rarall") {
      if (cb.checked) state.rarities.clear();
      renderRarList();
    } else {
      const rf = Number(cb.dataset.rf);
      cb.checked ? state.rarities.add(rf) : state.rarities.delete(rf);
      const all = els.rarpanel.querySelector("#fcevo-rarall");
      if (all) all.checked = state.rarities.size === 0;
    }
    els.rarbtn.textContent = "Rarity: " + (state.rarities.size ? state.rarities.size + " ▾" : "all ▾");
    renderList();
  }

  // ---- player results ----
  // Colored PS+/PS usage chips (green=room, red=at cap). Shared by both lists.
  function psChips(it) {
    const np = numPlus(it), nb = numBasic(it);
    if (np == null && nb == null) return "";
    const cp = capPlus(it);
    const plusFull = (np ?? 0) >= cp, baseFull = (nb ?? 0) >= CAP_BASIC;
    return `<span class="psc">`
      + `<span class="pchip ${plusFull ? "full" : "room"}" title="PlayStyle+ used / cap">+${np ?? "?"}/${cp}</span>`
      + `<span class="pchip ${baseFull ? "full" : "room"}" title="Basic PlayStyles used / cap">${nb ?? "?"}/${CAP_BASIC}</span>`
      + `</span>`;
  }
  // Unified club row for BOTH modes: OVR, name, GK, PS+/PS usage chips. Single mode
  // selects the player on click; Auto mode toggles them in the queue on click.
  const LIST_CAP = 100;
  function playerRow(it) {
    const auto = state.mode === "auto";
    const row = document.createElement("div");
    const hasEvos = (numPlus(it) ?? 0) > 0 || (numBasic(it) ?? 0) > 0;
    const active = auto ? state.queue.some((q) => q.item.id === it.id) : (state.item && state.item.id === it.id);
    row.className = "pr" + (hasEvos ? " hasps" : "") + (active ? " on" : "");
    const gk = isGKItem(it);
    row.innerHTML =
      `<span class="ov">${it.rating ?? "?"}</span>`
      + `<span class="nm">${esc(playerName(it))}${gk ? ' <span class="gk">GK</span>' : ""}</span>`
      + psChips(it);
    row.addEventListener("click", () => auto ? toggleQueue(it) : selectPlayer(it));
    return row;
  }
  // The one club list, shared by Single (click to pick) and Auto (tick to select).
  function renderList() {
    const box = els.list; if (!box) return; box.innerHTML = "";
    const all = clubPlayers().filter(pickable);
    // While the club is still loading the status line above already says so —
    // don't repeat it here. Only speak up once loaded but nothing is evolvable.
    if (!all.length) { box.innerHTML = clubPlayers().length ? `<div class="rhint">No evolvable players &mdash; all owned or ineligible.</div>` : ``; updateRunBtn(); return; }
    const matches = (searchQ ? all.filter((it) => playerName(it).toLowerCase().includes(searchQ)) : all)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (!matches.length) { box.innerHTML = `<div class="rhint">No player matches &ldquo;${esc(searchQ)}&rdquo;</div>`; updateRunBtn(); return; }
    matches.slice(0, LIST_CAP).forEach((it) => box.appendChild(playerRow(it)));
    const extra = matches.length - LIST_CAP;
    box.insertAdjacentHTML("beforeend", `<div class="rhint">${extra > 0 ? `+${extra} more &mdash; type to filter` : `${matches.length} evolvable`}</div>`);
    updateRunBtn();
  }

  // Read the live UTItemEntity behind the open player-detail panel by walking
  // getAppMain().getRootViewController(). Used to grab the freshest copy of a
  // just-evolved card (see freshItemById). Returns null if unreachable / none open.
  function openEntity() {
    if (typeof window.getAppMain !== "function") return null;
    let root; try { root = window.getAppMain().getRootViewController(); } catch (_) { return null; }
    if (!root || typeof root !== "object") return null;
    const seen = new Set(), stack = [root], hits = [];
    const isItem = (v) => v && typeof v.isPlayer === "function" && typeof v.getAttributes === "function";
    for (let i = 0; i < 500 && stack.length; i++) {
      const vc = stack.shift();
      if (!vc || typeof vc !== "object" || seen.has(vc)) continue;
      seen.add(vc);
      let kids = [];
      try {
        kids = [].concat(vc.childViewControllers || [])
          .concat(vc.currentController || [])
          .concat((vc.presentationController && vc.presentationController.presentedViewController) || [])
          .concat((vc.getPresentedViewController && vc.getPresentedViewController()) || []);
      } catch (_) {}
      for (const k of kids) if (k && !seen.has(k)) stack.push(k);
      let keys = []; try { keys = Object.keys(vc); } catch (_) {}
      for (const key of keys) {
        let v; try { v = vc[key]; } catch (_) { continue; }
        if (isItem(v)) { hits.push(v); break; }
      }
    }
    // Breadth-first visits shallow controllers first; the frontmost panel is the
    // deepest presented, so the last hit is the card on top.
    return hits.length ? hits[hits.length - 1] : null;
  }

  function selectPlayer(it) {
    state.item = it;
    state.selected.clear();
    // Reflect the pick in the search box and highlight the row in the shared list.
    searchQ = "";
    if (els.search) els.search.value = playerName(it);
    renderList();
    populatePositions(); // now restricted to this player's positions, preferred first
    renderPreview(); renderGrid(); updateCount();
    if (els.preview && els.preview.scrollIntoView) els.preview.scrollIntoView({ block: "nearest" });
    log("🎯 Selected " + playerName(it) + " (" + it.rating + ")", "head");
    updateGHTab();
  }

  // Show the "4th PS+" tab only for Glory Hunters cards; auto-load the reward evos
  // the first time one is picked, then refresh the grid if that tab is open.
  function ghTabBtn() { return els.root && els.root.querySelector('.tabs button[data-tab="GH4"]'); }
  const ghKinds = () => new Set(GH.map((g) => g.n)).size;
  // Why the 4th-PS+ tab is locked for the current pick ("" = it's available).
  function ghDisabledReason() {
    const it = state.item;
    if (!it) return "Select a Glory Hunters card first";
    if (!isGH(it)) return "Glory Hunters cards only";
    const np = numPlus(it) ?? 0;
    if (np < 3) return "Needs 3 PS+ first";
    if (np >= 4) return "Already has 4 PS+";
    return "";
  }
  // Keep the 4th-PS+ tab ALWAYS visible (so people discover it) but greyed out with
  // a hover tip unless the selected card is a Glory Hunters card with exactly 3 PS+.
  function updateGHTab() {
    const btn = ghTabBtn(); if (!btn) return;
    const reason = ghDisabledReason();
    const enabled = !reason;
    btn.classList.toggle("disabled", !enabled);
    btn.setAttribute("data-tip", "4th PlayStyle+|" + (enabled
      ? "Add a 4th PS+ to this Glory Hunters card via a reward evo — pick one below."
      : reason + ". The 4th PS+ is only for Glory Hunters cards that already have 3 PS+."));
    const paint = () => {
      const b = ghTabBtn(); if (!b) return;
      b.textContent = "4th PS+" + (ghLoaded && ghKinds() ? " (" + ghKinds() + ")" : "");
      if (state.item && !ghDisabledReason() && tab === "GH4") { renderGrid(); updateCount(); }
    };
    if (!enabled) { if (tab === "GH4") setTab("PS+"); paint(); return; }
    if (ghLoaded) { paint(); return; }
    log("Loading Glory Hunters evos…", "dim");
    loadGHEvos().then(() => {
      paint();
      if (GH.length) log(`Glory Hunters evos ready — ${ghKinds()} playstyle${ghKinds() === 1 ? "" : "s"}.`, "head");
      else if (ghLoaded) log("No Glory Hunters reward evos on this account.", "warn");
      else log("Couldn't load Glory Hunters evos — will retry on next select.", "warn");
    });
  }

  // Hardcoded from FUT.GG best-by-role page order.
  const BEST_BY_ROLE = {
    "ST": {
      "Advanced Forward": ["Finesse Shot", "Rapid", "Low Driven Shot", "Incisive Pass", "Pinged Pass", "Gamechanger", "Quick Step", "Technical", "Tiki Taka", "First Touch", "Press Proven", "Enforcer", "Inventive"],
      "Target Forward": ["Enforcer", "Finesse Shot", "Precision Header", "Low Driven Shot", "Incisive Pass", "Rapid", "First Touch", "Gamechanger", "Tiki Taka", "Press Proven", "Pinged Pass", "Technical", "Quick Step"],
      "Poacher": ["Finesse Shot", "Rapid", "Low Driven Shot", "Incisive Pass", "Tiki Taka", "First Touch", "Gamechanger", "Quick Step", "Technical", "Press Proven", "Pinged Pass", "Enforcer", "Inventive"],
      "False 9": ["Finesse Shot", "Incisive Pass", "Low Driven Shot", "Technical", "Quick Step", "Gamechanger", "Rapid", "Tiki Taka", "Pinged Pass", "Inventive", "First Touch", "Press Proven", "Chip Shot"],
    },
    "RW / LW": {
      "Inside Forward": ["Finesse Shot", "Low Driven Shot", "Rapid", "Quick Step", "Technical", "Gamechanger", "Incisive Pass", "Pinged Pass", "Tiki Taka", "First Touch", "Inventive", "Press Proven", "Enforcer"],
      "Winger": ["Rapid", "Finesse Shot", "Pinged Pass", "Quick Step", "Enforcer", "Technical", "Low Driven Shot", "Gamechanger", "Incisive Pass", "Tiki Taka", "First Touch", "Inventive", "Press Proven"],
      "Wide Playmaker": ["Finesse Shot", "Technical", "Incisive Pass", "Rapid", "Press Proven", "Tiki Taka", "Pinged Pass", "Low Driven Shot", "Gamechanger", "First Touch", "Inventive", "Quick Step", "Enforcer"],
    },
    "CAM": {
      "Shadow Striker": ["Finesse Shot", "Technical", "Rapid", "Incisive Pass", "Tiki Taka", "Low Driven Shot", "Quick Step", "Gamechanger", "First Touch", "Pinged Pass", "Inventive", "Press Proven", "Relentless"],
      "Playmaker": ["Low Driven Shot", "Finesse Shot", "Incisive Pass", "Technical", "Pinged Pass", "Tiki Taka", "Gamechanger", "First Touch", "Press Proven", "Quick Step", "Inventive", "Rapid", "Long Ball Pass"],
      "Classic 10": ["Finesse Shot", "Incisive Pass", "Technical", "Low Driven Shot", "Pinged Pass", "Tiki Taka", "Gamechanger", "First Touch", "Press Proven", "Quick Step", "Inventive", "Rapid", "Long Ball Pass"],
      "Half Winger": ["Finesse Shot", "Rapid", "Technical", "Incisive Pass", "Pinged Pass", "Tiki Taka", "Gamechanger", "Quick Step", "First Touch", "Press Proven", "Inventive", "Low Driven Shot", "Whipped Pass"],
    },
    "CM": {
      "Box to Box": ["Incisive Pass", "Pinged Pass", "Finesse Shot", "Intercept", "Bruiser", "Tiki Taka", "Anticipate", "Quick Step", "Technical", "Relentless", "Press Proven", "First Touch", "Low Driven Shot"],
      "Playmaker": ["Finesse Shot", "Pinged Pass", "Intercept", "Technical", "Incisive Pass", "Tiki Taka", "Low Driven Shot", "Anticipate", "First Touch", "Quick Step", "Inventive", "Press Proven", "Rapid"],
      "Deep Lying Playmaker": ["Pinged Pass", "Bruiser", "Incisive Pass", "Intercept", "Tiki Taka", "Anticipate", "Jockey", "Quick Step", "First Touch", "Press Proven", "Long Ball Pass", "Inventive", "Relentless"],
      "Holding": ["Pinged Pass", "Intercept", "Bruiser", "Incisive Pass", "Anticipate", "Tiki Taka", "Jockey", "Quick Step", "First Touch", "Press Proven", "Long Ball Pass", "Relentless", "Inventive"],
      "Half Winger": ["Pinged Pass", "Intercept", "Quick Step", "Bruiser", "Anticipate", "Tiki Taka", "Incisive Pass", "Finesse Shot", "Technical", "Jockey", "Rapid", "Relentless", "Press Proven"],
    },
    "RM / LM": {
      "Inside Forward": ["Finesse Shot", "Low Driven Shot", "Rapid", "Quick Step", "Technical", "Gamechanger", "Incisive Pass", "Pinged Pass", "Tiki Taka", "First Touch", "Inventive", "Press Proven", "Enforcer"],
      "Winger": ["Rapid", "Finesse Shot", "Pinged Pass", "Quick Step", "Enforcer", "Technical", "Low Driven Shot", "Gamechanger", "Incisive Pass", "Tiki Taka", "First Touch", "Inventive", "Press Proven"],
      "Wide Playmaker": ["Finesse Shot", "Technical", "Incisive Pass", "Rapid", "Press Proven", "Tiki Taka", "Pinged Pass", "Low Driven Shot", "Gamechanger", "First Touch", "Inventive", "Quick Step", "Enforcer"],
      "Wide Midfielder": ["Pinged Pass", "Intercept", "Quick Step", "Bruiser", "Anticipate", "Tiki Taka", "Incisive Pass", "Finesse Shot", "Technical", "Jockey", "Rapid", "Relentless", "Press Proven"],
    },
    "CDM": {
      "Holding": ["Pinged Pass", "Intercept", "Bruiser", "Incisive Pass", "Anticipate", "Tiki Taka", "Jockey", "Quick Step", "First Touch", "Press Proven", "Long Ball Pass", "Relentless", "Inventive"],
      "Deep Lying Playmaker": ["Pinged Pass", "Bruiser", "Incisive Pass", "Intercept", "Tiki Taka", "Anticipate", "Jockey", "Quick Step", "First Touch", "Press Proven", "Long Ball Pass", "Inventive", "Relentless"],
      "Box Crasher": ["Incisive Pass", "Intercept", "Pinged Pass", "Finesse Shot", "Bruiser", "Tiki Taka", "Quick Step", "Anticipate", "Technical", "Press Proven", "Relentless", "First Touch", "Low Driven Shot"],
      "Centre Half": ["Bruiser", "Intercept", "Jockey", "Quick Step", "Anticipate", "Block", "Tiki Taka", "Pinged Pass", "Aerial Fortress", "Slide Tackle", "Long Ball Pass", "Relentless", "First Touch"],
      "Wide Half": ["Bruiser", "Anticipate", "Quick Step", "Intercept", "Jockey", "Incisive Pass", "Block", "Tiki Taka", "Pinged Pass", "Press Proven", "Relentless", "Slide Tackle", "Aerial Fortress"],
    },
    "RB / LB": {
      "Fullback": ["Bruiser", "Anticipate", "Quick Step", "Intercept", "Jockey", "Incisive Pass", "Block", "Tiki Taka", "Pinged Pass", "Press Proven", "Relentless", "Slide Tackle", "Aerial Fortress"],
      "Wingback": ["Intercept", "Quick Step", "Pinged Pass", "Rapid", "Jockey", "Anticipate", "Bruiser", "Tiki Taka", "Incisive Pass", "Relentless", "Press Proven", "Whipped Pass", "First Touch"],
      "Falseback": ["Pinged Pass", "Anticipate", "Bruiser", "Intercept", "Jockey", "Tiki Taka", "Incisive Pass", "Quick Step", "First Touch", "Press Proven", "Long Ball Pass", "Relentless", "Rapid"],
      "Attacking Wingback": ["Quick Step", "Incisive Pass", "Tiki Taka", "Anticipate", "Jockey", "Intercept", "Rapid", "Pinged Pass", "Press Proven", "Relentless", "Bruiser", "First Touch", "Inventive"],
      "Inverted Wingback": ["Pinged Pass", "Quick Step", "Rapid", "Bruiser", "Intercept", "Tiki Taka", "Incisive Pass", "Anticipate", "Relentless", "Jockey", "First Touch", "Whipped Pass", "Press Proven"],
    },
    "CB": {
      "Defender": ["Intercept", "Bruiser", "Quick Step", "Anticipate", "Jockey", "Block", "Pinged Pass", "Aerial Fortress", "Slide Tackle", "Tiki Taka", "Press Proven", "Relentless", "First Touch"],
      "Stopper": ["Intercept", "Bruiser", "Anticipate", "Quick Step", "Aerial Fortress", "Jockey", "Block", "Slide Tackle", "Tiki Taka", "Pinged Pass", "Relentless", "First Touch", "Long Ball Pass"],
      "Ball Playing Defender": ["Intercept", "Quick Step", "Anticipate", "Jockey", "Bruiser", "Block", "Pinged Pass", "Aerial Fortress", "Slide Tackle", "Tiki Taka", "Press Proven", "Relentless", "First Touch"],
      "Wide Back": ["Intercept", "Bruiser", "Quick Step", "Anticipate", "Jockey", "Block", "Pinged Pass", "Tiki Taka", "First Touch", "Press Proven", "Aerial Fortress", "Slide Tackle", "Relentless"],
    },
    "GK": {
      "Goalkeeper": ["Footwork", "Far Reach", "1v1 Close Down", "Far Throw", "Cross Claimer", "Deflector", "Pinged Pass", "Long Ball Pass", "Tiki Taka", "Press Proven", "First Touch", "Incisive Pass", "Finesse Shot"],
      "Ball Playing": ["Footwork", "Far Reach", "1v1 Close Down", "Cross Claimer", "Deflector", "Pinged Pass", "Far Throw", "Long Ball Pass", "Tiki Taka", "Press Proven", "First Touch", "Incisive Pass", "Finesse Shot"],
      "Sweeper Keeper": ["Footwork", "1v1 Close Down", "Far Reach", "Deflector", "Cross Claimer", "Pinged Pass", "Far Throw", "Long Ball Pass", "Tiki Taka", "Press Proven", "First Touch", "Incisive Pass", "Finesse Shot"],
    },
  };

  // ---- role-based suggestion ----
  function populatePositions() {
    if (state.item) {
      const groups = playerPositionGroups(state.item);
      const list = groups.length ? groups : Object.keys(BEST_BY_ROLE);
      els.pos.innerHTML = list.map((p) => `<option>${esc(p)}</option>`).join("");
    } else {
      els.pos.innerHTML = '<option value="">position…</option>' + Object.keys(BEST_BY_ROLE).map((p) => `<option>${esc(p)}</option>`).join("");
    }
    populateRoles();
  }
  function populateRoles() {
    const pos = els.pos.value;
    const rs = pos && BEST_BY_ROLE[pos] ? Object.keys(BEST_BY_ROLE[pos]) : [];
    els.role.innerHTML = '<option value="">role…</option>' + rs.map((r) => `<option>${esc(r)}</option>`).join("");
  }
  // Pure: which evo slotIds to select for a player at a position+role, respecting
  // caps, ownership and GK scope. Returns { slots:[slotIds], owned, skip:[names] }.
  function suggestedSlots(it, pos, role, namesOverride) {
    const names = Array.isArray(namesOverride) && namesOverride.length
      ? namesOverride
      : (BEST_BY_ROLE[pos] && BEST_BY_ROLE[pos][role]) || [];
    const gk = isGKItem(it);
    let plusUsed = numPlus(it) ?? 0, baseUsed = numBasic(it) ?? 0, owned = 0;
    const slots = [], skip = [];
    names.forEach((name, idx) => {
      const wantPlus = idx < CAP_PLUS; // top cap count -> PS+
      const evo = wantPlus ? pspByName[name] : psByName[name];
      if (!evo) { skip.push(name); return; }
      if (evo.g && !gk) { skip.push(name + " (GK-only)"); return; }
      if (hasEvo(it, evo)) { owned++; return; }
      if (wantPlus) { if (plusUsed >= capPlus(it)) { skip.push(name + "+ (no room)"); return; } plusUsed++; }
      else { if (baseUsed >= CAP_BASIC) { skip.push(name + " (no room)"); return; } baseUsed++; }
      slots.push(evo.s);
    });
    return { slots, owned, skip };
  }
  async function suggest() {
    if (!state.item) return log("✋ Select a player first.", "warn");
    const pos = els.pos.value, role = els.role.value;
    if (!pos || !role || !BEST_BY_ROLE[pos] || !BEST_BY_ROLE[pos][role]) return log("✋ Pick a position and role.", "warn");

    // Keep order deterministic: walk the hardcoded list top-to-bottom, skipping
    // styles already owned or capped, then continue with the next style.
    const { slots, owned, skip } = suggestedSlots(state.item, pos, role);
    state.selected.clear();
    slots.forEach((s) => state.selected.add(s));
    setTab(idxTab());
    renderGrid(); updateCount();
    log(`✨ Preselected ${slots.length}${owned ? `, ${owned} owned` : ""}${skip.length ? `, ${skip.length} skipped` : ""} — hardcoded role order.`, "head");
    if (skip.length) log("   skipped: " + skip.join(", "), "dim");
  }

  // --- Auto (bulk) mode: resolver + checklist + direct apply ------------------
  // attributes = [pace, shooting, passing, dribbling, defending, physical]
  const ATT = (it, i) => { try { const a = (it.getAttributes && it.getAttributes()) || it.attributes; return a && a[i] != null ? +a[i] : null; } catch (_) { return null; } };
  const DEFAULT_ROLE = {
    "ST": "Advanced Forward", "RW / LW": "Inside Forward", "RM / LM": "Inside Forward",
    "CAM": "Shadow Striker", "CM": "Box to Box", "CDM": "Deep Lying Playmaker",
    "RB / LB": "Fullback", "CB": "Defender", "GK": "Goalkeeper",
  };
  const CM_DLP_RATIO = 0.94; // shooting/defending at or below this -> Deep Lying Playmaker
  // Pick { pos, role } from a card's primary position, with a CM attribute tweak.
  function autoResolveRole(it) {
    let pos = POS_GROUP[it && it.preferredPosition];
    if (!pos) { const g = playerPositionGroups(it); pos = g[0]; }
    if (!pos) return null;
    let role = DEFAULT_ROLE[pos];
    if (pos === "CM") {
      const sho = ATT(it, 1), def = ATT(it, 4);
      if (sho != null && def != null && def > 0) {
        if (sho / def <= CM_DLP_RATIO) role = "Deep Lying Playmaker";
        else if (def < 80 && sho > def) role = "Playmaker";
      }
    }
    if (!BEST_BY_ROLE[pos] || !BEST_BY_ROLE[pos][role]) role = BEST_BY_ROLE[pos] ? Object.keys(BEST_BY_ROLE[pos])[0] : role;
    return { pos, role };
  }
  function setMode(m) {
    const next = m === "auto" ? "auto" : "single";
    if (next !== state.mode) {
      // Switching modes starts clean — drop the other mode's transient selection.
      if (next === "auto") { state.selected.clear(); }   // leaving Single: clear evo picks
      else { state.queue = []; }                          // leaving Auto: clear the queue
      state.abort = false;
    }
    state.mode = next;
    const auto = state.mode === "auto";
    els.root.querySelectorAll(".modetabs button").forEach((b) => b.classList.toggle("on", b.getAttribute("data-mode") === state.mode));
    els.evosec.style.display = auto ? "none" : "";
    els.queuesec.style.display = "none"; // renderQueue re-shows it in Auto when non-empty
    els.preview.style.display = auto ? "none" : (state.item ? "" : "none");
    if (els.clearsel) els.clearsel.style.display = auto ? "" : "none"; // clears the queue (auto only)
    if (els.pickhdr) els.pickhdr.textContent = auto ? "Click players to queue" : "Select from club";
    renderList(); // one shared list; click = select (single) or queue (auto)
    if (auto) renderQueue(); else { renderPreview(); renderGrid(); updateCount(); }
    updateRunBtn();
  }
  function updateRunBtn() {
    if (!els.runbtn) return;
    // any label refresh also disarms the two-step confirm
    clearTimeout(_armTimer); els.runbtn.dataset.armed = ""; els.runbtn.classList.remove("armed");
    if (state.mode === "auto") {
      const n = state.queue.length;
      els.runbtn.textContent = n ? `Evolve selected players (${n})` : "Evolve selected players";
    } else {
      els.runbtn.textContent = "Apply selected evolutions";
    }
  }
  function disarmRun() { clearTimeout(_armTimer); if (els.runbtn) { els.runbtn.dataset.armed = ""; els.runbtn.classList.remove("armed"); } updateRunBtn(); }
  // Run button entry point. Single applies immediately; Auto uses an in-panel
  // two-step confirm (first click arms the button, second click within 4s evolves).
  function requestRun(opts) {
    if (state.running) return;
    if (state.mode !== "auto") return runDispatch(opts);
    if (!state.queue.length) return log("✋ Queue is empty — click players to add them.", "warn");
    if (els.runbtn.dataset.armed === "1") { clearTimeout(_armTimer); els.runbtn.dataset.armed = ""; els.runbtn.classList.remove("armed"); return runDispatch(opts); }
    els.runbtn.dataset.armed = "1"; els.runbtn.classList.add("armed");
    const total = state.queue.reduce((s, q) => s + q.slots.length, 0);
    els.runbtn.textContent = `Confirm — evolve ${state.queue.length} (${total} evo${total > 1 ? "s" : ""})?`;
    _armTimer = setTimeout(disarmRun, 4000);
  }

  // --- Auto queue: click a player to add (auto-resolved), review, remove, evolve ---
  function toggleQueue(it) {
    const i = state.queue.findIndex((q) => q.item.id === it.id);
    if (i >= 0) { state.queue.splice(i, 1); renderList(); renderQueue(); updateRunBtn(); return; } // click again = remove
    const rr = autoResolveRole(it);
    const { slots } = rr ? suggestedSlots(it, rr.pos, rr.role) : { slots: [] };
    if (!slots.length) return log(`⊘ ${playerName(it)}: nothing to add (owned/capped).`, "warn");
    state.queue.push({ item: it, role: rr, slots });
    renderList(); renderQueue(); updateRunBtn();
    log(`➕ Queued ${playerName(it)} (${slots.length} evo${slots.length > 1 ? "s" : ""}).`, "head");
  }
  function removeFromQueue(id) { const i = state.queue.findIndex((q) => q.item.id === id); if (i >= 0) state.queue.splice(i, 1); renderList(); renderQueue(); updateRunBtn(); }
  function clearQueue() { if (!state.queue.length) return; state.queue = []; renderList(); renderQueue(); updateRunBtn(); log("Queue cleared.", "dim"); }
  function renderQueue() {
    if (!els.queuesec) return;
    if (!state.queue.length) { els.queuesec.style.display = "none"; return; }
    els.queuesec.style.display = "";
    els.qcount.textContent = state.queue.length + " player" + (state.queue.length > 1 ? "s" : "");
    els.qlist.innerHTML = state.queue.map((q) => {
      const it = q.item, gk = isGKItem(it);
      const roleTxt = q.role ? `${q.role.pos} · ${q.role.role}` : "";
      const chips = q.slots.map((sid) => {
        const evo = byId(sid); if (!evo) return "";
        const nm = dispName(baseName(evo));
        return `<span class="chip ${evo.kind === "PS+" ? "ic" : ""}" data-ini="${esc(initials(nm))}" data-tip="${esc(nm)}${evo.kind === "PS+" ? " +" : ""}|${esc(psDesc(baseName(evo)))}"><i class="${iconClass(evo.kind === "PS+", evoTrait(evo))}"></i></span>`;
      }).join("");
      return `<div class="qi"><div class="qi-head"><span class="ov">${it.rating ?? "?"}</span>`
        + `<span class="nm">${esc(playerName(it))}${gk ? ' <span class="gk">GK</span>' : ""}</span>`
        + (roleTxt ? `<span class="rolechip">${esc(roleTxt)}</span>` : "")
        + `<button class="qx" data-qrm="${it.id}" title="Remove from queue">✕</button></div>`
        + `<div class="qps">${chips}</div></div>`;
    }).join("");
    markGlyphs();
  }

  // Dump a player entity so the obfuscated attribute field names can be mapped.
  function dumpEntity() {
    const it = state.item;
    if (!it) { log("✋ Select a player first.", "warn"); return null; }
    const numeric = Object.keys(it).filter((k) => typeof it[k] === "number");
    const dump = {
      id: it.id, rating: it.rating, height: it.height, weight: it.weight,
      numericProps: numeric, ownKeys: Object.keys(it),
      protoMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(it) || {}),
      attributeList: it.attributeList, attributeArray: it.attributeArray,
      coverage: readAttrs(it)._coverage,
    };
    console.log("[FCEvo] entity dump — share this to finalize attribute mapping:", dump);
    log("🔬 Entity dumped to console (attribute coverage " + Math.round(dump.coverage * 100) + "%).", "head");
    return dump;
  }
  function idxTab() { // show the tab that has the most selected, default PS+
    const selPlus = [...state.selected].filter((s) => byId(s) && byId(s).kind === "PS+").length;
    return selPlus >= state.selected.size - selPlus ? "PS+" : "PS";
  }

  function renderPreview() {
    const box = els.preview;
    if (!state.item) { box.style.display = "none"; return; }
    const it = state.item;
    const gk = (() => { try { return it.isGK(); } catch (_) { return false; } })();
    const nb = numBasic(it), np = numPlus(it), cp = capPlus(it);
    const basicFull = nb != null && nb >= CAP_BASIC, plusFull = np != null && np >= cp;
    box.style.display = "";
    box.innerHTML = `
      <div class="card">
        <div class="ov">${it.rating ?? "?"}</div>
        <div class="meta">
          <div class="pn">${esc(playerName(it))} ${gk ? '<span class="gk" style="font-size:10px;color:var(--acc)">GK</span>' : ""}</div>
          <div class="muted">${esc(rarityName(it))}</div>
        </div>
      </div>
      <div class="caps">
        <div class="cap ${plusFull ? "full" : ""}"><b>${np ?? "?"}/${cp}</b><small>PS+ used</small></div>
        <div class="cap ${basicFull ? "full" : ""}"><b>${nb ?? "?"}/${CAP_BASIC}</b><small>Basic used</small></div>
      </div>
      <div class="psrow">${currentPlayStyles(it).map((p) => {
        const nm = traitName[p.traitId] || ("trait " + p.traitId);
        return `<div class="chip ${p.isIcon ? "ic" : ""}" data-ini="${esc(initials(nm))}" data-tip="${esc(dispName(nm))}${p.isIcon ? " +" : ""}|${esc(psDesc(nm))}"><i class="${iconClass(p.isIcon, p.traitId)}"></i></div>`;
      }).join("") || '<span class="muted">no playstyles</span>'}</div>`;
    markGlyphs();
  }

  // ---- evo grid ----
  function evoCard(evo, it, gkPlayer) {
    const owned = it ? hasEvo(it, evo) : false;
    // A base PlayStyle is redundant when the player already has — or has selected —
    // the + version of the same playstyle (same rewardId). Block it so you can't
    // "downgrade" or double up; the + already covers it.
    let plusBlocked = false;
    if (it && evo.kind === "PS") {
      let plusOwned = false; try { plusOwned = !!it.hasPlusPlayStyle(evoTrait(evo)); } catch (_) {}
      const plusSel = [...state.selected].some((s) => { const e = byId(s); return e && e.kind === "PS+" && e.r === evo.r; });
      plusBlocked = plusOwned || plusSel;
    }
    // GK-exclusive evos (g=1) need a GK; "any player" evos (g=0) are open to all (incl. GKs)
    const wrongScope = it ? (!!evo.g && !gkPlayer) : false;
    const dis = wrongScope || owned || !!evo.disGH || plusBlocked; // owned -> would 460; disGH -> not applicable yet
    const sel = state.selected.has(evo.s);
    const card = document.createElement("div");
    card.className = "ec" + (evo.kind === "PS+" ? " psp" : "") + (sel ? " sel" : "") + (owned ? " owned" : "") + (dis ? " dis" : "");
    const nm = dispName(baseName(evo));
    const tipTitle = nm + (evo.kind === "PS+" ? " +" : "")
      + (wrongScope ? " · goalkeepers only" : "") + (owned ? " · already owned" : "")
      + (plusBlocked && !owned ? " · + version already applied/selected" : "")
      + (evo.disGH && !owned ? " · needs 3 PS+ first (or none left)" : "");
    card.setAttribute("data-tip", tipTitle + "|" + psDesc(baseName(evo)));
    card.innerHTML = `<div class="ico" data-ini="${esc(initials(nm))}"><i class="${iconClass(evo.kind === "PS+", evoTrait(evo))}"></i></div>` +
      `<div class="nm">${esc(nm)}</div>${owned ? '<span class="own" aria-label="owned"></span>' : ""}`;
    if (!dis) card.addEventListener("click", () => toggleEvo(evo, card));
    return card;
  }
  function renderGrid() {
    const box = els.grid; box.innerHTML = "";
    const it = state.item;
    const gkPlayer = it ? (() => { try { return it.isGK(); } catch (_) { return false; } })() : null;
    const list = current();
    // Bucket by EA category, then render each non-empty category in game order.
    const groups = {};
    list.forEach((evo) => { const c = CAT_OF[baseName(evo)] || "Other"; (groups[c] || (groups[c] = [])).push(evo); });
    CAT_ORDER.concat("Other").forEach((cat) => {
      const evos = groups[cat];
      if (!evos || !evos.length) return;
      const sec = document.createElement("div");
      sec.innerHTML = `<div class="gcat-h">${esc(cat)}</div>`;
      const row = document.createElement("div"); row.className = "gcat-row";
      evos.forEach((evo) => row.appendChild(evoCard(evo, it, gkPlayer)));
      sec.appendChild(row);
      box.appendChild(sec);
    });
    markGlyphs();
  }
  // EA's icon font fills the diamonds/hexagons on the live app. If a glyph isn't
  // rendering (font not yet loaded, or a genuinely blank glyph), fall back to the
  // playstyle's initials so a shape is never empty. Toggles both ways so it self-
  // corrects once document.fonts settles.
  function markGlyphs() {
    if (!els.root) return;
    els.root.querySelectorAll(".ec .ico, .psrow .chip, .qps .chip").forEach((el) => {
      const g = el.querySelector("i");
      el.classList.toggle("noglyph", !g || g.getBoundingClientRect().width < 4);
    });
  }

  function counterpart(evo) { return ALL.find((x) => x.r === evo.r && x.kind !== evo.kind); }
  function toggleEvo(evo, card) {
    const on = !state.selected.has(evo.s);
    if (on) {
      if (!checkCap(evo)) return;
      // base & + of the same playstyle are mutually exclusive
      const cp = counterpart(evo);
      if (cp && state.selected.has(cp.s)) {
        state.selected.delete(cp.s);
        log(`↔ Replaced ${cp.n} with ${evo.n} (same PlayStyle).`, "dim");
      }
      state.selected.add(evo.s);
    } else {
      state.selected.delete(evo.s);
    }
    card.classList.toggle("sel", on);
    updateCount();
  }

  function checkCap(evo) {
    if (!state.item) return true;
    const it = state.item;
    if (evo.kind === "PS+") {
      const used = numPlus(it) ?? 0;
      const selPlusAll = [...state.selected].filter((s) => { const e = byId(s); return e && e.kind === "PS+"; }).length;
      if (evo.gh) {
        // GH reward = the 4th slot (cap 4 on Glory Hunters cards).
        const cap = capPlus(it);
        if (used + selPlusAll >= cap) { log(`✋ 4th PS+ cap: player has ${used}/${cap} PS+, ${selPlusAll} queued. No room.`, "warn"); return false; }
      } else {
        // Repeatable PS+ never goes past 3 — the 4th can only come from a GH reward.
        const selRepeat = [...state.selected].filter((s) => { const e = byId(s); return e && e.kind === "PS+" && !e.gh; }).length;
        if (used + selRepeat >= CAP_PLUS) { log(`✋ PS+ cap: player has ${used}/${CAP_PLUS}, ${selRepeat} queued. No room.`, "warn"); return false; }
      }
    } else {
      const used = numBasic(it) ?? 0;
      const selB = [...state.selected].filter((s) => { const e = byId(s); return e && e.kind === "PS"; }).length;
      if (used + selB >= CAP_BASIC) { log(`✋ Basic cap: player has ${used}/${CAP_BASIC}, ${selB} queued. No room.`, "warn"); return false; }
    }
    return true;
  }

  function updateCount() {
    const selPlus = [...state.selected].filter((s) => byId(s) && byId(s).kind === "PS+").length;
    const selB = state.selected.size - selPlus;
    let txt = `${state.selected.size} selected (${selPlus} PS+, ${selB} PS)`;
    let over = false;
    if (state.item) {
      // Project where the player lands once the queued batch is applied, so the
      // caps are visible before hitting Apply.
      const cp = capPlus(state.item);
      const pp = (numPlus(state.item) ?? 0) + selPlus, pb = (numBasic(state.item) ?? 0) + selB;
      txt += ` → ${pp}/${cp} PS+, ${pb}/${CAP_BASIC} basic`;
      over = pp > cp || pb > CAP_BASIC;
    }
    els.count.textContent = txt;
    els.count.classList.toggle("over", over);
  }

  function setRunning(on) { els.run.disabled = on; els.stop.style.display = on ? "" : "none"; els.run.style.display = on ? "none" : ""; if (els.clearsel) els.clearsel.style.display = (on || state.mode !== "auto") ? "none" : ""; }

  // Latest message shows in the status line (full history goes to the console).
  // Strip any leading status glyph/emoji — state is conveyed by colour, not icons.
  const deglyph = (s) => String(s).replace(/^(?:\p{Extended_Pictographic}|[\u2190-\u21FF\u2300-\u27FF\u2900-\u29FF\u2B00-\u2BFF\uFE0F\u200D])+\s*/u, "");
  function log(msg, cls) {
    const shown = deglyph(msg);
    if (els.status) { els.status.textContent = shown; els.status.className = "status " + (cls || ""); }
    (cls === "err" ? console.error : cls === "warn" ? console.warn : console.log)("[FCEvo]", msg);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const initials = (n) => n.replace(/\+$/, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

  function makeDraggable(el, handle) {
    let sx, sy, ox, oy;
    // Attach move/up only for the duration of a drag, so we aren't running a
    // handler on every mouse move across the whole page for the app's lifetime.
    const onMove = (e) => { el.style.left = ox + e.clientX - sx + "px"; el.style.top = oy + e.clientY - sy + "px"; };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
      savePrefs({ pos: { left: el.style.left, top: el.style.top } });
    };
    handle.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect(); ox = r.left; oy = r.top;
      el.style.right = "auto"; el.style.left = ox + "px"; el.style.top = oy + "px"; e.preventDefault();
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  }

  // Hover tooltips for any [data-tip="Title|Body"] element. The tip lives on
  // <body> (not inside the panel) so the panel's overflow:hidden can't clip it,
  // and is placed beside the panel, clamped to the viewport.
  function initTips() {
    const tip = document.createElement("div");
    tip.id = "fcevo-tip"; tip.style.display = "none";
    document.body.appendChild(tip);
    let cur = null;
    const place = (el) => {
      const er = el.getBoundingClientRect(), pr = els.root.getBoundingClientRect(), tr = tip.getBoundingClientRect(), gap = 8;
      let left = pr.left - tr.width - gap;
      if (left < 8) left = Math.min(pr.right + gap, window.innerWidth - tr.width - 8);
      let top = er.top + er.height / 2 - tr.height / 2;
      top = Math.max(8, Math.min(top, window.innerHeight - tr.height - 8));
      tip.style.left = Math.round(left) + "px"; tip.style.top = Math.round(top) + "px";
    };
    els.root.addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-tip]");
      if (!el || el === cur) return;
      cur = el;
      const p = (el.getAttribute("data-tip") || "").split("|");
      tip.innerHTML = "<b>" + esc(p[0]) + "</b>" + (p[1] ? "<span>" + p[1] + "</span>" : "");
      tip.style.display = "block";
      place(el);
    });
    els.root.addEventListener("mouseout", (e) => {
      const el = e.target.closest("[data-tip]");
      if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) { cur = null; tip.style.display = "none"; }
    });
  }

  // --- boot -----------------------------------------------------------------
  // Auto-SBC integration: instead of auto-mounting a floating panel, the Evo
  // Helper is embedded into its own EA nav screen (see features/playstyle-evo/
  // nav.js). We expose window.FCEvo.mount(container)/unmount() which lazily
  // build the panel once, embed it, and kick off the club load. The single
  // instance is preserved across screen visits (state kept, no duplicate CSS).
  const exposeApi = () => {
    window.FCEvo = Object.assign(window.FCEvo || {}, {
      applyEvo, claimEvo, runBatch, runDispatch, state, PS, PSP, clubPlayers,
      selectPlayer, scrapeRarities, clubRaritiesDump, eligibleRarities, loadClub,
      startClubLoad, readAttrs, dumpEntity, openEntity, freshItemById,
      reloadAndReselect, setMode, autoResolveRole, suggestedSlots, toggleQueue,
      clearQueue, requestRun, mount, unmount,
    });
  };

  // Wait until the active squad is loaded (app ready for club searches), then
  // load the club. Runs once per session. Hard fallback at 15s so it can't hang.
  let _clubKicked = false;
  function kickClubLoad() {
    if (_clubKicked) return;
    _clubKicked = true;
    setClubStatus("Club: waiting for squad…", "load");
    let waited = 0;
    const gate = setInterval(() => {
      if (squadReady() || waited >= 15000) { clearInterval(gate); startClubLoad(1); return; }
      waited += 200;
    }, 200);
  }

  // Mount the panel into a host container (the Evo Helper screen). Returns false
  // if the EA app isn't ready yet so the caller can retry.
  function mount(container) {
    if (!(ACAD() && CLUB())) return false;
    if (!document.getElementById("fcevo")) build();
    const root = document.getElementById("fcevo");
    if (!root) return false;
    root.style.display = "";
    root.classList.add("fcevo-embedded");
    root.classList.remove("min");
    if (container && root.parentElement !== container) container.appendChild(root);
    exposeApi();
    kickClubLoad();
    return true;
  }

  // Detach the panel back to <body> (hidden) so EA can tear down the screen
  // container without destroying our instance — state is preserved for re-open.
  function unmount() {
    const root = document.getElementById("fcevo");
    if (root) {
      root.classList.remove("fcevo-embedded");
      root.style.display = "none";
      if (root.parentElement !== document.body) document.body.appendChild(root);
    }
  }

  exposeApi();
})();
