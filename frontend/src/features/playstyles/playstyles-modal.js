// Playstyles data with recommended status
const PLAYSTYLES_DATA = {
  // All available playstyles
  allPlaystyles: [
    { name: 'Finesse Shot', icon: '🎯' },
    { name: 'Low Driven', icon: '⚽' },
    { name: 'Rapid', icon: '⚡' },
    { name: 'Incisive Pass', icon: '🎭' },
    { name: 'Game Changer', icon: '🔄' },
    { name: 'Quick Step', icon: '👟' },
    { name: 'Technical', icon: '🔧' },
    { name: 'Tiki Taka', icon: '🎪' },
    { name: 'First Touch', icon: '✋' },
    { name: 'Press Proven', icon: '🔺' },
    { name: 'Enforcer', icon: '💪' },
    { name: 'Pinged Pass', icon: '🎯' },
    { name: 'Trivela', icon: '🌀' },
    { name: 'Basic', icon: '•' },
    { name: 'Sniper', icon: '🎯' },
    { name: 'Finisher', icon: '⚔️' },
    { name: 'Deadeye', icon: '👁️' },
    { name: 'Marksman', icon: '🏹' },
    { name: 'Hawk', icon: '🦅' },
    { name: 'Artist', icon: '🎨' },
    { name: 'Architect', icon: '🏗️' },
    { name: 'Powerhouse', icon: '⚙️' },
    { name: 'Maestro', icon: '🎵' },
    { name: 'Engine', icon: '🚗' },
    { name: 'Sentinel', icon: '🛡️' },
    { name: 'Guardian', icon: '🦾' },
    { name: 'Gladiator', icon: '⚔️' },
    { name: 'Backbone', icon: '🏃' },
    { name: 'Anchor', icon: '⚓' },
    { name: 'Hunter', icon: '🐺' },
    { name: 'Catalyst', icon: '⚗️' },
    { name: 'Shadow', icon: '👻' },
  ],
  // Recommended playstyles for different positions
  recommended: {
    'ST': ['Finesse Shot', 'Low Driven', 'Rapid', 'Incisive Pass', 'Game Changer', 'Quick Step', 'Technical', 'Tiki Taka', 'First Touch', 'Press Proven', 'Enforcer', 'Pinged Pass'],
    'LM': ['Finesse Shot', 'Low Driven', 'Rapid', 'Incisive Pass', 'Game Changer', 'Quick Step', 'Technical', 'Tiki Taka', 'First Touch', 'Press Proven', 'Enforcer', 'Pinged Pass'],
    'LW': ['Finesse Shot', 'Low Driven', 'Rapid', 'Incisive Pass', 'Game Changer', 'Quick Step', 'Technical', 'Tiki Taka', 'First Touch', 'Press Proven', 'Enforcer', 'Pinged Pass'],
    'RW': ['Finesse Shot', 'Low Driven', 'Rapid', 'Incisive Pass', 'Game Changer', 'Quick Step', 'Technical', 'Tiki Taka', 'First Touch', 'Press Proven', 'Enforcer', 'Pinged Pass'],
    'RM': ['Finesse Shot', 'Low Driven', 'Rapid', 'Incisive Pass', 'Game Changer', 'Quick Step', 'Technical', 'Tiki Taka', 'First Touch', 'Press Proven', 'Enforcer', 'Pinged Pass'],
    'CF': ['Finesse Shot', 'Low Driven', 'Rapid', 'Incisive Pass', 'Game Changer', 'Quick Step', 'Technical', 'Tiki Taka', 'First Touch', 'Press Proven', 'Enforcer', 'Pinged Pass'],
  }
};

class PlaystyleModal {
  constructor() {
    this.modalElement = null;
    this.playstyleStates = {}; // Track state: 'white' (unselected), 'gold' (selected), 'grey' (disabled)
    this.currentPlayer = null;
  }

  createModal() {
    const modalHTML = `
      <div id="autoSbc-playstyles-modal" class="auto-sbc-modal-overlay" style="display: none;">
        <div class="auto-sbc-modal">
          <div class="auto-sbc-modal-header">
            <h3>Player Playstyles</h3>
            <button class="auto-sbc-modal-close" aria-label="Close">×</button>
          </div>
          <div class="auto-sbc-modal-content">
            <div class="auto-sbc-playstyles-container">
              <div class="auto-sbc-playstyles-section">
                <h4>Recommended Playstyles</h4>
                <div class="auto-sbc-playstyles-grid" id="autoSbc-recommended-playstyles"></div>
              </div>
              <div class="auto-sbc-playstyles-section">
                <h4>Other Playstyles</h4>
                <div class="auto-sbc-playstyles-grid" id="autoSbc-other-playstyles"></div>
              </div>
            </div>
          </div>
          <div class="auto-sbc-modal-footer">
            <button class="auto-sbc-btn-primary" id="autoSbc-apply-playstyles">Apply Selection</button>
            <button class="auto-sbc-btn-secondary" id="autoSbc-use-recommended">Use Current</button>
            <button class="auto-sbc-btn-secondary" id="autoSbc-clear-playstyles">Reset All</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById('autoSbc-playstyles-modal');
    this.setupEventListeners();
  }

  setupEventListeners() {
    const closeBtn = this.modalElement.querySelector('.auto-sbc-modal-close');
    const applyBtn = this.modalElement.querySelector('#autoSbc-apply-playstyles');
    const currentBtn = this.modalElement.querySelector('#autoSbc-use-recommended');
    const resetBtn = this.modalElement.querySelector('#autoSbc-clear-playstyles');

    closeBtn.addEventListener('click', () => this.close());
    applyBtn.addEventListener('click', () => this.applySelection());
    currentBtn.addEventListener('click', () => this.resetToPlayerCurrent());
    resetBtn.addEventListener('click', () => this.resetAll());

    // Close on overlay click
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) this.close();
    });
  }

  getPlayerCurrentPlaystyles(player) {
    // Extract current playstyles from player entity
    const playstyles = [];
    if (player && player.playstyles) {
      // If player has playstyles array
      if (Array.isArray(player.playstyles)) {
        playstyles.push(...player.playstyles);
      }
    }
    return playstyles;
  }

  renderPlaystyles(position = 'ST') {
    const recommendedList = PLAYSTYLES_DATA.recommended[position] || PLAYSTYLES_DATA.recommended['ST'];
    const recommendedContainer = document.getElementById('autoSbc-recommended-playstyles');
    const otherContainer = document.getElementById('autoSbc-other-playstyles');

    recommendedContainer.innerHTML = '';
    otherContainer.innerHTML = '';

    // Render recommended playstyles
    recommendedList.forEach((psName) => {
      const ps = PLAYSTYLES_DATA.allPlaystyles.find(p => p.name === psName);
      if (ps) {
        const item = this.createPlaystyleItem(ps, true);
        recommendedContainer.appendChild(item);
      }
    });

    // Render other playstyles
    PLAYSTYLES_DATA.allPlaystyles.forEach((ps) => {
      if (!recommendedList.includes(ps.name)) {
        const item = this.createPlaystyleItem(ps, false);
        otherContainer.appendChild(item);
      }
    });
  }

  createPlaystyleItem(playstyle, isRecommended) {
    const div = document.createElement('div');
    const state = this.playstyleStates[playstyle.name] || 'white';
    
    div.className = `auto-sbc-playstyle-item ps-state-${state} ${isRecommended ? 'recommended' : ''}`;
    div.dataset.playstyle = playstyle.name;
    div.innerHTML = `
      <span class="auto-sbc-playstyle-icon">${playstyle.icon}</span>
      <span class="auto-sbc-playstyle-name">${playstyle.name}</span>
      ${isRecommended ? '<span class="auto-sbc-recommended-badge">★</span>' : ''}
      <span class="auto-sbc-playstyle-state-indicator"></span>
    `;

    div.addEventListener('click', () => this.cyclePlaystyleState(playstyle.name, div));

    return div;
  }

  cyclePlaystyleState(playstyleName, element) {
    const currentState = this.playstyleStates[playstyleName] || 'white';
    let nextState;

    // Cycle: white -> gold -> grey -> white
    if (currentState === 'white') {
      nextState = 'gold';
    } else if (currentState === 'gold') {
      nextState = 'grey';
    } else {
      nextState = 'white';
    }

    this.playstyleStates[playstyleName] = nextState;
    
    // Update element classes
    element.classList.remove('ps-state-white', 'ps-state-gold', 'ps-state-grey');
    element.classList.add(`ps-state-${nextState}`);
  }

  resetToPlayerCurrent() {
    const currentPlaystyles = this.getPlayerCurrentPlaystyles(this.currentPlayer);
    this.playstyleStates = {};
    
    // Set current playstyles to gold, rest to white
    PLAYSTYLES_DATA.allPlaystyles.forEach((ps) => {
      if (currentPlaystyles.includes(ps.name)) {
        this.playstyleStates[ps.name] = 'gold';
      } else {
        this.playstyleStates[ps.name] = 'white';
      }
    });

    this.renderPlaystyles(this.currentPosition || 'ST');
  }

  resetAll() {
    this.playstyleStates = {};
    const position = this.currentPosition || 'ST';
    this.renderPlaystyles(position);
  }

  applySelection() {
    // Filter to just gold playstyles
    const selectedPlaystyles = Object.entries(this.playstyleStates)
      .filter(([_, state]) => state === 'gold')
      .map(([name, _]) => name);

    localStorage.setItem('autoSbc_selectedPlaystyles', JSON.stringify(selectedPlaystyles));
    showNotification(
      `${selectedPlaystyles.length} playstyles selected (Gold)`,
      UINotificationType.POSITIVE
    );
    this.close();
  }

  open(position = 'ST', player = null) {
    this.currentPosition = position;
    this.currentPlayer = player;
    
    if (!this.modalElement) {
      this.createModal();
    }

    // Initialize states from player's current playstyles
    if (player) {
      this.resetToPlayerCurrent();
    } else {
      this.renderPlaystyles(position);
    }

    this.modalElement.style.display = 'flex';
  }

  close() {
    if (this.modalElement) {
      this.modalElement.style.display = 'none';
    }
  }
}

// Create global instance
window.playstyleModal = new PlaystyleModal();
