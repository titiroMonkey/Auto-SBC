// ==UserScript==
// @name         FIFA Auto SBC
// @namespace    http://tampermonkey.net/
// @version      25.1.17
// @description  automatically solve EAFC 25 SBCs using the currently available players in the club with the minimum cost
// @author       TitiroMonkey
// @match        https://www.easports.com/*/ea-sports-fc/ultimate-team/web-app/*
// @match        https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/npm/choices.js/public/assets/scripts/choices.min.js
// @require      http://d3js.org/d3.v3.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/c3/0.4.11/c3.min.js
// @require      https://pivottable.js.org/dist/pivot.js
// @require      https://pivottable.js.org/dist/c3_renderers.js
// @require      https://pivottable.js.org/dist/d3_renderers.js
// @resource     C3_CSS https://cdnjs.cloudflare.com/ajax/libs/c3/0.4.11/c3.min.css
// @resource      PIVOT_CSS https://pivottable.js.org/dist/pivot.css
// @resource     CHOICES_BASE_CSS https://cdn.jsdelivr.net/npm/choices.js/public/assets/styles/base.min.css
// @resource     CHOICES_CSS https://cdn.jsdelivr.net/npm/choices.js/public/assets/styles/choices.min.css
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @connect 	 www.fut.gg
// @require      https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.17/d3.min.js
// @connect      127.0.0.1

// ==/UserScript==

(function () {
  "use strict";
  const myBaseCss = GM_getResourceText("CHOICES_BASE_CSS");
  // GM_addStyle(myBaseCss);
  const myCss = GM_getResourceText("CHOICES_CSS");
  GM_addStyle(myCss);
  const mypivotCss = GM_getResourceText("PIVOT_CSS");
  GM_addStyle(mypivotCss);
  const myC3Css = GM_getResourceText("C3_CSS");
  GM_addStyle(myC3Css);
  //turn on console log
  let i = document.createElement("iframe");
  i.style.display = "none";
  document.body.appendChild(i);
  window.console = i.contentWindow.console;

  //Add Locked Icon
  let styles = `
     * {
       scrollbar-width: thin;
       scrollbar-color: rgba(0, 0, 0, .5) #ffffff;
     }
     
     *::-webkit-scrollbar {
       width: 12px;
       height: 12px;
     }

     *::-webkit-scrollbar-thumb {
       background-color: rgba(0, 0, 0, .5);
       border-radius: 10px;
       border: 2px solid #ffffff; 
     }

     *::-webkit-scrollbar-track {
       border-radius: 10px;
       background-color: #ffffff;
     }

     html[dir=ltr] #NotificationLayer {
       right: 6.5rem;
     }
     
     /* Rest of the styles unchanged */
     .ut-companion-carousel-item-container-view .item-container{
     padding-top:20px;
     }
     .ut-tab-bar-item.sbcToolBarHover {
    background-color: #1f2020;
    color: #fcfcf7
}
.untradable::before {
    content: "\\E0D8";
    color: #fd4821;
    font-family: UltimateTeam-Icons, sans-serif;
    margin-left: .5rem;
    font-size: 0.8rem;
    right: 0;
    bottom: 5px;
    position: absolute;
}
    .tradable::before {
    content: "\\E0D3";
    color: #07f468;
    font-family: UltimateTeam-Icons, sans-serif;
    margin-left: .5rem;
    font-size: 0.8rem;
    right: 0;
    bottom: 5px;
    position: absolute;
}
.ut-tab-bar-item.sbcToolBarHover.ut-tab-bar-item--default-to-root span::after {
    background-color: #fcfcf7
}
.landscape .ut-tab-bar-item.sbcToolBarHover::after {
    height: 100%;
    width: 4px
}
.ut-tab-bar-item {
word-wrap:breakword;
}
     .ut-tab-bar-item.sbcToolBarHover::after {
    content: "";
    background-color: #07f468;
    display: block;
    height: 2px;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%
}
    .player.locked::before {
    font-family: 'UltimateTeam-Icons';
    position: absolute;
    content: '\\E07F';
    right: 8px;
    bottom: 2px;
    color: #00ff00;
    z-index: 2;
}
    .sbc-settings-container {
    overflow-y: scroll;
    display: flex;
    align-items: center;
    padding: 10px;
    }
    .sbc-settings {
    overflow-y: auto;
    //display: flex;
    flex-wrap: wrap;
    margin-top: 20px;
    box-shadow: 0 1rem 3em rgb(0 0 0 / 40%);
    background-color: #2a323d;
    width: 75%;
    justify-content: space-between;
    min-height:85%;
}

.sbc-settings-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 10px;
    width: 100%;
}
.sbc-settings-wrapper {
    background-color: #2a323d;
}
.sbc-settings-wrapper.tile {
    overflow: unset;
    border: 1px solid #556c95;
    border-radius: unset;
}
.sbc-settings-section {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    justify-content: space-between;
    align-items: flex-end;
}
.sbc-settings-field {
    margin-top: 15px;
    width: 45%;
    padding: 10px;
}
   .ut-tab-bar-item.icon-sbcSettings:before {
      content: "\\E051";
   }
   .player.fixed::before {
    font-family: 'UltimateTeam-Icons';
    position: absolute;
    content: '\\E07F';
    right: 8px;
    bottom: 2px;
    color: #ff0000;
    z-index: 2;
}
   .item-price{
    width: auto !important;
    padding: 0 0.2rem;
    left: 50%;
    transform: translateX(-50%) !important;
    white-space: nowrap;
    background: #1e242a;
    border: 1px solid cornflowerblue;
    border-radius: 5px;
    position: absolute;
    z-index: 2;
    color: #fff;
    }
    .numCounter {
  display: none;
  height: 90px;
  line-height: 90px;
  text-shadow: 0 0 2px #fff;
  font-weight: bold;
  white-space: normal;
  font-size: 50px;
  position: absolute;
  bottom: 0;
  right:0px;
  transform: scale(0.5);
}

.numCounter > div {
  display: inline-block;
  vertical-align: top;
  height: 100%;

}

.numCounter > div > b {
  display: inline-block;
  width: 40px;
  height: 100%;
  margin: 0 0.1em;
  border-radius: 8px;
  text-align: center;
  background: white;
  overflow: hidden;
}

.numCounter > div > b::before {
  content: ' 0 1 2 3 4 5 6 7 8 9 ';
  display: block;
  word-break: break-all;
  -webkit-transition: 0.5s cubic-bezier(0.75, 0.15, 0.6, 1.15), text-shadow 150ms;
  transition: 0.5s cubic-bezier(0.75, 0.15, 0.6, 1.15), text-shadow 150ms;
}

.numCounter > div > b.blur {
  text-shadow: 2px 1px 3px rgba(0, 0, 0, 0.2),
               0 0.1em 2px rgba(255, 255, 255, 0.6),
               0 0.3em 3px rgba(255, 255, 255, 0.3),
               0 -0.1em 2px rgba(255, 255, 255, 0.6),
               0 -0.3em 3px rgba(255, 255, 255, 0.3);
}

.numCounter > div > b[data-value="1"]::before { margin-top: -90px; }
.numCounter > div > b[data-value="2"]::before { margin-top: -180px;}
.numCounter > div > b[data-value="3"]::before { margin-top: -270px;}
.numCounter > div > b[data-value="4"]::before { margin-top: -360px;}
.numCounter > div > b[data-value="5"]::before { margin-top: -450px;}
.numCounter > div > b[data-value="6"]::before { margin-top: -540px;}
.numCounter > div > b[data-value="7"]::before { margin-top: -630px;}
.numCounter > div > b[data-value="8"]::before { margin-top: -720px;}
.numCounter > div > b[data-value="9"]::before { margin-top: -810px;}

.numCounter {
  overflow: hidden;
  padding: .4em;
  text-align: center;

  border-radius: 16px;
  background: black;
}
.numCounter b {
  color: black;
}

.currency-sbc::after {
    background-position: right top;
    content: "";
    background-repeat: no-repeat;
    background-size: 100%;
    display: inline-block;
    height: 1em;
    vertical-align: middle;
    width: 1em;
    background-image: url(../web-app/images/sbc/logo_SBC_home_tile.png);
    margin-top: -.15em;
}
.currency-objective::after {
    background-position: right top;
    content: "";
    background-repeat: no-repeat;
    background-size: 100%;
    display: inline-block;
    height: 1em;
    vertical-align: middle;
    width: 1em;
    background-image: url(../web-app/images/pointsIcon.png);
    margin-top: -.15em;
}
.choices__item, .choices__list--dropdown .choices__item {
  display: flex;
  align-items: center;
}

.choices__item img {
  margin-right: 8px;
}
.choices__list--multiple .choices__item {
background-color: black;
display:flex;
width:fit-content;
}
.choices__inner{
min-height: 20px;
}
.choices{
color:black
}
`;
  let styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  const getElement = (query, parent = document) => {
    return getRootElement(parent).querySelector(query);
  };
  const css = (elem, css) => {
    for (let key of Object.keys(css)) {
      getRootElement(elem).style[key] = css[key];
    }
    return elem;
  };
  const addClass = (elem, ...className) => {
    getRootElement(elem).classList.add(...className);
    return elem;
  };
  const removeClass = (elem, className) => {
    try {
    getRootElement(elem).classList.remove(className);
    } catch (error) {
      
    }
    return elem;
  };
  const getElementString = (node) => {
    let DIV = document.createElement("div");
    if ("outerHTML" in DIV) {
      return node.outerHTML;
    }
    let div = DIV.cloneNode();
    div.appendChild(node.cloneNode(true));
    return div.innerHTML;
  };
  const createElem = (tag, attrs, innerHtml) => {
    let elem = document.createElement(tag);
    elem.innerHTML = innerHtml;
    if (attrs) {
      for (let attr of Object.keys(attrs)) {
        if (!attrs[attr]) continue;
        elem.setAttribute(attr === "className" ? "class" : attr, attrs[attr]);
      }
    }
    return elem;
  };
  const getRootElement = (elem) => {
    if (elem.getRootElement) {
      return elem.getRootElement();
    }
    return elem;
  };
  const insertBefore = (newNode, existingNode) => {
    existingNode = getRootElement(existingNode);
    existingNode.parentNode.insertBefore(getRootElement(newNode), existingNode);
    return newNode;
  };
  const insertAfter = (newNode, existingNode) => {
    existingNode = getRootElement(existingNode);
    existingNode.parentNode.insertBefore(
      getRootElement(newNode),
      existingNode.nextSibling
    );
    return newNode;
  };
  const createButton = (id, label, callback, buttonClass = "btn-standard") => {
    const innerSpan = createElem(
      "span",
      {
        className: "button__text",
      },
      label
    );
    const button = createElem(
      "button",
      {
        className: buttonClass,
        id: id,
      },
      getElementString(innerSpan)
    );
    button.addEventListener("click", function () {
      callback();
    });
    button.addEventListener("mouseenter", () => {
      addClass(button, "hover");
    });
    button.addEventListener("mouseleave", () => {
      removeClass(button, "hover");
    });
    return button;
  };

  const DEFAULT_SEARCH_BATCH_SIZE = 91;
  const MILLIS_IN_SECOND = 1000;
  const wait = async (maxWaitTime = 2) => {
    const factor = Math.random();
    await new Promise((resolve) =>
      setTimeout(resolve, factor * maxWaitTime * MILLIS_IN_SECOND)
    );
  };
  let fetchPlayers = ({ count = Infinity, level, rarities, sort } = {}) => {
    return new Promise((resolve) => {
      services.Club.clubDao.resetStatsCache();
      services.Club.getStats();
      let offset = 0;
      const batchSize = DEFAULT_SEARCH_BATCH_SIZE;
      let result = [];
      const fetchPlayersInner = () => {
        searchClub({
          count: batchSize,
          level,
          rarities,
          offset,
          sort,
        }).observe(undefined, async (sender, response) => {
          result = [...response.response.items];

          if (
            result.length < count &&
            Math.floor(response.status / 100) === 2 &&
            !response.response.retrievedAll
          ) {
            offset += batchSize;

            fetchPlayersInner();
            return;
          }
          // TODO: Handle statusCodes
          if (count) {
            result = result.slice(0, count);
          }
          resolve(result);
        });
      };
      fetchPlayersInner();
    });
  };

  const searchClub = ({ count, level, rarities, offset, sort }) => {
    const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;
    if (count) {
      searchCriteria.count = count;
    }
    if (level) {
      searchCriteria.level = level;
    }
    if (sort) {
      searchCriteria._sort = sort;
    }
    if (rarities) {
      searchCriteria.rarities = rarities;
    }
    if (offset) {
      searchCriteria.offset = offset;
    }
    return services.Club.search(searchCriteria);
  };
  let conceptPlayersCollected = false;
  let getConceptPlayers = async function (playerCount = 999999) {
    return new Promise((resolve, reject) => {
      console.log("Getting Concept Players");
      const gatheredPlayers = [];
      const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;
      searchCriteria.offset = 0;
      searchCriteria.sortBy = "rating";
      searchCriteria.count = DEFAULT_SEARCH_BATCH_SIZE;
      const getAllConceptPlayers = () => {
        searchConceptPlayers(searchCriteria).observe(
          this,
          async function (sender, response) {
            gatheredPlayers.push(...response.response.items);

            if (
              response.status !== 400 &&
              !response.response.endOfList &&
              searchCriteria.offset <= playerCount
            ) {
              searchCriteria.offset += searchCriteria.count;

              console.log("Concepts Retrieved", searchCriteria.offset);
              getAllConceptPlayers();
            } else {
              if (playerCount > 1) {
                conceptPlayersCollected = true;
                showNotification(
                  "Collected All Concept Players",
                  UINotificationType.POSITIVE
                );
              }
              resolve(gatheredPlayers);
            }
          }
        );
      };
      getAllConceptPlayers();
    });
  };
  const searchConceptPlayers = (searchCriteria) => {
    return services.Item.searchConceptItems(searchCriteria);
  };
  let getStoragePlayers = async function () {
    return new Promise((resolve, reject) => {
      const gatheredPlayers = [];
      const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;
      searchCriteria.offset = 0;
      searchCriteria.count = DEFAULT_SEARCH_BATCH_SIZE;
      const getAllStoragePlayers = () => {
        searchStoragePlayers(searchCriteria).observe(
          this,
          async function (sender, response) {
            gatheredPlayers.push(...response.response.items);
            if (response.status !== 400 && !response.response.endOfList) {
              searchCriteria.offset += searchCriteria.count;

              //console.log('Storages Retrieved',searchCriteria.offset)
              getAllStoragePlayers();
            } else {
              resolve(gatheredPlayers);
            }
          }
        );
      };
      getAllStoragePlayers();
    });
  };
  const searchStoragePlayers = (searchCriteria) => {
    return services.Item.searchStorageItems(searchCriteria);
  };
  let sendUnassignedtoTeam = async () => {
    let ulist = await fetchUnassigned();
    console.log(
      "sendUnassignedtoTeam",
      ulist.filter((l) => l.isMovable())
    );
    return new Promise((resolve) => {
      services.Item.move(
        ulist.filter((l) => l.isMovable()),
        7
      ).observe(this, function (obs, event) {
        resolve(ulist);
      });
    });
  };
  let discardNonPlayerDupes = async () => {
    let ulist = await fetchUnassigned();
    console.log(
      "discardNonPlayerDupes",
      ulist.filter((l) => !l.isPlayer() && l.isDuplicate())
    );
    return new Promise((resolve) => {
      ulist
        .filter((l) => !l.isPlayer() && l.isDuplicate())
        .forEach((card) => {
          services.Item.discard(card);
        });
      resolve(ulist);
    });
  };
  let swapDuplicates = async () => {
    let ulist = await fetchUnassigned();
    let playersToMove = ulist.filter((l) => !l.isTradeable && l.isDuplicate());
    console.log("swapDuplicates", playersToMove);
    return new Promise((resolve) => {
      if (playersToMove.length > 0) {
        services.Item.move(playersToMove, 7).observe(
          this,
          async function (obs, event) {
            repositories.Item.unassigned.clear();
            repositories.Item.unassigned.reset();
          }
        );
      }

      resolve(ulist);
    });
  };
  let sendDuplicatesToStorage = async () => {
    let ulist = await fetchUnassigned();

    let playersToMove = ulist.filter((l) => l.isStorable());
    console.log("sendToStorage", playersToMove);
    return new Promise((resolve) => {
      if (playersToMove.length > 0) {
        services.Item.move(playersToMove, 10).observe(
          this,
          function (obs, event) {
            repositories.Item.unassigned.clear();
            repositories.Item.unassigned.reset();
          }
        );
      }
      resolve(ulist);
    });
  };
  let fetchUnassigned = () => {
    repositories.Item.unassigned.clear();
    repositories.Item.unassigned.reset();

    return new Promise((resolve) => {
      let result = [];
      services.Item.requestUnassignedItems().observe(
        undefined,
        async (sender, response) => {
          result = [...response.response.items];
          await fetchPlayerPrices(result);
          console.log("Unassigned", result);
          resolve(result);
        }
      );
    });
  };
  let fetchDuplicateIds = () => {
    return new Promise((resolve) => {
      const result = [];
      repositories.Store.setDirty();
      services.Item.requestUnassignedItems().observe(
        undefined,
        (sender, response) => {
          const duplicates = [
            ...response.response.items.filter((item) => item.duplicateId > 0),
          ];
          result.push(...duplicates.map((duplicate) => duplicate.duplicateId));

          resolve(result);
        }
      );
    });
  };

  let apiUrl = "http://127.0.0.1:8000";

  let LOCKED_ITEMS_KEY = "excludePlayers";
  let cachedLockedItems;
  let isItemLocked = function (item) {
    let lockedItems = getLockedItems();
    return lockedItems.includes(item.definitionId);
  };
  let lockItem = function (item) {
    let lockedItems = getLockedItems();
    lockedItems.push(item.definitionId);
    saveLockedItems();
  };
  let unlockItem = function (item) {
    let lockedItems = getLockedItems();

    if (lockedItems.includes(item.definitionId)) {
      const index = lockedItems.indexOf(item.definitionId);
      if (index > -1) {
        lockedItems.splice(index, 1);
      }
    }
    saveLockedItems();
  };
  let getLockedItems = function () {
    return getSettings(0, 0, "excludePlayers");
  };
  let lockedItemsCleanup = function (clubPlayerIds) {
    let lockedItems = getLockedItems();
    for (let _i = 0, _a = Array.from(lockedItems); _i < _a.length; _i++) {
      let lockedItem = _a[_i];
      if (!clubPlayerIds[lockedItem]) {
        const index = lockedItems.indexOf(lockedItem);
        if (index > -1) {
          lockedItems.splice(index, 1);
        }
      }
    }
    saveLockedItems();
  };
  let saveLockedItems = function (set = 0, challenge = 0) {
    saveSettings(set, challenge, LOCKED_ITEMS_KEY, getLockedItems());
  };

  let FIXED_ITEMS_KEY = "fixeditems";
  let cachedFixedItems;
  let isItemFixed = function (item) {
    let fixedItems = getFixedItems();
    return fixedItems.includes(item.id);
  };
  let fixItem = function (item) {
    let fixedItems = getFixedItems();
    fixedItems.push(item.id);
    saveFixedItems();
  };
  let unfixItem = function (item) {
    let fixedItems = getFixedItems();

    if (fixedItems.includes(item.id)) {
      const index = fixedItems.indexOf(item.id);
      if (index > -1) {
        fixedItems.splice(index, 1);
      }
    }
    saveFixedItems();
  };
  let getFixedItems = function () {
    if (cachedFixedItems) {
      return cachedFixedItems;
    }
    cachedFixedItems = [];
    let fixedItems = localStorage.getItem(FIXED_ITEMS_KEY);
    if (fixedItems) {
      cachedFixedItems = JSON.parse(fixedItems);
    }
    return cachedFixedItems;
  };
  let fixedItemsCleanup = function (clubPlayerIds) {
    let fixedItems = getFixedItems();
    for (let _i = 0, _a = Array.from(fixedItems); _i < _a.length; _i++) {
      let fixedItem = _a[_i];
      if (!clubPlayerIds[fixedItem]) {
        const index = fixedItems.indexOf(fixedItem);
        if (index > -1) {
          fixedItems.splice(index, 1);
        }
      }
    }
    saveFixedItems();
  };
  let saveFixedItems = function () {
    localStorage.setItem(FIXED_ITEMS_KEY, JSON.stringify(cachedFixedItems));
  };

  const idToPlayerItem = {};

   // Add SBC and challenge information to the loader
   const addSbcInfo = (sbcName, challengeName) => {
    let shield = getElement(".ut-click-shield");
    let existingInfo = document.getElementById('sbc-info');
    
    if (existingInfo) {
      existingInfo.remove();
    }
    
    if (!sbcName) return;
    
    let infoDiv = document.createElement('div');
    infoDiv.id = 'sbc-info';
    infoDiv.style.position = 'fixed';
    infoDiv.style.top = '50%';
    infoDiv.style.left = '50%';
    infoDiv.style.transform = 'translate(0, -120px)';
    infoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    infoDiv.style.color = 'white';
    infoDiv.style.padding = '10px 20px';
    infoDiv.style.borderRadius = '5px';
    infoDiv.style.fontSize = '1.2rem';
    infoDiv.style.fontWeight = 'bold';
    infoDiv.style.textAlign = 'center';
    infoDiv.style.zIndex = '9999';
    
    let title = document.createElement('div');
    title.textContent = sbcName || 'SBC';
    infoDiv.appendChild(title);
    
    if (challengeName) {
      let subtitle = document.createElement('div');
      subtitle.textContent = challengeName;
      subtitle.style.fontSize = '1rem';
      subtitle.style.opacity = '0.8';
      infoDiv.appendChild(subtitle);
    }
    
    shield.appendChild(infoDiv);
  }

  const showLoader = (countdown = false) => {
    try {
      
      if (countDown) {
        updateLogOverlay()
        css(getElement(".numCounter"), {
          display: "block",
        });
       

      } else {
        let logOverlay = document.getElementById('sbc-log-overlay');
        if (logOverlay) {
          logOverlay.remove();
        }
        css(getElement(".numCounter"), {
          display: "none",
        });
      }
    } catch (error) {}
    addClass(getElement(".ut-click-shield"), "showing");
    css(getElement(".loaderIcon"), {
      display: "block",
    });
  };
  const hideLoader = () => {
    try {
      let logOverlay = document.getElementById('sbc-log-overlay');
      console.log(logOverlay)
      if (logOverlay) {
        logOverlay.remove();
      }
      let numCounterDiv = getElement(".numCounter");
      if (numCounterDiv) {
        numCounterDiv.remove();
      }
      removeClass(getElement(".ut-click-shield"), "showing");
      css(getElement(".loaderIcon"), {
        display: "block",
      });
    } catch (error) {
      console.log(error);
    }
  };
  const showNotification = function (
    message,
    type = UINotificationType.POSITIVE
  ) {
    services.Notification.queue([message, type]);
  };
  const getCurrentViewController = () => {
    return getAppMain()
      .getRootViewController()
      .getPresentedViewController()
      .getCurrentViewController();
  };
  const getControllerInstance = () => {
    return getCurrentViewController().getCurrentController()
      .childViewControllers[0];
  };

  let sbcSets = async function () {
    return new Promise((resolve, reject) => {
      services.SBC.requestSets().observe(this, function (obs, res) {
        if (!res.success) {
          obs.unobserve(this);
          reject(res.status);
        } else {
          resolve(res.data);
        }
      });
    }).catch((e) => {
      console.log(e);
    });
  };

  let getChallenges = async function (set) {
    return new Promise((resolve, reject) => {
      services.SBC.requestChallengesForSet(set).observe(
        this,
        async function (obs, res) {
          if (!res.success) {
            obs.unobserve(this);
            reject(res.status);
          } else {
            resolve(res.data);
          }
        }
      );
    }).catch((e) => {
      console.log(e);
    });
  };

  let loadChallenge = async function (currentChallenge) {
    return new Promise((resolve, reject) => {
      services.SBC.loadChallenge(currentChallenge).observe(
        this,
        function (obs, res) {
          if (!res.success) {
            obs.unobserve(this);
            reject(res.status);
          } else {
            resolve(res.data);
          }
        }
      );
    });
  };

  let fetchSBCData = async (sbcId, challengeId = 0) => {
    //Get SBC Data if given a setId

    let sbcData = await sbcSets();
    if (sbcData === undefined) {
      console.log("SBC DATA is not available");
      createSBCTab();
      return null;
    }

    let sbcSet = sbcData.sets.filter((e) => e.id == sbcId);

    if (sbcSet.length == 0) {
      createSBCTab();
      return null;
    }

    let challenges = await getChallenges(sbcSet[0]);
    let awards = [];
    let uncompletedChallenges = challenges?.challenges.filter(
      (f) => f.status != "COMPLETED"
    );
    if (uncompletedChallenges.length == 0) {
      showNotification("SBC not available", UINotificationType.NEGATIVE);
      createSBCTab();
      return null;
    }
    if (uncompletedChallenges.length == 1) {
      awards = sbcSet[0].awards
        .filter((f) => f.type == "pack")
        .map((m) => m.value);
    }

    if (challengeId == 0) {
      //Get last/hardest SBC if no challenge given

      challengeId = uncompletedChallenges[uncompletedChallenges.length - 1].id;
    }

    await loadChallenge(
      challenges.challenges.filter((i) => i.id == challengeId)[0]
    );

    let newSbcSquad = new UTSBCSquadOverviewViewController();
    (newSbcSquad._set = sbcSet[0]),
      (newSbcSquad._challenge = challenges.challenges.filter(
        (i) => i.id == challengeId
      )[0]);
    newSbcSquad.initWithSquad(
      challenges.challenges.filter((i) => i.id == challengeId)[0].squad
    );
    let { _challenge } = newSbcSquad;

    let totwIdx = -1;
    const challengeRequirements = _challenge.eligibilityRequirements.map(
      (eligibility, idx) => {
        let keys = Object.keys(eligibility.kvPairs._collection);
        if (
          SBCEligibilityKey[keys[0]] == "PLAYER_RARITY_GROUP" &&
          eligibility.kvPairs._collection[keys[0]][0] == 27
        ) {
          totwIdx = idx;
        }
        return {
          scope: SBCEligibilityScope[eligibility.scope],
          count: eligibility.count,
          requirementKey: SBCEligibilityKey[keys[0]],
          eligibilityValues: eligibility.kvPairs._collection[keys[0]],
        };
      }
    );
    if (getSettings(0, 0, "saveTotw")) {
      if (totwIdx >= 0) {
        challengeRequirements[totwIdx].scope = "EXACT";
      } else {
        challengeRequirements.push({
          scope: "EXACT",
          count: 0,
          requirementKey: "PLAYER_RARITY_GROUP",
          eligibilityValues: [27],
        });
      }
    }

    return {
      constraints: challengeRequirements,
      formation: _challenge.squad._formation.generalPositions.map((m, i) =>
        _challenge.squad.simpleBrickIndices.includes(i) ? -1 : m
      ),
      challengeId: _challenge.id,
      setId: _challenge.setId,
      brickIndices: _challenge.squad.simpleBrickIndices,
      finalSBC: uncompletedChallenges.length == 1,
      currentSolution: _challenge.squad._players
        .map((m) => m._item._metaData?.id)
        .slice(0, 11),
      subs: _challenge.squad._players
        .map((m) => m._item.definitionId)
        .slice(11, 99)
        .filter((f) => f > 0),
      awards: _challenge.awards
        .filter((f) => f.type == "pack")
        .map((m) => m.value)
        .concat(awards),
    };
  };
  let conceptPlayers = [];
  let sbcLogin = [];
  let players;

  const futHomeOverride = async () => {
    const homeHubInit = UTHomeHubView.prototype.init;
    UTHomeHubView.prototype.init = async function () {
      createSBCTab();
      players = await fetchPlayers();
      let storage = await getStoragePlayers();

      players = players.filter(
        (f) => !storage.map((m) => m.definitionId).includes(f.definitionId)
      );
      players = players.concat(storage);
      await fetchLowestPriceByRating();
      //    await fetchPlayerPrices(players);
      let sbcs = await sbcSets();
      await fetchPlayerPrices(
        sbcs.sets.filter((s) => s.awards[0]?.item).map((s) => s.awards[0]?.item)
      );
      homeHubInit.call(this);
      let sbcSettingsLogin = findSBCLogin(getSolverSettings(), "sbcOnLogin");
      console.log(sbcSettingsLogin);
      sbcs = sbcs.sets;
      sbcs
        .filter((f) => !f.isComplete())
        .forEach((sbc) => {
          sbcSettingsLogin.forEach((sl) => {
            if (sl.parents[1] == sbc.id) {
              sbcLogin.push([sl.parents[1], sl.parents[2], sbc.name]);
            }
          });
        });

      if (sbcLogin.length > 0) {
        let sbcToTry = sbcLogin.shift();

        sbcLogin = sbcLogin.slice();
        services.Notification.queue([
          sbcToTry[2] + " SBC Started",
          UINotificationType.POSITIVE,
        ]);

        solveSBC(sbcToTry[0], sbcToTry[1], true);
      }
      if (getSettings(0, 0, "collectConcepts")) {
        conceptPlayers = await getConceptPlayers();
        await fetchPlayerPrices(conceptPlayers);
      }
    };
  };

  const duplicateDiscount = 0.51;
  const untradeableDiscount = 0.8;
  const conceptPremium = 10;
  const evoPremium = 2;
  let count;

  function pad(n, width, z) {
    z = z || "0";
    n = n + "";
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }

  function countDown() {
    count = Math.max(0, count - 1);
    counter.count(pad(count, 4));
  }
  var counter;
  let failedChallenges;
  let getSBCPrice = (item, duplicateIds) => {
    if (isItemFixed(item)) {
      return 1;
    }

    let sbcPrice = Math.max(
      getPrice(item),
      getPrice({ definitionId: item.rating + "_CBR" }),
      100
    );

    if (getPrice(item) == -1) {
      return sbcPrice * 1.5;
    }
    if (getPrice(item) == 0 && item.rating > 87) {
      return Math.max(item?._itemPriceLimits?.maximum, sbcPrice * 1.5);
    }
    if (item.concept) {
      return conceptPremium * sbcPrice;
    }
    if (
      (
        (item.isSpecial()
          ? ""
          : services.Localization.localize(
              "search.cardLevels.cardLevel" + item.getTier()
            ) + " ") +
        services.Localization.localize("item.raretype" + item.rareflag)
      ).includes("volution")
    ) {
      return evoPremium * sbcPrice;
    }
    sbcPrice = sbcPrice - (100 - item.rating); //Rating Discount

    sbcPrice =
      sbcPrice * (duplicateIds.includes(item.id) ? duplicateDiscount : 1); // Dupe Discount

    sbcPrice = sbcPrice * (item?.isStorage ? duplicateDiscount : 1);
    sbcPrice = sbcPrice * (item.untradeable ? untradeableDiscount : 1);

    return sbcPrice;
  };
  let countDownInterval;
  let logPollInterval;
  let createSbc = true;
  let solveSBC = async (
    sbcId,
    challengeId,
    autoSubmit = false,
    repeat = null,
    autoOpen = false
  ) => {
    if (createSbc != true) {
      showNotification("SBC Stopped");
      createSbc = true;
      return;
    }
    console.log("Sbc Started");
    // Clear any existing counter
    if (counter) {
      counter = null;
    }

    counter = new Counter(".numCounter", {
      direction: "rtl",
      delay: 200,
      digits: 3,
    });

    showLoader();

    let sbcData = await fetchSBCData(sbcId, challengeId);

    if (sbcData == null) {
      hideLoader();
      if (sbcLogin.length > 0) {
        let sbcToTry = sbcLogin.shift();
        sbcLogin = sbcLogin.slice();
        services.Notification.queue([
          sbcToTry[2] + " SBC Started",
          UINotificationType.POSITIVE,
        ]);
        goToPacks();
        await solveSBC(sbcToTry[0], sbcToTry[1], true);
        return;
      }
      showNotification("SBC not available", UINotificationType.NEGATIVE);
      return;
    }
    await sendUnassignedtoTeam();
    await swapDuplicates();
    await sendDuplicatesToStorage();
    await discardNonPlayerDupes();
    let players = await fetchPlayers();
    let storage = await getStoragePlayers();
    let PriceItems = getPriceItems();
    if (getSettings(sbcId, sbcData.challengeId, "useConcepts")) {
      if (conceptPlayersCollected) {
        players = players.concat(
          conceptPlayers?.filter((f) => !PriceItems[f.definitionId].isExtinct)
        );
      } else {
        showNotification(
          "Still Collecting Concept Players, They will not be used for this solution",
          UINotificationType.NEGATIVE
        );
      }
    }

    players = players.filter(
      (f) => !storage.map((m) => m.definitionId).includes(f?.definitionId)
    );
    players = players.concat(storage);
    players = players.filter((item) => item != undefined);
    await fetchPlayerPrices(players);

    let maxRating = getSettings(sbcId, sbcData.challengeId, "maxRating");
    let useDupes = getSettings(sbcId, sbcData.challengeId, "useDupes");
    let duplicateIds = await fetchDuplicateIds();
    let storageIds = storage.map((m) => m.id);
    let chemUtil = new UTSquadChemCalculatorUtils();
    chemUtil.chemService = services.Chemistry;
    chemUtil.teamConfigRepo = repositories.TeamConfig;

    players.forEach((item) => {
      item.isStorage = storageIds.includes(item?.id);
      item.profile = chemUtil.getChemProfileForPlayer(item);
      item.normalizeClubId = chemUtil.normalizeClubId(item.teamId);
    });
    let excludeLeagues =
      getSettings(sbcId, sbcData.challengeId, "excludeLeagues") || [];
    let excludeNations =
      getSettings(sbcId, sbcData.challengeId, "excludeNations") || [];
    let excludeRarity =
      getSettings(sbcId, sbcData.challengeId, "excludeRarity") || [];
    let excludeTeams =
      getSettings(sbcId, sbcData.challengeId, "excludeTeams") || [];
    let excludePlayers =
      getSettings(sbcId, sbcData.challengeId, "excludePlayers") || [];
    let excludeSbc =
      getSettings(sbcId, sbcData.challengeId, "excludeSbc") || false;
    let excludeObjective =
      getSettings(sbcId, sbcData.challengeId, "excludeObjective") || false;
      let excludeSpecial =
      getSettings(sbcId, sbcData.challengeId, "excludeSpecial") || false;
      let excludeTradable =
      getSettings(sbcId, sbcData.challengeId, "excludeTradable") || false;
      let excludeExtinct = getSettings(sbcId, sbcData.challengeId, "excludeExtinct") || false;
    let backendPlayersInput = players
      .filter(
        (item) =>
          (item.loans < 0 &&
            item.rating <= maxRating &&
            !excludePlayers.includes(item.definitionId) &&
            !excludeLeagues.includes(item.leagueId) &&
            !excludeNations.includes(item.nationId) &&
            !excludeRarity.includes(
              services.Localization.localize("item.raretype" + item.rareflag)
            ) &&
            !excludeTeams.includes(item.teamId) &&
            !item.isTimeLimited() &&
            !(PriceItems[item.definitionId]?.isSbc && excludeSbc) &&
            !(PriceItems[item.definitionId]?.isObjective && excludeObjective) &&
            !(!PriceItems[item.definitionId]?.isSpecial && excludeSpecial) &&
            !(!PriceItems[item.definitionId]?.untradeable && excludeTradable) &&
            !(PriceItems[item.definitionId]?.isExtinct && excludeExtinct) &&
            !sbcData.subs.includes(item.definitionId)) ||
          (useDupes &&
            !sbcData.subs.includes(item.definitionId) && 
            (duplicateIds.includes(item.id) || storageIds.includes(item?.id)))
      )
      .map((item) => {
        if (!item.groups.length) {
          item.groups = [0];
        }

        return {
          id: item.id,
          name: item._staticData.name,
          cardType:
            (item.isSpecial()
              ? ""
              : services.Localization.localize(
                  "search.cardLevels.cardLevel" + item.getTier()
                ) + " ") +
            services.Localization.localize("item.raretype" + item.rareflag),
          assetId: item._metaData?.id,
          definitionId: item.definitionId,
          rating: item.rating,
          teamId: item.teamId,
          leagueId: item.leagueId,
          nationId: item.nationId,
          rarityId: item.rareflag,
          ratingTier: item.getTier(),
          isUntradeable: item.untradeable,
          isDuplicate: duplicateIds.includes(item.id),
          isStorage: storageIds.includes(item.id),
          preferredPosition: item.preferredPosition,
          possiblePositions: item.possiblePositions,
          groups: item.groups,
          isFixed: isItemFixed(item),
          concept: item.concept,
          price: getSBCPrice(item, duplicateIds),
          futggPrice: getPrice(item),
          maxChem: item.profile.maxChem,
          teamChem: item.profile.rules[0],
          leagueChem: item.profile.rules[1],
          nationChem: item.profile.rules[2],
          normalizeClubId: item.normalizeClubId,
        };
      });

    const input = JSON.stringify({
      clubPlayers: backendPlayersInput,
      sbcData: sbcData,
      maxSolveTime: getSettings(sbcId, sbcData.challengeId, "maxSolveTime"),
    });

    count = getSettings(sbcId, sbcData.challengeId, "maxSolveTime");
    showLoader(true);
    countDownInterval = setInterval(countDown, 1000);
    
    // Reset log index and start polling
    lastLogIndex = 0;
    logPollInterval = setInterval(pollSolverLogs, 1000);
    
    let solution = await makePostRequest(apiUrl + "/solve", input);
    
    // Stop polling when solve is complete
    clearInterval(logPollInterval);
    clearInterval(countDownInterval);
    pollSolverLogs()
    if (createSbc != true) {
      hideLoader();
      showNotification("SBC Stopped");
      createSbc = true;
      return;
    }
    if (solution.status_code != 2 && solution.status_code != 4) {
      hideLoader();
      if (getSettings(0, 0, "playSounds")) {
        wompSound.play();
      }
      showNotification(solution.status, UINotificationType.NEGATIVE);
      if (sbcLogin.length > 0) {
        let sbcToTry = sbcLogin.shift();
        sbcLogin = sbcLogin.slice();
        services.Notification.queue([
          sbcToTry[2] + " SBC Started",
          UINotificationType.POSITIVE,
        ]);
        goToPacks();
        solveSBC(sbcToTry[0], sbcToTry[1], true);
        return;
      }
    }
    showNotification(
      solution.status,
      solution.status_code != 4
        ? UINotificationType.NEUTRAL
        : UINotificationType.POSITIVE
    );

    let allSbcData = await sbcSets();
    let sbcSet = allSbcData.sets.filter((e) => e.id == sbcData.setId)[0];
    let challenges = await getChallenges(sbcSet);
    let sbcChallenge = challenges.challenges.filter(
      (i) => i.id == sbcData.challengeId
    )[0];
    await loadChallenge(sbcChallenge);

    window.sbcSet = sbcSet;
    window.challengeId = sbcData.challengeId;
    console.log(sbcSet, sbcData);
    let newSbcSquad = new UTSBCSquadOverviewViewController();
    newSbcSquad.initWithSBCSet(sbcSet, sbcData.challengeId);
    let { _squad, _challenge } = newSbcSquad;

    _squad.removeAllItems();

    let _solutionSquad = [...Array(11)];
    sbcData.brickIndices.forEach(function (item, index) {
      _solutionSquad[item] = new UTItemEntity();
    });
    JSON.parse(solution.results)
      .sort((a, b) => b.Is_Pos - a.Is_Pos)
      .forEach(function (item, index) {
        let findMap = sbcData.formation.map(
          (currValue, idx) =>
            ((currValue == item.possiblePositions && item.Is_Pos == 1) ||
              item.Is_Pos == 0) &&
            _solutionSquad[idx] == undefined
        );

        _solutionSquad[
          findMap.findIndex((element) => {
            return element;
          })
        ] = players.filter((f) => item.id == f.id)[0];
      });
    sbcData.subs.forEach(function (item, index) {
      _solutionSquad.push(players.filter((f) => item == f.definitionId)[0]);
    });
    _squad.setPlayers(_solutionSquad, true);

    await loadChallenge(_challenge);
    let autoSubmitId = getSettings(sbcId, sbcData.challengeId, "autoSubmit");
    if (
      (solution.status_code == autoSubmitId || autoSubmitId == 1) &&
      autoSubmit
    ) {
      await sbcSubmit(_challenge, sbcSet);
      if (getSettings(sbcId, sbcData.challengeId, "autoOpenPacks")) {
        repositories.Store.setDirty();
        let item = sbcData.awards[0];
        let packs = await getPacks();
        await openPack(packs.packs.filter((f) => f.id == item)[0]);
        goToUnassignedView();
      }
      if (!getSettings(sbcId, sbcData.challengeId, "autoOpenPacks")) {
        goToPacks();
      }
      if (repeat == null) {
        //  console.log('getRepeatCount')
        repeat = getSettings(sbcId, sbcData.challengeId, "repeatCount");
      }

      let totalRepeats =
        getSettings(sbcId, sbcData.challengeId, "repeatCount") + 1;
      if (repeat != 0) {
        if (repeat < 0) {
          showNotification(`${Math.abs(repeat)} Completed`);
        } else {
          showNotification(
            `${totalRepeats - repeat} / ${totalRepeats} Completed`
          );
        }
        let newRepeat = sbcData.finalSBC ? repeat - 1 : repeat;
        solveSBC(sbcId, 0, true, newRepeat);
        return;
      }
      if (repeat == 0 && totalRepeats > 0) {
        showNotification(`${totalRepeats} / ${totalRepeats} Completed`);
      }
    } else {
      let showSBC = new UTSBCSquadSplitViewController();
      showSBC.initWithSBCSet(sbcSet, sbcData.challengeId);
      getCurrentViewController()
        .rootController.getRootNavigationController()
        .popViewController();
      getCurrentViewController()
        .rootController.getRootNavigationController()
        .pushViewController(showSBC);
      services.SBC.saveChallenge(_challenge).observe(
        undefined,
        async function (sender, data) {
          if (!data.success) {
            if (getSettings(0, 0, "playSounds")) {
              wompSound.play();
            }
            showNotification(
              "Failed to save squad.",
              UINotificationType.NEGATIVE
            );
            _squad.removeAllItems();
            hideLoader();
            if (data.error) {
              if (getSettings(0, 0, "playSounds")) {
                wompSound.play();
              }
              showNotification(
                `Error code: ${data.error.code}`,
                UINotificationType.NEGATIVE
              );
            }
            hideLoader();
            return;
          }
        }
      );
      hideLoader();
    }

    if (sbcLogin.length > 0) {
      let sbcToTry = sbcLogin.shift();
      sbcLogin = sbcLogin.slice();
      services.Notification.queue([
        sbcToTry[2] + " SBC Started",
        UINotificationType.POSITIVE,
      ]);
      solveSBC(sbcToTry[0], sbcToTry[1], true);
    }
    hideLoader();
    //getAppMain().getRootViewController().getPresentedViewController().getCurrentViewController().rootController.getRootNavigationController().pushViewController(currentView);
  };

  let goToPacks = async () => {
    await sendUnassignedtoTeam();
    await swapDuplicates();
    await sendDuplicatesToStorage();
    await discardNonPlayerDupes();
    let ulist = await fetchUnassigned();

    if (ulist.length > 0) {
      goToUnassignedView();
      return;
    }
    repositories.Store.setDirty();
    let n = new UTStorePackViewController();
    n.init();
    getCurrentViewController()
      .rootController.getRootNavigationController()
      .popViewController();
    getCurrentViewController()
      .rootController.getRootNavigationController()
      .pushViewController(n);
  };
  let goToUnassignedView = async () => {
    return new Promise((resolve, reject) => {
      repositories.Item.unassigned.clear();
      repositories.Item.unassigned.reset();
      var r = getCurrentViewController().rootController;
      showLoader(),
        services.Item.requestUnassignedItems().observe(
          this,
          async function (e, t) {
            var i;

            e.unobserve(r);
            var o = r.getRootNavigationController();
            if (o) {
              var n = isPhone()
                ? new UTUnassignedItemsViewController()
                : new UTUnassignedItemsSplitViewController();
              t.success && JSUtils.isObject(t.response)
                ? n.initWithItems(
                    null === (i = t.response) || void 0 === i ? void 0 : i.items
                  )
                : n.init();
              services.Item.clearTransferMarketCache();

              o.popToRootViewController();
              o.pushViewController(n);
            }
            hideLoader();
            resolve();
          }
        );

      hideLoader();
    });
  };
  let getPacks = async () => {
    return new Promise((resolve, reject) => {
      let packResponse;
      repositories.Store.setDirty();
      services.Store.getPacks("ALL", true, true).observe(
        this,
        function (obs, res) {
          if (!res.success) {
            obs.unobserve(this);
            reject(res.status);
          } else {
            packResponse = res.response;
            resolve(packResponse);
          }
        }
      );
    });
  };

  const sbcSubmitChallengeOverride = () => {
    const sbcSubmit = PopupQueueViewController.prototype.closeActivePopup;
    PopupQueueViewController.prototype.closeActivePopup = function () {
      sbcSubmit.call(this);
      createSBCTab();
    };
  };

  const unassignedItemsOverride = () => {
    const unassignedItems = UTSectionedItemListView.prototype.render;
    UTSectionedItemListView.prototype.render = async function (...args) {
      let players = [];
      for (const { data } of this.listRows) {
        players.push(data);
      }
      console.log('players', players);
      await fetchPlayerPrices(players);
      unassignedItems.call(this, ...args);
    };
    const ppItems = UTPlayerPicksView.prototype.setCarouselItems;
    UTPlayerPicksView.prototype.setCarouselItems = async function (...args) {
      console.log(args);
      await fetchPlayerPrices(args[0]);
      ppItems.call(this, ...args);
    };
  };

  let sbcSubmit = async function (challenge, sbcSet, i) {
    return new Promise((resolve, reject) => {
      services.SBC.submitChallenge(
        challenge,
        sbcSet,
        true,
        services.Chemistry.isFeatureEnabled()
      ).observe(this, async function (obs, res) {
        if (!res.success) {
          obs.unobserve(this);
          if (getSettings(0, 0, "playSounds")) {
            wompSound.play();
          }
          showNotification("Failed to submit", UINotificationType.NEGATIVE);
          gClickShield.hideShield(EAClickShieldView.Shield.LOADING);

          reject(res);
        } else {
          showNotification("SBC Submitted", UINotificationType.POSITIVE);
          createSBCTab();
          resolve(res);
        }
      });
    });
  };

  const sbcViewOverride = () => {
    UTSquadEntity.prototype._calculateRating = function () {
      var t = this.isSBC()
          ? this.getFieldPlayers()
          : this.getFieldAndSubPlayers(),
        e = services.Configuration.checkFeatureEnabled(
          UTServerSettingsRepository.KEY.SQUAD_RATING_FLOAT_CALCULATION_ENABLED
        ),
        n = 0,
        r = UTSquadEntity.FIELD_PLAYERS;
      if (
        (t.forEach(function (t, e) {
          var i = t.item;
          i.isValid() &&
            ((n += i.rating), UTSquadEntity.FIELD_PLAYERS <= e && r++);
        }),
        e)
      ) {
        var o = n,
          a = o;

        0 < r && (o /= r),
          (o = Math.min(o, 99)),
          t.forEach(function (t, e) {
            var i = t.item;
            if (i.isValid()) {
              if (i.rating <= o) return;
              a +=
                e < UTSquadEntity.FIELD_PLAYERS
                  ? i.rating - o
                  : 0.5 * (i.rating - o);
            }
          }),
          (n = Math.round(a, 2));
      } else {
        var s = Math.min(Math.floor(n / r), 99);
        t.forEach(function (t, e) {
          var i = t.item;
          if (i.isValid()) {
            if (i.rating <= s) return;
            n +=
              e < UTSquadEntity.FIELD_PLAYERS
                ? i.rating - s
                : Math.floor(0.5 * (i.rating - s));
          }
        });
      }
      this._rating = new Intl.NumberFormat("en", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(Math.min(Math.max(n / r, 0), 99));
    };

    const squadDetailPanelView = UTSBCSquadDetailPanelView.prototype.init;
    UTSBCSquadDetailPanelView.prototype.init = function (...args) {
      const response = squadDetailPanelView.call(this, ...args);

      const button = createButton("idSolveSbc", "Solve SBC", async function () {
        const { _challenge } = getControllerInstance();

        solveSBC(_challenge.setId, _challenge.id);
      });
      insertAfter(button, this._btnExchange.__root);
      return response;
    };
  };
  const sbcButtonOverride = () => {
    const UTSBCSetTileView_render = UTSBCSetTileView.prototype.render;
    UTSBCSetTileView.prototype.render = function render() {
      UTSBCSetTileView_render.call(this);
      if (this.data) {
        insertBefore(
          createElem("span", null, `COMPLETED: ${this.data.timesCompleted}. `),
          this.__rewardsHeader
        );
      }
    };
  };

  const lockedLabel = "SBC Unlock";
  const unlockedLabel = "SBC Lock";
  const fixedLabel = "SBC Use actual prices";
  const unfixedLabel = "SBC Set Price to Zero";

  const playerItemOverride = () => {
    const UTDefaultSetItem = UTSlotActionPanelView.prototype.setItem;
    UTSlotActionPanelView.prototype.setItem = function (e, t) {
      const result = UTDefaultSetItem.call(this, e, t);
    // Add refresh price button
    if (!this.refreshPriceButton && e.isPlayer()) {
      const refreshButton = new UTGroupButtonControl();
      refreshButton.init();
      refreshButton.setInteractionState(true);
      refreshButton.setText("Refresh Price");
      insertAfter(refreshButton, this._btnBio.__root);
      refreshButton.addTarget(
        this,
        async () => {
          
          // Remove existing price data for this player before refreshing
          let PriceItems = getPriceItems();
          if (e.definitionId in PriceItems) {
            delete PriceItems[e.definitionId];
            savePriceItems();
          }
          await fetchPlayerPrices([e]);
          showNotification(`Price refreshed`, UINotificationType.POSITIVE);
          getControllerInstance().applyDataChange();
          getCurrentViewController()
            .getCurrentController()
            .rightController.currentController.renderView();
        },
        EventType.TAP
      );
      this.refreshPriceButton = refreshButton;
    }
      // Concept player
      if (
        e.concept ||
        e.loans > -1 ||
        !e.isPlayer() ||
        !e.id ||
        e.isTimeLimited()
      ) {
        return result;
      }
      if (!e.isDuplicate() && !isItemFixed(e) && !this.lockUnlockButton) {
        const label = isItemLocked(e) ? lockedLabel : unlockedLabel;
        const button = new UTGroupButtonControl();
        button.init();
        insertAfter(button, this._btnBio.__root);

        button.setInteractionState(true);
        button.setText(label);

        button.addTarget(
          this,
          async () => {
            if (isItemLocked(e)) {
              unlockItem(e);
              button.setText(unlockedLabel);
              showNotification(`Item unlocked`, UINotificationType.POSITIVE);
            } else {
              lockItem(e);

              button.setText(lockedLabel);
              showNotification(`Item locked`, UINotificationType.POSITIVE);
            }
            getControllerInstance().applyDataChange();
            getCurrentViewController()
              .getCurrentController()
              .rightController.currentController.renderView();
          },
          EventType.TAP
        );
        this.lockUnlockButton = button;
      }
      if (!isItemLocked(e) && !this.fixUnfixButton) {
        const fixLabel = isItemFixed(e) ? fixedLabel : unfixedLabel;
        const fixbutton = new UTGroupButtonControl();
        fixbutton.init();
        fixbutton.setInteractionState(true);
        fixbutton.setText(fixLabel);
        insertAfter(fixbutton, this._btnBio.__root);
        fixbutton.addTarget(
          this,
          async () => {
            if (isItemFixed(e)) {
              unfixItem(e);
              fixbutton.setText(unfixedLabel);
              showNotification(`Removed Must Use`, UINotificationType.POSITIVE);
            } else {
              fixItem(e);
              fixbutton.setText(fixedLabel);
              showNotification(`Must Use Set`, UINotificationType.POSITIVE);
            }
            getControllerInstance().applyDataChange();
            getCurrentViewController()
              .getCurrentController()
              .rightController.currentController.renderView();
          },
          EventType.TAP
        );
        this.fixUnfixButton = fixbutton;
      }
      
  
      
      return result;
    };

    const UTDefaultAction = UTDefaultActionPanelView.prototype.render;
    UTDefaultActionPanelView.prototype.render = function (e, t, i, o, n, r, s) {
      const result = UTDefaultAction.call(this, e, t, i, o, n, r, s);
 // Add refresh price button in default action panel
 if (!this.refreshPriceButton && e.isPlayer()) {
  const refreshButton = new UTGroupButtonControl();
  refreshButton.init();
  refreshButton.setInteractionState(true);
  refreshButton.setText("Refresh Price");
  insertAfter(refreshButton, this._bioButton.__root);
  refreshButton.addTarget(
    this,
    async () => {
      
      await fetchPlayerPrices([e]);
      showNotification(`Price refreshed`, UINotificationType.POSITIVE);
      try {
        getCurrentViewController()
          .getCurrentController()
          .leftController.renderView();
        getCurrentViewController()
          .getCurrentController()
          .rightController.currentController.renderView();
      } catch (error) {
        getCurrentViewController()
          .getCurrentController()
          .leftController.refreshList();
      }
    },
    EventType.TAP
  );
  this.refreshPriceButton = refreshButton;
} // Add refresh price button in default action panel
if (!this.refreshPriceButton && e.isPlayer()) {
  const refreshButton = new UTGroupButtonControl();
  refreshButton.init();
  refreshButton.setInteractionState(true);
  refreshButton.setText("Refresh Price");
  insertAfter(refreshButton, this._bioButton.__root);
  refreshButton.addTarget(
    this,
    async () => {
     
      await fetchPlayerPrices([e]);
      showNotification(`Price refreshed`, UINotificationType.POSITIVE);
      try {
        getCurrentViewController()
          .getCurrentController()
          .leftController.renderView();
        getCurrentViewController()
          .getCurrentController()
          .rightController.currentController.renderView();
      } catch (error) {
        getCurrentViewController()
          .getCurrentController()
          .leftController.refreshList();
      }
    },
    EventType.TAP
  );
  this.refreshPriceButton = refreshButton;
}
      // Concept player
      if (e.concept || e.loans > -1 || !e.isPlayer() || !e.id) {
        return result;
      }
      if (!e.isDuplicate() && !isItemFixed(e)) {
        const label = isItemLocked(e) ? lockedLabel : unlockedLabel;
        if (!this.lockUnlockButton) {
          const button = new UTGroupButtonControl();
          button.init();
          button.setInteractionState(true);
          button.setText(label);
          insertAfter(button, this._bioButton.__root);
          button.addTarget(
            this,
            async () => {
              if (isItemLocked(e)) {
                unlockItem(e);
                button.setText(unlockedLabel);
                showNotification(`Item unlocked`, UINotificationType.POSITIVE);
              } else {
                lockItem(e);
                button.setText(lockedLabel);
                showNotification(`Item locked`, UINotificationType.POSITIVE);
              }
              try {
                getCurrentViewController()
                  .getCurrentController()
                  .leftController.renderView();
                getCurrentViewController()
                  .getCurrentController()
                  .rightController.currentController.renderView();
              } catch (error) {
                getCurrentViewController()
                  .getCurrentController()
                  .leftController.refreshList();
              }
            },
            EventType.TAP
          );
          this.lockUnlockButton = button;
        }
      }
      if (!isItemLocked(e)) {
        const fixlabel = isItemFixed(e) ? fixedLabel : unfixedLabel;
        if (!this.fixUnfixButton) {
          const button = new UTGroupButtonControl();
          button.init();
          button.setInteractionState(true);
          button.setText(fixlabel);
          insertAfter(button, this._bioButton.__root);
          button.addTarget(
            this,
            async () => {
              if (isItemFixed(e)) {
                unfixItem(e);
                button.setText(unfixedLabel);
                showNotification(
                  `Removed Must Use`,
                  UINotificationType.POSITIVE
                );
              } else {
                fixItem(e);
                button.setText(fixedLabel);
                showNotification(`Must Use Set`, UINotificationType.POSITIVE);
              }
              try {
                getCurrentViewController()
                  .getCurrentController()
                  .leftController.renderView();
                getCurrentViewController()
                  .getCurrentController()
                  .rightController.currentController.renderView();
              } catch (error) {
                getCurrentViewController()
                  .getCurrentController()
                  .leftController.refreshList();
              }
            },
            EventType.TAP
          );
          this.fixUnfixButton = button;
        }
      }
      
     
      
      return result;
    };


    const getPriceDiv = async (item) => {
      if (getSettings(0, 0, "showPrices")) {
        let PriceItems = getPriceItems();
        let price = getPrice(item) * (isItemFixed(item) ? 0 : 1);
        if (
          !(item.definitionId in PriceItems) ||
          !("isSbc" in PriceItems[item.definitionId])
        ) {
        }
        let symbol = PriceItems[item.definitionId]?.isSbc
          ? "currency-sbc"
          : PriceItems[item.definitionId]?.isObjective
          ? "currency-objective"
          : "currency-coins";
      const priceElement = document.createElement("div");
      priceElement.className = `${symbol} item-price`;
      priceElement.textContent = PriceItems[item.definitionId]?.isExtinct
        ? "EXTINCT"
        : PriceItems[item.definitionId]?.isObjective
        ? ""
        : price.toLocaleString();
      
      
     
  
   
      return priceElement
    };
    return null;
  }

    const UTPlayerItemView_renderItem = UTPlayerItemView.prototype.renderItem;
    UTPlayerItemView.prototype.renderItem = async function (item, t) {
      const result = UTPlayerItemView_renderItem.call(this, item, t);
      const duplicateIds = await fetchDuplicateIds();
      let storage = await getStoragePlayers();
      if (
        duplicateIds.includes(item.id) ||
        storage.map((m) => m.id).includes(item.id)
      ) {
        this.__root.style.opacity = "0.4";
      }
        let priceElement = await getPriceDiv(item)
        // Add the price element to the player item
        if (this.__root && priceElement) {
          this.__root.prepend(priceElement);
        }
      
      if (isItemLocked(item)) {
        addClass(this, "locked");
      } else {
        removeClass(this, "locked");
      }
      if (isItemFixed(item)) {
        addClass(this, "fixed");
      } else {
        removeClass(this, "fixed");
      }
      return result;
    }
  }

  let priceCacheMinutes = 60;
  let PRICE_ITEMS_KEY = "futggPrices";
  let cachedPriceItems;
  let isPriceOld = function (item) {
    let PriceItems = getPriceItems();
    if (!(item?.definitionId in PriceItems)) {
      return true;
    }
    let cacheMin = getSettings(0, 0, "priceCacheMinutes");
    let timeStamp = new Date(PriceItems[item.definitionId]?.timeStamp);

    let now = new Date(Date.now());
    let cacheDate = timeStamp.getTime() + cacheMin * 60 * 1000;
    if (
      PriceItems[item.definitionId] &&
      PriceItems[item.definitionId]?.timeStamp &&
      cacheDate < now
    ) {
      return true;
    }
    return false;
  };
  let getPrice = function (item) {
    let PriceItems = getPriceItems();
    if (!(item.definitionId in PriceItems)) {
      return null;
    }

    return PriceItems[item.definitionId]?.price;

    //console.log(PriceItems[item.definitionId])
    let cacheMin = item.concept ? 1440 : getSettings(0, 0, "priceCacheMinutes");
    let timeStamp = new Date(PriceItems[item.definitionId]?.timeStamp);

    let now = new Date(Date.now());

    if (
      PriceItems[item.definitionId] &&
      PriceItems[item.definitionId]?.timeStamp &&
      cacheDate < now
    ) {
      //console.log('Cache is old',PriceItems[item.definitionId],item)
      return null;
    }
    let fbPrice = PriceItems[item.definitionId]?.price;
    return fbPrice;
  };

  let PriceItem = function (items) {
    //  console.log(item, price, lastUpdated)
    let PriceItems = getPriceItems();
    let timeStamp = new Date(Date.now());
    for (let key in items) {
      items[key]["timeStamp"] = timeStamp;
      PriceItems[items[key]["eaId"]] = items[key];
    }
    savePriceItems();
  };

  let getPriceItems = function () {
    if (cachedPriceItems) {
      return cachedPriceItems;
    }
    cachedPriceItems = {};
    let PriceItems = localStorage.getItem(PRICE_ITEMS_KEY);
    if (PriceItems) {
      cachedPriceItems = JSON.parse(PriceItems);
    }

    return cachedPriceItems;
  };
  let PriceItemsCleanup = function (clubPlayerIds) {
    let PriceItems = getPriceItems();
    for (let _i = 0, _a = Array.from(PriceItems); _i < _a.length; _i++) {
      let PriceItem = _a[_i];
      if (!clubPlayerIds[PriceItem]) {
        PriceItems.delete(PriceItem);
      }
    }
    savePriceItems();
  };
  let savePriceItems = function () {
    localStorage.setItem(PRICE_ITEMS_KEY, JSON.stringify(cachedPriceItems));
  };

  function makeGetRequest(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        onload: function (response) {
          resolve(response.responseText);
        },
        onerror: function (error) {
          reject(error);
        },
      });
    });
  }

  function makePostRequest(url, data) {
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: "POST",
        body: data,
      })
        .then((response) => {
          // 1. check response.ok
          if (response.ok) {
            return response.json();
          }
          return Promise.reject(response); // 2. reject instead of throw
        })
        .then((json) => {
          resolve(json);
        })
        .catch((error) => {
          console.log(error);
          if (getSettings(0, 0, "playSounds")) {
            wompSound.play();
          }
          showNotification(
            `Please check backend API is running`,
            UINotificationType.NEGATIVE
          );
          clearInterval(logPollInterval);
          clearInterval(countDownInterval);
          hideLoader();
        });
    });
  }
  const convertAbbreviatedNumber = (number) => {
    let base = parseFloat(number);
    if (number.toLowerCase().match(/k/)) {
      return Math.round(base * 1000);
    } else if (number.toLowerCase().match(/m/)) {
      return Math.round(base * 1000000);
    }
    return number * 1;
  };

  let priceResponse;
  const fetchLowestPriceByRating = async () => {
    let PriceItems = getPriceItems();
    let timeStamp = new Date(Date.now());

    for (let i = 45; i <= 80; i++) {
      PriceItems[i + "_CBR"] = {
        price: i < 75 ? 200 : 400,
        timestamp: timeStamp,
      };
    }

    let highestRating = await getConceptPlayers(1);

    for (
      let i = 80;
      i <= Math.max(...highestRating.map((m) => m.rating));
      i++
    ) {
      if (isPriceOld({ definitionId: i + "_CBR" })) {
        await fetchSingleCheapest(i);
      }
      await fetchSingleCheapest(i);
    }
  };
  const fetchSingleCheapest = async (rating) => {
    const futggSingleCheapestByRatingResponse = await makeGetRequest(
      `https://www.fut.gg/players/?overall__gte=${rating}&overall__lte=${rating}&price__gte=100&sorts=current_price`
    );
    try {
      const doc = new DOMParser().parseFromString(
        futggSingleCheapestByRatingResponse,
        "text/html"
      );

      let playerLink = doc
        .getElementsByClassName("fut-card-container")[0]
        .href?.split("25-")[1]
        .replace("/", "");

      const futggResponse = await makeGetRequest(
        `https://www.fut.gg/api/fut/player-prices/25/?ids=${playerLink}`
      );
      //  console.log(rating,doc,`https://www.fut.gg/api/fut/player-prices/25/?ids=${playerLink}`, doc.getElementsByClassName("fut-card-container")[0].href)

      priceResponse = JSON.parse(futggResponse);
      priceResponse = priceResponse.data;
    } catch (error) {
      console.error(error);

      return;
    }
    let PriceItems = getPriceItems();
    let timeStamp = new Date(Date.now());
    for (let key in priceResponse) {
      priceResponse[key]["timeStamp"] = timeStamp;
      PriceItems[rating + "_CBR"] = priceResponse[key];
    }
    savePriceItems();
  };
  let fetchPlayerPrices = async (players) => {
    let duplicateIds = await fetchDuplicateIds();

    let idsArray = players
      .filter((f) => isPriceOld(f) && f?.isPlayer())
      .map((p) => p.definitionId);

    let totalPrices = idsArray.length;
    while (idsArray.length) {
      const playersIdArray = idsArray.splice(0, 50);

      const futggResponse = await makeGetRequest(
        `https://www.fut.gg/api/fut/player-prices/25/?ids=${playersIdArray}`
      );
      let priceResponse;
      try {
        priceResponse = JSON.parse(futggResponse);
        priceResponse = priceResponse.data;
        //     console.log( `https://www.fut.gg/api/fut/player-prices/25/?ids=${playersIdArray}`,priceResponse)
        PriceItem(priceResponse);
      } catch (error) {
        console.error(error);
        await wait();
        continue;
      }
      if (totalPrices - idsArray.length >= totalPrices) {
        showNotification(
          `Fetched ${totalPrices - idsArray.length} / ${totalPrices} Prices`,
          UINotificationType.NEUTRAL
        );
      }
    }
  };
  let sound = new Audio(
    "https://raw.githubusercontent.com/Yousuke777/sound/main/kansei.mp3"
  );
  let wompSound = new Audio(
    "https://www.myinstants.com/media/sounds/downer_noise.mp3"
  );
  let nopeSound = new Audio(
    "https://www.myinstants.com/media/sounds/engineer_no01.mp3"
  );
  let openPack = async (pack, repeat = 0) => {
    showLoader();
    await sendUnassignedtoTeam();
    await swapDuplicates();
    await sendDuplicatesToStorage();
    await discardNonPlayerDupes();
    let ulist = await fetchUnassigned();
    console.log(ulist);
    if (ulist.length > 0) {
      goToUnassignedView();
      return;
    }
    return new Promise((resolve, reject) => {
      repositories.Store.setDirty();
      pack.open().observe(this, async function (obs, res) {
        if (!res.success) {
          console.log(res);
          obs.unobserve(this);
          reject(res.status);
          createSBCTab();
          hideLoader();
        } else {
          let packPlayers = res.response;
          createSBCTab();
          await fetchPlayerPrices(packPlayers.items);
          console.table(
            packPlayers.items
              .sort(function (t, e) {
                return getSBCPrice(e, []) - getSBCPrice(t, []);
              })
              .map((item) => {
                return {
                  name: item._staticData.name,
                  cardType:
                    (item.isSpecial()
                      ? ""
                      : services.Localization.localize(
                          "search.cardLevels.cardLevel" + item.getTier()
                        ) + " ") +
                    services.Localization.localize(
                      "item.raretype" + item.rareflag
                    ),
                  rating: item.rating,
                  futggPrice: getPrice(item),
                };
              })
          );
          if (
            packPlayers.items.filter(function (e) {
              return e.rating >= getSettings(0, 0, "animateWalkouts");
            }).length > 0
          ) {
            createSbc = false;
            await showPack(pack, packPlayers);
          }

          await goToUnassignedView();
          createSBCTab();
          if (repeat > 0) {
            repeat = repeat - 1;
            await openPack(pack, repeat);
          }
          resolve(res.response);
        }
      });
    });
  };
  let showPack = async (pack, packPlayers) => {
    return new Promise((resolve, reject) => {
      let c = new UTStoreViewController();
      var o = null,
        n = packPlayers.items.filter(function (e) {
          return e.isPlayer();
        });
      if (0 < n.length) {
        var r = new UTItemUtils(),
          s = n.sort(function (t, e) {
            return getSBCPrice(e, []) - getSBCPrice(t, []);
          });
        o = s[0];
      } else
        packPlayers.items.forEach(function (e) {
          (!o || o.discardValue < e.discardValue) && (o = e);
        });

      if (o && o.rating >= getSettings(0, 0, "animateWalkouts")) {
        if (getSettings(0, 0, "playSounds")) {
          sound.play();
        }
        var a = new UTPackAnimationViewController();
        a.initWithPackData(o, pack.assetId),
          a.setAnimationCallback(
            function () {
              this.dismissViewController(!1, function () {
                a.dealloc();
              }),
                repositories.Store.setDirty();
            }.bind(c)
          ),
          (a.modalDisplayStyle = "fullscreen"),
          c.presentViewController(a, !0);
      }

      resolve();
    });
  };
  const packOverRide = async () => {
    const packOpen = UTStoreViewController.prototype.eOpenPack;
    UTStoreViewController.prototype.eOpenPack = async function (...args) {
      showLoader();
      await sendUnassignedtoTeam();
      await swapDuplicates();
      await sendDuplicatesToStorage();
      await discardNonPlayerDupes();
      createSBCTab();

      let packs = await getPacks();
      let item = args[2].articleId;
      let packToOpen = packs.packs.filter((f) => f.id == item)[0];
      console.log(args, packToOpen);
      if (packs.packs.filter((f) => f.id == item).length > 0) {
        if (packToOpen.isMyPack) {
          await openPack(packToOpen);
        } else {
          let e = args[1];
          let m =
            e === "UTStorePackDetailsView.Event.BUY_POINTS" ||
            e === "UTStoreBundleDetailsView.Event.BUY_POINTS" ||
            e === "UTStoreRevealModalListView.Event.POINTS_PURCHASE"
              ? GameCurrency.POINTS
              : GameCurrency.COINS;

          packToOpen
            .purchase(m)
            .observe(new UTStoreViewController(), (obs, event) => {
              console.log(obs, event);
              openPack(packToOpen);
            });
        }

        goToUnassignedView();
        await wait(10);
      }
    };
  };
  const packItemOverride = () => {
    const storeListView = UTStoreRevealModalListView.prototype.render;

    UTStoreRevealModalListView.prototype.render = function (...args) {
      storeListView.call(this, ...args);
    };
  };
  const playerSlotOverride = () => {
    const playerSlot = UTSquadPitchView.prototype.setSlots;

    UTSquadPitchView.prototype.setSlots = async function (...args) {
      const result = playerSlot.call(this, ...args);
      const slots = this.getSlotViews();
      const squadSlots = [];
      slots.forEach((slot, index) => {
        const item = args[0][index];
        squadSlots.push({
          item: item._item,
          rootElement: slot.getRootElement(),
        });
      });

      appendSlotPrice(squadSlots);
      return result;
    };
  };

  const appendSlotPrice = async (squadSlots) => {
    if (!squadSlots.length) {
      return;
    }
    const players = [];
    for (const { item } of squadSlots) {
      players.push(item);
    }

    const prices = await fetchPlayerPrices(players);
    let total = 0;
    const duplicateIds = await fetchDuplicateIds();
    for (const { rootElement, item } of squadSlots) {
      if (duplicateIds.includes(item.id)) {
        rootElement.style.opacity = "0.4";
      }
      
     
        const element = $(rootElement);
        appendPriceToSlot(element, item);
      
    }
    appendSquadTotal(total);
  };
  const appendSquadTotal = (total) => {
    if (getSettings(0, 0, "showPrices")) {
      if ($(".squadTotal").length) {
        $(".squadTotal").text(total.toLocaleString());
      } else {
        $(
          `<div class="rating chemistry-inline">
          <span class="ut-squad-summary-label">Squad Price</span>
          <div>
            <span class="ratingValue squadTotal currency-coins">${total.toLocaleString()}</span>
          </div>
        </div>
        `
        ).insertAfter($(".chemistry"));
      }
    }
  };
  const appendPriceToSlot = async (rootElement, item) => {
    let priceElement = await getPriceDiv(item)
    if (priceElement) {
    rootElement.prepend(priceElement);
    }
    }
  

  const getUserPlatform = () => {
    if (services.User.getUser().getSelectedPersona().isPC) {
      return "pc";
    }
    return "ps";
  };
  const favTagOverride = () => {
    const favTag = UTSBCFavoriteButtonControl.prototype.watchSBCSet;

    UTSBCFavoriteButtonControl.prototype.watchSBCSet = function () {
      const result = favTag.call(this);
      createSBCTab();
      return result;
    };
  };

  const createNavButton = (id, content, hover, callback, style = {}) => {
    const button = document.createElement("button");
    button.classList.add("ut-tab-bar-item");
    button.id = id;
    const defaultStyles = {
      width: "100%",
      background: "#1e1f1f",
      marginTop: "0px",
    };

    const combinedStyles = { ...defaultStyles, ...style };
    Object.keys(combinedStyles).forEach((key) => {
      button.style[key] = combinedStyles[key];
    });
    button.innerHTML = content;
    button.addEventListener("click", () => {
      let hoverNav = document.getElementById("hoverNav");

      if (hoverNav) {
        hoverNav.remove();
      }
      callback();
    });
    button.addEventListener("mouseenter", async (e) => {
      button.classList.add("sbcToolBarHover");

      let parentElement = e.target.parentElement;
      while (parentElement && parentElement.tagName !== "NAV") {
        parentElement = parentElement.parentElement;
      }
      if (parentElement.id == "sbcToolbar") {
        let hoverNav = document.getElementById("hoverNav");

        if (hoverNav) {
          hoverNav.remove();
        }
      }

      if (hover) {
        let sbcToolbar = document.getElementById("sbcToolbar");
        if (sbcToolbar) {
          let hoverTimeout = setTimeout(async () => {
            let hoverBtn = await hover();
            let sbcToolbar = document.getElementById("sbcToolbar");
            if (sbcToolbar) {
              sbcToolbar.appendChild(hoverBtn);
            }
          }, 500);

          button.addEventListener("mouseleave", () => {
            clearTimeout(hoverTimeout);
          });
        }
      }
    });
    button.addEventListener("mouseleave", () => {
      button.classList.remove("sbcToolBarHover");
    });
    return button;
  };

  const createHoverNav = (id, title, footer, buttons, style = {}) => {
    const nav = document.createElement("nav");
    nav.classList.add("ut-tab-bar", "sbc-auto");
    nav.id = "hoverNav";
    const defaultStyles = {
      backgroundImage: "none",
      paddingTop: "5px",
      right: "6.5rem",
      width: "auto",
      position: "absolute",
      zIndex: "1000",
      direction: "rtl",
      maxHeight: "70vh",
      background: "none",
    };
    const combinedStyles = { ...defaultStyles, ...style };
    Object.keys(combinedStyles).forEach((key) => {
      nav.style[key] = combinedStyles[key];
    });

    if (title) {
      let navTitle = document.createElement("span");
      navTitle.innerHTML = `<b>${title}</b>`;
      navTitle.style.display = "block";
      navTitle.style.textAlign = "center";
      navTitle.style.background = "#1e1f1f";
      nav.appendChild(navTitle);
    }
    let btnDiv = createDiv(`btnDiv${id}`, {});
    btnDiv.style.overflowY = "auto";
    btnDiv.style.height = "auto";
    btnDiv.style.width = "auto !important";
    btnDiv.style.display = "block";
    btnDiv.style.textAlign = "center";
    btnDiv.style.borderBottomLeftRadius = "20px";
    btnDiv.style.borderBottomRightRadius = "20px";
    buttons.forEach((button) => {
      btnDiv.appendChild(button);
    });
    nav.appendChild(btnDiv);
    if (footer) {
      let navFooter = document.createElement("span");
      navFooter.innerHTML = `<i>${footer}</i>`;
      navFooter.style.display = "block";
      navFooter.style.textAlign = "center";
      nav.appendChild(navFooter);
    }
    nav.addEventListener("mouseleave", () => {
      nav.remove();
    });

    return nav;
  };

  const createDiv = (id, style) => {
    const div = document.createElement("div");
    div.id = id;
    Object.keys(style).forEach((key) => {
      div.style[key] = style[key];
    });
    return div;
  };

  const createPackList = async () => {
    let packs = await getPacks();
    let i = services.Localization;
    let packContent = `<span>Packs<br>${
      packs.packs.filter(
        (f) => f.isMyPack || f?.prices?._collection?.COINS?.amount < 100
      ).length
    }</span>`;
    let packCounts = packs.packs
      .filter((f) => f.isMyPack || f?.prices?._collection?.COINS?.amount < 100)
      .reduce((acc, pack) => {
        let key = `${pack.packName} ${
          pack.tradeable ? "(Tradable)" : "(Untradable)"
        }`;

        acc[key] = acc[key] || {};
        acc[key].count = (acc[key]?.count || 0) + 1;
        acc[key].packName =
          i.localize(pack.packName) +
          (pack?.prices?._collection?.COINS?.amount
            ? ` (${pack.prices._collection.COINS.amount} coins)`
            : "");
        acc[key].class = pack.tradable ? "tradable" : "untradable";
        acc[key].description = i.localize(pack.packDesc);
        acc[key].pack = pack;

        return acc;
      }, {});

    let packHoverButtons = Object.keys(packCounts).map((packName) => {
      let pack = packCounts[packName];

      let navLabelSpan = document.createElement("span");
      navLabelSpan.title = pack.description; // Add tooltip with pack description
      navLabelSpan.classList.add(pack.class);
      navLabelSpan.style.direction = "ltr";

      let packLabel =
        pack.count > 1 ? `${pack.packName}<br>x ${pack.count}` : pack.packName;
      navLabelSpan.innerHTML = packLabel;
      let btn = createNavButton(
        "openPackItem",
        navLabelSpan.outerHTML,
        () => {},
        async () => {
          let packToOpen = pack.pack;
          if (pack.pack.isMyPack) {
            await openPack(packToOpen, pack.count);
          } else {
            packToOpen
              .purchase(GameCurrency.COINS)
              .observe(new UTStoreViewController(), async (obs, event) => {
                await openPack(packToOpen);
              });
          }

          createSBCTab();
          goToUnassignedView();
        },
        { width: "20vw", marginTop: "0px" }
      );

      return btn;
    });
    let packDiv = document.createElement("div");
    packHoverButtons.forEach((button) => {
      packDiv.appendChild(button);
    });
    let packNavBtn = createNavButton(
      "navPacks",
      packContent,
      async () => {
        return createHoverNav(
          "myPacks",
          "My Packs",
          "click to open",
          [packDiv],
          { width: "20vw" }
        );
      },
      () => {},
      { background: "none" }
    );

    return packNavBtn;
  };

  const createCategoryPicker = async () => {
    let sets = await sbcSets();
    if (sets === undefined) {
      console.log("createCategoryPicker: sets are undefined");
      return null;
    }
    let categories = sets.categories.map((f) => f.name);
    let categoryButtons = [];
    categories.forEach((category) => {
      let navLabelSpan = document.createElement("span");
      navLabelSpan.innerHTML = category;
      navLabelSpan.style.display = "inline-block";
      navLabelSpan.style.verticalAlign = "middle";
      navLabelSpan.style.width = "50px";
      let navBtn = createNavButton(
        category,
        navLabelSpan.outerHTML,
        () => {},
        async () => {
          saveSettings(0, 0, "sbcType", category);
          services.Notification.queue([
            "Updating SBC toolbar to " + category,
            UINotificationType.POSITIVE,
          ]);
          createSBCTab();
        },
        { width: "20vw", marginTop: "0px" }
      );
      categoryButtons.push(navBtn);
    });

    let categoryNavBtn = createNavButton(
      "navCategory",
      `SBC 1-click <br>${getSettings(0, 0, "sbcType")}`,
      async () => {
        return createHoverNav(
          "categoryPicker",
          "SBC Categories",
          "click to select",
          categoryButtons,
          { width: "20vw" }
        );
      },
      () => {},
      { background: "none" }
    );
    return categoryNavBtn;
  };

  const createSBCButtons = async () => {
    let sets = await sbcSets();
    if (sets === undefined) {
      console.log("createSBCButtons: sets are undefined");
      return null;
    }

    let sbcSetIds = sets.categories.filter(
      (f) => f.name == getSettings(0, 0, "sbcType")
    )[0].setIds;
    console.log(
      sets.sets.filter((f) => sbcSetIds.includes(f.id) && !f.isComplete())
    );
    let allSbcSets = sets.sets
      .filter((f) => sbcSetIds.includes(f.id) && !f.isComplete())
      .reverse();
    if (getSettings(0, 0, "sbcType") === "Favourites") {
      allSbcSets = allSbcSets.sort(
        (a, b) => b.timesCompleted - a.timesCompleted
      );
    }
    let sbcTiles = [];
    allSbcSets.forEach((set) => {
      var t = new UTSBCSetTileView();
      t.init(), (t.title = set.name), t.setData(set), t.render();
      let pb = t._progressBar;
      let sbcDiv = document.createElement("div");
      var img = document.createElement("img");
      img.setAttribute("src", t._setImage.src);
      img.width = img.height = "64";
      sbcDiv.appendChild(img);
      if (!t.data.isSingleChallenge) {
        sbcDiv.appendChild(pb.getRootElement());
      }
      var label = document.createElement("span");
      label.innerHTML = set.name;
      sbcDiv.appendChild(label);

      //     console.log(set)

      sbcTiles.push(
        createNavButton(
          `navSBC${set.id}`,
          sbcDiv.outerHTML,
          async () => {
            let hoverSet = await createSBCHover(set);

            let hoverNav = createHoverNav(set.id, "", "click to start", [
              hoverSet,
            ]);
            return hoverNav;
          },
          () => {
            createSbc = true;
            createSBCTab();
            services.Notification.queue([
              set.name + " SBC Started",
              UINotificationType.POSITIVE,
            ]);

            solveSBC(set.id, 0, true);
          },
          { background: "none" }
        )
      );
    });
    return sbcTiles;
  };

  const createSBCHover = async (set) => {
    let layoutHubDiv = document.createElement("div");
    layoutHubDiv.style.padding = "0";
    layoutHubDiv.style.width = "50vw";
    layoutHubDiv.style.maxWidth = "500px";
    layoutHubDiv.style.direction = "ltr";
    layoutHubDiv.style.overflowY = "none";
    var s = new UTSBCSetTileView();
    s.init(), (s.title = set.name), s.setData(set), s.render();
    layoutHubDiv.appendChild(s.getRootElement());
    layoutHubDiv.querySelectorAll("div").forEach((div) => {
      div.classList.remove("col-1-2-md");
    });
    let progressBlock = layoutHubDiv.querySelector(
      ".ut-sbc-set-tile-view--progress-block"
    );
    if (progressBlock) {
      progressBlock.insertBefore(
        s._progressBar.getRootElement(),
        progressBlock.firstChild
      );
    }

    let c = await getChallenges(set);
    let row = c.challenges
      .sort(function (e, t) {
        return e.priority - t.priority;
      })
      .map(function (e) {
        i = new UTSBCChallengeTableRowView();
        i.init(), i.setTitle(e.name), i.render(e);
        let rowRoot = i.getRootElement();
        rowRoot.querySelectorAll("div").forEach((div) => {
          div.classList.remove("has-tap-callback");
          if (div.classList.contains("ut-progress-bar")) {
            div.remove();
          }

          rowRoot.querySelectorAll("img").forEach((img) => {
            img.style.width = "15%";
          });
        });
        rowRoot.addEventListener("mouseenter", async () => {
          let s = new UTSBCChallengeRequirementsView();
          s.renderChallengeRequirements(e, true);
          let challengeDiv = document.createElement("div");
          challengeDiv.id = "challengeNav";
          challengeDiv.style.position = "absolute";

          challengeDiv.style.top = "355px";
          challengeDiv.style.right = "calc(100% + 5px)";
          challengeDiv.style.padding = "5px";
          challengeDiv.style.width = "25vw";
          challengeDiv.style.borderRadius = "20px";
          challengeDiv.style.background = "#1e1f1f";
          challengeDiv.appendChild(s.getRootElement());
          layoutHubDiv.appendChild(challengeDiv);
        });
        rowRoot.addEventListener("mouseleave", () => {
          let challengeDiv = document.getElementById("challengeNav");
          if (challengeDiv) {
            challengeDiv.remove();
          }
        });
        rowRoot.addEventListener("click", () => {
          let hoverNav = document.getElementById("hoverNav");

          if (hoverNav) {
            hoverNav.remove();
          }
          createSbc = true;
          createSBCTab();
          services.Notification.queue([
            set.name + " SBC Started",
            UINotificationType.POSITIVE,
          ]);

          solveSBC(e.setId, e.id, true);
        });
        return rowRoot;
      });

    let rowDiv = document.createElement("div");
    rowDiv.id = "challengeRow";
    rowDiv.style.padding = "5px";
    rowDiv.style.borderRadius = "20px";
    rowDiv.style.background = "#1e1f1f";
    rowDiv.style.overflowY = "auto";
    row.forEach((r) => {
      rowDiv.appendChild(r);
    });
    layoutHubDiv.appendChild(rowDiv);

    return layoutHubDiv;
  };

  let createSBCTab = async () => {
    if (!getSettings(0, 0, "showSbcTab")) {
      $(".sbc-auto").remove();
      return;
    }
    services.SBC.repository.reset();
    const nav = document.createElement("nav");
    nav.id = "sbcToolbar";
    nav.classList.add("ut-tab-bar", "sbc-auto");

    let packList = await createPackList();
    nav.appendChild(packList);

    let categoryPicker = await createCategoryPicker();
    nav.appendChild(categoryPicker);
    let sbcDiv = document.createElement("div");
    sbcDiv.style.overflowY = "auto";
    sbcDiv.style.height = "auto";
    let sbcTiles = await createSBCButtons();
    sbcTiles.forEach((tile) => {
      sbcDiv.appendChild(tile);
    });
    nav.appendChild(sbcDiv);

    $(".sbc-auto").remove();
    $(".ut-tab-bar-view").prepend(nav);
  };

  const generatePivotTab = () => {
    const pivotTab = new UTTabBarItemView();
    pivotTab.init();
    pivotTab.setTag(7);
    pivotTab.setText("Club Analysis");
    pivotTab.addClass("icon-club");
    return pivotTab;
  };

  const pivotTableController = function (t) {
    UTHomeHubViewController.call(this);
  };

  JSUtils.inherits(pivotTableController, UTHomeHubViewController);

  pivotTableController.prototype._getViewInstanceFromData = function () {
    return new pivotTableView();
  };

  pivotTableController.prototype.viewDidAppear = function () {
    this.getNavigationController().setNavigationVisibility(true, true);
  };

  pivotTableController.prototype.getNavigationTitle = function () {
    return "Club Analysis";
  };
  pivotTableController.prototype.viewWillDisappear = function () {
    this.getNavigationController().setNavigationVisibility(false, false);
  };
  const pivotTableView = function (t) {
    UTHomeHubView.call(this);
  };

  JSUtils.inherits(pivotTableView, UTHomeHubView);

  pivotTableView.prototype.viewWillDisappear = function () {
    this.getNavigationController().setNavigationVisibility(false, false);
  };

  pivotTableView.prototype.destroyGeneratedElements =
    function destroyGeneratedElements() {
      DOMKit.remove(this.__root), (this.__root = null);
    };

  pivotTableView.prototype._generate = async function () {
    // Create container

    const container = document.createElement("div");
    container.style.padding = "20px";
    container.style.background = "white";
    container.style.height = "100%";

    // Create pivot table
    const pivotTable = document.createElement("div");
    pivotTable.id = "pivot-table";
    pivotTable.style.background = "#fff";
    pivotTable.style.padding = "10px";
    pivotTable.style.borderRadius = "5px";

    container.appendChild(pivotTable);
    this.__root = container;
    this.__root.style.height = "100%";
    this.__root.style.width = "100%";
    this.__root.style.overflow = "auto";
    this.__root.style.padding = "20px";
    showLoader();
    const pivotData = await initPivotTable();

    // Add form elements for saving/loading layouts
    const layoutForm = document.createElement("div");
    layoutForm.style.marginBottom = "20px";
    // Create the container div
    const pivotContainer = document.createElement("div");
    pivotContainer.style.display = "flex";
    pivotContainer.style.gap = "10px";
    pivotContainer.style.alignItems = "center";

    // Create layout name input
    const layoutNameInput = document.createElement("input");
    layoutNameInput.type = "text";
    layoutNameInput.id = "layoutName";
    layoutNameInput.placeholder = "Layout name";
    layoutNameInput.style.padding = "5px";
    layoutNameInput.style.width = "250px";
    // Create save button
    const saveButton = document.createElement("button");
    saveButton.id = "saveLayout";
    saveButton.className = "btn-standard";
    saveButton.textContent = "Save Layout";

    // Create layout select dropdown
    const layoutSelect = document.createElement("select");
    layoutSelect.id = "savedLayouts";
    layoutSelect.style.padding = "5px";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = localStorage.getItem("lastUsedLayout") || "Save a layout...";
    layoutSelect.appendChild(defaultOption);
    

    // Create delete button
    const deleteButton = document.createElement("button");
    deleteButton.id = "deleteLayout";
    deleteButton.className = "btn-standard";
    deleteButton.textContent = "Delete Layout";

    // Append all elements to container
    pivotContainer.appendChild(layoutSelect);
    pivotContainer.appendChild(layoutNameInput);
    pivotContainer.appendChild(saveButton);
    
    pivotContainer.appendChild(deleteButton);

    // Add container to layout form
    layoutForm.appendChild(pivotContainer);
    container.insertBefore(layoutForm, pivotTable);

    // Setup layout saving/loading functionality
    const layoutStorage = localStorage.getItem("pivotLayouts")
      ? JSON.parse(localStorage.getItem("pivotLayouts"))
      : {};

    const populateLayoutSelect = () => {
      const select = document.getElementById("savedLayouts");
      select.innerHTML = '<option value="">Select a saved layout...</option>';
      Object.keys(layoutStorage).forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
      });
      // Auto load layout when selection changes
      layoutSelect.addEventListener('change', () => {
        const name = layoutSelect.value;
        if (!name) return;
        
        const config = layoutStorage[name];
        localStorage.setItem("lastUsedLayout", name);
        $("#pivot-table").pivotUI(pivotData, config, true);
        showNotification(`Layout "${name}" loaded`, UINotificationType.POSITIVE);
      });
    };

    saveButton.addEventListener("click", () => {
      const name = document.getElementById("layoutName").value;
      if (!name) {
        showNotification(
          "Please enter a layout name",
          UINotificationType.NEGATIVE
        );
        return;
      }
      const config = $("#pivot-table").data("pivotUIOptions");
      const config_copy = JSON.parse(JSON.stringify(config));
      delete config_copy.aggregators;
      delete config_copy.renderers;
      layoutStorage[name] = config_copy;
      localStorage.setItem("pivotLayouts", JSON.stringify(layoutStorage));
      localStorage.setItem("lastUsedLayout", name); // Save last used layout name
      
      showNotification(`Layout "${name}" saved`, UINotificationType.POSITIVE);
      populateLayoutSelect();
      document.getElementById("layoutName").value = "";
    });

  deleteButton.addEventListener("click", () => {
      const name = document.getElementById("savedLayouts").value;
      if (!name) {
        showNotification("Please select a layout", UINotificationType.NEGATIVE);
        return;
      }
      delete layoutStorage[name];
      localStorage.setItem("pivotLayouts", JSON.stringify(layoutStorage));
      showNotification(`Layout "${name}" deleted`, UINotificationType.POSITIVE);
      populateLayoutSelect();
    });

    populateLayoutSelect();
    hideLoader();
  };

  const initPivotTable = async () => {
    const players = await fetchPlayers();
    // Add isStorage = false to each player in players
    players.forEach((player) => (player.storage = false));
    const storageItems = await getStoragePlayers();
    storageItems.forEach((player) => (player.storage = true));
    const duplicateIds = await fetchDuplicateIds();
    // Transform player data for pivot table

    const pivotData = [...players, ...storageItems].map((player) => ({
      name: player._staticData.name,
      rating: player.rating,
      isSpecial: player.isSpecial(),
      cardType:
        (player.isSpecial()
          ? ""
          : services.Localization.localize(
              "search.cardLevels.cardLevel" + player.getTier()
            ) + " ") +
        services.Localization.localize("item.raretype" + player.rareflag),
      league: factories.DataProvider.getLeagueDP().filter(
        (n) => n.id === player.leagueId
      )[0]?.label,
      nation: factories.DataProvider.getNationDP().filter(
        (n) => n.id === player.nationId
      )[0]?.label,
      team: factories.DataProvider.getTeamDP().filter(
        (t) => t.id === player.teamId
      )[0]?.label,
      price: getPrice(player) || 0,
      sbcPrice: getSBCPrice(player, duplicateIds),
      isUntradeable: player.untradeable,
      isStorage: player.storage,
      isLoan: player.loans > -1,
      preferredPosition: player.preferredPosition,
      possiblePositions: player.possiblePositions,
    }));

    // Initialize pivot table after DOM is ready
    setTimeout(() => {
      // Include all D3 renderers
      $.pivotUtilities.c3_renderers = $.extend($.pivotUtilities.c3_renderers, {
        "D3 Tree": function (pivotData, opts) {
          return c3.generate({
            bindto: opts.element,
            data: {
              json: pivotData,
              type: "treemap",
            },
          });
        },
        "D3 Sunburst": function (pivotData, opts) {
          return c3.generate({
            bindto: opts.element,
            data: {
              json: pivotData,
              type: "sunburst",
            },
          });
        },
        "D3 Bubble": function (pivotData, opts) {
          return c3.generate({
            bindto: opts.element,
            data: {
              json: pivotData,
              type: "bubble",
            },
          });
        },
      });
      let renderers = $.extend(
        $.pivotUtilities.renderers,
        $.pivotUtilities.c3_renderers,
        $.pivotUtilities.d3_renderers
      );
      
    // Load last used layout name from storage if exists
    const lastUsed = localStorage.getItem("lastUsedLayout");
    const layoutStorage = localStorage.getItem("pivotLayouts") ? 
      JSON.parse(localStorage.getItem("pivotLayouts")) : {};

    // If last used layout exists, use it as initial config
    const initialConfig = lastUsed && layoutStorage[lastUsed] ? 
      layoutStorage[lastUsed] : {
        rows: ["cardType"],
        cols: [],
        vals: [],
        rowOrder: "value_z_to_a",
        aggregatorName: "Count",
        rendererName: "Heatmap",
        exclusions: {},
        inclusions: {},
        unusedAttrsVertical: false,
        renderers: renderers,
      };

      $("#pivot-table").pivotUI(pivotData, initialConfig);
    }, 1000);
    return pivotData;
  };
  const sideBarNavOverride = () => {
    const navViewInit =
      UTGameTabBarController.prototype.initWithViewControllers;
    UTGameTabBarController.prototype.initWithViewControllers = function (tabs) {
      // Check if SBC Solver tab already exists
      const sbcSolverExists = tabs.some(tab => 
        tab.tabBarItem && tab.tabBarItem.getText && tab.tabBarItem.getText() === "SBC Solver");
      
      // Check if Club Analysis tab already exists
      const clubAnalysisExists = tabs.some(tab => 
        tab.tabBarItem && tab.tabBarItem.getText && tab.tabBarItem.getText() === "Club Analysis");
      
      // Add SBC Solver tab if it doesn't exist
      if (!sbcSolverExists) {
        const navBar = new UTGameFlowNavigationController();
        navBar.initWithRootController(new sbcSettingsController());
        navBar.tabBarItem = generateSbcSolveTab();
        tabs.push(navBar);
      }
      
      // Add Club Analysis tab if it doesn't exist
      if (!clubAnalysisExists) {
        const navBar2 = new UTGameFlowNavigationController();
        navBar2.initWithRootController(new pivotTableController());
        navBar2.tabBarItem = generatePivotTab();
        tabs.push(navBar2);
      }
      
      navViewInit.call(this, tabs);
    };
  };

  let SOLVER_SETTINGS_KEY = "sbcSolverSettings";
  let cachedSolverSettings;

  let setSolverSettings = function (key, Settings) {
    let SolverSettings = getSolverSettings();
    SolverSettings[key] = Settings;
    cachedSolverSettings = SolverSettings;
    localStorage.setItem(
      SOLVER_SETTINGS_KEY,
      JSON.stringify(cachedSolverSettings)
    );
  };

  let getSolverSettings = function () {
    if (cachedSolverSettings) {
      return cachedSolverSettings;
    }
    cachedSolverSettings = {};
    let SolverSettings = localStorage.getItem(SOLVER_SETTINGS_KEY);
    if (SolverSettings) {
      cachedSolverSettings = JSON.parse(SolverSettings);
    } else {
      cachedSolverSettings = {};
    }

    return cachedSolverSettings;
  };

  const generateSbcSolveTab = () => {
    const sbcSolveTab = new UTTabBarItemView();
    sbcSolveTab.init();
    sbcSolveTab.setTag(6);
    sbcSolveTab.setText("SBC Solver");
    sbcSolveTab.addClass("icon-sbcSettings");
    return sbcSolveTab;
  };

  const sbcSettingsController = function (t) {
    UTHomeHubViewController.call(this);
  };

  JSUtils.inherits(sbcSettingsController, UTHomeHubViewController);

  sbcSettingsController.prototype._getViewInstanceFromData = function () {
    return new sbcSettingsView();
  };

  sbcSettingsController.prototype.viewDidAppear = function () {
    this.getNavigationController().setNavigationVisibility(true, true);
  };

  const sbcSettingsView = function (t) {
    UTHomeHubView.call(this);
  };
  JSUtils.inherits(sbcSettingsView, UTHomeHubView);
  sbcSettingsController.prototype.viewWillDisappear = function () {
    this.getNavigationController().setNavigationVisibility(false, false);
  };
  sbcSettingsController.prototype.getNavigationTitle = function () {
    return "SBC Solver";
  };
  sbcSettingsView.prototype.destroyGeneratedElements =
    function destroyGeneratedElements() {
      DOMKit.remove(this.__root), (this.__root = null);
    };

  sbcSettingsView.prototype._generate = function _generate() {
    if (
      document.contains(
        document.getElementsByClassName("ut-sbc-challenge-requirements-view")[0]
      )
    ) {
      document
        .getElementsByClassName("ut-sbc-challenge-requirements-view")[0]
        .remove();
    }

    var e = document.createElement("div");
    e.classList.add("ut-market-search-filters-view"),
      e.classList.add("floating");
    e.classList.add("sbc-settings-container");
    e.setAttribute("id", "SettingsPanel");

    var f = document.createElement("div");
    f.classList.add("ut-pinned-list"), f.classList.add("sbc-settings");
    e.appendChild(f);

    var g = document.createElement("div");

    g.classList.add("sbc-settings-header"), g.classList.add("main-header");
    var h1 = document.createElement("H1");
    h1.innerHTML = "SBC Solver Settings";
    g.appendChild(h1);
    f.appendChild(g);
    let sbcUITile = createSettingsTile(f, "Customise UI", "ui");
    createToggle(
      sbcUITile,
      "Collect Concept Player Prices (Must be enabled to use concepts in SBC)",
      "collectConcepts",
      getSettings(0, 0, "collectConcepts"),
      (toggleCC) => {
        saveSettings(0, 0, "collectConcepts", toggleCC.getToggleState());
        if (getSettings(0, 0, "collectConcepts")) {
          getConceptPlayers();
        }
      }
    );
    createToggle(
      sbcUITile,
      "Play Sounds",
      "playSounds",
      getSettings(0, 0, "playSounds"),
      (togglePS) => {
        saveSettings(0, 0, "playSounds", togglePS.getToggleState());
      }
    );

    createNumberSpinner(
      sbcUITile,
      "Min Rating for Pack Animation",
      "animateWalkouts",
      1,
      100,
      getSettings(0, 0, "animateWalkouts"),
      (toggleAW) => {
        saveSettings(0, 0, "animateWalkouts", toggleAW.getToggleState());
      }
    );
    createToggle(
      sbcUITile,
      "Only use TOTW/TOTS where necessary",
      "saveTotw",
      getSettings(0, 0, "saveTotw"),
      (toggleST) => {
        saveSettings(0, 0, "saveTotw", toggleST.getToggleState());
      }
    );
    createToggle(
      sbcUITile,
      "Show Prices",
      "showPrices",
      getSettings(0, 0, "showPrices"),
      (toggleSP) => {
        saveSettings(0, 0, "showPrices", toggleSP.getToggleState());
      }
    );
    createNumberSpinner(
      sbcUITile,
      "Price Cache Minutes",
      "priceCacheMinutes",
      1,
      1440,
      getSettings(0, 0, "priceCacheMinutes"),
      (numberspinnerPCM) => {
        saveSettings(0, 0, "priceCacheMinutes", numberspinnerPCM.getValue());
      }
    );
    createToggle(
      sbcUITile,
      "Show SBCs Tab",
      "showSbcTab",
      getSettings(0, 0, "showSbcTab"),
      (toggleSBCT) => {
        saveSettings(0, 0, "showSbcTab", toggleSBCT.getToggleState());
        createSBCTab();
      }
    );
    createToggle(
      sbcUITile,
      "Show Debug Log Overlay",
      "showLogOverlay",
      getSettings(0, 0, "showLogOverlay"),
      (toggleLog) => {
        saveSettings(0, 0, "showLogOverlay", toggleLog.getToggleState());
      }
    );
    let panel = createPanel();
    let clearPricesBtn = createButton("clearPrices", "Clear All Prices", () => {
      cachedPriceItems = null;
      localStorage.removeItem(PRICE_ITEMS_KEY);
    });
    panel.appendChild(clearPricesBtn);
    sbcUITile.appendChild(panel);

    let sbcRulesTile = createSettingsTile(f, "Customise SBC", "customRules");
    createSBCCustomRulesPanel(sbcRulesTile);

    (this.__root = e), (this._generated = !0);
  };
  let challenges;
  let sbcSet;
  const createSBCCustomRulesPanel = async (parent) => {
    let sbcData = await sbcSets();

    let SBCList = sbcData.sets
      .sort(function (a, b) {
        if (a.name < b.name) {
          return -1;
        }
        if (a.name > b.name) {
          return 1;
        }
        return 0;
      })
      .filter((f) => !f.isComplete())
      .map((e) => new UTDataProviderEntryDTO(e.id, e.id, e.name));
    SBCList.unshift(new UTDataProviderEntryDTO(0, 0, "All SBCS"));
    createDropDown(
      parent,
      "Choose SBC",
      "sbcId",
      SBCList,
      "1",
      async (dropdown) => {
        if (
          document.contains(
            document.getElementsByClassName(
              "ut-sbc-challenge-requirements-view"
            )[0]
          )
        ) {
          document
            .getElementsByClassName("ut-sbc-challenge-requirements-view")[0]
            .remove();
        }
        let challenge = [];
        if (dropdown.getValue() != 0) {
          let allSbcData = await sbcSets();
          sbcSet = allSbcData.sets.filter(
            (e) => e.id == dropdown.getValue()
          )[0];

          challenges = await getChallenges(sbcSet);

          challenge = challenges.challenges.map(
            (e) => new UTDataProviderEntryDTO(e.id, e.id, e.name)
          );
        }
        challenge.unshift(new UTDataProviderEntryDTO(0, 0, "All Challenges"));
        createDropDown(
          parent,
          "Choose Challenge",
          "sbcChallengeId",
          challenge,
          null,
          async (dropdownChallenge) => {
            if (
              document.contains(
                document.getElementsByClassName(
                  "ut-sbc-challenge-requirements-view"
                )[0]
              )
            ) {
              document
                .getElementsByClassName("ut-sbc-challenge-requirements-view")[0]
                .remove();
            }
            let sbcParamsTile = createSettingsTile(
              parent,
              "SBC Solver Paramaters",
              "submitParams"
            );
            createDropDown(
              sbcParamsTile,
              "1-click Auto Submit",
              "autoSubmit",
              [
                { name: "Always", id: 1 },
                { name: "Optimal", id: 4 },
                { name: "Never", id: 0 },
              ].map((e) => new UTDataProviderEntryDTO(e.id, e.id, e.name)),
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "autoSubmit"
              ),
              (dropdownAS) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "autoSubmit",
                  parseInt(dropdownAS.getValue())
                );
              }
            );
            createNumberSpinner(
              sbcParamsTile,
              "Repeat Count (-1 repeats infinitely)",
              "repeatCount",
              -1,
              100,
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "repeatCount"
              ),
              (numberspinnerRC) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "repeatCount",
                  numberspinnerRC.getValue()
                );
              }
            );
            createToggle(
              sbcParamsTile,
              "Automatically try SBC on Login",
              "sbcOnLogin",
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "sbcOnLogin"
              ),
              (toggleLOG) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "sbcOnLogin",
                  toggleLOG.getToggleState()
                );
              }
            );
            createToggle(
              sbcParamsTile,
              "Use Concepts",
              "useConcepts",
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "useConcepts"
              ),
              (toggleUC) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "useConcepts",
                  toggleUC.getToggleState()
                );
              }
            );
            createToggle(
              sbcParamsTile,
              "Automatically Open Reward Packs",
              "autoOpenPacks",
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "autoOpenPacks"
              ),
              (toggleAO) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "autoOpenPacks",
                  toggleAO.getToggleState()
                );
              }
            );
            createNumberSpinner(
              sbcParamsTile,
              "Player Max Rating",
              "maxRating",
              48,
              99,
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "maxRating"
              ),
              (numberspinnerMR) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "maxRating",
                  numberspinnerMR.getValue()
                );
              }
            );
            createToggle(
              sbcParamsTile,
              "Ignore Max Rating for Duplicates",
              "useDupes",
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "useDupes"
              ),
              (toggleUD) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "useDupes",
                  toggleUD.getToggleState()
                );
              }
            );
            createNumberSpinner(
              sbcParamsTile,
              "API Max Solve Time",
              "maxSolveTime",
              10,
              990,
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "maxSolveTime"
              ),
              (numberspinnerMST) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "maxSolveTime",
                  numberspinnerMST.getValue()
                );
              }
            );
            //  (parentDiv,label,id,options,value,target)
            createToggle(
              sbcParamsTile,
              "Exclude Objective Players",
              "excludeObjective",
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeObjective"
              ),
              (toggleXO) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "excludeObjective",
                  toggleXO.getToggleState()
                );
              }
            );
            createToggle(
              sbcParamsTile,
              "Exclude Special Players",
              "excludeSpecial",
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeSpecial"
              ),
              (toggleSP) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "excludeSpecial",
                  toggleSP.getToggleState()
                );
              }
            );
            createToggle(
              sbcParamsTile,
              "Exclude Tradable Players",
              "excludeTradable",
              getSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeTradable"
              ),
              (toggleSP) => {
                saveSettings(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  "excludeTradable",
                  toggleSP.getToggleState()
                );
              }
            );
            createToggle(
              sbcParamsTile,
              "Exclude SBC Players",
              "excludeSbc",
              getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "excludeSbc"
              ),
              (toggleXSBC) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeSbc",
                toggleXSBC.getToggleState()
              );
              }
            );
            createToggle(
              sbcParamsTile,
              "Exclude Extinct Players",
              "excludeExtinct",
              getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "excludeExtinct"
              ),
              (toggleXE) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeExtinct",
                toggleXE.getToggleState()
              );
              }
            );
            createChoice(
              sbcParamsTile,
              "EXCLUDE - Players",
              "excludePlayers",
              players.map((item) => {
                return {
                  label:
                    item._staticData.firstName +
                    " " +
                    item._staticData.lastName,
                  value: item.definitionId,
                  id: item.definitionId,
                  customProperties: {
                    icon: `<img width="30" src='${getShellUri(
                      item.rareflag,
                      item.rareflag < 4 ? item.getTier() : ItemRatingTier.NONE
                    )}'/>`,
                  },
                };
              }),
              dropdown.getValue(),
              dropdownChallenge.getValue()
            );
            createChoice(
              sbcParamsTile,
              "EXCLUDE - Leagues",
              "excludeLeagues",
              factories.DataProvider.getLeagueDP()
                .filter((f) => f.id > 0)
                .map((m) => {
                  return {
                    id: m.id,
                    value: m.id,
                    label: m.label,
                    customProperties: {
                      icon: `<img width="20" src='${AssetLocationUtils.getLeagueImageUri(
                        m.id,
                        enums.UIThemeVariation.DARK
                      )}'/>`,
                    },
                  };
                }),

              dropdown.getValue(),
              dropdownChallenge.getValue()
            );
            createChoice(
              sbcParamsTile,
              "EXCLUDE - Nations",
              "excludeNations",
              factories.DataProvider.getNationDP()
                .map((m) => {
                  return {
                    id: m.id,
                    value: m.id,
                    label: m.label,
                    customProperties: {
                      icon: `<img width="30" src='${AssetLocationUtils.getFlagImageUri(
                        m.id,
                        enums.UIThemeVariation.DARK
                      )}'/>`,
                    },
                  };
                })
                .filter((f) => f.id > 0),

              dropdown.getValue(),
              dropdownChallenge.getValue()
            );
            createChoice(
              sbcParamsTile,
              "EXCLUDE - Teams",
              "excludeTeams",
              factories.DataProvider.getTeamDP()
                .map((m) => {
                  return {
                    id: m.id,
                    value: m.id,
                    label:
                      m.label +
                      " ( " +
                      repositories.TeamConfig.leagues._collection[
                        repositories.TeamConfig.teams._collection[m.id]?.league
                      ]?.name +
                      " )",
                    customProperties: {
                      icon: `<img width="30" src='${AssetLocationUtils.getBadgeImageUri(
                        m.id,
                        enums.UIThemeVariation.DARK
                      )}'/>`,
                    },
                  };
                })
                .filter((f) => f.id > 0 && !f.label.includes("*")),
              dropdown.getValue(),
              dropdownChallenge.getValue()
            );
            createChoice(
              sbcParamsTile,
              "EXCLUDE - Rarity",
              "excludeRarity",
              factories.DataProvider.getItemRarityDP({
                itemSubTypes: [ItemSubType.PLAYER],
                itemTypes: [ItemType.PLAYER],
                quality: SearchLevel.ANY,
                tradableOnly: false,
              })
                .map((m) => {
                  return {
                    id: m.id,
                    value: m.label,
                    label: m.label,
                    customProperties: {
                      icon: `<img width="30" src='${getShellUri(
                        m.id,
                        m.id < 4 ? ItemRatingTier.GOLD : ItemRatingTier.NONE
                      )}'/>`,
                    },
                  };
                })
                .filter((f) => f.id > 0 && !f.label.includes("*")),
              dropdown.getValue(),
              dropdownChallenge.getValue()
            );
          }
        );
      }
    );
  };

  const getShellUri = (id, ratingTier) => {
    return AssetLocationUtils.getShellUri(
      0,
      1,
      id,
      ratingTier,
      repositories.Rarity._collection[id]?.guid
    );
  };

  const saveSettings = (sbc, challenge, id, value) => {
    let settings = getSolverSettings();
    settings["sbcSettings"] ??= {};
    let sbcSettings = settings["sbcSettings"];
    sbcSettings[sbc] ??= {};
    sbcSettings[sbc][challenge] ??= {};
    sbcSettings[sbc][challenge][id] = value;
    setSolverSettings("sbcSettings", sbcSettings);

  };
  const getSettings = (sbc, challenge, id) => {
    let settings = getSolverSettings();
    let returnValue =
      settings["sbcSettings"]?.[sbc]?.[challenge]?.[id] ??
      settings["sbcSettings"]?.[sbc]?.[0]?.[id] ??
      settings["sbcSettings"]?.[0]?.[0]?.[id];
    return returnValue;
  };
  const defaultSBCSolverSettings = {
    apiUrl: "http://127.0.0.1:8000",
    excludeTeams: [],
    excludeRarity: [],
    excludeNations: [],
    excludeLeagues: [],
    excludePlayers: [],
    excludeSbc: false,
    excludeTradable: false,
    excludeSpecial: false,
    excludeObjective: false,
    excludeExtinct: false,
    useConcepts: false,
    collectConcepts: false,
    animateWalkouts: 86,
    playSounds: true,
    autoSubmit: 0,
    maxSolveTime: 60,
    priceCacheMinutes: 1440,
    maxRating: 99,
    repeatCount: 0,
    showPrices: true,
    showSbcTab: true,
    useDupes: true,
    autoOpenPacks: false,
    saveTotw: false,
    sbcType: "Favourites",
    showLogOverlay: false
  };

  // Create or update the log overlay
  const updateLogOverlay = () => {
    let logOverlay = document.getElementById('sbc-log-overlay');
    
    if (getSettings(0, 0, "showLogOverlay")) {
      if (!logOverlay) {
        logOverlay = document.createElement('div');
        logOverlay.id = 'sbc-log-overlay';
        logOverlay.style.position = 'fixed';
        logOverlay.style.bottom = '10px';
        logOverlay.style.left = '10px';
        logOverlay.style.maxHeight = '15vh';
        logOverlay.style.overflowY = 'auto';
        logOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        logOverlay.style.color = '#00ff00';
        logOverlay.style.padding = '10px';
        logOverlay.style.fontSize = '12px';
        logOverlay.style.fontFamily = 'monospace';
        logOverlay.style.zIndex = '9999';
        logOverlay.style.borderRadius = '5px';
        document.body.appendChild(logOverlay);
      }
      logOverlay.style.display = 'block';
    } else if (logOverlay) {
      logOverlay.style.display = 'none';
    }
  };


  // Setup a variable to track the last log we've seen
  let lastLogIndex = 0;

  // Function to poll for solver logs
  const pollSolverLogs = async () => {
      if (!getSettings(0, 0, "showLogOverlay")) {
          return; // Don't poll if log overlay is disabled
      }
      
      try {
          const response = await makeGetRequest(apiUrl + "/solver-logs");
          const data = JSON.parse(response);
          console.log("Solver logs:",data);
          // We have new logs
          const logOverlay = document.getElementById('sbc-log-overlay');
          if (lastLogIndex === 0 && logOverlay) {
            while (logOverlay.firstChild) {
              logOverlay.removeChild(logOverlay.firstChild);
            }
          }
          if (data.logs && data.logs.length > lastLogIndex) {
              
              if (logOverlay) {
                  // Add new logs to the overlay
                  for (let i = lastLogIndex; i < data.logs.length; i++) {
                      const log = data.logs[i];
                      const timestamp = new Date(log.time * 1000).toISOString().split('T')[1].slice(0, -1);
                      
                      const logEntry = document.createElement('div');
                      logEntry.className = 'solver-log';
                      
                      if (log.message) {
                          logEntry.textContent = `${timestamp}: ${log.message}`;
                      }
                                            
                      logOverlay.insertBefore(logEntry, logOverlay.firstChild);
                  }
                  
                  lastLogIndex = data.logs.length;
              }
          }
      } catch (error) {
          console.error("Error polling solver logs:", error);
      }
  };

let initDefaultSettings = () => {
    Object.keys(defaultSBCSolverSettings).forEach((id) =>
      saveSettings(
        0,
        0,
        id,
        getSettings(0, 0, id) ?? defaultSBCSolverSettings[id]
      )
    );
  };
  const createPanel = () => {
    var panel = document.createElement("div");
    panel.classList.add("sbc-settings-field");

    return panel;
  };
  const createNumberSpinner = (
    parentDiv,
    label,
    id,
    min = 0,
    max = 100,
    value = 1,
    target = () => {}
  ) => {
    var i = document.createElement("div");
    i.classList.add("panelActionRow");
    var o = document.createElement("div");
    o.classList.add("buttonInfoLabel");
    var spinnerLabel = document.createElement("span");
    spinnerLabel.classList.add("spinnerLabel");
    spinnerLabel.innerHTML = label;
    o.appendChild(spinnerLabel);
    i.appendChild(o);
    let spinner = new UTNumberInputSpinnerControl();
    let panel = createPanel();

    spinner.init();
    spinner.setLimits(min, max);
    spinner.setValue(value);
    spinner.addTarget(spinner, target, EventType.CHANGE);
    panel.appendChild(i);
    panel.appendChild(spinner.getRootElement());
    //console.log(panel)
    parentDiv.appendChild(panel);
    return panel;
  };
  const createChoice = (parentDiv, label, id, options, sbc, challenge) => {
    if (document.contains(document.getElementById(id))) {
      document.getElementById(id).remove();
    }
    i = document.createElement("div");
    i.classList.add("panelActionRow");
    var o = document.createElement("div");
    o.classList.add("buttonInfoLabel");
    var choicesLabel = document.createElement("span");
    choicesLabel.classList.add("choicesLabel");
    choicesLabel.innerHTML = label;
    o.appendChild(choicesLabel);
    i.appendChild(o);

    let panel = createPanel();
    panel.appendChild(i);
    panel.setAttribute("id", id);
    let select = document.createElement("select");
    select.multiple = "multiple";
    select.setAttribute("id", "choice" + id);

    panel.appendChild(select);
    parentDiv.appendChild(panel);
    let currentSettings = getSettings(sbc, challenge, id) || [];

    const choices = new Choices(select, {
      choices: options,
      closeDropdownOnSelect: true,
      removeItemButton: true,
      shouldSort: false,
      allowHTML: true,
      callbackOnCreateTemplates: function (template) {
        return {
          item: (classNames, data) => {
            const customProps = data.customProperties
              ? data.customProperties
              : {};
            return template(`
              <div class="choices__item choices__item--selectable ${
                data.highlighted ? "choices__item--highlighted" : ""
              }" data-item data-deletable data-id="${data.id}" data-value="${
              data.value
            }" data-custom-properties='${data.customProperties}' ${
              data.active ? 'aria-selected="true"' : ""
            }>
                ${customProps.icon || ""} ${data.label}
                <button type="button" class="choices__button" aria-label="Remove item: ${
                  data.value
                }" data-button>Remove item</button>
             </div>
            `);
          },
          choice: (classNames, data) => {
            const customProps = data.customProperties
              ? data.customProperties
              : {};
            return template(`
              <div class=" choices__item choices__item--choice ${
                data.disabled
                  ? "choices__item--disabled"
                  : "choices__item--selectable"
              }" data-select-text="${
              this.config.itemSelectText
            }" data-choice data-id="${data.id}" data-value="${data.value}" ${
              data.disabled
                ? 'data-choice-disabled aria-disabled="true"'
                : "data-choice-selectable"
            }>
                ${customProps.icon || ""} ${data.label}
               </div>
            `);
          },
        };
      },
    });

    choices.setChoiceByValue(currentSettings);
    select.addEventListener(
      "change",
      function (event) {
        saveSettings(sbc, challenge, id, choices.getValue(true));
      },
      false
    );
  };
  const createDropDown = (parentDiv, label, id, options, value, target) => {
    if (document.contains(document.getElementById(id))) {
      document.getElementById(id).remove();
    }

    i = document.createElement("div");

    i.classList.add("panelActionRow");
    var o = document.createElement("div");
    o.classList.add("buttonInfoLabel");
    var spinnerLabel = document.createElement("span");
    spinnerLabel.classList.add("spinnerLabel");
    spinnerLabel.innerHTML = label;
    o.appendChild(spinnerLabel);
    i.appendChild(o);
    let dropdown = new UTDropDownControl();
    let panel = createPanel();
    panel.appendChild(i);
    panel.appendChild(dropdown.getRootElement());
    panel.setAttribute("id", id);
    dropdown.init();

    dropdown.setOptions(options);

    dropdown.addTarget(dropdown, target, EventType.CHANGE);
    parentDiv.appendChild(panel);
    dropdown.setIndexById(value);
    dropdown._triggerActions(EventType.CHANGE);
    return dropdown;
  };
  const createToggle = (parentDiv, label, id, value, target) => {
    let toggle = new UTToggleCellView();

    let panel = createPanel();

    panel.appendChild(toggle.getRootElement());
    toggle.init();

    if (value) {
      toggle.toggle();
    }
    toggle.setLabel(label);

    toggle.addTarget(toggle, target, EventType.TAP);
    toggle._triggerActions(EventType.TAP);
    parentDiv.appendChild(panel);
    return panel;
  };
  const createSettingsTile = (parentDiv, label, id) => {
    if (document.contains(document.getElementById(id))) {
      document.getElementById(id).remove();
    }

    var tile = document.createElement("div");
    tile.setAttribute("id", id);
    tile.classList.add("tile");
    tile.classList.add("col-1-1");
    tile.classList.add("sbc-settings-wrapper");
    tile.classList.add("main-header");

    var tileheader = document.createElement("div");
    tileheader.classList.add("sbc-settings-header");
    var h1 = document.createElement("H1");
    h1.innerHTML = label;
    tileheader.appendChild(h1);
    tile.appendChild(tileheader);
    var tileContent = document.createElement("div");
    tileContent.classList.add("sbc-settings-section");
    tile.appendChild(tileContent);
    parentDiv.appendChild(tile);
    return tileContent;
  };

  function Counter(selector, settings) {
    let shield = getElement(".ut-click-shield");
    if (!document.contains(document.getElementsByClassName("numCounter")[0])) {
      var counterContent = document.createElement("div");
      counterContent.classList.add("numCounter");
      counterContent.addEventListener("click", () => {
        hideLoader();
      });
      shield.appendChild(counterContent);
    }
    this.settings = Object.assign(
      {
        digits: 5,
        delay: 250, // ms
        direction: "", // ltr is default
      },
      settings || {}
    );

    var scopeElm = document.querySelector(selector);

    // generate digits markup
    var digitsHTML = Array(this.settings.digits + 1).join(
      '<div><b data-value="0"></b></div>'
    );
    scopeElm.innerHTML = digitsHTML;

    this.DOM = {
      scope: scopeElm,
      digits: scopeElm.querySelectorAll("b"),
    };

    this.DOM.scope.addEventListener("transitionend", (e) => {
      if (e.pseudoElement === "::before" && e.propertyName == "margin-top") {
        e.target.classList.remove("blur");
      }
    });

    this.count();
  }

  Counter.prototype.count = function (newVal) {
    var countTo,
      className,
      settings = this.settings,
      digitsElms = this.DOM.digits;

    // update instance's value
    this.value = newVal || this.DOM.scope.dataset.value | 0;

    if (!this.value) return;

    // convert value into an array of numbers
    countTo = (this.value + "").split("");

    if (settings.direction == "rtl") {
      countTo = countTo.reverse();
      digitsElms = [].slice.call(digitsElms).reverse();
    }

    // loop on each number element and change it
    digitsElms.forEach(function (item, i) {
      if (+item.dataset.value != countTo[i] && countTo[i] >= 0)
        setTimeout(
          function (j) {
            var diff = Math.abs(countTo[j] - +item.dataset.value);
            item.dataset.value = countTo[j];
            if (diff > 3) item.className = "blur";
          },
          i * settings.delay,
          i
        );
    });
  };
  
  function findSBCLogin(obj, keyToFind) {
    let results = [];

    function recursiveSearch(obj, parents = []) {
      if (typeof obj === "object" && obj !== null) {
        for (let key in obj) {
          if (key === keyToFind && obj[key] === true) {
            results.push({
              value: obj[key],
              parents: [...parents, key],
            });
          }
          recursiveSearch(obj[key], [...parents, key]);
        }
      }
    }

    recursiveSearch(obj);
    return results;
  }

  const init = () => {
    let isAllLoaded = false;
    if (services.Localization) {
      isAllLoaded = true;
    }
    if (isAllLoaded) {
      sbcViewOverride();
      sbcButtonOverride();
      playerItemOverride();
      playerSlotOverride();
      packOverRide();
      sideBarNavOverride();
      favTagOverride();
      sbcSubmitChallengeOverride();
      unassignedItemsOverride();
      initDefaultSettings();
      futHomeOverride();
     
    } else {
      setTimeout(init, 4000);
    }
  };
  init();
})();
