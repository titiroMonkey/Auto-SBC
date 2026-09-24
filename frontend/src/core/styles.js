let style = document.createElement("style");
//style.textContent = "*{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}*,::after,::before{box-sizing:border-box}body,html{position:relative;margin:0;width:100%;height:100%}body{font-family:\"Helvetica Neue\",Helvetica,Arial,\"Lucida Grande\",sans-serif;font-size:16px;line-height:1.4;color:#fff;background-color:#333;overflow-x:hidden}hr,label{display:block}label,p{margin-bottom:8px}label{font-size:14px;font-weight:500;cursor:pointer}p{margin-top:0}hr{margin:30px 0;border:0;border-bottom:1px solid #eaeaea;height:1px}h1,h2,h3,h4,h5,h6{margin-top:0;margin-bottom:12px;font-weight:400;line-height:1.2}a,a:focus,a:visited{color:#fff;text-decoration:none;font-weight:600}.form-control{display:block;width:100%;background-color:#f9f9f9;padding:12px;border:1px solid #ddd;border-radius:2.5px;font-size:14px;appearance:none;margin-bottom:24px}.h1,h1{font-size:32px}.h2,h2{font-size:24px}.h3,h3{font-size:20px}.h4,h4{font-size:18px}.h5,h5{font-size:16px}.h6,h6{font-size:14px}label+p{margin-top:-4px}.container{display:block;margin:auto;max-width:40em;padding:48px}@media (max-width:620px){.container{padding:0}}.section{background-color:#fff;padding:24px;color:#333}.section a,.section a:focus,.section a:visited{color:#005f75}.logo{display:block;margin-bottom:12px}.logo-img{width:100%;height:auto;display:inline-block;max-width:100%;vertical-align:top;padding:6px 0}.visible-ie{display:none}.push-bottom{margin-bottom:24px}.zero-bottom{margin-bottom:0}.zero-top{margin-top:0}.text-center{text-align:center}[data-test-hook]{margin-bottom:24px}";
//document.head.appendChild(style);
//style = document.createElement('style');
style.textContent =
  '.choices{position:relative;overflow:hidden;margin-bottom:24px;font-size:16px}.choices:focus{outline:0}.choices:last-child{margin-bottom:0}.choices.is-open{overflow:visible}.choices.is-disabled .choices__inner,.choices.is-disabled .choices__input{background-color:#eaeaea;cursor:not-allowed;-webkit-user-select:none;user-select:none}.choices.is-disabled .choices__item{cursor:not-allowed}.choices [hidden]{display:none!important}.choices[data-type*=select-one]{cursor:pointer}.choices[data-type*=select-one] .choices__inner{padding-bottom:7.5px}.choices[data-type*=select-one] .choices__input{display:block;width:100%;padding:10px;border-bottom:1px solid #ddd;background-color:#fff;margin:0}.choices[data-type*=select-one] .choices__button{background-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEiIGhlaWdodD0iMjEiIHZpZXdCb3g9IjAgMCAyMSAyMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yLjU5Mi4wNDRsMTguMzY0IDE4LjM2NC0yLjU0OCAyLjU0OEwuMDQ0IDIuNTkyeiIvPjxwYXRoIGQ9Ik0wIDE4LjM2NEwxOC4zNjQgMGwyLjU0OCAyLjU0OEwyLjU0OCAyMC45MTJ6Ii8+PC9nPjwvc3ZnPg==);padding:0;background-size:8px;position:absolute;top:50%;right:0;margin-top:-10px;margin-right:25px;height:20px;width:20px;border-radius:10em;opacity:.25}.choices[data-type*=select-one] .choices__button:focus,.choices[data-type*=select-one] .choices__button:hover{opacity:1}.choices[data-type*=select-one] .choices__button:focus{box-shadow:0 0 0 2px #005f75}.choices[data-type*=select-one] .choices__item[data-placeholder] .choices__button{display:none}.choices[data-type*=select-one]::after{content:"";height:0;width:0;border-style:solid;border-color:#333 transparent transparent;border-width:5px;position:absolute;right:11.5px;top:50%;margin-top:-2.5px;pointer-events:none}.choices[data-type*=select-one].is-open::after{border-color:transparent transparent #333;margin-top:-7.5px}.choices[data-type*=select-one][dir=rtl]::after{left:11.5px;right:auto}.choices[data-type*=select-one][dir=rtl] .choices__button{right:auto;left:0;margin-left:25px;margin-right:0}.choices[data-type*=select-multiple] .choices__inner,.choices[data-type*=text] .choices__inner{cursor:text}.choices[data-type*=select-multiple] .choices__button,.choices[data-type*=text] .choices__button{position:relative;display:inline-block;margin:0-4px 0 8px;padding-left:16px;border-left:1px solid #003642;background-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEiIGhlaWdodD0iMjEiIHZpZXdCb3g9IjAgMCAyMSAyMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSIjRkZGIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yLjU5Mi4wNDRsMTguMzY0IDE4LjM2NC0yLjU0OCAyLjU0OEwuMDQ0IDIuNTkyeiIvPjxwYXRoIGQ9Ik0wIDE4LjM2NEwxOC4zNjQgMGwyLjU0OCAyLjU0OEwyLjU0OCAyMC45MTJ6Ii8+PC9nPjwvc3ZnPg==);background-size:8px;width:8px;line-height:1;opacity:.75;border-radius:0}.choices[data-type*=select-multiple] .choices__button:focus,.choices[data-type*=select-multiple] .choices__button:hover,.choices[data-type*=text] .choices__button:focus,.choices[data-type*=text] .choices__button:hover{opacity:1}.choices__inner{display:inline-block;vertical-align:top;width:100%;background-color:#f9f9f9;padding:7.5px 7.5px 3.75px;border:1px solid #ddd;border-radius:2.5px;font-size:14px;min-height:44px;overflow:hidden}.is-focused .choices__inner,.is-open .choices__inner{border-color:#b7b7b7}.is-open .choices__inner{border-radius:2.5px 2.5px 0 0}.is-flipped.is-open .choices__inner{border-radius:0 0 2.5px 2.5px}.choices__list{margin:0;padding-left:0;list-style:none}.choices__list--single{display:inline-block;padding:4px 16px 4px 4px;width:100%}[dir=rtl] .choices__list--single{padding-right:4px;padding-left:16px}.choices__list--single .choices__item{width:100%}.choices__list--multiple{display:inline}.choices__list--multiple .choices__item{display:inline-block;vertical-align:middle;border-radius:20px;padding:4px 10px;font-size:12px;font-weight:500;margin-right:3.75px;margin-bottom:3.75px;background-color:#005f75;border:1px solid #004a5c;color:#fff;word-break:break-all;box-sizing:border-box}.choices__list--multiple .choices__item[data-deletable]{padding-right:5px}[dir=rtl] .choices__list--multiple .choices__item{margin-right:0;margin-left:3.75px}.choices__list--multiple .choices__item.is-highlighted{background-color:#004a5c;border:1px solid #003642}.is-disabled .choices__list--multiple .choices__item{background-color:#aaa;border:1px solid #919191}.choices__list--dropdown,.choices__list[aria-expanded]{display:none;z-index:1;position:absolute;width:100%;background-color:#fff;border:1px solid #ddd;top:100%;margin-top:-1px;border-bottom-left-radius:2.5px;border-bottom-right-radius:2.5px;overflow:hidden;word-break:break-all}.is-active.choices__list--dropdown,.is-active.choices__list[aria-expanded]{display:block}.is-open .choices__list--dropdown,.is-open .choices__list[aria-expanded]{border-color:#b7b7b7}.is-flipped .choices__list--dropdown,.is-flipped .choices__list[aria-expanded]{top:auto;bottom:100%;margin-top:0;margin-bottom:-1px;border-radius:.25rem .25rem 0 0}.choices__list--dropdown .choices__list,.choices__list[aria-expanded] .choices__list{position:relative;max-height:300px;overflow:auto;-webkit-overflow-scrolling:touch;will-change:scroll-position}.choices__list--dropdown .choices__item,.choices__list[aria-expanded] .choices__item{position:relative;padding:10px;font-size:14px}[dir=rtl] .choices__list--dropdown .choices__item,[dir=rtl] .choices__list[aria-expanded] .choices__item{text-align:right}@media (min-width:640px){.choices__list--dropdown .choices__item--selectable[data-select-text],.choices__list[aria-expanded] .choices__item--selectable[data-select-text]{padding-right:100px}.choices__list--dropdown .choices__item--selectable[data-select-text]::after,.choices__list[aria-expanded] .choices__item--selectable[data-select-text]::after{content:attr(data-select-text);font-size:12px;opacity:0;position:absolute;right:10px;top:50%;transform:translateY(-50%)}[dir=rtl] .choices__list--dropdown .choices__item--selectable[data-select-text],[dir=rtl] .choices__list[aria-expanded] .choices__item--selectable[data-select-text]{text-align:right;padding-left:100px;padding-right:10px}[dir=rtl] .choices__list--dropdown .choices__item--selectable[data-select-text]::after,[dir=rtl] .choices__list[aria-expanded] .choices__item--selectable[data-select-text]::after{right:auto;left:10px}}.choices__list--dropdown .choices__item--selectable.is-highlighted,.choices__list[aria-expanded] .choices__item--selectable.is-highlighted{background-color:#f2f2f2}.choices__list--dropdown .choices__item--selectable.is-highlighted::after,.choices__list[aria-expanded] .choices__item--selectable.is-highlighted::after{opacity:.5}.choices__item{cursor:default}.choices__item--selectable{cursor:pointer}.choices__item--disabled{cursor:not-allowed;-webkit-user-select:none;user-select:none;opacity:.5}.choices__heading{font-weight:600;font-size:12px;padding:10px;border-bottom:1px solid #f7f7f7;color:gray}.choices__button{text-indent:-9999px;appearance:none;border:0;background-color:transparent;background-repeat:no-repeat;background-position:center;cursor:pointer}.choices__button:focus,.choices__input:focus{outline:0}.choices__input{display:inline-block;vertical-align:baseline;background-color:#f9f9f9;font-size:14px;margin-bottom:5px;border:0;border-radius:0;max-width:100%;padding:4px 0 4px 2px}.choices__input::-webkit-search-cancel-button,.choices__input::-webkit-search-decoration,.choices__input::-webkit-search-results-button,.choices__input::-webkit-search-results-decoration{display:none}.choices__input::-ms-clear,.choices__input::-ms-reveal{display:none;width:0;height:0}[dir=rtl] .choices__input{padding-right:2px;padding-left:0}.choices__placeholder{opacity:.5}';
document.head.appendChild(style);

// EA's icon-font codepoints shift between game builds, so instead of hardcoding
// the "info" glyph we read it live from EA's own info-button CSS at runtime and
// expose it via a CSS variable the tooltip rule falls back to.
const syncNativeTooltipIcon = () => {
  const candidateSelectors = [
    ".ut-image-button-control.info-btn::after",
    ".info-btn::after",
  ];

  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (!rules) continue;

    for (const rule of rules) {
      if (!candidateSelectors.includes(rule.selectorText)) continue;

      const content = rule.style?.getPropertyValue("content");
      const fontFamily = rule.style?.getPropertyValue("font-family");
      if (!content || content === '""' || !fontFamily) continue;

      document.documentElement.style.setProperty(
        "--autosbc-tooltip-icon-content",
        content,
      );
      document.documentElement.style.setProperty(
        "--autosbc-tooltip-icon-font",
        fontFamily,
      );
      return true;
    }
  }
  return false;
};

if (!syncNativeTooltipIcon()) {
  // Native stylesheet may not be attached yet on first injection; retry briefly.
  let attempts = 0;
  const retryTimer = setInterval(() => {
    attempts += 1;
    if (syncNativeTooltipIcon() || attempts >= 10) {
      clearInterval(retryTimer);
    }
  }, 500);
}

function GM_xmlhttpRequest(options) {
  const { method = "GET", url, headers = {}, data, onload, onerror } = options;
  const fetchOptions = { method, headers };
  if (method.toUpperCase() !== "GET" && data !== undefined) {
    fetchOptions.body = data;
  }
  fetch(url, fetchOptions)
    .then((response) => {
      return response.text().then((text) => {
        const result = {
          responseText: text,
          status: response.status,
          statusText: response.statusText,
          finalUrl: response.url,
          responseHeaders: response.headers,
        };
        if (response.ok) {
          onload && onload(result);
        } else {
          onerror && onerror(result);
        }
      });
    })
    .catch((err) => {
      onerror && onerror({ error: err });
    });
}
function GM_getResourceText(resourceName) {
  // For example, you might fetch this text/string via a normal XHR or simply return an empty string.
  return "";
}

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
  color: #f40727ff;
  font-family: UltimateTeam-Icons, sans-serif;
  margin-left: .5rem;
  font-size: 0.8rem;
  right: 0;
  bottom: 5px;
  position: absolute;
}
    .tradable::before {
    content: "\\E0D5";
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
.ut-sbc-challenge-table-row-view.complete {
  cursor: no-drop;
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
.autosbc-settings-group {
  flex: 1 1 100%;
  margin: 10px;
  padding: 12px;
  border: 1px solid rgba(128, 164, 205, .55);
  border-radius: 6px;
  background: rgba(16, 24, 39, .32);
  box-sizing: border-box;
}
.autosbc-settings-group-title {
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(128, 164, 205, .35);
  color: #f4f7fb;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: .02em;
}
.autosbc-settings-group-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 14px;
  align-items: stretch;
}
.autosbc-settings-group-grid > * {
  min-width: 0;
}
.autosbc-settings-group-grid .sbc-settings-field,
.autosbc-settings-group-grid .panelActionRow {
  width: 100%;
  box-sizing: border-box;
}
.autosbc-settings-group-wide {
  grid-column: 1 / -1;
}
@media (max-width: 900px) {
  .autosbc-settings-group-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .autosbc-settings-group-grid {
    grid-template-columns: 1fr;
  }
}
.sbc-settings-field {
    margin-top: 15px;
    padding: 10px;
}
.sbc-rule-field {
    margin-top: 15px;
    width:100%;
    padding: 10px;
}
    .sbc-settings-longField {
    margin-top: 15px;
    width: 90%;
    padding: 10px;
}
    .spinnerLabel {
    padding-bottom: 10px;
    }
   .ut-tab-bar-item.icon-sbcSettings:before {
      content: "\\E052";
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
    margin-left: .15em;
}
.currency-untradable::after {
    background-position: right top;
    content: "";
    background-repeat: no-repeat;
    background-size: 100%;
    display: inline-block;
    height: 1em;
    vertical-align: middle;
    width: 1em;
    background-image: url(../web-app/images/coinIcon.png);
    margin-top: -.15em;
    margin-left: .15em;
    filter: grayscale(1);
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
    margin-left: .15em;
}
.autosbc-auto-buy-currency-icon {
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  display: inline-block;
  height: 1em;
  margin-left: .25em;
  vertical-align: middle;
  width: 1em;
}
.autosbc-auto-buy-currency-icon.currency-coins {
  background-image: url(../web-app/images/coinIcon.png);
}
.autosbc-auto-buy-currency-icon.currency-points {
  background-image: url(../web-app/images/pointsIcon.png);
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
display:inline-flex;
width:fit-content;
}
.choices__inner{
min-height: 20px;
}
.choices{
color:black;
padding-right: 5px;
}
.tooltip-container {
          position: relative;
}
.tooltip-container::after {
  content: var(--autosbc-tooltip-icon-content, "\\E094");
  font-family: var(--autosbc-tooltip-icon-font, UltimateTeam-Icons, sans-serif);
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: #07f468;
  font-size: 16px;
  text-shadow: 0 0 3px rgba(7, 244, 104, 0.5);
  cursor: help;
}
.tooltip-container:hover::before {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 10px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  max-width: 320px;
  width: max-content;
  white-space: normal;
  text-align: left;
  line-height: 1.4;
  border-radius: 5px;
  font-size: 12px;
  z-index: 2147483647;
  pointer-events: none;
}
.view-navbar-currency-sbc-submitted {
  position: relative;
  cursor: default;
}
.sbc-submit-tracker-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% - 125px);
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  background-color: rgba(0, 0, 0, 0.88);
  color: #fff;
  border-radius: 5px;
  font-size: 16px;
  line-height: 1.6;
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
}
.view-navbar-currency-sbc-submitted:hover .sbc-submit-tracker-tooltip {
  display: block;
}

@keyframes autosbc-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes autosbc-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(7, 244, 104, 0.55); }
  70%  { box-shadow: 0 0 0 8px rgba(7, 244, 104, 0); }
  100% { box-shadow: 0 0 0 0 rgba(7, 244, 104, 0); }
}

.autosbc-exclude-filters-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.autosbc-exclude-filters-grid > * {
  min-width: 0;
  width: 100%;
}

.autosbc-squad-price-row {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.autosbc-squad-price-row .ut-squad-summary-value-button {
  display: flex;
  align-items: center;
  gap: 4px;
}

.autosbc-squad-price-value {
  /* EA reuses .ut-squad-summary-value with position: absolute for overlaying
     values on progress bars/star ratings; this row needs it in normal flow. */
  position: static;
  padding-left: 0;
}

.autosbc-solve-status-icon {
  display: none;
  align-self: center;
  padding: 0 4px;
}

.autosbc-status--solving {
  display: block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(240, 192, 32, 0.2);
  border-top-color: #f0c020;
  border-radius: 50%;
  animation: autosbc-spin 0.8s linear infinite;
  box-sizing: border-box;
}

.autosbc-status--feasible {
  display: block;
  color: #f0c020;
  font-size: 14px;
  line-height: 1;
}
.autosbc-status--feasible::before {
  content: "\\2714";
}

.autosbc-status--optimal {
  display: block;
  color: #07f468;
  font-size: 14px;
  line-height: 1;
}
.autosbc-status--optimal::before {
  content: "\\2714";
}

.autosbc-background-status-icon {
  position: fixed;
  right: 18px;
  bottom: 18px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  z-index: 10020;
  display: none;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  box-sizing: border-box;
  background: rgba(8, 15, 20, 0.88);
}

.autosbc-bg-status--solving {
  border: 3px solid rgba(7, 244, 104, 0.25);
  border-top-color: #07f468;
  animation: autosbc-spin 0.85s linear infinite, autosbc-pulse 1.4s ease-out infinite;
}

.autosbc-bg-status--feasible,
.autosbc-bg-status--optimal {
  color: #07f468;
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
  border: 1px solid rgba(7, 244, 104, 0.45);
}

.autosbc-bg-status--feasible::before,
.autosbc-bg-status--optimal::before {
  content: "\\2714";
}

    .show-pack::after {
    content: "\\E062";
    margin: auto;
    display: block;
    font-family: UltimateTeam-Icons, sans-serif;
    font-size: 36px;
    color: white;
}
    .hide-pack::after {
    content: "\\E063";
    margin: auto;
    display: block;
    font-family: UltimateTeam-Icons, sans-serif;
    font-size: 26px;
    color: white;
}

    /* Playstyles Modal Styles */
    .auto-sbc-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .auto-sbc-modal {
      background: linear-gradient(135deg, #2a3f5f 0%, #1a2a3a 100%);
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      color: #fff;
      border: 2px solid #00ff00;
    }

    .auto-sbc-modal-header {
      padding: 20px;
      border-bottom: 2px solid #00ff00;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .auto-sbc-modal-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #00ff00;
    }

    .auto-sbc-modal-close {
      background: none;
      border: none;
      color: #00ff00;
      font-size: 28px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }

    .auto-sbc-modal-close:hover {
      transform: scale(1.2);
    }

    .auto-sbc-modal-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .auto-sbc-playstyles-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .auto-sbc-playstyles-section h4 {
      margin: 0 0 12px 0;
      color: #00ff00;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }

    .auto-sbc-playstyles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
    }

    .auto-sbc-playstyle-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      background: rgba(0, 255, 0, 0.05);
      border: 2px solid rgba(0, 255, 0, 0.2);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }

    .auto-sbc-playstyle-item:hover {
      background: rgba(0, 255, 0, 0.1);
      border-color: rgba(0, 255, 0, 0.4);
    }

    .auto-sbc-playstyle-item.recommended {
      background: rgba(0, 255, 100, 0.08);
      border-color: rgba(0, 255, 0, 0.4);
    }

    /* State styles: white (unselected) */
    .auto-sbc-playstyle-item.ps-state-white {
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid rgba(255, 255, 255, 0.2);
    }

    .auto-sbc-playstyle-item.ps-state-white .auto-sbc-playstyle-name {
      color: #ffffff;
    }

    .auto-sbc-playstyle-item.ps-state-white .auto-sbc-playstyle-icon {
      opacity: 0.7;
    }

    .auto-sbc-playstyle-item.ps-state-white:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.4);
    }

    /* State styles: gold (selected) */
    .auto-sbc-playstyle-item.ps-state-gold {
      background: rgba(255, 215, 0, 0.2);
      border: 2px solid #ffd700;
      box-shadow: 0 0 12px rgba(255, 215, 0, 0.4);
    }

    .auto-sbc-playstyle-item.ps-state-gold .auto-sbc-playstyle-name {
      color: #ffd700;
      font-weight: 600;
    }

    .auto-sbc-playstyle-item.ps-state-gold .auto-sbc-playstyle-icon {
      opacity: 1;
      filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.6));
    }

    .auto-sbc-playstyle-item.ps-state-gold:hover {
      background: rgba(255, 215, 0, 0.3);
      box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
    }

    /* State styles: grey (disabled) */
    .auto-sbc-playstyle-item.ps-state-grey {
      background: rgba(128, 128, 128, 0.08);
      border: 2px solid rgba(128, 128, 128, 0.4);
      opacity: 0.5;
    }

    .auto-sbc-playstyle-item.ps-state-grey .auto-sbc-playstyle-name {
      color: #808080;
    }

    .auto-sbc-playstyle-item.ps-state-grey .auto-sbc-playstyle-icon {
      opacity: 0.4;
      filter: grayscale(100%);
    }

    .auto-sbc-playstyle-item.ps-state-grey:hover {
      background: rgba(128, 128, 128, 0.1);
      border-color: rgba(128, 128, 128, 0.5);
    }

    .auto-sbc-playstyle-item.selected {
      background: rgba(0, 255, 0, 0.2);
      border-color: #00ff00;
      box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
    }

    .auto-sbc-playstyle-checkbox {
      position: absolute;
      top: 8px;
      right: 8px;
      cursor: pointer;
      width: 16px;
      height: 16px;
      accent-color: #00ff00;
    }

    .auto-sbc-playstyle-state-indicator {
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .auto-sbc-playstyle-item.ps-state-white .auto-sbc-playstyle-state-indicator {
      background: rgba(255, 255, 255, 0.5);
    }

    .auto-sbc-playstyle-item.ps-state-gold .auto-sbc-playstyle-state-indicator {
      background: #ffd700;
    }

    .auto-sbc-playstyle-item.ps-state-grey .auto-sbc-playstyle-state-indicator {
      background: #808080;
    }

    .auto-sbc-playstyle-icon {
      font-size: 24px;
      margin-bottom: 6px;
    }

    .auto-sbc-playstyle-name {
      font-size: 12px;
      text-align: center;
      color: #ccc;
      font-weight: 500;
      line-height: 1.3;
    }

    .auto-sbc-recommended-badge {
      position: absolute;
      top: 2px;
      left: 4px;
      color: #00ff00;
      font-size: 12px;
      font-weight: bold;
    }

    .auto-sbc-modal-footer {
      padding: 15px 20px;
      border-top: 2px solid #00ff00;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .auto-sbc-btn-primary,
    .auto-sbc-btn-secondary {
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .auto-sbc-btn-primary {
      background: #00ff00;
      color: #000;
    }

    .auto-sbc-btn-primary:hover {
      background: #00dd00;
      transform: translateY(-2px);
    }

    .auto-sbc-btn-secondary {
      background: rgba(0, 255, 0, 0.15);
      color: #00ff00;
      border: 1px solid #00ff00;
    }

    .auto-sbc-btn-secondary:hover {
      background: rgba(0, 255, 0, 0.25);
    }

`;

let styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

const createPseudoContentSync = (() => {
  const FALLBACK_CONTENT = "\\E0DA";
  const registry = new Map();

  const normalizeContent = (rawContent) => {
    if (!rawContent || rawContent === "none") {
      return FALLBACK_CONTENT;
    }
    let value = rawContent.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) {
      return FALLBACK_CONTENT;
    }
    if (value.startsWith("\\")) {
      return value;
    }
    const codePoint = value.codePointAt(0);
    if (!Number.isFinite(codePoint)) {
      return FALLBACK_CONTENT;
    }
    return `\\${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  };

  const splitSelectors = (selectorText) =>
    selectorText
      .split(",")
      .map((sel) => sel.trim())
      .filter(Boolean);

  const findContentForSelector = (sourceSelector) => {
    const selector = sourceSelector.trim();
    const matches = (selectorText) =>
      splitSelectors(selectorText).includes(selector);

    const walkRules = (rules) => {
      if (!rules) {
        return null;
      }
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.selectorText) {
          if (matches(rule.selectorText)) {
            const value = rule.style?.getPropertyValue("content");
            if (value) {
              return value;
            }
          }
        }
        if (rule.cssRules) {
          const nested = walkRules(rule.cssRules);
          if (nested) {
            return nested;
          }
        }
      }
      return null;
    };

    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules || sheet.rules;
      } catch (err) {
        continue; // skip cross-origin stylesheets
      }
      const match = walkRules(rules);
      if (match) {
        return match;
      }
    }
    return null;
  };

  return ({ sourceSelector, injectSelector }) => {
    if (!sourceSelector || !injectSelector) {
      throw new Error("sourceSelector and injectSelector are required");
    }

    const rawContent = findContentForSelector(sourceSelector);
    const content = normalizeContent(rawContent);

    let styleElement = registry.get(injectSelector);
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.dataset.injectSelector = injectSelector;
      document.head.appendChild(styleElement);
      registry.set(injectSelector, styleElement);
    }

    styleElement.textContent = `${injectSelector} {\n  content: "${content}";\n}`;
  };
})();

const syncBadgeContent = () => {
  try {
    createPseudoContentSync({
      sourceSelector:
        ".ut-store-pack-details-view.is-untradeable .ut-store-pack-details-view--title span::after",
      injectSelector: ".untradable::before",
    });
    createPseudoContentSync({
      sourceSelector:
        ".ut-store-pack-details-view.is-tradeable .ut-store-pack-details-view--title span::after",
      injectSelector: ".tradable::before",
    });
  } catch (err) {
    console.warn("Failed to sync badge content", err);
  }
};

