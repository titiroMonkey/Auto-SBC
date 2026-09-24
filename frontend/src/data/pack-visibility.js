const packVisibilityStore = (() => {
  const storageKey = "sbcPackVisibilityState";
  return {
    load() {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    },
    save(state) {
      localStorage.setItem(storageKey, JSON.stringify(state));
    },
    get(id) {
      const state = this.load();
      return id in state ? state[id] : true;
    },
    set(id, value) {
      const state = this.load();
      state[id] = value;
      this.save(state);
    },
  };
})();
