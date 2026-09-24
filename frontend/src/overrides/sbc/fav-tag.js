const sbcFavoriteTagOverride = () => {
  const favTag = UTSBCFavoriteButtonControl.prototype.watchSBCSet;

  UTSBCFavoriteButtonControl.prototype.watchSBCSet = function () {
    const result = favTag.call(this);
    createSBCTab();
    return result;
  };
};
