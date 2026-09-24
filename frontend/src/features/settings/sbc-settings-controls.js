// SBC Settings - UI Control Builders
// Reusable UI primitives for building the settings panel.

const createPanel = (long = false) => {
  var panel = document.createElement("div");
  if (long) {
    panel.classList.add("sbc-settings-longField");
  } else {
    panel.classList.add("sbc-settings-field");
  }

  return panel;
};

const createTooltip = (tooltip, labelSpan, labelContainer) => {
  const tooltipIcon = document.createElement("span");
  const labelWrapper = document.createElement("div");
  labelWrapper.style.position = "relative";
  labelWrapper.style.display = "inline-block";
  labelWrapper.style.paddingRight = "25px";
  labelWrapper.appendChild(labelSpan);

  // Add a data attribute for the tooltip text
  labelWrapper.dataset.tooltip = tooltip;
  labelWrapper.classList.add("tooltip-container");

  // Replace the labelContainer with our wrapper
  labelContainer.appendChild(labelWrapper);
  labelContainer.appendChild(tooltipIcon);
};

const createDoubleRangeControl = (
  parentDiv,
  label,
  id,
  absoluteMin = 0,
  absoluteMax = 99,
  value = [0, 99],
  target = () => {},
  tooltip = "",
  step = UTDoubleRangeControl.DEFAULT_STEP,
  valueLabel = ["Min Ovr", " Max Ovr"],
) => {
  const panelRow = document.createElement("div");
  panelRow.classList.add("panelActionRow");
  const infoLabel = document.createElement("div");
  infoLabel.classList.add("buttonInfoLabel");
  const rangeLabel = document.createElement("span");
  rangeLabel.classList.add("spinnerLabel");
  rangeLabel.innerHTML = label;
  infoLabel.appendChild(rangeLabel);

  if (tooltip) {
    createTooltip(tooltip, rangeLabel, infoLabel);
  }

  panelRow.appendChild(infoLabel);

  const rangeControl = new UTDoubleRangeControl();
  rangeControl._generate();
  (rangeControl.init(),
    rangeControl.setStep(step),
    (rangeControl.latestSetMin = value[0]),
    (rangeControl.latestSetMax = value[1]),
    rangeControl.setAbsoluteMin(absoluteMin),
    rangeControl.setAbsoluteMax(absoluteMax),
    rangeControl._setValue(value[0], rangeControl.__rangeSliderMinInput),
    rangeControl._setValue(value[1], rangeControl.__rangeSliderMaxInput),
    rangeControl.setMinTitle(valueLabel[0]),
    rangeControl.setMaxTitle(valueLabel[1]),
    rangeControl._refresh());
  rangeControl.addTarget(rangeControl, target, EventType.INPUT);

  const panel = createPanel(true);
  panel.setAttribute("id", id);
  panel.appendChild(panelRow);
  panel.appendChild(rangeControl.getRootElement());
  parentDiv.appendChild(panel);

  return panel;
};

const createNumberSpinner = (
  parentDiv,
  label,
  id,
  min = 0,
  max = 100,
  value = 1,
  target = () => {},
  tooltip = "",
) => {
  var i = document.createElement("div");
  i.classList.add("panelActionRow");
  var o = document.createElement("div");
  o.classList.add("buttonInfoLabel");
  var spinnerLabel = document.createElement("span");
  spinnerLabel.classList.add("spinnerLabel");
  spinnerLabel.innerHTML = label;
  o.appendChild(spinnerLabel);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    createTooltip(tooltip, spinnerLabel, o);
  }

  i.appendChild(o);
  let spinner = new UTNumberInputSpinnerControl();
  let panel = createPanel();

  spinner.init();
  spinner.setLimits(min, max);
  spinner.setValue(value);
  spinner.addTarget(spinner, target, EventType.CHANGE);
  panel.appendChild(i);
  panel.appendChild(spinner.getRootElement());

  parentDiv.appendChild(panel);
  return panel;
};

const createTextInput = (
  parentDiv,
  label,
  id,
  value = "",
  onChange = () => {},
  tooltip = "",
  placeholder = "",
) => {
  const row = document.createElement("div");
  row.classList.add("panelActionRow");

  const infoLabel = document.createElement("div");
  infoLabel.classList.add("buttonInfoLabel");

  const textLabel = document.createElement("span");
  textLabel.classList.add("spinnerLabel");
  textLabel.innerHTML = label;
  infoLabel.appendChild(textLabel);

  if (tooltip) {
    createTooltip(tooltip, textLabel, infoLabel);
  }

  row.appendChild(infoLabel);

  const panel = createPanel();
  panel.setAttribute("id", id);
  panel.appendChild(row);

  const input = document.createElement("input");
  input.type = "text";
  input.value = value == null ? "" : String(value);
  input.placeholder = placeholder || "";
  input.style.width = "100%";
  input.style.padding = "8px";
  input.style.boxSizing = "border-box";

  input.addEventListener("change", () => onChange(input.value));
  input.addEventListener("blur", () => onChange(input.value));

  panel.appendChild(input);
  parentDiv.appendChild(panel);
  return panel;
};

const createChoice = (
  parentDiv,
  label,
  id,
  options,
  sbc,
  challenge,
  tooltip = "",
) => {
  if (document.contains(document.getElementById(id))) {
    document.getElementById(id).remove();
  }
  const i = document.createElement("div");
  i.classList.add("panelActionRow");
  const o = document.createElement("div");
  o.classList.add("buttonInfoLabel");
  const choicesLabel = document.createElement("span");
  choicesLabel.classList.add("choicesLabel");
  choicesLabel.innerHTML = label;
  o.appendChild(choicesLabel);

  if (tooltip) {
    createTooltip(tooltip, choicesLabel, o);
  }

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
    false,
  );
};

const createChoiceLocal = (
  parentDiv,
  label,
  id,
  options,
  currentValues,
  onChange,
  tooltip = "",
  config = {},
) => {
  if (document.contains(document.getElementById(id))) {
    document.getElementById(id).remove();
  }
  const i = document.createElement("div");
  i.classList.add("panelActionRow");
  const o = document.createElement("div");
  o.classList.add("buttonInfoLabel");
  const choicesLabel = document.createElement("span");
  choicesLabel.classList.add("choicesLabel");
  choicesLabel.innerHTML = label;
  o.appendChild(choicesLabel);

  if (tooltip) {
    createTooltip(tooltip, choicesLabel, o);
  }

  i.appendChild(o);

  let container = document.createElement("div");
  container.appendChild(i);
  container.setAttribute("id", id);
  let select = document.createElement("select");
  select.multiple = "multiple";
  select.setAttribute("id", `choice${id}`);

  container.appendChild(select);
  parentDiv.appendChild(container);

  const normalizedValues = Array.isArray(currentValues)
    ? currentValues
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : [];

  const normalizedOptions = Array.isArray(options)
    ? options
        .map((option) => ({
          ...option,
          value: String(option?.value ?? "").trim(),
          label: String(option?.label ?? option?.value ?? "").trim(),
        }))
        .filter((option) => option.value)
    : [];

  const mergedOptions = [...normalizedOptions];
  if (config.allowCustomValues) {
    const existingOptionValues = new Set(
      normalizedOptions.map((option) => option.value),
    );
    normalizedValues.forEach((value) => {
      if (existingOptionValues.has(value)) {
        return;
      }
      existingOptionValues.add(value);
      mergedOptions.push({ value, label: value });
    });
  }

  const choices = new Choices(select, {
    choices: mergedOptions,
    closeDropdownOnSelect: true,
    removeItemButton: true,
    duplicateItemsAllowed: Boolean(config.allowCustomValues) ? false : true,
    addItems: Boolean(config.allowCustomValues),
    addChoices: Boolean(config.allowCustomValues),
    editItems: Boolean(config.allowCustomValues),
    paste: Boolean(config.allowCustomValues),
    delimiter: ",",
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

  if (normalizedValues.length) {
    choices.setChoiceByValue(normalizedValues);
  }

  select.addEventListener(
    "change",
    function () {
      onChange(choices.getValue(true));
    },
    false,
  );
};

const createDropDown = (
  parentDiv,
  label,
  id,
  options,
  value,
  target,
  tooltip = "",
  fullWidth = false,
  triggerOnInit = true,
) => {
  if (document.contains(document.getElementById(id))) {
    document.getElementById(id).remove();
  }

  const i = document.createElement("div");
  i.classList.add("panelActionRow");

  const o = document.createElement("div");
  o.classList.add("buttonInfoLabel");

  // Add label
  const spinnerLabel = document.createElement("span");
  spinnerLabel.classList.add("spinnerLabel");
  spinnerLabel.innerHTML = label;
  o.appendChild(spinnerLabel);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    createTooltip(tooltip, spinnerLabel, o);
  }

  i.appendChild(o);

  let dropdown = new UTDropDownControl();
  let container = document.createElement("div");
  container.classList.add("sbc-settings-field");
  container.style.width = "45%";
  if (fullWidth) {
    container.style.width = "100%";
  }
  container.appendChild(i);
  container.appendChild(dropdown.getRootElement());
  container.setAttribute("id", id);
  dropdown.init();

  dropdown.setOptions(options);

  // Guard against controls that emit CHANGE while initial value is being bound.
  // We only want target callbacks from explicit init trigger or real user edits.
  let isInitializing = true;
  dropdown.addTarget(
    dropdown,
    (...args) => {
      if (isInitializing) {
        return;
      }
      target(...args);
    },
    EventType.CHANGE,
  );
  parentDiv.appendChild(container);
  dropdown.setIndexById(value);
  isInitializing = false;
  if (triggerOnInit) {
    dropdown._triggerActions(EventType.CHANGE);
  }
  return dropdown;
};

const createToggle = (parentDiv, label, id, value, target, tooltip = "") => {
  let toggle = new UTToggleCellView();
  let panel = createPanel();
  panel.id = id;

  // Create label container
  const labelContainer = document.createElement("div");
  labelContainer.style.display = "flex";
  labelContainer.style.alignItems = "center";

  // Add label text
  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;
  labelContainer.appendChild(labelSpan);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    createTooltip(tooltip, labelSpan, labelContainer);
  }

  // Set label container as toggle label
  toggle.setLabel("");
  toggle.getRootElement().prepend(labelContainer);

  panel.appendChild(toggle.getRootElement());
  toggle.init();

  if (value) {
    toggle.toggle();
  }

  toggle.addTarget(toggle, target, EventType.TAP);
  parentDiv.appendChild(panel);
  return panel;
};

const createSettingsTile = (parentDiv, label, id, tooltip = "") => {
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
  if (tooltip) {
    h1.classList.add("tooltip-container");
    h1.setAttribute("data-tooltip", tooltip);
  }
  tileheader.appendChild(h1);
  tile.appendChild(tileheader);
  var tileContent = document.createElement("div");
  tileContent.classList.add("sbc-settings-section");
  tile.appendChild(tileContent);
  parentDiv.appendChild(tile);
  return tileContent;
};

/**
 * Creates a styled SBC settings panel div for use in challenge hover and other UI contexts.
 * Matches the visual style of SBC settings without the tile wrapper.
 * @param {string} label - Panel header label/title
 * @param {string} id - Unique identifier for the panel div
 * @param {string} tooltip - Optional tooltip text for the header
 * @returns {Object} Object containing { container: styledDiv, contentSection: sectionForControls }
 */
const createSBCSettingsPanel = (label, id, tooltip = "") => {
  const container = document.createElement("div");
  container.setAttribute("id", id);
  container.classList.add("sbc-settings-wrapper");
  container.style.marginTop = "0";
  container.style.padding = "10px";
  container.style.paddingTop = "0";
  container.style.maxHeight = "400px";
  container.style.overflowY = "auto";

  const header = document.createElement("div");
  header.classList.add("sbc-settings-header");
  header.style.marginTop = "0";
  header.style.marginBottom = "5px";

  const headerTitle = document.createElement("h3");
  headerTitle.style.fontWeight = "bold";
  headerTitle.style.margin = "0";
  headerTitle.style.userSelect = "none";
  headerTitle.textContent = label;

  if (tooltip) {
    headerTitle.classList.add("tooltip-container");
    headerTitle.setAttribute("data-tooltip", tooltip);
  }

  header.appendChild(headerTitle);
  container.appendChild(header);

  const contentSection = document.createElement("div");
  contentSection.classList.add("sbc-settings-section");
  contentSection.style.fontSize = "0.85em";
  container.appendChild(contentSection);

  return { container, contentSection };
};

function Counter(selector, settings) {
  let shield = getElement(".ut-click-shield");
  if (!document.contains(document.getElementsByClassName("numCounter")[0])) {
    var counterContent = document.createElement("div");
    counterContent.classList.add("numCounter");
    counterContent.addEventListener("click", () => {
      createSbc = false;
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
    settings || {},
  );

  var scopeElm = document.querySelector(selector);

  // generate digits markup
  var digitsHTML = Array(this.settings.digits + 1).join(
    '<div><b data-value="0"></b></div>',
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
        i,
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
