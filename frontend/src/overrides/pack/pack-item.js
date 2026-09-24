const packItemOverride = () => {
  const storeListView = UTStoreRevealModalListView.prototype.render;

  UTStoreRevealModalListView.prototype.render = function (...args) {
    storeListView.call(this, ...args);
  };
};
