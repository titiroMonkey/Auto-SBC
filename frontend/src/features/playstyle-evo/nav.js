// Evo Helper — EA nav screen wrappers.
// Mirrors the SBC Solver pattern (features/settings/sbc-settings-view.js):
// a left-side tab that opens a full EA screen (UTHomeHubViewController), into
// which the vendored PlayStyle Evo Helper panel is embedded via window.FCEvo.mount().

const EVO_HELPER_TAB_TAG = 108;

const generateEvoHelperTab = () => {
  const tab = new UTTabBarItemView();
  tab.init();
  tab.setTag(EVO_HELPER_TAB_TAG);
  tab.setText("Evo Helper");
  tab.addClass("icon-sbcSettings"); // reuse an existing nav glyph
  return tab;
};

const evoHelperController = function () {
  UTHomeHubViewController.call(this);
};
JSUtils.inherits(evoHelperController, UTHomeHubViewController);

evoHelperController.prototype._getViewInstanceFromData = function () {
  return new evoHelperView();
};
evoHelperController.prototype.viewDidAppear = function () {
  this.getNavigationController().setNavigationVisibility(true, true);
  // Mount here (not just in _generate) so re-opening the tab works. EA caches
  // this controller/view, so _generate only runs on the first visit; on later
  // visits the wrap is re-attached empty (we detached #fcevo on leave). Re-mount
  // into the current view root each time the screen appears.
  const view = this.getView && this.getView();
  const wrap =
    (view && view.getRootElement && view.getRootElement()) ||
    document.getElementById("EvoHelperPanel");
  const doMount = (attempt) => {
    if (
      wrap &&
      window.FCEvo &&
      typeof window.FCEvo.mount === "function" &&
      window.FCEvo.mount(wrap)
    ) {
      return;
    }
    if (attempt < 60) setTimeout(() => doMount(attempt + 1), 250);
  };
  doMount(0);
};
evoHelperController.prototype.viewWillDisappear = function () {
  this.getNavigationController().setNavigationVisibility(false, false);
  // Detach the panel back to <body> (hidden) so the instance + state survive
  // EA tearing down this screen's container.
  try {
    if (window.FCEvo && typeof window.FCEvo.unmount === "function") {
      window.FCEvo.unmount();
    }
  } catch {}
};
evoHelperController.prototype.getNavigationTitle = function () {
  return "Evo Helper";
};

const evoHelperView = function () {
  UTHomeHubView.call(this);
};
JSUtils.inherits(evoHelperView, UTHomeHubView);

evoHelperView.prototype.destroyGeneratedElements =
  function destroyGeneratedElements() {
    try {
      if (window.FCEvo && typeof window.FCEvo.unmount === "function") {
        window.FCEvo.unmount();
      }
    } catch {}
    DOMKit.remove(this.__root);
    this.__root = null;
  };

evoHelperView.prototype._generate = function _generate() {
  const wrap = document.createElement("div");
  wrap.classList.add("ut-market-search-filters-view", "floating");
  wrap.classList.add("evo-helper-container");
  wrap.setAttribute("id", "EvoHelperPanel");
  // The panel (#fcevo) is mounted into this wrap by the controller's
  // viewDidAppear, which fires on every visit (this view is cached by EA).
  this.__root = wrap;
  this._generated = true;
};
