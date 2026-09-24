// Temporarily removed from the sidebar; flip to true to reinstate. Core tab
// code is kept intact below.
const ENABLE_EVO_HELPER_TAB = false;
const ENABLE_COLLECTION_BOOK_TAB = false;

const sideBarNavOverride = () => {
  if (UTGameTabBarController.prototype.__autoSbcSidebarPatched) {
    return;
  }
  UTGameTabBarController.prototype.__autoSbcSidebarPatched = true;
  const navViewInit = UTGameTabBarController.prototype.initWithViewControllers;
  UTGameTabBarController.prototype.initWithViewControllers = function (tabs) {
    // Check if SBC Solver tab already exists
    const sbcSolverExists = tabs.some(
      (tab) =>
        tab.tabBarItem &&
        tab.tabBarItem.getText &&
        tab.tabBarItem.getText() === "SBC Solver",
    );

    // Check if Club Analysis tab already exists
    const clubAnalysisExists = tabs.some(
      (tab) =>
        tab.tabBarItem &&
        tab.tabBarItem.getText &&
        tab.tabBarItem.getText() === "Club Analysis",
    );

    // Check if Evo Helper tab already exists
    const evoHelperExists = tabs.some(
      (tab) =>
        tab.tabBarItem &&
        tab.tabBarItem.getText &&
        tab.tabBarItem.getText() === "Evo Helper",
    );

    // Add SBC Solver tab if it doesn't exist
    if (!sbcSolverExists) {
      const navBar = new UTGameFlowNavigationController();
      navBar.initWithRootController(new sbcSettingsController());
      navBar.tabBarItem = generateSbcSolveTab();
      tabs.push(navBar);
      // Hide until players are fetched
      if (!window.__sbcPlayersReady) {
        const tabEl = navBar.tabBarItem.getRootElement?.();
        if (tabEl) {
          tabEl.style.display = 'none';
          tabEl.classList.add('sbc-tab-deferred');
        }
      }
    }

    // Add Evo Helper tab if it doesn't exist. Opens its own full EA screen.
    if (
      ENABLE_EVO_HELPER_TAB &&
      !evoHelperExists &&
      typeof generateEvoHelperTab === "function"
    ) {
      const navBar = new UTGameFlowNavigationController();
      navBar.initWithRootController(new evoHelperController());
      navBar.tabBarItem = generateEvoHelperTab();
      tabs.push(navBar);
    }

    // Add Collection Book tab if it doesn't exist. Opens its own full EA screen.
    const collectionBookExists = tabs.some(
      (tab) =>
        tab.tabBarItem &&
        tab.tabBarItem.getText &&
        tab.tabBarItem.getText() === "Collection Book",
    );
    if (
      ENABLE_COLLECTION_BOOK_TAB &&
      !collectionBookExists &&
      typeof generateCollectionBookTab === "function"
    ) {
      const navBar = new UTGameFlowNavigationController();
      navBar.initWithRootController(new collectionBookController());
      navBar.tabBarItem = generateCollectionBookTab();
      tabs.push(navBar);
      // Hide until every collection player (and its price) has loaded, so the
      // book opens already sorted by price. collectionBookPrefetchAll reveals
      // it by clearing the deferred class when it completes.
      if (!window.__collectionBookAllLoaded) {
        const tabEl = navBar.tabBarItem.getRootElement?.();
        if (tabEl) {
          tabEl.style.display = "none";
          tabEl.classList.add("collection-book-tab-deferred");
        }
      }
    }

    navViewInit.call(this, tabs);
  };
};

