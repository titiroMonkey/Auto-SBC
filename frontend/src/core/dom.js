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
  } catch (error) {}
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
    existingNode.nextSibling,
  );
  return newNode;
};
const createButton = (id, label, callback, buttonClass = "btn-standard") => {
  const innerSpan = createElem(
    "span",
    {
      className: "button__text",
    },
    label,
  );
  const button = createElem(
    "button",
    {
      className: buttonClass,
      id: id,
    },
    getElementString(innerSpan),
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

const createDiv = (id, style) => {
  const div = document.createElement("div");
  div.id = id;
  Object.keys(style || {}).forEach((key) => {
    div.style[key] = style[key];
  });
  return div;
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
    if (parentElement?.id == "sbcToolbar") {
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
          if (sbcToolbar && hoverBtn) {
            sbcToolbar.appendChild(hoverBtn);
          }
        }, 150);

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
  (buttons || []).forEach((button) => {
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
