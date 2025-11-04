// ==UserScript==
// @name         EAFC 26 Auto SBC
// @namespace    http://tampermonkey.net/
// @version      26.1.05
// @description  automatically solve EAFC 26 SBCs using the currently available players in the club with the minimum cost
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
// (function() {
//   const scriptUrls = [
//     "https://code.jquery.com/jquery-3.6.0.min.js",
//     "https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js",
// "https://cdn.jsdelivr.net/npm/choices.js/public/assets/scripts/choices.min.js",
//     "http://d3js.org/d3.v3.min.js",
//     "https://cdnjs.cloudflare.com/ajax/libs/c3/0.4.11/c3.min.js",
//     "https://pivottable.js.org/dist/pivot.js",
//     "https://pivottable.js.org/dist/c3_renderers.js",
//     "https://pivottable.js.org/dist/d3_renderers.js"
//   ];

//   function loadScript(url) {
//     return new Promise((resolve, reject) => {
//       // Check if a script with the same URL already exists
//       if (document.querySelector(`script[src="${url}"]`)) {
//         console.log(`Script already loaded: ${url}`);
//         resolve();
//         return;
//       }
//       const script = document.createElement('script');
//       script.src = url;
//       // Add integrity and crossorigin attributes for jQuery
//       if (url.includes("jquery-3.6.0.min.js")) {
//         script.integrity = "sha256-/xUj+3OJ9JdXZz1NsMtpxgbeHyNiBTGAC8ToH0zavmM=";
//         script.crossOrigin = "anonymous";
//       }
//       // Retrieve nonce from the meta tag if it exists and set it on the script
//       const nonce = document.querySelector('meta[nonce]')?.getAttribute('nonce');
//       if (nonce) {
//         script.setAttribute('nonce', nonce);
//       }
//       script.onload = resolve;
//       script.onerror = () => reject(new Error(`Failed to load ${url}`));
//       document.head.appendChild(script);
//     });
//   }

//   Promise.all(scriptUrls.map(loadScript))
//       .then(() => {
//         console.log("All external scripts have been successfully loaded.");
//         if (typeof jQuery !== 'undefined') {
//           window.$ = jQuery;
//         }
//         // Main code is already defined below; execution continues.
//       })
//     .catch(err => console.error(err));
// })();
/*! choices.js v11.1.0 | © 2025 Josh Johnson | https://github.com/jshjohnson/Choices#readme */
!(function (e, t) {
  'object' == typeof exports && 'undefined' != typeof module
    ? (module.exports = t())
    : 'function' == typeof define && define.amd
    ? define(t)
    : ((e = 'undefined' != typeof globalThis ? globalThis : e || self).Choices = t());
})(this, function () {
  'use strict';
  var e = function (t, i) {
    return (
      (e =
        Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array &&
          function (e, t) {
            e.__proto__ = t;
          }) ||
        function (e, t) {
          for (var i in t) Object.prototype.hasOwnProperty.call(t, i) && (e[i] = t[i]);
        }),
      e(t, i)
    );
  };
  function t(t, i) {
    if ('function' != typeof i && null !== i)
      throw new TypeError('Class extends value ' + String(i) + ' is not a constructor or null');
    function n() {
      this.constructor = t;
    }
    e(t, i), (t.prototype = null === i ? Object.create(i) : ((n.prototype = i.prototype), new n()));
  }
  var i = function () {
    return (
      (i =
        Object.assign ||
        function (e) {
          for (var t, i = 1, n = arguments.length; i < n; i++)
            for (var s in (t = arguments[i]))
              Object.prototype.hasOwnProperty.call(t, s) && (e[s] = t[s]);
          return e;
        }),
      i.apply(this, arguments)
    );
  };
  function n(e, t, i) {
    if (i || 2 === arguments.length)
      for (var n, s = 0, o = t.length; s < o; s++)
        (!n && s in t) || (n || (n = Array.prototype.slice.call(t, 0, s)), (n[s] = t[s]));
    return e.concat(n || Array.prototype.slice.call(t));
  }
  'function' == typeof SuppressedError && SuppressedError;
  var s,
    o = 'ADD_CHOICE',
    r = 'REMOVE_CHOICE',
    c = 'FILTER_CHOICES',
    a = 'ACTIVATE_CHOICES',
    h = 'CLEAR_CHOICES',
    l = 'ADD_GROUP',
    u = 'ADD_ITEM',
    d = 'REMOVE_ITEM',
    p = 'HIGHLIGHT_ITEM',
    f = 'search',
    m = 'removeItem',
    g = 'highlightItem',
    v = ['fuseOptions', 'classNames'],
    _ = 'select-one',
    y = 'select-multiple',
    b = function (e) {
      return { type: o, choice: e };
    },
    E = function (e) {
      return { type: u, item: e };
    },
    C = function (e) {
      return { type: d, item: e };
    },
    S = function (e, t) {
      return { type: p, item: e, highlighted: t };
    },
    w = function (e) {
      return Array.from({ length: e }, function () {
        return Math.floor(36 * Math.random() + 0).toString(36);
      }).join('');
    },
    I = function (e) {
      if ('string' != typeof e) {
        if (null == e) return '';
        if ('object' == typeof e) {
          if ('raw' in e) return I(e.raw);
          if ('trusted' in e) return e.trusted;
        }
        return e;
      }
      return e
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;')
        .replace(/'/g, '&#039;')
        .replace(/"/g, '&quot;');
    },
    A =
      ((s = document.createElement('div')),
      function (e) {
        s.innerHTML = e.trim();
        for (var t = s.children[0]; s.firstChild; ) s.removeChild(s.firstChild);
        return t;
      }),
    x = function (e, t) {
      return 'function' == typeof e ? e(I(t), t) : e;
    },
    O = function (e) {
      return 'function' == typeof e ? e() : e;
    },
    L = function (e) {
      if ('string' == typeof e) return e;
      if ('object' == typeof e) {
        if ('trusted' in e) return e.trusted;
        if ('raw' in e) return e.raw;
      }
      return '';
    },
    M = function (e) {
      if ('string' == typeof e) return e;
      if ('object' == typeof e) {
        if ('escaped' in e) return e.escaped;
        if ('trusted' in e) return e.trusted;
      }
      return '';
    },
    T = function (e, t) {
      return e ? M(t) : I(t);
    },
    N = function (e, t, i) {
      e.innerHTML = T(t, i);
    },
    k = function (e, t) {
      return e.rank - t.rank;
    },
    F = function (e) {
      return Array.isArray(e) ? e : [e];
    },
    D = function (e) {
      return e && Array.isArray(e)
        ? e
            .map(function (e) {
              return '.'.concat(e);
            })
            .join('')
        : '.'.concat(e);
    },
    P = function (e, t) {
      var i;
      (i = e.classList).add.apply(i, F(t));
    },
    j = function (e, t) {
      var i;
      (i = e.classList).remove.apply(i, F(t));
    },
    R = function (e) {
      if (void 0 !== e)
        try {
          return JSON.parse(e);
        } catch (t) {
          return e;
        }
      return {};
    },
    K = (function () {
      function e(e) {
        var t = e.type,
          i = e.classNames;
        (this.element = e.element), (this.classNames = i), (this.type = t), (this.isActive = !1);
      }
      return (
        (e.prototype.show = function () {
          return (
            P(this.element, this.classNames.activeState),
            this.element.setAttribute('aria-expanded', 'true'),
            (this.isActive = !0),
            this
          );
        }),
        (e.prototype.hide = function () {
          return (
            j(this.element, this.classNames.activeState),
            this.element.setAttribute('aria-expanded', 'false'),
            (this.isActive = !1),
            this
          );
        }),
        e
      );
    })(),
    V = (function () {
      function e(e) {
        var t = e.type,
          i = e.classNames,
          n = e.position;
        (this.element = e.element),
          (this.classNames = i),
          (this.type = t),
          (this.position = n),
          (this.isOpen = !1),
          (this.isFlipped = !1),
          (this.isDisabled = !1),
          (this.isLoading = !1);
      }
      return (
        (e.prototype.shouldFlip = function (e, t) {
          var i = !1;
          return (
            'auto' === this.position
              ? (i =
                  this.element.getBoundingClientRect().top - t >= 0 &&
                  !window.matchMedia('(min-height: '.concat(e + 1, 'px)')).matches)
              : 'top' === this.position && (i = !0),
            i
          );
        }),
        (e.prototype.setActiveDescendant = function (e) {
          this.element.setAttribute('aria-activedescendant', e);
        }),
        (e.prototype.removeActiveDescendant = function () {
          this.element.removeAttribute('aria-activedescendant');
        }),
        (e.prototype.open = function (e, t) {
          P(this.element, this.classNames.openState),
            this.element.setAttribute('aria-expanded', 'true'),
            (this.isOpen = !0),
            this.shouldFlip(e, t) &&
              (P(this.element, this.classNames.flippedState), (this.isFlipped = !0));
        }),
        (e.prototype.close = function () {
          j(this.element, this.classNames.openState),
            this.element.setAttribute('aria-expanded', 'false'),
            this.removeActiveDescendant(),
            (this.isOpen = !1),
            this.isFlipped &&
              (j(this.element, this.classNames.flippedState), (this.isFlipped = !1));
        }),
        (e.prototype.addFocusState = function () {
          P(this.element, this.classNames.focusState);
        }),
        (e.prototype.removeFocusState = function () {
          j(this.element, this.classNames.focusState);
        }),
        (e.prototype.enable = function () {
          j(this.element, this.classNames.disabledState),
            this.element.removeAttribute('aria-disabled'),
            this.type === _ && this.element.setAttribute('tabindex', '0'),
            (this.isDisabled = !1);
        }),
        (e.prototype.disable = function () {
          P(this.element, this.classNames.disabledState),
            this.element.setAttribute('aria-disabled', 'true'),
            this.type === _ && this.element.setAttribute('tabindex', '-1'),
            (this.isDisabled = !0);
        }),
        (e.prototype.wrap = function (e) {
          var t = this.element,
            i = e.parentNode;
          i && (e.nextSibling ? i.insertBefore(t, e.nextSibling) : i.appendChild(t)),
            t.appendChild(e);
        }),
        (e.prototype.unwrap = function (e) {
          var t = this.element,
            i = t.parentNode;
          i && (i.insertBefore(e, t), i.removeChild(t));
        }),
        (e.prototype.addLoadingState = function () {
          P(this.element, this.classNames.loadingState),
            this.element.setAttribute('aria-busy', 'true'),
            (this.isLoading = !0);
        }),
        (e.prototype.removeLoadingState = function () {
          j(this.element, this.classNames.loadingState),
            this.element.removeAttribute('aria-busy'),
            (this.isLoading = !1);
        }),
        e
      );
    })(),
    B = (function () {
      function e(e) {
        var t = e.element,
          i = e.type,
          n = e.classNames,
          s = e.preventPaste;
        (this.element = t),
          (this.type = i),
          (this.classNames = n),
          (this.preventPaste = s),
          (this.isFocussed = this.element.isEqualNode(document.activeElement)),
          (this.isDisabled = t.disabled),
          (this._onPaste = this._onPaste.bind(this)),
          (this._onInput = this._onInput.bind(this)),
          (this._onFocus = this._onFocus.bind(this)),
          (this._onBlur = this._onBlur.bind(this));
      }
      return (
        Object.defineProperty(e.prototype, 'placeholder', {
          set: function (e) {
            this.element.placeholder = e;
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'value', {
          get: function () {
            return this.element.value;
          },
          set: function (e) {
            this.element.value = e;
          },
          enumerable: !1,
          configurable: !0,
        }),
        (e.prototype.addEventListeners = function () {
          var e = this.element;
          e.addEventListener('paste', this._onPaste),
            e.addEventListener('input', this._onInput, { passive: !0 }),
            e.addEventListener('focus', this._onFocus, { passive: !0 }),
            e.addEventListener('blur', this._onBlur, { passive: !0 });
        }),
        (e.prototype.removeEventListeners = function () {
          var e = this.element;
          e.removeEventListener('input', this._onInput),
            e.removeEventListener('paste', this._onPaste),
            e.removeEventListener('focus', this._onFocus),
            e.removeEventListener('blur', this._onBlur);
        }),
        (e.prototype.enable = function () {
          this.element.removeAttribute('disabled'), (this.isDisabled = !1);
        }),
        (e.prototype.disable = function () {
          this.element.setAttribute('disabled', ''), (this.isDisabled = !0);
        }),
        (e.prototype.focus = function () {
          this.isFocussed || this.element.focus();
        }),
        (e.prototype.blur = function () {
          this.isFocussed && this.element.blur();
        }),
        (e.prototype.clear = function (e) {
          return void 0 === e && (e = !0), (this.element.value = ''), e && this.setWidth(), this;
        }),
        (e.prototype.setWidth = function () {
          var e = this.element;
          (e.style.minWidth = ''.concat(e.placeholder.length + 1, 'ch')),
            (e.style.width = ''.concat(e.value.length + 1, 'ch'));
        }),
        (e.prototype.setActiveDescendant = function (e) {
          this.element.setAttribute('aria-activedescendant', e);
        }),
        (e.prototype.removeActiveDescendant = function () {
          this.element.removeAttribute('aria-activedescendant');
        }),
        (e.prototype._onInput = function () {
          this.type !== _ && this.setWidth();
        }),
        (e.prototype._onPaste = function (e) {
          this.preventPaste && e.preventDefault();
        }),
        (e.prototype._onFocus = function () {
          this.isFocussed = !0;
        }),
        (e.prototype._onBlur = function () {
          this.isFocussed = !1;
        }),
        e
      );
    })(),
    H = (function () {
      function e(e) {
        (this.element = e.element),
          (this.scrollPos = this.element.scrollTop),
          (this.height = this.element.offsetHeight);
      }
      return (
        (e.prototype.prepend = function (e) {
          var t = this.element.firstElementChild;
          t ? this.element.insertBefore(e, t) : this.element.append(e);
        }),
        (e.prototype.scrollToTop = function () {
          this.element.scrollTop = 0;
        }),
        (e.prototype.scrollToChildElement = function (e, t) {
          var i = this;
          if (e) {
            var n =
              t > 0
                ? this.element.scrollTop +
                  (e.offsetTop + e.offsetHeight) -
                  (this.element.scrollTop + this.element.offsetHeight)
                : e.offsetTop;
            requestAnimationFrame(function () {
              i._animateScroll(n, t);
            });
          }
        }),
        (e.prototype._scrollDown = function (e, t, i) {
          var n = (i - e) / t;
          this.element.scrollTop = e + (n > 1 ? n : 1);
        }),
        (e.prototype._scrollUp = function (e, t, i) {
          var n = (e - i) / t;
          this.element.scrollTop = e - (n > 1 ? n : 1);
        }),
        (e.prototype._animateScroll = function (e, t) {
          var i = this,
            n = this.element.scrollTop,
            s = !1;
          t > 0
            ? (this._scrollDown(n, 4, e), n < e && (s = !0))
            : (this._scrollUp(n, 4, e), n > e && (s = !0)),
            s &&
              requestAnimationFrame(function () {
                i._animateScroll(e, t);
              });
        }),
        e
      );
    })(),
    $ = (function () {
      function e(e) {
        var t = e.classNames;
        (this.element = e.element), (this.classNames = t), (this.isDisabled = !1);
      }
      return (
        Object.defineProperty(e.prototype, 'isActive', {
          get: function () {
            return 'active' === this.element.dataset.choice;
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'dir', {
          get: function () {
            return this.element.dir;
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'value', {
          get: function () {
            return this.element.value;
          },
          set: function (e) {
            this.element.setAttribute('value', e), (this.element.value = e);
          },
          enumerable: !1,
          configurable: !0,
        }),
        (e.prototype.conceal = function () {
          var e = this.element;
          P(e, this.classNames.input), (e.hidden = !0), (e.tabIndex = -1);
          var t = e.getAttribute('style');
          t && e.setAttribute('data-choice-orig-style', t), e.setAttribute('data-choice', 'active');
        }),
        (e.prototype.reveal = function () {
          var e = this.element;
          j(e, this.classNames.input), (e.hidden = !1), e.removeAttribute('tabindex');
          var t = e.getAttribute('data-choice-orig-style');
          t
            ? (e.removeAttribute('data-choice-orig-style'), e.setAttribute('style', t))
            : e.removeAttribute('style'),
            e.removeAttribute('data-choice');
        }),
        (e.prototype.enable = function () {
          this.element.removeAttribute('disabled'),
            (this.element.disabled = !1),
            (this.isDisabled = !1);
        }),
        (e.prototype.disable = function () {
          this.element.setAttribute('disabled', ''),
            (this.element.disabled = !0),
            (this.isDisabled = !0);
        }),
        (e.prototype.triggerEvent = function (e, t) {
          var i;
          void 0 === (i = t || {}) && (i = null),
            this.element.dispatchEvent(
              new CustomEvent(e, { detail: i, bubbles: !0, cancelable: !0 })
            );
        }),
        e
      );
    })(),
    q = (function (e) {
      function i() {
        return (null !== e && e.apply(this, arguments)) || this;
      }
      return t(i, e), i;
    })($),
    W = function (e, t) {
      return void 0 === t && (t = !0), void 0 === e ? t : !!e;
    },
    U = function (e) {
      if (
        ('string' == typeof e &&
          (e = e.split(' ').filter(function (e) {
            return e.length;
          })),
        Array.isArray(e) && e.length)
      )
        return e;
    },
    G = function (e, t, i) {
      if ((void 0 === i && (i = !0), 'string' == typeof e)) {
        var n = I(e);
        return G({ value: e, label: i || n === e ? e : { escaped: n, raw: e }, selected: !0 }, !1);
      }
      var s = e;
      if ('choices' in s) {
        if (!t) throw new TypeError('optGroup is not allowed');
        var o = s,
          r = o.choices.map(function (e) {
            return G(e, !1);
          });
        return {
          id: 0,
          label: L(o.label) || o.value,
          active: !!r.length,
          disabled: !!o.disabled,
          choices: r,
        };
      }
      var c = s;
      return {
        id: 0,
        group: null,
        score: 0,
        rank: 0,
        value: c.value,
        label: c.label || c.value,
        active: W(c.active),
        selected: W(c.selected, !1),
        disabled: W(c.disabled, !1),
        placeholder: W(c.placeholder, !1),
        highlighted: !1,
        labelClass: U(c.labelClass),
        labelDescription: c.labelDescription,
        customProperties: c.customProperties,
      };
    },
    z = function (e) {
      return 'SELECT' === e.tagName;
    },
    J = (function (e) {
      function i(t) {
        var i = t.template,
          n = t.extractPlaceholder,
          s = e.call(this, { element: t.element, classNames: t.classNames }) || this;
        return (s.template = i), (s.extractPlaceholder = n), s;
      }
      return (
        t(i, e),
        Object.defineProperty(i.prototype, 'placeholderOption', {
          get: function () {
            return (
              this.element.querySelector('option[value=""]') ||
              this.element.querySelector('option[placeholder]')
            );
          },
          enumerable: !1,
          configurable: !0,
        }),
        (i.prototype.addOptions = function (e) {
          var t = this,
            i = document.createDocumentFragment();
          e.forEach(function (e) {
            var n = e;
            if (!n.element) {
              var s = t.template(n);
              i.appendChild(s), (n.element = s);
            }
          }),
            this.element.appendChild(i);
        }),
        (i.prototype.optionsAsChoices = function () {
          var e = this,
            t = [];
          return (
            this.element
              .querySelectorAll(':scope > option, :scope > optgroup')
              .forEach(function (i) {
                !(function (e) {
                  return 'OPTION' === e.tagName;
                })(i)
                  ? (function (e) {
                      return 'OPTGROUP' === e.tagName;
                    })(i) && t.push(e._optgroupToChoice(i))
                  : t.push(e._optionToChoice(i));
              }),
            t
          );
        }),
        (i.prototype._optionToChoice = function (e) {
          return (
            !e.hasAttribute('value') &&
              e.hasAttribute('placeholder') &&
              (e.setAttribute('value', ''), (e.value = '')),
            {
              id: 0,
              group: null,
              score: 0,
              rank: 0,
              value: e.value,
              label: e.label,
              element: e,
              active: !0,
              selected: this.extractPlaceholder ? e.selected : e.hasAttribute('selected'),
              disabled: e.disabled,
              highlighted: !1,
              placeholder: this.extractPlaceholder && (!e.value || e.hasAttribute('placeholder')),
              labelClass: void 0 !== e.dataset.labelClass ? U(e.dataset.labelClass) : void 0,
              labelDescription:
                void 0 !== e.dataset.labelDescription ? e.dataset.labelDescription : void 0,
              customProperties: R(e.dataset.customProperties),
            }
          );
        }),
        (i.prototype._optgroupToChoice = function (e) {
          var t = this,
            i = e.querySelectorAll('option'),
            n = Array.from(i).map(function (e) {
              return t._optionToChoice(e);
            });
          return {
            id: 0,
            label: e.label || '',
            element: e,
            active: !!n.length,
            disabled: e.disabled,
            choices: n,
          };
        }),
        i
      );
    })($),
    X = {
      items: [],
      choices: [],
      silent: !1,
      renderChoiceLimit: -1,
      maxItemCount: -1,
      closeDropdownOnSelect: 'auto',
      singleModeForMultiSelect: !1,
      addChoices: !1,
      addItems: !0,
      addItemFilter: function (e) {
        return !!e && '' !== e;
      },
      removeItems: !0,
      removeItemButton: !1,
      removeItemButtonAlignLeft: !1,
      editItems: !1,
      allowHTML: !1,
      allowHtmlUserInput: !1,
      duplicateItemsAllowed: !0,
      delimiter: ',',
      paste: !0,
      searchEnabled: !0,
      searchChoices: !0,
      searchFloor: 1,
      searchResultLimit: 4,
      searchFields: ['label', 'value'],
      position: 'auto',
      resetScrollPosition: !0,
      shouldSort: !0,
      shouldSortItems: !1,
      sorter: function (e, t) {
        var i = e.label,
          n = t.label,
          s = void 0 === n ? t.value : n;
        return L(void 0 === i ? e.value : i).localeCompare(L(s), [], {
          sensitivity: 'base',
          ignorePunctuation: !0,
          numeric: !0,
        });
      },
      shadowRoot: null,
      placeholder: !0,
      placeholderValue: null,
      searchPlaceholderValue: null,
      prependValue: null,
      appendValue: null,
      renderSelectedChoices: 'auto',
      loadingText: 'Loading...',
      noResultsText: 'No results found',
      noChoicesText: 'No choices to choose from',
      itemSelectText: 'Press to select',
      uniqueItemText: 'Only unique values can be added',
      customAddItemText: 'Only values matching specific conditions can be added',
      addItemText: function (e) {
        return 'Press Enter to add <b>"'.concat(e, '"</b>');
      },
      removeItemIconText: function () {
        return 'Remove item';
      },
      removeItemLabelText: function (e) {
        return 'Remove item: '.concat(e);
      },
      maxItemText: function (e) {
        return 'Only '.concat(e, ' values can be added');
      },
      valueComparer: function (e, t) {
        return e === t;
      },
      fuseOptions: { includeScore: !0 },
      labelId: '',
      callbackOnInit: null,
      callbackOnCreateTemplates: null,
      classNames: {
        containerOuter: ['choices'],
        containerInner: ['choices__inner'],
        input: ['choices__input'],
        inputCloned: ['choices__input--cloned'],
        list: ['choices__list'],
        listItems: ['choices__list--multiple'],
        listSingle: ['choices__list--single'],
        listDropdown: ['choices__list--dropdown'],
        item: ['choices__item'],
        itemSelectable: ['choices__item--selectable'],
        itemDisabled: ['choices__item--disabled'],
        itemChoice: ['choices__item--choice'],
        description: ['choices__description'],
        placeholder: ['choices__placeholder'],
        group: ['choices__group'],
        groupHeading: ['choices__heading'],
        button: ['choices__button'],
        activeState: ['is-active'],
        focusState: ['is-focused'],
        openState: ['is-open'],
        disabledState: ['is-disabled'],
        highlightedState: ['is-highlighted'],
        selectedState: ['is-selected'],
        flippedState: ['is-flipped'],
        loadingState: ['is-loading'],
        notice: ['choices__notice'],
        addChoice: ['choices__item--selectable', 'add-choice'],
        noResults: ['has-no-results'],
        noChoices: ['has-no-choices'],
      },
      appendGroupInSearch: !1,
    },
    Q = function (e) {
      var t = e.itemEl;
      t && (t.remove(), (e.itemEl = void 0));
    },
    Y = {
      groups: function (e, t) {
        var i = e,
          n = !0;
        switch (t.type) {
          case l:
            i.push(t.group);
            break;
          case h:
            i = [];
            break;
          default:
            n = !1;
        }
        return { state: i, update: n };
      },
      items: function (e, t, i) {
        var n = e,
          s = !0;
        switch (t.type) {
          case u:
            (t.item.selected = !0),
              (o = t.item.element) && ((o.selected = !0), o.setAttribute('selected', '')),
              n.push(t.item);
            break;
          case d:
            var o;
            if (((t.item.selected = !1), (o = t.item.element))) {
              (o.selected = !1), o.removeAttribute('selected');
              var c = o.parentElement;
              c && z(c) && c.type === _ && (c.value = '');
            }
            Q(t.item),
              (n = n.filter(function (e) {
                return e.id !== t.item.id;
              }));
            break;
          case r:
            Q(t.choice),
              (n = n.filter(function (e) {
                return e.id !== t.choice.id;
              }));
            break;
          case p:
            var a = t.highlighted,
              h = n.find(function (e) {
                return e.id === t.item.id;
              });
            h &&
              h.highlighted !== a &&
              ((h.highlighted = a),
              i &&
                (function (e, t, i) {
                  var n = e.itemEl;
                  n && (j(n, i), P(n, t));
                })(
                  h,
                  a ? i.classNames.highlightedState : i.classNames.selectedState,
                  a ? i.classNames.selectedState : i.classNames.highlightedState
                ));
            break;
          default:
            s = !1;
        }
        return { state: n, update: s };
      },
      choices: function (e, t, i) {
        var n = e,
          s = !0;
        switch (t.type) {
          case o:
            n.push(t.choice);
            break;
          case r:
            (t.choice.choiceEl = void 0),
              t.choice.group &&
                (t.choice.group.choices = t.choice.group.choices.filter(function (e) {
                  return e.id !== t.choice.id;
                })),
              (n = n.filter(function (e) {
                return e.id !== t.choice.id;
              }));
            break;
          case u:
          case d:
            t.item.choiceEl = void 0;
            break;
          case c:
            var l = [];
            t.results.forEach(function (e) {
              l[e.item.id] = e;
            }),
              n.forEach(function (e) {
                var t = l[e.id];
                void 0 !== t
                  ? ((e.score = t.score), (e.rank = t.rank), (e.active = !0))
                  : ((e.score = 0), (e.rank = 0), (e.active = !1)),
                  i && i.appendGroupInSearch && (e.choiceEl = void 0);
              });
            break;
          case a:
            n.forEach(function (e) {
              (e.active = t.active), i && i.appendGroupInSearch && (e.choiceEl = void 0);
            });
            break;
          case h:
            n = [];
            break;
          default:
            s = !1;
        }
        return { state: n, update: s };
      },
    },
    Z = (function () {
      function e(e) {
        (this._state = this.defaultState),
          (this._listeners = []),
          (this._txn = 0),
          (this._context = e);
      }
      return (
        Object.defineProperty(e.prototype, 'defaultState', {
          get: function () {
            return { groups: [], items: [], choices: [] };
          },
          enumerable: !1,
          configurable: !0,
        }),
        (e.prototype.changeSet = function (e) {
          return { groups: e, items: e, choices: e };
        }),
        (e.prototype.reset = function () {
          this._state = this.defaultState;
          var e = this.changeSet(!0);
          this._txn
            ? (this._changeSet = e)
            : this._listeners.forEach(function (t) {
                return t(e);
              });
        }),
        (e.prototype.subscribe = function (e) {
          return this._listeners.push(e), this;
        }),
        (e.prototype.dispatch = function (e) {
          var t = this,
            i = this._state,
            n = !1,
            s = this._changeSet || this.changeSet(!1);
          Object.keys(Y).forEach(function (o) {
            var r = Y[o](i[o], e, t._context);
            r.update && ((n = !0), (s[o] = !0), (i[o] = r.state));
          }),
            n &&
              (this._txn
                ? (this._changeSet = s)
                : this._listeners.forEach(function (e) {
                    return e(s);
                  }));
        }),
        (e.prototype.withTxn = function (e) {
          this._txn++;
          try {
            e();
          } finally {
            if (((this._txn = Math.max(0, this._txn - 1)), !this._txn)) {
              var t = this._changeSet;
              t &&
                ((this._changeSet = void 0),
                this._listeners.forEach(function (e) {
                  return e(t);
                }));
            }
          }
        }),
        Object.defineProperty(e.prototype, 'state', {
          get: function () {
            return this._state;
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'items', {
          get: function () {
            return this.state.items;
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'highlightedActiveItems', {
          get: function () {
            return this.items.filter(function (e) {
              return e.active && e.highlighted;
            });
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'choices', {
          get: function () {
            return this.state.choices;
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'activeChoices', {
          get: function () {
            return this.choices.filter(function (e) {
              return e.active;
            });
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'searchableChoices', {
          get: function () {
            return this.choices.filter(function (e) {
              return !e.disabled && !e.placeholder;
            });
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'groups', {
          get: function () {
            return this.state.groups;
          },
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e.prototype, 'activeGroups', {
          get: function () {
            var e = this;
            return this.state.groups.filter(function (t) {
              var i = t.active && !t.disabled,
                n = e.state.choices.some(function (e) {
                  return e.active && !e.disabled;
                });
              return i && n;
            }, []);
          },
          enumerable: !1,
          configurable: !0,
        }),
        (e.prototype.inTxn = function () {
          return this._txn > 0;
        }),
        (e.prototype.getChoiceById = function (e) {
          return this.activeChoices.find(function (t) {
            return t.id === e;
          });
        }),
        (e.prototype.getGroupById = function (e) {
          return this.groups.find(function (t) {
            return t.id === e;
          });
        }),
        e
      );
    })(),
    ee = 'no-choices',
    te = 'no-results',
    ie = 'add-choice';
  function ne(e, t, i) {
    return (
      (t = (function (e) {
        var t = (function (e) {
          if ('object' != typeof e || !e) return e;
          var t = e[Symbol.toPrimitive];
          if (void 0 !== t) {
            var i = t.call(e, 'string');
            if ('object' != typeof i) return i;
            throw new TypeError('@@toPrimitive must return a primitive value.');
          }
          return String(e);
        })(e);
        return 'symbol' == typeof t ? t : t + '';
      })(t)) in e
        ? Object.defineProperty(e, t, { value: i, enumerable: !0, configurable: !0, writable: !0 })
        : (e[t] = i),
      e
    );
  }
  function se(e, t) {
    var i = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var n = Object.getOwnPropertySymbols(e);
      t &&
        (n = n.filter(function (t) {
          return Object.getOwnPropertyDescriptor(e, t).enumerable;
        })),
        i.push.apply(i, n);
    }
    return i;
  }
  function oe(e) {
    for (var t = 1; t < arguments.length; t++) {
      var i = null != arguments[t] ? arguments[t] : {};
      t % 2
        ? se(Object(i), !0).forEach(function (t) {
            ne(e, t, i[t]);
          })
        : Object.getOwnPropertyDescriptors
        ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(i))
        : se(Object(i)).forEach(function (t) {
            Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(i, t));
          });
    }
    return e;
  }
  function re(e) {
    return Array.isArray ? Array.isArray(e) : '[object Array]' === de(e);
  }
  function ce(e) {
    return 'string' == typeof e;
  }
  function ae(e) {
    return 'number' == typeof e;
  }
  function he(e) {
    return 'object' == typeof e;
  }
  function le(e) {
    return null != e;
  }
  function ue(e) {
    return !e.trim().length;
  }
  function de(e) {
    return null == e
      ? void 0 === e
        ? '[object Undefined]'
        : '[object Null]'
      : Object.prototype.toString.call(e);
  }
  const pe = (e) => `Missing ${e} property in key`,
    fe = (e) => `Property 'weight' in key '${e}' must be a positive integer`,
    me = Object.prototype.hasOwnProperty;
  class ge {
    constructor(e) {
      (this._keys = []), (this._keyMap = {});
      let t = 0;
      e.forEach((e) => {
        let i = ve(e);
        this._keys.push(i), (this._keyMap[i.id] = i), (t += i.weight);
      }),
        this._keys.forEach((e) => {
          e.weight /= t;
        });
    }
    get(e) {
      return this._keyMap[e];
    }
    keys() {
      return this._keys;
    }
    toJSON() {
      return JSON.stringify(this._keys);
    }
  }
  function ve(e) {
    let t = null,
      i = null,
      n = null,
      s = 1,
      o = null;
    if (ce(e) || re(e)) (n = e), (t = _e(e)), (i = ye(e));
    else {
      if (!me.call(e, 'name')) throw new Error(pe('name'));
      const r = e.name;
      if (((n = r), me.call(e, 'weight') && ((s = e.weight), s <= 0))) throw new Error(fe(r));
      (t = _e(r)), (i = ye(r)), (o = e.getFn);
    }
    return { path: t, id: i, weight: s, src: n, getFn: o };
  }
  function _e(e) {
    return re(e) ? e : e.split('.');
  }
  function ye(e) {
    return re(e) ? e.join('.') : e;
  }
  const be = {
    useExtendedSearch: !1,
    getFn: function (e, t) {
      let i = [],
        n = !1;
      const s = (e, t, o) => {
        if (le(e))
          if (t[o]) {
            const r = e[t[o]];
            if (!le(r)) return;
            if (
              o === t.length - 1 &&
              (ce(r) ||
                ae(r) ||
                (function (e) {
                  return (
                    !0 === e ||
                    !1 === e ||
                    ((function (e) {
                      return he(e) && null !== e;
                    })(e) &&
                      '[object Boolean]' == de(e))
                  );
                })(r))
            )
              i.push(
                (function (e) {
                  return null == e
                    ? ''
                    : (function (e) {
                        if ('string' == typeof e) return e;
                        let t = e + '';
                        return '0' == t && 1 / e == -1 / 0 ? '-0' : t;
                      })(e);
                })(r)
              );
            else if (re(r)) {
              n = !0;
              for (let e = 0, i = r.length; e < i; e += 1) s(r[e], t, o + 1);
            } else t.length && s(r, t, o + 1);
          } else i.push(e);
      };
      return s(e, ce(t) ? t.split('.') : t, 0), n ? i : i[0];
    },
    ignoreLocation: !1,
    ignoreFieldNorm: !1,
    fieldNormWeight: 1,
  };
  var Ee = oe(
    oe(
      oe(
        oe(
          {},
          {
            isCaseSensitive: !1,
            includeScore: !1,
            keys: [],
            shouldSort: !0,
            sortFn: (e, t) =>
              e.score === t.score ? (e.idx < t.idx ? -1 : 1) : e.score < t.score ? -1 : 1,
          }
        ),
        { includeMatches: !1, findAllMatches: !1, minMatchCharLength: 1 }
      ),
      { location: 0, threshold: 0.6, distance: 100 }
    ),
    be
  );
  const Ce = /[^ ]+/g;
  class Se {
    constructor({ getFn: e = Ee.getFn, fieldNormWeight: t = Ee.fieldNormWeight } = {}) {
      (this.norm = (function (e = 1, t = 3) {
        const i = new Map(),
          n = Math.pow(10, t);
        return {
          get(t) {
            const s = t.match(Ce).length;
            if (i.has(s)) return i.get(s);
            const o = 1 / Math.pow(s, 0.5 * e),
              r = parseFloat(Math.round(o * n) / n);
            return i.set(s, r), r;
          },
          clear() {
            i.clear();
          },
        };
      })(t, 3)),
        (this.getFn = e),
        (this.isCreated = !1),
        this.setIndexRecords();
    }
    setSources(e = []) {
      this.docs = e;
    }
    setIndexRecords(e = []) {
      this.records = e;
    }
    setKeys(e = []) {
      (this.keys = e),
        (this._keysMap = {}),
        e.forEach((e, t) => {
          this._keysMap[e.id] = t;
        });
    }
    create() {
      !this.isCreated &&
        this.docs.length &&
        ((this.isCreated = !0),
        ce(this.docs[0])
          ? this.docs.forEach((e, t) => {
              this._addString(e, t);
            })
          : this.docs.forEach((e, t) => {
              this._addObject(e, t);
            }),
        this.norm.clear());
    }
    add(e) {
      const t = this.size();
      ce(e) ? this._addString(e, t) : this._addObject(e, t);
    }
    removeAt(e) {
      this.records.splice(e, 1);
      for (let t = e, i = this.size(); t < i; t += 1) this.records[t].i -= 1;
    }
    getValueForItemAtKeyId(e, t) {
      return e[this._keysMap[t]];
    }
    size() {
      return this.records.length;
    }
    _addString(e, t) {
      if (!le(e) || ue(e)) return;
      let i = { v: e, i: t, n: this.norm.get(e) };
      this.records.push(i);
    }
    _addObject(e, t) {
      let i = { i: t, $: {} };
      this.keys.forEach((t, n) => {
        let s = t.getFn ? t.getFn(e) : this.getFn(e, t.path);
        if (le(s))
          if (re(s)) {
            let e = [];
            const t = [{ nestedArrIndex: -1, value: s }];
            for (; t.length; ) {
              const { nestedArrIndex: i, value: n } = t.pop();
              if (le(n))
                if (ce(n) && !ue(n)) {
                  let t = { v: n, i: i, n: this.norm.get(n) };
                  e.push(t);
                } else
                  re(n) &&
                    n.forEach((e, i) => {
                      t.push({ nestedArrIndex: i, value: e });
                    });
            }
            i.$[n] = e;
          } else if (ce(s) && !ue(s)) {
            let e = { v: s, n: this.norm.get(s) };
            i.$[n] = e;
          }
      }),
        this.records.push(i);
    }
    toJSON() {
      return { keys: this.keys, records: this.records };
    }
  }
  function we(e, t, { getFn: i = Ee.getFn, fieldNormWeight: n = Ee.fieldNormWeight } = {}) {
    const s = new Se({ getFn: i, fieldNormWeight: n });
    return s.setKeys(e.map(ve)), s.setSources(t), s.create(), s;
  }
  function Ie(
    e,
    {
      errors: t = 0,
      currentLocation: i = 0,
      expectedLocation: n = 0,
      distance: s = Ee.distance,
      ignoreLocation: o = Ee.ignoreLocation,
    } = {}
  ) {
    const r = t / e.length;
    if (o) return r;
    const c = Math.abs(n - i);
    return s ? r + c / s : c ? 1 : r;
  }
  const Ae = 32;
  function xe(e) {
    let t = {};
    for (let i = 0, n = e.length; i < n; i += 1) {
      const s = e.charAt(i);
      t[s] = (t[s] || 0) | (1 << (n - i - 1));
    }
    return t;
  }
  class Oe {
    constructor(
      e,
      {
        location: t = Ee.location,
        threshold: i = Ee.threshold,
        distance: n = Ee.distance,
        includeMatches: s = Ee.includeMatches,
        findAllMatches: o = Ee.findAllMatches,
        minMatchCharLength: r = Ee.minMatchCharLength,
        isCaseSensitive: c = Ee.isCaseSensitive,
        ignoreLocation: a = Ee.ignoreLocation,
      } = {}
    ) {
      if (
        ((this.options = {
          location: t,
          threshold: i,
          distance: n,
          includeMatches: s,
          findAllMatches: o,
          minMatchCharLength: r,
          isCaseSensitive: c,
          ignoreLocation: a,
        }),
        (this.pattern = c ? e : e.toLowerCase()),
        (this.chunks = []),
        !this.pattern.length)
      )
        return;
      const h = (e, t) => {
          this.chunks.push({ pattern: e, alphabet: xe(e), startIndex: t });
        },
        l = this.pattern.length;
      if (l > Ae) {
        let e = 0;
        const t = l % Ae,
          i = l - t;
        for (; e < i; ) h(this.pattern.substr(e, Ae), e), (e += Ae);
        if (t) {
          const e = l - Ae;
          h(this.pattern.substr(e), e);
        }
      } else h(this.pattern, 0);
    }
    searchIn(e) {
      const { isCaseSensitive: t, includeMatches: i } = this.options;
      if ((t || (e = e.toLowerCase()), this.pattern === e)) {
        let t = { isMatch: !0, score: 0 };
        return i && (t.indices = [[0, e.length - 1]]), t;
      }
      const {
        location: n,
        distance: s,
        threshold: o,
        findAllMatches: r,
        minMatchCharLength: c,
        ignoreLocation: a,
      } = this.options;
      let h = [],
        l = 0,
        u = !1;
      this.chunks.forEach(({ pattern: t, alphabet: d, startIndex: p }) => {
        const {
          isMatch: f,
          score: m,
          indices: g,
        } = (function (
          e,
          t,
          i,
          {
            location: n = Ee.location,
            distance: s = Ee.distance,
            threshold: o = Ee.threshold,
            findAllMatches: r = Ee.findAllMatches,
            minMatchCharLength: c = Ee.minMatchCharLength,
            includeMatches: a = Ee.includeMatches,
            ignoreLocation: h = Ee.ignoreLocation,
          } = {}
        ) {
          if (t.length > Ae) throw new Error('Pattern length exceeds max of 32.');
          const l = t.length,
            u = e.length,
            d = Math.max(0, Math.min(n, u));
          let p = o,
            f = d;
          const m = c > 1 || a,
            g = m ? Array(u) : [];
          let v;
          for (; (v = e.indexOf(t, f)) > -1; ) {
            let e = Ie(t, {
              currentLocation: v,
              expectedLocation: d,
              distance: s,
              ignoreLocation: h,
            });
            if (((p = Math.min(e, p)), (f = v + l), m)) {
              let e = 0;
              for (; e < l; ) (g[v + e] = 1), (e += 1);
            }
          }
          f = -1;
          let _ = [],
            y = 1,
            b = l + u;
          const E = 1 << (l - 1);
          for (let n = 0; n < l; n += 1) {
            let o = 0,
              c = b;
            for (; o < c; )
              Ie(t, {
                errors: n,
                currentLocation: d + c,
                expectedLocation: d,
                distance: s,
                ignoreLocation: h,
              }) <= p
                ? (o = c)
                : (b = c),
                (c = Math.floor((b - o) / 2 + o));
            b = c;
            let a = Math.max(1, d - c + 1),
              v = r ? u : Math.min(d + c, u) + l,
              C = Array(v + 2);
            C[v + 1] = (1 << n) - 1;
            for (let o = v; o >= a; o -= 1) {
              let r = o - 1,
                c = i[e.charAt(r)];
              if (
                (m && (g[r] = +!!c),
                (C[o] = ((C[o + 1] << 1) | 1) & c),
                n && (C[o] |= ((_[o + 1] | _[o]) << 1) | 1 | _[o + 1]),
                C[o] & E &&
                  ((y = Ie(t, {
                    errors: n,
                    currentLocation: r,
                    expectedLocation: d,
                    distance: s,
                    ignoreLocation: h,
                  })),
                  y <= p))
              ) {
                if (((p = y), (f = r), f <= d)) break;
                a = Math.max(1, 2 * d - f);
              }
            }
            if (
              Ie(t, {
                errors: n + 1,
                currentLocation: d,
                expectedLocation: d,
                distance: s,
                ignoreLocation: h,
              }) > p
            )
              break;
            _ = C;
          }
          const C = { isMatch: f >= 0, score: Math.max(0.001, y) };
          if (m) {
            const e = (function (e = [], t = Ee.minMatchCharLength) {
              let i = [],
                n = -1,
                s = -1,
                o = 0;
              for (let r = e.length; o < r; o += 1) {
                let r = e[o];
                r && -1 === n
                  ? (n = o)
                  : r || -1 === n || ((s = o - 1), s - n + 1 >= t && i.push([n, s]), (n = -1));
              }
              return e[o - 1] && o - n >= t && i.push([n, o - 1]), i;
            })(g, c);
            e.length ? a && (C.indices = e) : (C.isMatch = !1);
          }
          return C;
        })(e, t, d, {
          location: n + p,
          distance: s,
          threshold: o,
          findAllMatches: r,
          minMatchCharLength: c,
          includeMatches: i,
          ignoreLocation: a,
        });
        f && (u = !0), (l += m), f && g && (h = [...h, ...g]);
      });
      let d = { isMatch: u, score: u ? l / this.chunks.length : 1 };
      return u && i && (d.indices = h), d;
    }
  }
  class Le {
    constructor(e) {
      this.pattern = e;
    }
    static isMultiMatch(e) {
      return Me(e, this.multiRegex);
    }
    static isSingleMatch(e) {
      return Me(e, this.singleRegex);
    }
    search() {}
  }
  function Me(e, t) {
    const i = e.match(t);
    return i ? i[1] : null;
  }
  class Te extends Le {
    constructor(
      e,
      {
        location: t = Ee.location,
        threshold: i = Ee.threshold,
        distance: n = Ee.distance,
        includeMatches: s = Ee.includeMatches,
        findAllMatches: o = Ee.findAllMatches,
        minMatchCharLength: r = Ee.minMatchCharLength,
        isCaseSensitive: c = Ee.isCaseSensitive,
        ignoreLocation: a = Ee.ignoreLocation,
      } = {}
    ) {
      super(e),
        (this._bitapSearch = new Oe(e, {
          location: t,
          threshold: i,
          distance: n,
          includeMatches: s,
          findAllMatches: o,
          minMatchCharLength: r,
          isCaseSensitive: c,
          ignoreLocation: a,
        }));
    }
    static get type() {
      return 'fuzzy';
    }
    static get multiRegex() {
      return /^"(.*)"$/;
    }
    static get singleRegex() {
      return /^(.*)$/;
    }
    search(e) {
      return this._bitapSearch.searchIn(e);
    }
  }
  class Ne extends Le {
    constructor(e) {
      super(e);
    }
    static get type() {
      return 'include';
    }
    static get multiRegex() {
      return /^'"(.*)"$/;
    }
    static get singleRegex() {
      return /^'(.*)$/;
    }
    search(e) {
      let t,
        i = 0;
      const n = [],
        s = this.pattern.length;
      for (; (t = e.indexOf(this.pattern, i)) > -1; ) (i = t + s), n.push([t, i - 1]);
      const o = !!n.length;
      return { isMatch: o, score: o ? 0 : 1, indices: n };
    }
  }
  const ke = [
      class extends Le {
        constructor(e) {
          super(e);
        }
        static get type() {
          return 'exact';
        }
        static get multiRegex() {
          return /^="(.*)"$/;
        }
        static get singleRegex() {
          return /^=(.*)$/;
        }
        search(e) {
          const t = e === this.pattern;
          return { isMatch: t, score: t ? 0 : 1, indices: [0, this.pattern.length - 1] };
        }
      },
      Ne,
      class extends Le {
        constructor(e) {
          super(e);
        }
        static get type() {
          return 'prefix-exact';
        }
        static get multiRegex() {
          return /^\^"(.*)"$/;
        }
        static get singleRegex() {
          return /^\^(.*)$/;
        }
        search(e) {
          const t = e.startsWith(this.pattern);
          return { isMatch: t, score: t ? 0 : 1, indices: [0, this.pattern.length - 1] };
        }
      },
      class extends Le {
        constructor(e) {
          super(e);
        }
        static get type() {
          return 'inverse-prefix-exact';
        }
        static get multiRegex() {
          return /^!\^"(.*)"$/;
        }
        static get singleRegex() {
          return /^!\^(.*)$/;
        }
        search(e) {
          const t = !e.startsWith(this.pattern);
          return { isMatch: t, score: t ? 0 : 1, indices: [0, e.length - 1] };
        }
      },
      class extends Le {
        constructor(e) {
          super(e);
        }
        static get type() {
          return 'inverse-suffix-exact';
        }
        static get multiRegex() {
          return /^!"(.*)"\$$/;
        }
        static get singleRegex() {
          return /^!(.*)\$$/;
        }
        search(e) {
          const t = !e.endsWith(this.pattern);
          return { isMatch: t, score: t ? 0 : 1, indices: [0, e.length - 1] };
        }
      },
      class extends Le {
        constructor(e) {
          super(e);
        }
        static get type() {
          return 'suffix-exact';
        }
        static get multiRegex() {
          return /^"(.*)"\$$/;
        }
        static get singleRegex() {
          return /^(.*)\$$/;
        }
        search(e) {
          const t = e.endsWith(this.pattern);
          return {
            isMatch: t,
            score: t ? 0 : 1,
            indices: [e.length - this.pattern.length, e.length - 1],
          };
        }
      },
      class extends Le {
        constructor(e) {
          super(e);
        }
        static get type() {
          return 'inverse-exact';
        }
        static get multiRegex() {
          return /^!"(.*)"$/;
        }
        static get singleRegex() {
          return /^!(.*)$/;
        }
        search(e) {
          const t = -1 === e.indexOf(this.pattern);
          return { isMatch: t, score: t ? 0 : 1, indices: [0, e.length - 1] };
        }
      },
      Te,
    ],
    Fe = ke.length,
    De = / +(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/,
    Pe = new Set([Te.type, Ne.type]);
  const je = [];
  function Re(e, t) {
    for (let i = 0, n = je.length; i < n; i += 1) {
      let n = je[i];
      if (n.condition(e, t)) return new n(e, t);
    }
    return new Oe(e, t);
  }
  const Ke = '$and',
    Ve = '$path',
    Be = (e) => !(!e[Ke] && !e.$or),
    He = (e) => ({ [Ke]: Object.keys(e).map((t) => ({ [t]: e[t] })) });
  function $e(e, t, { auto: i = !0 } = {}) {
    const n = (e) => {
      let s = Object.keys(e);
      const o = ((e) => !!e[Ve])(e);
      if (!o && s.length > 1 && !Be(e)) return n(He(e));
      if (((e) => !re(e) && he(e) && !Be(e))(e)) {
        const n = o ? e[Ve] : s[0],
          r = o ? e.$val : e[n];
        if (!ce(r)) throw new Error(((e) => `Invalid value for key ${e}`)(n));
        const c = { keyId: ye(n), pattern: r };
        return i && (c.searcher = Re(r, t)), c;
      }
      let r = { children: [], operator: s[0] };
      return (
        s.forEach((t) => {
          const i = e[t];
          re(i) &&
            i.forEach((e) => {
              r.children.push(n(e));
            });
        }),
        r
      );
    };
    return Be(e) || (e = He(e)), n(e);
  }
  function qe(e, t) {
    const i = e.matches;
    (t.matches = []),
      le(i) &&
        i.forEach((e) => {
          if (!le(e.indices) || !e.indices.length) return;
          const { indices: i, value: n } = e;
          let s = { indices: i, value: n };
          e.key && (s.key = e.key.src), e.idx > -1 && (s.refIndex = e.idx), t.matches.push(s);
        });
  }
  function We(e, t) {
    t.score = e.score;
  }
  class Ue {
    constructor(e, t = {}, i) {
      (this.options = oe(oe({}, Ee), t)),
        (this._keyStore = new ge(this.options.keys)),
        this.setCollection(e, i);
    }
    setCollection(e, t) {
      if (((this._docs = e), t && !(t instanceof Se))) throw new Error("Incorrect 'index' type");
      this._myIndex =
        t ||
        we(this.options.keys, this._docs, {
          getFn: this.options.getFn,
          fieldNormWeight: this.options.fieldNormWeight,
        });
    }
    add(e) {
      le(e) && (this._docs.push(e), this._myIndex.add(e));
    }
    remove(e = () => !1) {
      const t = [];
      for (let i = 0, n = this._docs.length; i < n; i += 1) {
        const s = this._docs[i];
        e(s, i) && (this.removeAt(i), (i -= 1), (n -= 1), t.push(s));
      }
      return t;
    }
    removeAt(e) {
      this._docs.splice(e, 1), this._myIndex.removeAt(e);
    }
    getIndex() {
      return this._myIndex;
    }
    search(e, { limit: t = -1 } = {}) {
      const {
        includeMatches: i,
        includeScore: n,
        shouldSort: s,
        sortFn: o,
        ignoreFieldNorm: r,
      } = this.options;
      let c = ce(e)
        ? ce(this._docs[0])
          ? this._searchStringList(e)
          : this._searchObjectList(e)
        : this._searchLogical(e);
      return (
        (function (e, { ignoreFieldNorm: t = Ee.ignoreFieldNorm }) {
          e.forEach((e) => {
            let i = 1;
            e.matches.forEach(({ key: e, norm: n, score: s }) => {
              const o = e ? e.weight : null;
              i *= Math.pow(0 === s && o ? Number.EPSILON : s, (o || 1) * (t ? 1 : n));
            }),
              (e.score = i);
          });
        })(c, { ignoreFieldNorm: r }),
        s && c.sort(o),
        ae(t) && t > -1 && (c = c.slice(0, t)),
        (function (
          e,
          t,
          { includeMatches: i = Ee.includeMatches, includeScore: n = Ee.includeScore } = {}
        ) {
          const s = [];
          return (
            i && s.push(qe),
            n && s.push(We),
            e.map((e) => {
              const { idx: i } = e,
                n = { item: t[i], refIndex: i };
              return (
                s.length &&
                  s.forEach((t) => {
                    t(e, n);
                  }),
                n
              );
            })
          );
        })(c, this._docs, { includeMatches: i, includeScore: n })
      );
    }
    _searchStringList(e) {
      const t = Re(e, this.options),
        { records: i } = this._myIndex,
        n = [];
      return (
        i.forEach(({ v: e, i: i, n: s }) => {
          if (!le(e)) return;
          const { isMatch: o, score: r, indices: c } = t.searchIn(e);
          o && n.push({ item: e, idx: i, matches: [{ score: r, value: e, norm: s, indices: c }] });
        }),
        n
      );
    }
    _searchLogical(e) {
      const t = $e(e, this.options),
        i = (e, t, n) => {
          if (!e.children) {
            const { keyId: i, searcher: s } = e,
              o = this._findMatches({
                key: this._keyStore.get(i),
                value: this._myIndex.getValueForItemAtKeyId(t, i),
                searcher: s,
              });
            return o && o.length ? [{ idx: n, item: t, matches: o }] : [];
          }
          const s = [];
          for (let o = 0, r = e.children.length; o < r; o += 1) {
            const r = i(e.children[o], t, n);
            if (r.length) s.push(...r);
            else if (e.operator === Ke) return [];
          }
          return s;
        },
        n = {},
        s = [];
      return (
        this._myIndex.records.forEach(({ $: e, i: o }) => {
          if (le(e)) {
            let r = i(t, e, o);
            r.length &&
              (n[o] || ((n[o] = { idx: o, item: e, matches: [] }), s.push(n[o])),
              r.forEach(({ matches: e }) => {
                n[o].matches.push(...e);
              }));
          }
        }),
        s
      );
    }
    _searchObjectList(e) {
      const t = Re(e, this.options),
        { keys: i, records: n } = this._myIndex,
        s = [];
      return (
        n.forEach(({ $: e, i: n }) => {
          if (!le(e)) return;
          let o = [];
          i.forEach((i, n) => {
            o.push(...this._findMatches({ key: i, value: e[n], searcher: t }));
          }),
            o.length && s.push({ idx: n, item: e, matches: o });
        }),
        s
      );
    }
    _findMatches({ key: e, value: t, searcher: i }) {
      if (!le(t)) return [];
      let n = [];
      if (re(t))
        t.forEach(({ v: t, i: s, n: o }) => {
          if (!le(t)) return;
          const { isMatch: r, score: c, indices: a } = i.searchIn(t);
          r && n.push({ score: c, key: e, value: t, idx: s, norm: o, indices: a });
        });
      else {
        const { v: s, n: o } = t,
          { isMatch: r, score: c, indices: a } = i.searchIn(s);
        r && n.push({ score: c, key: e, value: s, norm: o, indices: a });
      }
      return n;
    }
  }
  (Ue.version = '7.0.0'),
    (Ue.createIndex = we),
    (Ue.parseIndex = function (
      e,
      { getFn: t = Ee.getFn, fieldNormWeight: i = Ee.fieldNormWeight } = {}
    ) {
      const { keys: n, records: s } = e,
        o = new Se({ getFn: t, fieldNormWeight: i });
      return o.setKeys(n), o.setIndexRecords(s), o;
    }),
    (Ue.config = Ee),
    (Ue.parseQuery = $e),
    (function (...e) {
      je.push(...e);
    })(
      class {
        constructor(
          e,
          {
            isCaseSensitive: t = Ee.isCaseSensitive,
            includeMatches: i = Ee.includeMatches,
            minMatchCharLength: n = Ee.minMatchCharLength,
            ignoreLocation: s = Ee.ignoreLocation,
            findAllMatches: o = Ee.findAllMatches,
            location: r = Ee.location,
            threshold: c = Ee.threshold,
            distance: a = Ee.distance,
          } = {}
        ) {
          (this.query = null),
            (this.options = {
              isCaseSensitive: t,
              includeMatches: i,
              minMatchCharLength: n,
              findAllMatches: o,
              ignoreLocation: s,
              location: r,
              threshold: c,
              distance: a,
            }),
            (this.pattern = t ? e : e.toLowerCase()),
            (this.query = (function (e, t = {}) {
              return e.split('|').map((e) => {
                let i = e
                    .trim()
                    .split(De)
                    .filter((e) => e && !!e.trim()),
                  n = [];
                for (let e = 0, s = i.length; e < s; e += 1) {
                  const s = i[e];
                  let o = !1,
                    r = -1;
                  for (; !o && ++r < Fe; ) {
                    const e = ke[r];
                    let i = e.isMultiMatch(s);
                    i && (n.push(new e(i, t)), (o = !0));
                  }
                  if (!o)
                    for (r = -1; ++r < Fe; ) {
                      const e = ke[r];
                      let i = e.isSingleMatch(s);
                      if (i) {
                        n.push(new e(i, t));
                        break;
                      }
                    }
                }
                return n;
              });
            })(this.pattern, this.options));
        }
        static condition(e, t) {
          return t.useExtendedSearch;
        }
        searchIn(e) {
          const t = this.query;
          if (!t) return { isMatch: !1, score: 1 };
          const { includeMatches: i, isCaseSensitive: n } = this.options;
          e = n ? e : e.toLowerCase();
          let s = 0,
            o = [],
            r = 0;
          for (let n = 0, c = t.length; n < c; n += 1) {
            const c = t[n];
            (o.length = 0), (s = 0);
            for (let t = 0, n = c.length; t < n; t += 1) {
              const n = c[t],
                { isMatch: a, indices: h, score: l } = n.search(e);
              if (!a) {
                (r = 0), (s = 0), (o.length = 0);
                break;
              }
              (s += 1),
                (r += l),
                i && (Pe.has(n.constructor.type) ? (o = [...o, ...h]) : o.push(h));
            }
            if (s) {
              let e = { isMatch: !0, score: r / s };
              return i && (e.indices = o), e;
            }
          }
          return { isMatch: !1, score: 1 };
        }
      }
    );
  var Ge = (function () {
      function e(e) {
        (this._haystack = []),
          (this._fuseOptions = i(i({}, e.fuseOptions), {
            keys: n([], e.searchFields, !0),
            includeMatches: !0,
          }));
      }
      return (
        (e.prototype.index = function (e) {
          (this._haystack = e), this._fuse && this._fuse.setCollection(e);
        }),
        (e.prototype.reset = function () {
          (this._haystack = []), (this._fuse = void 0);
        }),
        (e.prototype.isEmptyIndex = function () {
          return !this._haystack.length;
        }),
        (e.prototype.search = function (e) {
          return (
            this._fuse || (this._fuse = new Ue(this._haystack, this._fuseOptions)),
            this._fuse.search(e).map(function (e, t) {
              return { item: e.item, score: e.score || 0, rank: t + 1 };
            })
          );
        }),
        e
      );
    })(),
    ze = function (e, t, i) {
      var n = e.dataset,
        s = t.customProperties,
        o = t.labelClass,
        r = t.labelDescription;
      o && (n.labelClass = F(o).join(' ')),
        r && (n.labelDescription = r),
        i &&
          s &&
          ('string' == typeof s
            ? (n.customProperties = s)
            : 'object' != typeof s ||
              (function (e) {
                for (var t in e) if (Object.prototype.hasOwnProperty.call(e, t)) return !1;
                return !0;
              })(s) ||
              (n.customProperties = JSON.stringify(s)));
    },
    Je = function (e, t, i) {
      var n = t && e.querySelector("label[for='".concat(t, "']")),
        s = n && n.innerText;
      s && i.setAttribute('aria-label', s);
    },
    Xe = {
      containerOuter: function (e, t, i, n, s, o, r) {
        var c = e.classNames.containerOuter,
          a = document.createElement('div');
        return (
          P(a, c),
          (a.dataset.type = o),
          t && (a.dir = t),
          n && (a.tabIndex = 0),
          i &&
            (a.setAttribute('role', s ? 'combobox' : 'listbox'),
            s
              ? a.setAttribute('aria-autocomplete', 'list')
              : r || Je(this._docRoot, this.passedElement.element.id, a),
            a.setAttribute('aria-haspopup', 'true'),
            a.setAttribute('aria-expanded', 'false')),
          r && a.setAttribute('aria-labelledby', r),
          a
        );
      },
      containerInner: function (e) {
        var t = e.classNames.containerInner,
          i = document.createElement('div');
        return P(i, t), i;
      },
      itemList: function (e, t) {
        var i = e.searchEnabled,
          n = e.classNames,
          s = n.list,
          o = n.listSingle,
          r = n.listItems,
          c = document.createElement('div');
        return (
          P(c, s),
          P(c, t ? o : r),
          this._isSelectElement && i && c.setAttribute('role', 'listbox'),
          c
        );
      },
      placeholder: function (e, t) {
        var i = e.allowHTML,
          n = e.classNames.placeholder,
          s = document.createElement('div');
        return P(s, n), N(s, i, t), s;
      },
      item: function (e, t, i) {
        var n = e.allowHTML,
          s = e.removeItemButtonAlignLeft,
          o = e.removeItemIconText,
          r = e.removeItemLabelText,
          c = e.classNames,
          a = c.item,
          h = c.button,
          l = c.highlightedState,
          u = c.itemSelectable,
          d = c.placeholder,
          p = L(t.value),
          f = document.createElement('div');
        if ((P(f, a), t.labelClass)) {
          var m = document.createElement('span');
          N(m, n, t.label), P(m, t.labelClass), f.appendChild(m);
        } else N(f, n, t.label);
        if (
          ((f.dataset.item = ''),
          (f.dataset.id = t.id),
          (f.dataset.value = p),
          ze(f, t, !0),
          (t.disabled || this.containerOuter.isDisabled) && f.setAttribute('aria-disabled', 'true'),
          this._isSelectElement &&
            (f.setAttribute('aria-selected', 'true'), f.setAttribute('role', 'option')),
          t.placeholder && (P(f, d), (f.dataset.placeholder = '')),
          P(f, t.highlighted ? l : u),
          i)
        ) {
          t.disabled && j(f, u), (f.dataset.deletable = '');
          var g = document.createElement('button');
          (g.type = 'button'), P(g, h), N(g, !0, x(o, t.value));
          var v = x(r, t.value);
          v && g.setAttribute('aria-label', v),
            (g.dataset.button = ''),
            s ? f.insertAdjacentElement('afterbegin', g) : f.appendChild(g);
        }
        return f;
      },
      choiceList: function (e, t) {
        var i = e.classNames.list,
          n = document.createElement('div');
        return (
          P(n, i),
          t || n.setAttribute('aria-multiselectable', 'true'),
          n.setAttribute('role', 'listbox'),
          n
        );
      },
      choiceGroup: function (e, t) {
        var i = e.allowHTML,
          n = e.classNames,
          s = n.group,
          o = n.groupHeading,
          r = n.itemDisabled,
          c = t.id,
          a = t.label,
          h = t.disabled,
          l = L(a),
          u = document.createElement('div');
        P(u, s),
          h && P(u, r),
          u.setAttribute('role', 'group'),
          (u.dataset.group = ''),
          (u.dataset.id = c),
          (u.dataset.value = l),
          h && u.setAttribute('aria-disabled', 'true');
        var d = document.createElement('div');
        return P(d, o), N(d, i, a || ''), u.appendChild(d), u;
      },
      choice: function (e, t, i, n) {
        var s = e.allowHTML,
          o = e.classNames,
          r = o.item,
          c = o.itemChoice,
          a = o.itemSelectable,
          h = o.selectedState,
          l = o.itemDisabled,
          u = o.description,
          d = o.placeholder,
          p = t.label,
          f = L(t.value),
          m = document.createElement('div');
        (m.id = t.elementId),
          P(m, r),
          P(m, c),
          n &&
            'string' == typeof p &&
            ((p = T(s, p)), (p = { trusted: (p += ' ('.concat(n, ')')) }));
        var g = m;
        if (t.labelClass) {
          var v = document.createElement('span');
          N(v, s, p), P(v, t.labelClass), (g = v), m.appendChild(v);
        } else N(m, s, p);
        if (t.labelDescription) {
          var _ = ''.concat(t.elementId, '-description');
          g.setAttribute('aria-describedby', _);
          var y = document.createElement('span');
          N(y, s, t.labelDescription), (y.id = _), P(y, u), m.appendChild(y);
        }
        return (
          t.selected && P(m, h),
          t.placeholder && P(m, d),
          m.setAttribute('role', t.group ? 'treeitem' : 'option'),
          (m.dataset.choice = ''),
          (m.dataset.id = t.id),
          (m.dataset.value = f),
          i && (m.dataset.selectText = i),
          t.group && (m.dataset.groupId = ''.concat(t.group.id)),
          ze(m, t, !1),
          t.disabled
            ? (P(m, l), (m.dataset.choiceDisabled = ''), m.setAttribute('aria-disabled', 'true'))
            : (P(m, a), (m.dataset.choiceSelectable = '')),
          m
        );
      },
      input: function (e, t) {
        var i = e.classNames,
          n = i.input,
          s = i.inputCloned,
          o = e.labelId,
          r = document.createElement('input');
        return (
          (r.type = 'search'),
          P(r, n),
          P(r, s),
          (r.autocomplete = 'off'),
          (r.autocapitalize = 'off'),
          (r.spellcheck = !1),
          r.setAttribute('aria-autocomplete', 'list'),
          t
            ? r.setAttribute('aria-label', t)
            : o || Je(this._docRoot, this.passedElement.element.id, r),
          r
        );
      },
      dropdown: function (e) {
        var t = e.classNames,
          i = t.list,
          n = t.listDropdown,
          s = document.createElement('div');
        return P(s, i), P(s, n), s.setAttribute('aria-expanded', 'false'), s;
      },
      notice: function (e, t, i) {
        var n = e.classNames,
          s = n.item,
          o = n.itemChoice,
          r = n.addChoice,
          c = n.noResults,
          a = n.noChoices,
          h = n.notice;
        void 0 === i && (i = '');
        var l = document.createElement('div');
        switch ((N(l, !0, t), P(l, s), P(l, o), P(l, h), i)) {
          case ie:
            P(l, r);
            break;
          case te:
            P(l, c);
            break;
          case ee:
            P(l, a);
        }
        return i === ie && ((l.dataset.choiceSelectable = ''), (l.dataset.choice = '')), l;
      },
      option: function (e) {
        var t = L(e.label),
          i = new Option(t, e.value, !1, e.selected);
        return (
          ze(i, e, !0), (i.disabled = e.disabled), e.selected && i.setAttribute('selected', ''), i
        );
      },
    },
    Qe =
      '-ms-scroll-limit' in document.documentElement.style &&
      '-ms-ime-align' in document.documentElement.style,
    Ye = {},
    Ze = function (e) {
      if (e) return e.dataset.id ? parseInt(e.dataset.id, 10) : void 0;
    },
    et = '[data-choice-selectable]';
  return (function () {
    function e(t, n) {
      void 0 === t && (t = '[data-choice]'), void 0 === n && (n = {});
      var s = this;
      (this.initialisedOK = void 0),
        (this._hasNonChoicePlaceholder = !1),
        (this._lastAddedChoiceId = 0),
        (this._lastAddedGroupId = 0);
      var o = e.defaults;
      (this.config = i(i(i({}, o.allOptions), o.options), n)),
        v.forEach(function (e) {
          s.config[e] = i(i(i({}, o.allOptions[e]), o.options[e]), n[e]);
        });
      var r = this.config;
      r.silent || this._validateConfig();
      var c = r.shadowRoot || document.documentElement;
      this._docRoot = c;
      var a = 'string' == typeof t ? c.querySelector(t) : t;
      if (!a || 'object' != typeof a || ('INPUT' !== a.tagName && !z(a))) {
        if (!a && 'string' == typeof t)
          throw TypeError('Selector '.concat(t, ' failed to find an element'));
        throw TypeError('Expected one of the following types text|select-one|select-multiple');
      }
      var h = a.type,
        l = 'text' === h;
      (l || 1 !== r.maxItemCount) && (r.singleModeForMultiSelect = !1),
        r.singleModeForMultiSelect && (h = y);
      var u = h === _,
        d = h === y,
        p = u || d;
      if (
        ((this._elementType = h),
        (this._isTextElement = l),
        (this._isSelectOneElement = u),
        (this._isSelectMultipleElement = d),
        (this._isSelectElement = u || d),
        (this._canAddUserChoices = (l && r.addItems) || (p && r.addChoices)),
        'boolean' != typeof r.renderSelectedChoices &&
          (r.renderSelectedChoices = 'always' === r.renderSelectedChoices || u),
        (r.closeDropdownOnSelect =
          'auto' === r.closeDropdownOnSelect
            ? l || u || r.singleModeForMultiSelect
            : W(r.closeDropdownOnSelect)),
        r.placeholder &&
          (r.placeholderValue
            ? (this._hasNonChoicePlaceholder = !0)
            : a.dataset.placeholder &&
              ((this._hasNonChoicePlaceholder = !0), (r.placeholderValue = a.dataset.placeholder))),
        n.addItemFilter && 'function' != typeof n.addItemFilter)
      ) {
        var f = n.addItemFilter instanceof RegExp ? n.addItemFilter : new RegExp(n.addItemFilter);
        r.addItemFilter = f.test.bind(f);
      }
      if (
        ((this.passedElement = this._isTextElement
          ? new q({ element: a, classNames: r.classNames })
          : new J({
              element: a,
              classNames: r.classNames,
              template: function (e) {
                return s._templates.option(e);
              },
              extractPlaceholder: r.placeholder && !this._hasNonChoicePlaceholder,
            })),
        (this.initialised = !1),
        (this._store = new Z(r)),
        (this._currentValue = ''),
        (r.searchEnabled = (!l && r.searchEnabled) || d),
        (this._canSearch = r.searchEnabled),
        (this._isScrollingOnIe = !1),
        (this._highlightPosition = 0),
        (this._wasTap = !0),
        (this._placeholderValue = this._generatePlaceholderValue()),
        (this._baseId = (function (e) {
          var t = e.id || (e.name && ''.concat(e.name, '-').concat(w(2))) || w(4);
          return (t = t.replace(/(:|\.|\[|\]|,)/g, '')), ''.concat('choices-', '-').concat(t);
        })(a)),
        (this._direction = a.dir),
        !this._direction)
      ) {
        var m = window.getComputedStyle(a).direction;
        m !== window.getComputedStyle(document.documentElement).direction && (this._direction = m);
      }
      if (
        ((this._idNames = { itemChoice: 'item-choice' }),
        (this._templates = o.templates),
        (this._render = this._render.bind(this)),
        (this._onFocus = this._onFocus.bind(this)),
        (this._onBlur = this._onBlur.bind(this)),
        (this._onKeyUp = this._onKeyUp.bind(this)),
        (this._onKeyDown = this._onKeyDown.bind(this)),
        (this._onInput = this._onInput.bind(this)),
        (this._onClick = this._onClick.bind(this)),
        (this._onTouchMove = this._onTouchMove.bind(this)),
        (this._onTouchEnd = this._onTouchEnd.bind(this)),
        (this._onMouseDown = this._onMouseDown.bind(this)),
        (this._onMouseOver = this._onMouseOver.bind(this)),
        (this._onFormReset = this._onFormReset.bind(this)),
        (this._onSelectKey = this._onSelectKey.bind(this)),
        (this._onEnterKey = this._onEnterKey.bind(this)),
        (this._onEscapeKey = this._onEscapeKey.bind(this)),
        (this._onDirectionKey = this._onDirectionKey.bind(this)),
        (this._onDeleteKey = this._onDeleteKey.bind(this)),
        this.passedElement.isActive)
      )
        return (
          r.silent ||
            console.warn('Trying to initialise Choices on element already initialised', {
              element: t,
            }),
          (this.initialised = !0),
          void (this.initialisedOK = !1)
        );
      this.init(),
        (this._initialItems = this._store.items.map(function (e) {
          return e.value;
        }));
    }
    return (
      Object.defineProperty(e, 'defaults', {
        get: function () {
          return Object.preventExtensions({
            get options() {
              return Ye;
            },
            get allOptions() {
              return X;
            },
            get templates() {
              return Xe;
            },
          });
        },
        enumerable: !1,
        configurable: !0,
      }),
      (e.prototype.init = function () {
        if (!this.initialised && void 0 === this.initialisedOK) {
          (this._searcher = new Ge(this.config)),
            this._loadChoices(),
            this._createTemplates(),
            this._createElements(),
            this._createStructure(),
            (this._isTextElement && !this.config.addItems) ||
            this.passedElement.element.hasAttribute('disabled') ||
            this.passedElement.element.closest('fieldset:disabled')
              ? this.disable()
              : (this.enable(), this._addEventListeners()),
            this._initStore(),
            (this.initialised = !0),
            (this.initialisedOK = !0);
          var e = this.config.callbackOnInit;
          'function' == typeof e && e.call(this);
        }
      }),
      (e.prototype.destroy = function () {
        this.initialised &&
          (this._removeEventListeners(),
          this.passedElement.reveal(),
          this.containerOuter.unwrap(this.passedElement.element),
          (this._store._listeners = []),
          this.clearStore(!1),
          this._stopSearch(),
          (this._templates = e.defaults.templates),
          (this.initialised = !1),
          (this.initialisedOK = void 0));
      }),
      (e.prototype.enable = function () {
        return (
          this.passedElement.isDisabled && this.passedElement.enable(),
          this.containerOuter.isDisabled &&
            (this._addEventListeners(), this.input.enable(), this.containerOuter.enable()),
          this
        );
      }),
      (e.prototype.disable = function () {
        return (
          this.passedElement.isDisabled || this.passedElement.disable(),
          this.containerOuter.isDisabled ||
            (this._removeEventListeners(), this.input.disable(), this.containerOuter.disable()),
          this
        );
      }),
      (e.prototype.highlightItem = function (e, t) {
        if ((void 0 === t && (t = !0), !e || !e.id)) return this;
        var i = this._store.items.find(function (t) {
          return t.id === e.id;
        });
        return (
          !i ||
            i.highlighted ||
            (this._store.dispatch(S(i, !0)),
            t && this.passedElement.triggerEvent(g, this._getChoiceForOutput(i))),
          this
        );
      }),
      (e.prototype.unhighlightItem = function (e, t) {
        if ((void 0 === t && (t = !0), !e || !e.id)) return this;
        var i = this._store.items.find(function (t) {
          return t.id === e.id;
        });
        return i && i.highlighted
          ? (this._store.dispatch(S(i, !1)),
            t && this.passedElement.triggerEvent('unhighlightItem', this._getChoiceForOutput(i)),
            this)
          : this;
      }),
      (e.prototype.highlightAll = function () {
        var e = this;
        return (
          this._store.withTxn(function () {
            e._store.items.forEach(function (t) {
              t.highlighted ||
                (e._store.dispatch(S(t, !0)),
                e.passedElement.triggerEvent(g, e._getChoiceForOutput(t)));
            });
          }),
          this
        );
      }),
      (e.prototype.unhighlightAll = function () {
        var e = this;
        return (
          this._store.withTxn(function () {
            e._store.items.forEach(function (t) {
              t.highlighted &&
                (e._store.dispatch(S(t, !1)),
                e.passedElement.triggerEvent(g, e._getChoiceForOutput(t)));
            });
          }),
          this
        );
      }),
      (e.prototype.removeActiveItemsByValue = function (e) {
        var t = this;
        return (
          this._store.withTxn(function () {
            t._store.items
              .filter(function (t) {
                return t.value === e;
              })
              .forEach(function (e) {
                return t._removeItem(e);
              });
          }),
          this
        );
      }),
      (e.prototype.removeActiveItems = function (e) {
        var t = this;
        return (
          this._store.withTxn(function () {
            t._store.items
              .filter(function (t) {
                return t.id !== e;
              })
              .forEach(function (e) {
                return t._removeItem(e);
              });
          }),
          this
        );
      }),
      (e.prototype.removeHighlightedItems = function (e) {
        var t = this;
        return (
          void 0 === e && (e = !1),
          this._store.withTxn(function () {
            t._store.highlightedActiveItems.forEach(function (i) {
              t._removeItem(i), e && t._triggerChange(i.value);
            });
          }),
          this
        );
      }),
      (e.prototype.showDropdown = function (e) {
        var t = this;
        return (
          this.dropdown.isActive ||
            (void 0 === e && (e = !this._canSearch),
            requestAnimationFrame(function () {
              t.dropdown.show();
              var i = t.dropdown.element.getBoundingClientRect();
              t.containerOuter.open(i.bottom, i.height),
                e || t.input.focus(),
                t.passedElement.triggerEvent('showDropdown');
            })),
          this
        );
      }),
      (e.prototype.hideDropdown = function (e) {
        var t = this;
        return this.dropdown.isActive
          ? (requestAnimationFrame(function () {
              t.dropdown.hide(),
                t.containerOuter.close(),
                !e && t._canSearch && (t.input.removeActiveDescendant(), t.input.blur()),
                t.passedElement.triggerEvent('hideDropdown');
            }),
            this)
          : this;
      }),
      (e.prototype.getValue = function (e) {
        var t = this,
          i = this._store.items.map(function (i) {
            return e ? i.value : t._getChoiceForOutput(i);
          });
        return this._isSelectOneElement || this.config.singleModeForMultiSelect ? i[0] : i;
      }),
      (e.prototype.setValue = function (e) {
        var t = this;
        return this.initialisedOK
          ? (this._store.withTxn(function () {
              e.forEach(function (e) {
                e && t._addChoice(G(e, !1));
              });
            }),
            this._searcher.reset(),
            this)
          : (this._warnChoicesInitFailed('setValue'), this);
      }),
      (e.prototype.setChoiceByValue = function (e) {
        var t = this;
        return this.initialisedOK
          ? (this._isTextElement ||
              (this._store.withTxn(function () {
                (Array.isArray(e) ? e : [e]).forEach(function (e) {
                  return t._findAndSelectChoiceByValue(e);
                }),
                  t.unhighlightAll();
              }),
              this._searcher.reset()),
            this)
          : (this._warnChoicesInitFailed('setChoiceByValue'), this);
      }),
      (e.prototype.setChoices = function (e, t, n, s, o, r) {
        var c = this;
        if (
          (void 0 === e && (e = []),
          void 0 === t && (t = 'value'),
          void 0 === n && (n = 'label'),
          void 0 === s && (s = !1),
          void 0 === o && (o = !0),
          void 0 === r && (r = !1),
          !this.initialisedOK)
        )
          return this._warnChoicesInitFailed('setChoices'), this;
        if (!this._isSelectElement)
          throw new TypeError("setChoices can't be used with INPUT based Choices");
        if ('string' != typeof t || !t)
          throw new TypeError("value parameter must be a name of 'value' field in passed objects");
        if ('function' == typeof e) {
          var a = e(this);
          if ('function' == typeof Promise && a instanceof Promise)
            return new Promise(function (e) {
              return requestAnimationFrame(e);
            })
              .then(function () {
                return c._handleLoadingState(!0);
              })
              .then(function () {
                return a;
              })
              .then(function (e) {
                return c.setChoices(e, t, n, s, o, r);
              })
              .catch(function (e) {
                c.config.silent || console.error(e);
              })
              .then(function () {
                return c._handleLoadingState(!1);
              })
              .then(function () {
                return c;
              });
          if (!Array.isArray(a))
            throw new TypeError(
              '.setChoices first argument function must return either array of choices or Promise, got: '.concat(
                typeof a
              )
            );
          return this.setChoices(a, t, n, !1);
        }
        if (!Array.isArray(e))
          throw new TypeError(
            '.setChoices must be called either with array of choices with a function resulting into Promise of array of choices'
          );
        return (
          this.containerOuter.removeLoadingState(),
          this._store.withTxn(function () {
            o && (c._isSearching = !1), s && c.clearChoices(!0, r);
            var a = 'value' === t,
              h = 'label' === n;
            e.forEach(function (e) {
              if ('choices' in e) {
                var s = e;
                h || (s = i(i({}, s), { label: s[n] })), c._addGroup(G(s, !0));
              } else {
                var o = e;
                (h && a) || (o = i(i({}, o), { value: o[t], label: o[n] }));
                var r = G(o, !1);
                c._addChoice(r),
                  r.placeholder &&
                    !c._hasNonChoicePlaceholder &&
                    (c._placeholderValue = M(r.label));
              }
            }),
              c.unhighlightAll();
          }),
          this._searcher.reset(),
          this
        );
      }),
      (e.prototype.refresh = function (e, t, i) {
        var n = this;
        return (
          void 0 === e && (e = !1),
          void 0 === t && (t = !1),
          void 0 === i && (i = !1),
          this._isSelectElement
            ? (this._store.withTxn(function () {
                var s = n.passedElement.optionsAsChoices(),
                  o = {};
                i ||
                  n._store.items.forEach(function (e) {
                    e.id && e.active && e.selected && (o[e.value] = !0);
                  }),
                  n.clearStore(!1);
                var r = function (e) {
                  i ? n._store.dispatch(C(e)) : o[e.value] && (e.selected = !0);
                };
                s.forEach(function (e) {
                  'choices' in e ? e.choices.forEach(r) : r(e);
                }),
                  n._addPredefinedChoices(s, t, e),
                  n._isSearching && n._searchChoices(n.input.value);
              }),
              this)
            : (this.config.silent ||
                console.warn(
                  'refresh method can only be used on choices backed by a <select> element'
                ),
              this)
        );
      }),
      (e.prototype.removeChoice = function (e) {
        var t = this._store.choices.find(function (t) {
          return t.value === e;
        });
        return t
          ? (this._clearNotice(),
            this._store.dispatch(
              (function (e) {
                return { type: r, choice: e };
              })(t)
            ),
            this._searcher.reset(),
            t.selected && this.passedElement.triggerEvent(m, this._getChoiceForOutput(t)),
            this)
          : this;
      }),
      (e.prototype.clearChoices = function (e, t) {
        var i = this;
        return (
          void 0 === e && (e = !0),
          void 0 === t && (t = !1),
          e &&
            (t
              ? this.passedElement.element.replaceChildren('')
              : this.passedElement.element
                  .querySelectorAll(':not([selected])')
                  .forEach(function (e) {
                    e.remove();
                  })),
          this.itemList.element.replaceChildren(''),
          this.choiceList.element.replaceChildren(''),
          this._clearNotice(),
          this._store.withTxn(function () {
            var e = t ? [] : i._store.items;
            i._store.reset(),
              e.forEach(function (e) {
                i._store.dispatch(b(e)), i._store.dispatch(E(e));
              });
          }),
          this._searcher.reset(),
          this
        );
      }),
      (e.prototype.clearStore = function (e) {
        return (
          void 0 === e && (e = !0),
          this.clearChoices(e, !0),
          this._stopSearch(),
          (this._lastAddedChoiceId = 0),
          (this._lastAddedGroupId = 0),
          this
        );
      }),
      (e.prototype.clearInput = function () {
        return this.input.clear(!this._isSelectOneElement), this._stopSearch(), this;
      }),
      (e.prototype._validateConfig = function () {
        var e,
          t,
          i,
          n = this.config,
          s =
            ((e = X),
            (t = Object.keys(n).sort()),
            (i = Object.keys(e).sort()),
            t.filter(function (e) {
              return i.indexOf(e) < 0;
            }));
        s.length && console.warn('Unknown config option(s) passed', s.join(', ')),
          n.allowHTML &&
            n.allowHtmlUserInput &&
            (n.addItems &&
              console.warn(
                'Warning: allowHTML/allowHtmlUserInput/addItems all being true is strongly not recommended and may lead to XSS attacks'
              ),
            n.addChoices &&
              console.warn(
                'Warning: allowHTML/allowHtmlUserInput/addChoices all being true is strongly not recommended and may lead to XSS attacks'
              ));
      }),
      (e.prototype._render = function (e) {
        void 0 === e && (e = { choices: !0, groups: !0, items: !0 }),
          this._store.inTxn() ||
            (this._isSelectElement && (e.choices || e.groups) && this._renderChoices(),
            e.items && this._renderItems());
      }),
      (e.prototype._renderChoices = function () {
        var e = this;
        if (this._canAddItems()) {
          var t = this.config,
            i = this._isSearching,
            n = this._store,
            s = n.activeGroups,
            o = n.activeChoices,
            r = 0;
          if (
            (i && t.searchResultLimit > 0
              ? (r = t.searchResultLimit)
              : t.renderChoiceLimit > 0 && (r = t.renderChoiceLimit),
            this._isSelectElement)
          ) {
            var c = o.filter(function (e) {
              return !e.element;
            });
            c.length && this.passedElement.addOptions(c);
          }
          var a = document.createDocumentFragment(),
            h = function (e) {
              return e.filter(function (e) {
                return !e.placeholder && (i ? !!e.rank : t.renderSelectedChoices || !e.selected);
              });
            },
            l = !1,
            u = function (n, s, o) {
              i ? n.sort(k) : t.shouldSort && n.sort(t.sorter);
              var c = n.length;
              (c = !s && r && c > r ? r : c),
                c--,
                n.every(function (n, s) {
                  var r = n.choiceEl || e._templates.choice(t, n, t.itemSelectText, o);
                  return (n.choiceEl = r), a.appendChild(r), (!i && n.selected) || (l = !0), s < c;
                });
            };
          o.length &&
            (t.resetScrollPosition &&
              requestAnimationFrame(function () {
                return e.choiceList.scrollToTop();
              }),
            this._hasNonChoicePlaceholder ||
              i ||
              !this._isSelectOneElement ||
              u(
                o.filter(function (e) {
                  return e.placeholder && !e.group;
                }),
                !1,
                void 0
              ),
            s.length && !i
              ? (t.shouldSort && s.sort(t.sorter),
                u(
                  o.filter(function (e) {
                    return !e.placeholder && !e.group;
                  }),
                  !1,
                  void 0
                ),
                s.forEach(function (n) {
                  var s = h(n.choices);
                  if (s.length) {
                    if (n.label) {
                      var o = n.groupEl || e._templates.choiceGroup(e.config, n);
                      (n.groupEl = o), o.remove(), a.appendChild(o);
                    }
                    u(s, !0, t.appendGroupInSearch && i ? n.label : void 0);
                  }
                }))
              : u(h(o), !1, void 0)),
            l ||
              (!i && a.children.length && t.renderSelectedChoices) ||
              (this._notice ||
                (this._notice = {
                  text: O(i ? t.noResultsText : t.noChoicesText),
                  type: i ? te : ee,
                }),
              a.replaceChildren('')),
            this._renderNotice(a),
            this.choiceList.element.replaceChildren(a),
            l && this._highlightChoice();
        }
      }),
      (e.prototype._renderItems = function () {
        var e = this,
          t = this._store.items || [],
          i = this.itemList.element,
          n = this.config,
          s = document.createDocumentFragment(),
          o = function (e) {
            return i.querySelector('[data-item][data-id="'.concat(e.id, '"]'));
          },
          r = function (t) {
            var i = t.itemEl;
            (i && i.parentElement) ||
              ((i = o(t) || e._templates.item(n, t, n.removeItemButton)),
              (t.itemEl = i),
              s.appendChild(i));
          };
        t.forEach(r);
        var c = !!s.childNodes.length;
        if (this._isSelectOneElement) {
          var a = i.children.length;
          if (c || a > 1) {
            var h = i.querySelector(D(n.classNames.placeholder));
            h && h.remove();
          } else
            c ||
              a ||
              !this._placeholderValue ||
              ((c = !0),
              r(
                G({ selected: !0, value: '', label: this._placeholderValue, placeholder: !0 }, !1)
              ));
        }
        c &&
          (i.append(s),
          n.shouldSortItems &&
            !this._isSelectOneElement &&
            (t.sort(n.sorter),
            t.forEach(function (e) {
              var t = o(e);
              t && (t.remove(), s.append(t));
            }),
            i.append(s))),
          this._isTextElement &&
            (this.passedElement.value = t
              .map(function (e) {
                return e.value;
              })
              .join(n.delimiter));
      }),
      (e.prototype._displayNotice = function (e, t, i) {
        void 0 === i && (i = !0);
        var n = this._notice;
        n && ((n.type === t && n.text === e) || (n.type === ie && (t === te || t === ee)))
          ? i && this.showDropdown(!0)
          : (this._clearNotice(),
            (this._notice = e ? { text: e, type: t } : void 0),
            this._renderNotice(),
            i && e && this.showDropdown(!0));
      }),
      (e.prototype._clearNotice = function () {
        if (this._notice) {
          var e = this.choiceList.element.querySelector(D(this.config.classNames.notice));
          e && e.remove(), (this._notice = void 0);
        }
      }),
      (e.prototype._renderNotice = function (e) {
        var t = this._notice;
        if (t) {
          var i = this._templates.notice(this.config, t.text, t.type);
          e ? e.append(i) : this.choiceList.prepend(i);
        }
      }),
      (e.prototype._getChoiceForOutput = function (e, t) {
        return {
          id: e.id,
          highlighted: e.highlighted,
          labelClass: e.labelClass,
          labelDescription: e.labelDescription,
          customProperties: e.customProperties,
          disabled: e.disabled,
          active: e.active,
          label: e.label,
          placeholder: e.placeholder,
          value: e.value,
          groupValue: e.group ? e.group.label : void 0,
          element: e.element,
          keyCode: t,
        };
      }),
      (e.prototype._triggerChange = function (e) {
        null != e && this.passedElement.triggerEvent('change', { value: e });
      }),
      (e.prototype._handleButtonAction = function (e) {
        var t = this,
          i = this._store.items;
        if (i.length && this.config.removeItems && this.config.removeItemButton) {
          var n = e && Ze(e.parentElement),
            s =
              n &&
              i.find(function (e) {
                return e.id === n;
              });
          s &&
            this._store.withTxn(function () {
              if (
                (t._removeItem(s),
                t._triggerChange(s.value),
                t._isSelectOneElement && !t._hasNonChoicePlaceholder)
              ) {
                var e = (t.config.shouldSort ? t._store.choices.reverse() : t._store.choices).find(
                  function (e) {
                    return e.placeholder;
                  }
                );
                e && (t._addItem(e), t.unhighlightAll(), e.value && t._triggerChange(e.value));
              }
            });
        }
      }),
      (e.prototype._handleItemAction = function (e, t) {
        var i = this;
        void 0 === t && (t = !1);
        var n = this._store.items;
        if (n.length && this.config.removeItems && !this._isSelectOneElement) {
          var s = Ze(e);
          s &&
            (n.forEach(function (e) {
              e.id !== s || e.highlighted
                ? !t && e.highlighted && i.unhighlightItem(e)
                : i.highlightItem(e);
            }),
            this.input.focus());
        }
      }),
      (e.prototype._handleChoiceAction = function (e) {
        var t = this,
          i = Ze(e),
          n = i && this._store.getChoiceById(i);
        if (!n || n.disabled) return !1;
        var s = this.dropdown.isActive;
        if (!n.selected) {
          if (!this._canAddItems()) return !0;
          this._store.withTxn(function () {
            t._addItem(n, !0, !0), t.clearInput(), t.unhighlightAll();
          }),
            this._triggerChange(n.value);
        }
        return (
          s &&
            this.config.closeDropdownOnSelect &&
            (this.hideDropdown(!0), this.containerOuter.element.focus()),
          !0
        );
      }),
      (e.prototype._handleBackspace = function (e) {
        var t = this.config;
        if (t.removeItems && e.length) {
          var i = e[e.length - 1],
            n = e.some(function (e) {
              return e.highlighted;
            });
          t.editItems && !n && i
            ? ((this.input.value = i.value),
              this.input.setWidth(),
              this._removeItem(i),
              this._triggerChange(i.value))
            : (n || this.highlightItem(i, !1), this.removeHighlightedItems(!0));
        }
      }),
      (e.prototype._loadChoices = function () {
        var e,
          t = this,
          i = this.config;
        if (this._isTextElement) {
          if (
            ((this._presetChoices = i.items.map(function (e) {
              return G(e, !1);
            })),
            this.passedElement.value)
          ) {
            var n = this.passedElement.value.split(i.delimiter).map(function (e) {
              return G(e, !1, t.config.allowHtmlUserInput);
            });
            this._presetChoices = this._presetChoices.concat(n);
          }
          this._presetChoices.forEach(function (e) {
            e.selected = !0;
          });
        } else if (this._isSelectElement) {
          this._presetChoices = i.choices.map(function (e) {
            return G(e, !0);
          });
          var s = this.passedElement.optionsAsChoices();
          s && (e = this._presetChoices).push.apply(e, s);
        }
      }),
      (e.prototype._handleLoadingState = function (e) {
        void 0 === e && (e = !0);
        var t = this.itemList.element;
        e
          ? (this.disable(),
            this.containerOuter.addLoadingState(),
            this._isSelectOneElement
              ? t.replaceChildren(this._templates.placeholder(this.config, this.config.loadingText))
              : (this.input.placeholder = this.config.loadingText))
          : (this.enable(),
            this.containerOuter.removeLoadingState(),
            this._isSelectOneElement
              ? (t.replaceChildren(''), this._render())
              : (this.input.placeholder = this._placeholderValue || ''));
      }),
      (e.prototype._handleSearch = function (e) {
        if (this.input.isFocussed)
          if (null != e && e.length >= this.config.searchFloor) {
            var t = this.config.searchChoices ? this._searchChoices(e) : 0;
            null !== t && this.passedElement.triggerEvent(f, { value: e, resultCount: t });
          } else
            this._store.choices.some(function (e) {
              return !e.active;
            }) && this._stopSearch();
      }),
      (e.prototype._canAddItems = function () {
        var e = this.config,
          t = e.maxItemCount,
          i = e.maxItemText;
        return !e.singleModeForMultiSelect && t > 0 && t <= this._store.items.length
          ? (this.choiceList.element.replaceChildren(''),
            (this._notice = void 0),
            this._displayNotice('function' == typeof i ? i(t) : i, ie),
            !1)
          : (this._notice && this._notice.type === ie && this._clearNotice(), !0);
      }),
      (e.prototype._canCreateItem = function (e) {
        var t = this.config,
          i = !0,
          n = '';
        if (
          (i &&
            'function' == typeof t.addItemFilter &&
            !t.addItemFilter(e) &&
            ((i = !1), (n = x(t.customAddItemText, e))),
          i &&
            this._store.choices.find(function (i) {
              return t.valueComparer(i.value, e);
            }))
        ) {
          if (this._isSelectElement) return this._displayNotice('', ie), !1;
          t.duplicateItemsAllowed || ((i = !1), (n = x(t.uniqueItemText, e)));
        }
        return i && (n = x(t.addItemText, e)), n && this._displayNotice(n, ie), i;
      }),
      (e.prototype._searchChoices = function (e) {
        var t = e.trim().replace(/\s{2,}/, ' ');
        if (!t.length || t === this._currentValue) return null;
        var i = this._searcher;
        i.isEmptyIndex() && i.index(this._store.searchableChoices);
        var n = i.search(t);
        (this._currentValue = t), (this._highlightPosition = 0), (this._isSearching = !0);
        var s = this._notice;
        return (
          (s && s.type) !== ie &&
            (n.length
              ? this._clearNotice()
              : this._displayNotice(O(this.config.noResultsText), te)),
          this._store.dispatch(
            (function (e) {
              return { type: c, results: e };
            })(n)
          ),
          n.length
        );
      }),
      (e.prototype._stopSearch = function () {
        this._isSearching &&
          ((this._currentValue = ''),
          (this._isSearching = !1),
          this._clearNotice(),
          this._store.dispatch({ type: a, active: !0 }),
          this.passedElement.triggerEvent(f, { value: '', resultCount: 0 }));
      }),
      (e.prototype._addEventListeners = function () {
        var e = this._docRoot,
          t = this.containerOuter.element,
          i = this.input.element;
        e.addEventListener('touchend', this._onTouchEnd, !0),
          t.addEventListener('keydown', this._onKeyDown, !0),
          t.addEventListener('mousedown', this._onMouseDown, !0),
          e.addEventListener('click', this._onClick, { passive: !0 }),
          e.addEventListener('touchmove', this._onTouchMove, { passive: !0 }),
          this.dropdown.element.addEventListener('mouseover', this._onMouseOver, { passive: !0 }),
          this._isSelectOneElement &&
            (t.addEventListener('focus', this._onFocus, { passive: !0 }),
            t.addEventListener('blur', this._onBlur, { passive: !0 })),
          i.addEventListener('keyup', this._onKeyUp, { passive: !0 }),
          i.addEventListener('input', this._onInput, { passive: !0 }),
          i.addEventListener('focus', this._onFocus, { passive: !0 }),
          i.addEventListener('blur', this._onBlur, { passive: !0 }),
          i.form && i.form.addEventListener('reset', this._onFormReset, { passive: !0 }),
          this.input.addEventListeners();
      }),
      (e.prototype._removeEventListeners = function () {
        var e = this._docRoot,
          t = this.containerOuter.element,
          i = this.input.element;
        e.removeEventListener('touchend', this._onTouchEnd, !0),
          t.removeEventListener('keydown', this._onKeyDown, !0),
          t.removeEventListener('mousedown', this._onMouseDown, !0),
          e.removeEventListener('click', this._onClick),
          e.removeEventListener('touchmove', this._onTouchMove),
          this.dropdown.element.removeEventListener('mouseover', this._onMouseOver),
          this._isSelectOneElement &&
            (t.removeEventListener('focus', this._onFocus),
            t.removeEventListener('blur', this._onBlur)),
          i.removeEventListener('keyup', this._onKeyUp),
          i.removeEventListener('input', this._onInput),
          i.removeEventListener('focus', this._onFocus),
          i.removeEventListener('blur', this._onBlur),
          i.form && i.form.removeEventListener('reset', this._onFormReset),
          this.input.removeEventListeners();
      }),
      (e.prototype._onKeyDown = function (e) {
        var t = e.keyCode,
          i = this.dropdown.isActive,
          n =
            1 === e.key.length ||
            (2 === e.key.length && e.key.charCodeAt(0) >= 55296) ||
            'Unidentified' === e.key;
        switch (
          (this._isTextElement ||
            i ||
            27 === t ||
            9 === t ||
            16 === t ||
            (this.showDropdown(),
            !this.input.isFocussed &&
              n &&
              ((this.input.value += e.key), ' ' === e.key && e.preventDefault())),
          t)
        ) {
          case 65:
            return this._onSelectKey(e, this.itemList.element.hasChildNodes());
          case 13:
            return this._onEnterKey(e, i);
          case 27:
            return this._onEscapeKey(e, i);
          case 38:
          case 33:
          case 40:
          case 34:
            return this._onDirectionKey(e, i);
          case 8:
          case 46:
            return this._onDeleteKey(e, this._store.items, this.input.isFocussed);
        }
      }),
      (e.prototype._onKeyUp = function () {
        this._canSearch = this.config.searchEnabled;
      }),
      (e.prototype._onInput = function () {
        var e = this.input.value;
        e
          ? this._canAddItems() &&
            (this._canSearch && this._handleSearch(e),
            this._canAddUserChoices &&
              (this._canCreateItem(e),
              this._isSelectElement && ((this._highlightPosition = 0), this._highlightChoice())))
          : this._isTextElement
          ? this.hideDropdown(!0)
          : this._stopSearch();
      }),
      (e.prototype._onSelectKey = function (e, t) {
        (e.ctrlKey || e.metaKey) &&
          t &&
          ((this._canSearch = !1),
          this.config.removeItems &&
            !this.input.value &&
            this.input.element === document.activeElement &&
            this.highlightAll());
      }),
      (e.prototype._onEnterKey = function (e, t) {
        var i = this,
          n = this.input.value,
          s = e.target;
        if ((e.preventDefault(), s && s.hasAttribute('data-button'))) this._handleButtonAction(s);
        else if (t) {
          var o = this.dropdown.element.querySelector(D(this.config.classNames.highlightedState));
          if (!o || !this._handleChoiceAction(o))
            if (s && n) {
              if (this._canAddItems()) {
                var r = !1;
                this._store.withTxn(function () {
                  if (!(r = i._findAndSelectChoiceByValue(n, !0))) {
                    if (!i._canAddUserChoices) return;
                    if (!i._canCreateItem(n)) return;
                    i._addChoice(G(n, !1, i.config.allowHtmlUserInput), !0, !0), (r = !0);
                  }
                  i.clearInput(), i.unhighlightAll();
                }),
                  r &&
                    (this._triggerChange(n),
                    this.config.closeDropdownOnSelect && this.hideDropdown(!0));
              }
            } else this.hideDropdown(!0);
        } else (this._isSelectElement || this._notice) && this.showDropdown();
      }),
      (e.prototype._onEscapeKey = function (e, t) {
        t &&
          (e.stopPropagation(),
          this.hideDropdown(!0),
          this._stopSearch(),
          this.containerOuter.element.focus());
      }),
      (e.prototype._onDirectionKey = function (e, t) {
        var i,
          n,
          s,
          o = e.keyCode;
        if (t || this._isSelectOneElement) {
          this.showDropdown(), (this._canSearch = !1);
          var r = 40 === o || 34 === o ? 1 : -1,
            c = void 0;
          if (e.metaKey || 34 === o || 33 === o)
            c = this.dropdown.element.querySelector(r > 0 ? ''.concat(et, ':last-of-type') : et);
          else {
            var a = this.dropdown.element.querySelector(D(this.config.classNames.highlightedState));
            c = a
              ? (function (e, t, i) {
                  void 0 === i && (i = 1);
                  for (
                    var n = ''.concat(i > 0 ? 'next' : 'previous', 'ElementSibling'), s = e[n];
                    s;

                  ) {
                    if (s.matches(t)) return s;
                    s = s[n];
                  }
                  return null;
                })(a, et, r)
              : this.dropdown.element.querySelector(et);
          }
          c &&
            ((i = c),
            (n = this.choiceList.element),
            void 0 === (s = r) && (s = 1),
            (s > 0
              ? n.scrollTop + n.offsetHeight >= i.offsetTop + i.offsetHeight
              : i.offsetTop >= n.scrollTop) || this.choiceList.scrollToChildElement(c, r),
            this._highlightChoice(c)),
            e.preventDefault();
        }
      }),
      (e.prototype._onDeleteKey = function (e, t, i) {
        this._isSelectOneElement ||
          e.target.value ||
          !i ||
          (this._handleBackspace(t), e.preventDefault());
      }),
      (e.prototype._onTouchMove = function () {
        this._wasTap && (this._wasTap = !1);
      }),
      (e.prototype._onTouchEnd = function (e) {
        var t = (e || e.touches[0]).target;
        this._wasTap &&
          this.containerOuter.element.contains(t) &&
          ((t === this.containerOuter.element || t === this.containerInner.element) &&
            (this._isTextElement
              ? this.input.focus()
              : this._isSelectMultipleElement && this.showDropdown()),
          e.stopPropagation()),
          (this._wasTap = !0);
      }),
      (e.prototype._onMouseDown = function (e) {
        var t = e.target;
        if (t instanceof HTMLElement) {
          if (Qe && this.choiceList.element.contains(t)) {
            var i = this.choiceList.element.firstElementChild;
            this._isScrollingOnIe =
              'ltr' === this._direction ? e.offsetX >= i.offsetWidth : e.offsetX < i.offsetLeft;
          }
          if (t !== this.input.element) {
            var n = t.closest('[data-button],[data-item],[data-choice]');
            n instanceof HTMLElement &&
              ('button' in n.dataset
                ? this._handleButtonAction(n)
                : 'item' in n.dataset
                ? this._handleItemAction(n, e.shiftKey)
                : 'choice' in n.dataset && this._handleChoiceAction(n)),
              e.preventDefault();
          }
        }
      }),
      (e.prototype._onMouseOver = function (e) {
        var t = e.target;
        t instanceof HTMLElement && 'choice' in t.dataset && this._highlightChoice(t);
      }),
      (e.prototype._onClick = function (e) {
        var t = e.target,
          i = this.containerOuter;
        i.element.contains(t)
          ? this.dropdown.isActive || i.isDisabled
            ? this._isSelectOneElement &&
              t !== this.input.element &&
              !this.dropdown.element.contains(t) &&
              this.hideDropdown()
            : this._isTextElement
            ? document.activeElement !== this.input.element && this.input.focus()
            : (this.showDropdown(), i.element.focus())
          : (i.removeFocusState(), this.hideDropdown(!0), this.unhighlightAll());
      }),
      (e.prototype._onFocus = function (e) {
        var t = e.target,
          i = this.containerOuter;
        if (t && i.element.contains(t)) {
          var n = t === this.input.element;
          this._isTextElement
            ? n && i.addFocusState()
            : this._isSelectMultipleElement
            ? n && (this.showDropdown(!0), i.addFocusState())
            : (i.addFocusState(), n && this.showDropdown(!0));
        }
      }),
      (e.prototype._onBlur = function (e) {
        var t = e.target,
          i = this.containerOuter;
        t && i.element.contains(t) && !this._isScrollingOnIe
          ? t === this.input.element
            ? (i.removeFocusState(),
              this.hideDropdown(!0),
              (this._isTextElement || this._isSelectMultipleElement) && this.unhighlightAll())
            : t === this.containerOuter.element &&
              (i.removeFocusState(), this._canSearch || this.hideDropdown(!0))
          : ((this._isScrollingOnIe = !1), this.input.element.focus());
      }),
      (e.prototype._onFormReset = function () {
        var e = this;
        this._store.withTxn(function () {
          e.clearInput(),
            e.hideDropdown(),
            e.refresh(!1, !1, !0),
            e._initialItems.length && e.setChoiceByValue(e._initialItems);
        });
      }),
      (e.prototype._highlightChoice = function (e) {
        void 0 === e && (e = null);
        var t = Array.from(this.dropdown.element.querySelectorAll(et));
        if (t.length) {
          var i = e,
            n = this.config.classNames.highlightedState;
          Array.from(this.dropdown.element.querySelectorAll(D(n))).forEach(function (e) {
            j(e, n), e.setAttribute('aria-selected', 'false');
          }),
            i
              ? (this._highlightPosition = t.indexOf(i))
              : (i =
                  t.length > this._highlightPosition
                    ? t[this._highlightPosition]
                    : t[t.length - 1]) || (i = t[0]),
            P(i, n),
            i.setAttribute('aria-selected', 'true'),
            this.passedElement.triggerEvent('highlightChoice', { el: i }),
            this.dropdown.isActive &&
              (this.input.setActiveDescendant(i.id), this.containerOuter.setActiveDescendant(i.id));
        }
      }),
      (e.prototype._addItem = function (e, t, i) {
        if ((void 0 === t && (t = !0), void 0 === i && (i = !1), !e.id))
          throw new TypeError('item.id must be set before _addItem is called for a choice/item');
        (this.config.singleModeForMultiSelect || this._isSelectOneElement) &&
          this.removeActiveItems(e.id),
          this._store.dispatch(E(e)),
          t &&
            (this.passedElement.triggerEvent('addItem', this._getChoiceForOutput(e)),
            i && this.passedElement.triggerEvent('choice', this._getChoiceForOutput(e)));
      }),
      (e.prototype._removeItem = function (e) {
        if (e.id) {
          this._store.dispatch(C(e));
          var t = this._notice;
          t && t.type === ee && this._clearNotice(),
            this.passedElement.triggerEvent(m, this._getChoiceForOutput(e));
        }
      }),
      (e.prototype._addChoice = function (e, t, i) {
        if ((void 0 === t && (t = !0), void 0 === i && (i = !1), e.id))
          throw new TypeError('Can not re-add a choice which has already been added');
        var n = this.config;
        if (
          n.duplicateItemsAllowed ||
          !this._store.choices.find(function (t) {
            return n.valueComparer(t.value, e.value);
          })
        ) {
          this._lastAddedChoiceId++,
            (e.id = this._lastAddedChoiceId),
            (e.elementId = ''
              .concat(this._baseId, '-')
              .concat(this._idNames.itemChoice, '-')
              .concat(e.id));
          var s = n.prependValue,
            o = n.appendValue;
          s && (e.value = s + e.value),
            o && (e.value += o.toString()),
            (s || o) && e.element && (e.element.value = e.value),
            this._clearNotice(),
            this._store.dispatch(b(e)),
            e.selected && this._addItem(e, t, i);
        }
      }),
      (e.prototype._addGroup = function (e, t) {
        var i = this;
        if ((void 0 === t && (t = !0), e.id))
          throw new TypeError('Can not re-add a group which has already been added');
        this._store.dispatch(
          (function (e) {
            return { type: l, group: e };
          })(e)
        ),
          e.choices &&
            (this._lastAddedGroupId++,
            (e.id = this._lastAddedGroupId),
            e.choices.forEach(function (n) {
              (n.group = e), e.disabled && (n.disabled = !0), i._addChoice(n, t);
            }));
      }),
      (e.prototype._createTemplates = function () {
        var e = this,
          t = this.config.callbackOnCreateTemplates,
          i = {};
        'function' == typeof t && (i = t.call(this, A, T, F));
        var n = {};
        Object.keys(this._templates).forEach(function (t) {
          n[t] = t in i ? i[t].bind(e) : e._templates[t].bind(e);
        }),
          (this._templates = n);
      }),
      (e.prototype._createElements = function () {
        var e = this._templates,
          t = this.config,
          i = this._isSelectOneElement,
          n = t.position,
          s = t.classNames,
          o = this._elementType;
        (this.containerOuter = new V({
          element: e.containerOuter(
            t,
            this._direction,
            this._isSelectElement,
            i,
            t.searchEnabled,
            o,
            t.labelId
          ),
          classNames: s,
          type: o,
          position: n,
        })),
          (this.containerInner = new V({
            element: e.containerInner(t),
            classNames: s,
            type: o,
            position: n,
          })),
          (this.input = new B({
            element: e.input(t, this._placeholderValue),
            classNames: s,
            type: o,
            preventPaste: !t.paste,
          })),
          (this.choiceList = new H({ element: e.choiceList(t, i) })),
          (this.itemList = new H({ element: e.itemList(t, i) })),
          (this.dropdown = new K({ element: e.dropdown(t), classNames: s, type: o }));
      }),
      (e.prototype._createStructure = function () {
        var e = this,
          t = e.containerInner,
          i = e.containerOuter,
          n = e.passedElement,
          s = this.dropdown.element;
        n.conceal(),
          t.wrap(n.element),
          i.wrap(t.element),
          this._isSelectOneElement
            ? (this.input.placeholder = this.config.searchPlaceholderValue || '')
            : (this._placeholderValue && (this.input.placeholder = this._placeholderValue),
              this.input.setWidth()),
          i.element.appendChild(t.element),
          i.element.appendChild(s),
          t.element.appendChild(this.itemList.element),
          s.appendChild(this.choiceList.element),
          this._isSelectOneElement
            ? this.config.searchEnabled && s.insertBefore(this.input.element, s.firstChild)
            : t.element.appendChild(this.input.element),
          (this._highlightPosition = 0),
          (this._isSearching = !1);
      }),
      (e.prototype._initStore = function () {
        var e = this;
        this._store.subscribe(this._render).withTxn(function () {
          e._addPredefinedChoices(
            e._presetChoices,
            e._isSelectOneElement && !e._hasNonChoicePlaceholder,
            !1
          );
        }),
          (!this._store.choices.length ||
            (this._isSelectOneElement && this._hasNonChoicePlaceholder)) &&
            this._render();
      }),
      (e.prototype._addPredefinedChoices = function (e, t, i) {
        var n = this;
        void 0 === t && (t = !1),
          void 0 === i && (i = !0),
          t &&
            -1 ===
              e.findIndex(function (e) {
                return e.selected;
              }) &&
            e.some(function (e) {
              return !e.disabled && !('choices' in e) && ((e.selected = !0), !0);
            }),
          e.forEach(function (e) {
            'choices' in e ? n._isSelectElement && n._addGroup(e, i) : n._addChoice(e, i);
          });
      }),
      (e.prototype._findAndSelectChoiceByValue = function (e, t) {
        var i = this;
        void 0 === t && (t = !1);
        var n = this._store.choices.find(function (t) {
          return i.config.valueComparer(t.value, e);
        });
        return !(!n || n.disabled || n.selected || (this._addItem(n, !0, t), 0));
      }),
      (e.prototype._generatePlaceholderValue = function () {
        var e = this.config;
        if (!e.placeholder) return null;
        if (this._hasNonChoicePlaceholder) return e.placeholderValue;
        if (this._isSelectElement) {
          var t = this.passedElement.placeholderOption;
          return t ? t.text : null;
        }
        return null;
      }),
      (e.prototype._warnChoicesInitFailed = function (e) {
        if (!this.config.silent) {
          if (!this.initialised)
            throw new TypeError(''.concat(e, ' called on a non-initialised instance of Choices'));
          if (!this.initialisedOK)
            throw new TypeError(
              ''.concat(
                e,
                ' called for an element which has multiple instances of Choices initialised on it'
              )
            );
        }
      }),
      (e.version = '11.1.0'),
      e
    );
  })();
});
let style = document.createElement('style');
//style.textContent = "*{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}*,::after,::before{box-sizing:border-box}body,html{position:relative;margin:0;width:100%;height:100%}body{font-family:\"Helvetica Neue\",Helvetica,Arial,\"Lucida Grande\",sans-serif;font-size:16px;line-height:1.4;color:#fff;background-color:#333;overflow-x:hidden}hr,label{display:block}label,p{margin-bottom:8px}label{font-size:14px;font-weight:500;cursor:pointer}p{margin-top:0}hr{margin:30px 0;border:0;border-bottom:1px solid #eaeaea;height:1px}h1,h2,h3,h4,h5,h6{margin-top:0;margin-bottom:12px;font-weight:400;line-height:1.2}a,a:focus,a:visited{color:#fff;text-decoration:none;font-weight:600}.form-control{display:block;width:100%;background-color:#f9f9f9;padding:12px;border:1px solid #ddd;border-radius:2.5px;font-size:14px;appearance:none;margin-bottom:24px}.h1,h1{font-size:32px}.h2,h2{font-size:24px}.h3,h3{font-size:20px}.h4,h4{font-size:18px}.h5,h5{font-size:16px}.h6,h6{font-size:14px}label+p{margin-top:-4px}.container{display:block;margin:auto;max-width:40em;padding:48px}@media (max-width:620px){.container{padding:0}}.section{background-color:#fff;padding:24px;color:#333}.section a,.section a:focus,.section a:visited{color:#005f75}.logo{display:block;margin-bottom:12px}.logo-img{width:100%;height:auto;display:inline-block;max-width:100%;vertical-align:top;padding:6px 0}.visible-ie{display:none}.push-bottom{margin-bottom:24px}.zero-bottom{margin-bottom:0}.zero-top{margin-top:0}.text-center{text-align:center}[data-test-hook]{margin-bottom:24px}";
//document.head.appendChild(style);
//style = document.createElement('style');
style.textContent =
  '.choices{position:relative;overflow:hidden;margin-bottom:24px;font-size:16px}.choices:focus{outline:0}.choices:last-child{margin-bottom:0}.choices.is-open{overflow:visible}.choices.is-disabled .choices__inner,.choices.is-disabled .choices__input{background-color:#eaeaea;cursor:not-allowed;-webkit-user-select:none;user-select:none}.choices.is-disabled .choices__item{cursor:not-allowed}.choices [hidden]{display:none!important}.choices[data-type*=select-one]{cursor:pointer}.choices[data-type*=select-one] .choices__inner{padding-bottom:7.5px}.choices[data-type*=select-one] .choices__input{display:block;width:100%;padding:10px;border-bottom:1px solid #ddd;background-color:#fff;margin:0}.choices[data-type*=select-one] .choices__button{background-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEiIGhlaWdodD0iMjEiIHZpZXdCb3g9IjAgMCAyMSAyMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yLjU5Mi4wNDRsMTguMzY0IDE4LjM2NC0yLjU0OCAyLjU0OEwuMDQ0IDIuNTkyeiIvPjxwYXRoIGQ9Ik0wIDE4LjM2NEwxOC4zNjQgMGwyLjU0OCAyLjU0OEwyLjU0OCAyMC45MTJ6Ii8+PC9nPjwvc3ZnPg==);padding:0;background-size:8px;position:absolute;top:50%;right:0;margin-top:-10px;margin-right:25px;height:20px;width:20px;border-radius:10em;opacity:.25}.choices[data-type*=select-one] .choices__button:focus,.choices[data-type*=select-one] .choices__button:hover{opacity:1}.choices[data-type*=select-one] .choices__button:focus{box-shadow:0 0 0 2px #005f75}.choices[data-type*=select-one] .choices__item[data-placeholder] .choices__button{display:none}.choices[data-type*=select-one]::after{content:"";height:0;width:0;border-style:solid;border-color:#333 transparent transparent;border-width:5px;position:absolute;right:11.5px;top:50%;margin-top:-2.5px;pointer-events:none}.choices[data-type*=select-one].is-open::after{border-color:transparent transparent #333;margin-top:-7.5px}.choices[data-type*=select-one][dir=rtl]::after{left:11.5px;right:auto}.choices[data-type*=select-one][dir=rtl] .choices__button{right:auto;left:0;margin-left:25px;margin-right:0}.choices[data-type*=select-multiple] .choices__inner,.choices[data-type*=text] .choices__inner{cursor:text}.choices[data-type*=select-multiple] .choices__button,.choices[data-type*=text] .choices__button{position:relative;display:inline-block;margin:0-4px 0 8px;padding-left:16px;border-left:1px solid #003642;background-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEiIGhlaWdodD0iMjEiIHZpZXdCb3g9IjAgMCAyMSAyMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSIjRkZGIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yLjU5Mi4wNDRsMTguMzY0IDE4LjM2NC0yLjU0OCAyLjU0OEwuMDQ0IDIuNTkyeiIvPjxwYXRoIGQ9Ik0wIDE4LjM2NEwxOC4zNjQgMGwyLjU0OCAyLjU0OEwyLjU0OCAyMC45MTJ6Ii8+PC9nPjwvc3ZnPg==);background-size:8px;width:8px;line-height:1;opacity:.75;border-radius:0}.choices[data-type*=select-multiple] .choices__button:focus,.choices[data-type*=select-multiple] .choices__button:hover,.choices[data-type*=text] .choices__button:focus,.choices[data-type*=text] .choices__button:hover{opacity:1}.choices__inner{display:inline-block;vertical-align:top;width:100%;background-color:#f9f9f9;padding:7.5px 7.5px 3.75px;border:1px solid #ddd;border-radius:2.5px;font-size:14px;min-height:44px;overflow:hidden}.is-focused .choices__inner,.is-open .choices__inner{border-color:#b7b7b7}.is-open .choices__inner{border-radius:2.5px 2.5px 0 0}.is-flipped.is-open .choices__inner{border-radius:0 0 2.5px 2.5px}.choices__list{margin:0;padding-left:0;list-style:none}.choices__list--single{display:inline-block;padding:4px 16px 4px 4px;width:100%}[dir=rtl] .choices__list--single{padding-right:4px;padding-left:16px}.choices__list--single .choices__item{width:100%}.choices__list--multiple{display:inline}.choices__list--multiple .choices__item{display:inline-block;vertical-align:middle;border-radius:20px;padding:4px 10px;font-size:12px;font-weight:500;margin-right:3.75px;margin-bottom:3.75px;background-color:#005f75;border:1px solid #004a5c;color:#fff;word-break:break-all;box-sizing:border-box}.choices__list--multiple .choices__item[data-deletable]{padding-right:5px}[dir=rtl] .choices__list--multiple .choices__item{margin-right:0;margin-left:3.75px}.choices__list--multiple .choices__item.is-highlighted{background-color:#004a5c;border:1px solid #003642}.is-disabled .choices__list--multiple .choices__item{background-color:#aaa;border:1px solid #919191}.choices__list--dropdown,.choices__list[aria-expanded]{display:none;z-index:1;position:absolute;width:100%;background-color:#fff;border:1px solid #ddd;top:100%;margin-top:-1px;border-bottom-left-radius:2.5px;border-bottom-right-radius:2.5px;overflow:hidden;word-break:break-all}.is-active.choices__list--dropdown,.is-active.choices__list[aria-expanded]{display:block}.is-open .choices__list--dropdown,.is-open .choices__list[aria-expanded]{border-color:#b7b7b7}.is-flipped .choices__list--dropdown,.is-flipped .choices__list[aria-expanded]{top:auto;bottom:100%;margin-top:0;margin-bottom:-1px;border-radius:.25rem .25rem 0 0}.choices__list--dropdown .choices__list,.choices__list[aria-expanded] .choices__list{position:relative;max-height:300px;overflow:auto;-webkit-overflow-scrolling:touch;will-change:scroll-position}.choices__list--dropdown .choices__item,.choices__list[aria-expanded] .choices__item{position:relative;padding:10px;font-size:14px}[dir=rtl] .choices__list--dropdown .choices__item,[dir=rtl] .choices__list[aria-expanded] .choices__item{text-align:right}@media (min-width:640px){.choices__list--dropdown .choices__item--selectable[data-select-text],.choices__list[aria-expanded] .choices__item--selectable[data-select-text]{padding-right:100px}.choices__list--dropdown .choices__item--selectable[data-select-text]::after,.choices__list[aria-expanded] .choices__item--selectable[data-select-text]::after{content:attr(data-select-text);font-size:12px;opacity:0;position:absolute;right:10px;top:50%;transform:translateY(-50%)}[dir=rtl] .choices__list--dropdown .choices__item--selectable[data-select-text],[dir=rtl] .choices__list[aria-expanded] .choices__item--selectable[data-select-text]{text-align:right;padding-left:100px;padding-right:10px}[dir=rtl] .choices__list--dropdown .choices__item--selectable[data-select-text]::after,[dir=rtl] .choices__list[aria-expanded] .choices__item--selectable[data-select-text]::after{right:auto;left:10px}}.choices__list--dropdown .choices__item--selectable.is-highlighted,.choices__list[aria-expanded] .choices__item--selectable.is-highlighted{background-color:#f2f2f2}.choices__list--dropdown .choices__item--selectable.is-highlighted::after,.choices__list[aria-expanded] .choices__item--selectable.is-highlighted::after{opacity:.5}.choices__item{cursor:default}.choices__item--selectable{cursor:pointer}.choices__item--disabled{cursor:not-allowed;-webkit-user-select:none;user-select:none;opacity:.5}.choices__heading{font-weight:600;font-size:12px;padding:10px;border-bottom:1px solid #f7f7f7;color:gray}.choices__button{text-indent:-9999px;appearance:none;border:0;background-color:transparent;background-repeat:no-repeat;background-position:center;cursor:pointer}.choices__button:focus,.choices__input:focus{outline:0}.choices__input{display:inline-block;vertical-align:baseline;background-color:#f9f9f9;font-size:14px;margin-bottom:5px;border:0;border-radius:0;max-width:100%;padding:4px 0 4px 2px}.choices__input::-webkit-search-cancel-button,.choices__input::-webkit-search-decoration,.choices__input::-webkit-search-results-button,.choices__input::-webkit-search-results-decoration{display:none}.choices__input::-ms-clear,.choices__input::-ms-reveal{display:none;width:0;height:0}[dir=rtl] .choices__input{padding-right:2px;padding-left:0}.choices__placeholder{opacity:.5}';
document.head.appendChild(style);

function GM_xmlhttpRequest(options) {
  const { method = 'GET', url, headers = {}, data, onload, onerror } = options;
  const fetchOptions = { method, headers };
  if (method.toUpperCase() !== 'GET' && data !== undefined) {
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
  return '';
}

//turn on console log
let i = document.createElement('iframe');
i.style.display = 'none';
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
    content: "\\E0DA";
    color: #fd4821;
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
.sbc-settings-field {
    margin-top: 15px;
    width: 45%;
    padding: 10px;
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
`;
let styleSheet = document.createElement('style');
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
  } catch (error) {}
  return elem;
};
const getElementString = (node) => {
  let DIV = document.createElement('div');
  if ('outerHTML' in DIV) {
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
      elem.setAttribute(attr === 'className' ? 'class' : attr, attrs[attr]);
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
  existingNode.parentNode.insertBefore(getRootElement(newNode), existingNode.nextSibling);
  return newNode;
};
const createButton = (id, label, callback, buttonClass = 'btn-standard') => {
  const innerSpan = createElem(
    'span',
    {
      className: 'button__text',
    },
    label
  );
  const button = createElem(
    'button',
    {
      className: buttonClass,
      id: id,
    },
    getElementString(innerSpan)
  );
  button.addEventListener('click', function () {
    callback();
  });
  button.addEventListener('mouseenter', () => {
    addClass(button, 'hover');
  });
  button.addEventListener('mouseleave', () => {
    removeClass(button, 'hover');
  });
  return button;
};

const DEFAULT_SEARCH_BATCH_SIZE = 91;
const MILLIS_IN_SECOND = 1000;
const wait = async (maxWaitTime = 2) => {
  const factor = Math.random();
  await new Promise((resolve) => setTimeout(resolve, factor * maxWaitTime * MILLIS_IN_SECOND));
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
// Progress bar utility functions
// Global state to track active progress bars and their positions
const activeProgressBars = [];

const createProgressBar = (id, containerId, labelText = '') => {
  // Remove existing progress bar if it exists
  let existingContainer = document.getElementById(containerId);
  if (existingContainer) {
    existingContainer.parentNode.removeChild(existingContainer);
    // Remove from active bars list
    const index = activeProgressBars.findIndex((item) => item.id === containerId);
    if (index !== -1) {
      activeProgressBars.splice(index, 1);
    }
  }

  const progressBarContainer = document.createElement('div');
  progressBarContainer.id = containerId;
  progressBarContainer.style.position = 'fixed';
  progressBarContainer.style.bottom = '10px';
  progressBarContainer.style.right = '130px';
  progressBarContainer.style.width = '300px';
  progressBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  progressBarContainer.style.borderRadius = '2px';
  progressBarContainer.style.zIndex = '9999';
  progressBarContainer.style.transition = 'bottom 0.3s ease-in-out';

  // Create label element if label text is provided
  if (labelText) {
    const label = document.createElement('div');
    label.id = `${id}-label`;
    label.textContent = labelText;
    label.style.position = 'absolute';
    label.style.top = '-20px';
    label.style.left = '0';
    label.style.width = '100%';
    label.style.color = '#ffffff';
    label.style.textAlign = 'center';
    label.style.fontSize = '12px';
    progressBarContainer.appendChild(label);
  }

  // Add a container for the progress bar itself
  const progressBarWrapper = document.createElement('div');
  progressBarWrapper.style.height = '15px';
  progressBarWrapper.style.width = '100%';
  progressBarWrapper.style.position = 'relative';
  progressBarWrapper.style.overflow = 'hidden';
  progressBarContainer.appendChild(progressBarWrapper);

  const progressBar = document.createElement('div');
  progressBar.id = id;
  progressBar.style.height = '100%';
  progressBar.style.width = '0%';
  progressBar.style.backgroundColor = '#07f468';
  progressBar.style.borderRadius = '2px';
  progressBar.style.transition = 'width 0.3s ease-in-out';

  progressBarWrapper.appendChild(progressBar);
  document.body.appendChild(progressBarContainer);

  // Calculate position based on existing progress bars
  const offset = 35; // Height of bar + margin
  const bottomPosition = 10 + activeProgressBars.length * offset;
  progressBarContainer.style.bottom = `${bottomPosition}px`;

  // Add to active progress bars list
  activeProgressBars.push({
    id: containerId,
    element: progressBarContainer,
    position: activeProgressBars.length,
  });

  return progressBarContainer;
};

const removeProgressBar = (containerId, delay = 2000) => {
  setTimeout(() => {
    const progressBarContainer = document.getElementById(containerId);
    if (progressBarContainer) {
      progressBarContainer.style.opacity = '0';
      progressBarContainer.style.transition = 'opacity 0.5s ease-in-out';

      setTimeout(() => {
        if (progressBarContainer && progressBarContainer.parentNode) {
          // Remove from active bars list
          const index = activeProgressBars.findIndex((item) => item.id === containerId);
          if (index !== -1) {
            activeProgressBars.splice(index, 1);
          }

          progressBarContainer.parentNode.removeChild(progressBarContainer);

          // Reposition remaining progress bars
          activeProgressBars.forEach((item, idx) => {
            const bottomPosition = 10 + idx * 25;
            item.element.style.bottom = `${bottomPosition}px`;
            item.position = idx;
          });
        }
      }, 500);
    }
  }, delay);
};

const updateProgressBar = (progressBarId, progress) => {
  const progressBar = document.getElementById(progressBarId);
  if (progressBar) {
    progressBar.style.width = `${Math.min(100, progress)}%`;
  }
};

// Add a flag to track if concept players are currently being fetched
let isConceptPlayerFetchInProgress = false;

let getConceptPlayers = async function (playerCount = 999999) {
  // If already fetching concepts, return the current conceptPlayers array
  if (isConceptPlayerFetchInProgress || conceptPlayersCollected) {
    console.log('Already fetching concept players or already collected.');

    return conceptPlayers;
  }

  return new Promise((resolve, reject) => {
    isConceptPlayerFetchInProgress = true;
    console.log('Getting Concept Players');
    const gatheredPlayers = [];
    const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;
    searchCriteria.offset = 0;
    searchCriteria.sortBy = SearchSortType.RECENCY;
    searchCriteria.count = DEFAULT_SEARCH_BATCH_SIZE;

    // Create progress bar using the extracted utility function
    const containerId = 'concept-progress-container';
    const progressBarId = 'concept-progress-bar';
    createProgressBar(progressBarId, containerId, 'Fetching Concepts');

    // Start with 0% progress
    updateProgressBar(progressBarId, 0);

    // Estimate total players to be around 20000 for progress calculation
    // Try to get saved total from localStorage first
    const savedEstimatedTotal = localStorage.getItem('conceptPlayerTotal');
    const estimatedTotal = savedEstimatedTotal ? parseInt(savedEstimatedTotal) : 20000;

    // Update the total once we have more data
    const updateTotal = (newTotal) => {
      if (newTotal > 1000) {
        // Only save if it seems like a reasonable count
        localStorage.setItem('conceptPlayerTotal', newTotal);
        console.log(`Updated concept player count to ${newTotal}`);
      }
    };

    const getAllConceptPlayers = () => {
      searchConceptPlayers(searchCriteria).observe(this, async function (sender, response) {
        gatheredPlayers.push(...response.response.items);

        // Update progress based on current offset
        const progress = (searchCriteria.offset / estimatedTotal) * 100;
        updateProgressBar(progressBarId, progress);

        if (
          response.status !== 400 &&
          !response.response.endOfList &&
          searchCriteria.offset <= playerCount
        ) {
          searchCriteria.offset += searchCriteria.count;

          getAllConceptPlayers();
        } else {
          if (playerCount > 1) {
            conceptPlayersCollected = true;
            showNotification('Collected All Concept Players', UINotificationType.POSITIVE);
          }
          // Set progress to 100% when complete
          updateProgressBar(progressBarId, 100);
          // Remove progress bar after a delay
          removeProgressBar(containerId);
          // Reset the flag when done
          isConceptPlayerFetchInProgress = false;
          console.table(gatheredPlayers.slice(0, 10));
          resolve(gatheredPlayers);
        }
      });
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
      searchStoragePlayers(searchCriteria).observe(this, async function (sender, response) {
        gatheredPlayers.push(...response.response.items);
        if (response.status !== 400 && !response.response.endOfList) {
          searchCriteria.offset += searchCriteria.count;

          //console.log('Storages Retrieved',searchCriteria.offset)
          getAllStoragePlayers();
        } else {
          resolve(gatheredPlayers);
        }
      });
    };
    getAllStoragePlayers();
  });
};
const searchStoragePlayers = (searchCriteria) => {
  return services.Item.searchStorageItems(searchCriteria);
};

let dealWithUnassigned = async () => {
  let storage = await getStoragePlayers();
  let ulist = await fetchUnassigned();
  let players = await fetchPlayers();

  // move to team any storage players not already in club
  const storageToTeam = storage.filter(
    (item) => !players.map((p) => p.definitionId).includes(item.definitionId)
  );
  if (storageToTeam.length > 0) {
    console.log(
      `Moving to club (storage → club): count=${storageToTeam.length}`,
      storageToTeam.map((p) => ({
        id: p.id,
        definitionId: p.definitionId,
        name: p._staticData?.name,
      }))
    );

    services.Item.move(storageToTeam, 7);
  }

  // swap duplicates for tradable
  const switchTradeable = ulist.filter((l) =>
    players
      .filter((p) => p.isTradeable())
      .map((m) => m.definitionId)
      .includes(l.definitionId)
  );
  const tradablePlayers = players.filter(
    (f) => f.definitionId in switchTradeable.map((m) => m.definitionId)
  );
  if (tradablePlayers.length > 0) {
    console.log(
      `Moving duplicates to club (tradable swaps): count=${tradablePlayers.length}`,
      tradablePlayers.map((p) => ({
        id: p.id,
        definitionId: p.definitionId,
        name: p._staticData?.name,
      }))
    );

    services.Item.move(tradablePlayers, 7);
    goToUnassignedView();

    storage = await getStoragePlayers();
    ulist = await fetchUnassigned();
    players = await fetchPlayers();
  }
  // ulist = ulist.filter(item =>
  //       !switchTradeable.some(sw => sw.id === item.id)
  //     ).concat(players.filter(p => p.isTradeable()).map(m => m.definitionId).includes(ulist.map(p=>p.definitionId)));

  const toTeam = ulist.filter((item) => item.isMovable());
  if (toTeam.length > 0) {
    console.log(
      `Moving to club (unassigned → club): count=${toTeam.length}`,
      toTeam.map((p) => ({
        id: p.id,
        definitionId: p.definitionId,
        name: p._staticData?.name,
      }))
    );

    services.Item.move(toTeam, 7);
  }
  // discard non-player dupes
//   const nonPlayerDupes = ulist.filter((l) => !l.isPlayer() && l.duplicateId > 0);
//   if (nonPlayerDupes.length > 0) {
//     console.log(
//       `Discarding non-player duplicates: count=${nonPlayerDupes.length}`,
//       nonPlayerDupes.map((p) => ({
//         id: p.id,
//         definitionId: p.definitionId,
//         name: p._staticData?.name,
//       }))
//     );

//     services.Item.discard(nonPlayerDupes);
//     goToUnassignedView();

//     storage = await getStoragePlayers();
//     ulist = await fetchUnassigned();
//     players = await fetchPlayers();
//   }

  // sendDuplicatesToStorage
  const toStorage = ulist
    .filter((item) => item.isStorable() && !item.isMovable() && !item.isTradeable())
    .sort((a, b) => getPrice(b) - getPrice(a))
    .slice(0, Math.max(0, 100 - storage.length));
  if (toStorage.length > 0) {
    console.log(
      `Moving to storage (duplicates): count=${toStorage.length}`,
      toStorage.map((p) => ({
        id: p.id,
        definitionId: p.definitionId,
        name: p._staticData?.name,
      }))
    );
    services.Item.move(toStorage, 10);
  }

//   // discard tradable fodder
//   const tradableFodder = ulist
//     .concat(tradablePlayers)
//     .filter((l) => l.isPlayer() && getPrice(l) < 20000 && !l.untradeable);
//   if (tradableFodder.length > 0) {
//     console.log(
//       `Discarding tradable fodder players: count=${tradableFodder.length}`,
//       tradableFodder.map((p) => ({
//         id: p.id,
//         definitionId: p.definitionId,
//         name: p._staticData?.name,
//       }))
//     );

//     services.Item.discard(tradableFodder);
//   }

  ulist = await fetchUnassigned();
  if (ulist.length > 0) {
    console.log(
      `Remaining Unassigned: count=${ulist.length}`,
      ulist.map((p) => ({
        id: p.id,
        definitionId: p.definitionId,
        name: p._staticData?.name,
      }))
    );
  }
  await ratingCountUI();
  return Promise.resolve(ulist);
};
let fetchUnassigned = () => {
  repositories.Item.unassigned.clear();
  repositories.Item.unassigned.reset();

  return new Promise((resolve) => {
    let result = [];
    services.Item.requestUnassignedItems().observe(undefined, async (sender, response) => {
      result = [...response.response.items];
      await fetchPlayerPrices(result);

      resolve(result);
    });
  });
};
let fetchDuplicateIds = () => {
  return new Promise((resolve) => {
    const result = [];
    repositories.Store.setDirty();
    services.Item.requestUnassignedItems().observe(undefined, (sender, response) => {
      const duplicates = [...response.response.items.filter((item) => item.duplicateId > 0)];
      result.push(...duplicates.map((duplicate) => duplicate.duplicateId));

      resolve(result);
    });
  });
};

let apiUrl = 'http://127.0.0.1:8000';

let LOCKED_ITEMS_KEY = 'excludePlayers';
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
  return getSettings(0, 0, 'excludePlayers');
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

let FIXED_ITEMS_KEY = 'fixeditems';
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
  let shield = getElement('.ut-click-shield');
  let existingInfo = document.getElementById('sbc-info');
  let logOverlay = document.getElementById('sbc-log-overlay');

  if (existingInfo) {
    existingInfo.remove();
  }

  if (!sbcName) return;

  let infoDiv = document.createElement('div');
  infoDiv.id = 'sbc-info';
  infoDiv.style.position = 'fixed';
  infoDiv.style.bottom = '10px';
  infoDiv.style.left = '160px';
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

  if (challengeName && challengeName !== sbcName) {
    let subtitle = document.createElement('div');
    subtitle.textContent = challengeName;
    subtitle.style.fontSize = '1rem';
    subtitle.style.opacity = '0.8';
    infoDiv.appendChild(subtitle);
  }

  shield.appendChild(infoDiv);
};

const showLoader = (countdown = false) => {
  if (countdown) {
    createLogOverlayToggle();
    updateLogOverlay();
    createStopOverlayButton();
    const numCounterElement = document.querySelector('.numCounter');
    if (numCounterElement) {
      numCounterElement.style.display = 'block';
    }
  } else {
    const toggleContainers = document.querySelectorAll('#sbc-log-toggle');
    toggleContainers.forEach((toggleContainer) => {
      toggleContainer.remove();
    });
    let logOverlay = document.getElementById('sbc-log-overlay');
    if (logOverlay) {
      logOverlay.remove();
    }
    const numCounterElement = document.querySelector('.numCounter');
    if (numCounterElement) {
      numCounterElement.style.display = 'none';
    }
  }

  const clickShield = document.querySelector('.ut-click-shield');

  if (clickShield) {
    clickShield.classList.add('showing');
  }
  const loaderIcon = document.querySelector('.loaderIcon');
  if (loaderIcon) {
    loaderIcon.style.display = 'block';
  }
};
const hideLoader = () => {
  const stopButtons = document.querySelectorAll('#sbc-stop-overlay');
  stopButtons.forEach((stopButton) => {
    stopButton.remove();
  });
  const sbcNames = document.querySelectorAll('#sbc-info');
  sbcNames.forEach((sbcName) => {
    sbcName.remove();
  });
  const toggleContainers = document.querySelectorAll('#sbc-log-toggle');
  toggleContainers.forEach((toggleContainer) => {
    toggleContainer.remove();
  });

  let logOverlay = document.getElementById('sbc-log-overlay');
  if (logOverlay) {
    logOverlay.remove();
  }
  if (counter) {
    counter = null;
  }
  document.querySelectorAll('.numCounter').forEach((element) => {
    element.remove();
  });
  const clickShield = document.querySelector('.ut-click-shield');
  if (clickShield) {
    clickShield.classList.remove('showing');
  }
  const loaderIcon = document.querySelector('.loaderIcon');
  if (loaderIcon) {
    loaderIcon.style.display = 'block';
  }
  clearInterval(logPollInterval);
  clearInterval(countDownInterval);
};
const showNotification = function (message, type = UINotificationType.POSITIVE) {
  services.Notification.queue([message, type]);
};
const getCurrentViewController = () => {
  return getAppMain()
    .getRootViewController()
    .getPresentedViewController()
    .getCurrentViewController();
};
const getControllerInstance = () => {
  return getCurrentViewController().getCurrentController().childViewControllers[0];
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
    services.SBC.requestChallengesForSet(set).observe(this, async function (obs, res) {
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

let loadChallenge = async function (currentChallenge, count = 0) {
  if (count > 5) {
    return;
  }
  return new Promise((resolve, reject) => {
    services.SBC.loadChallenge(currentChallenge).observe(this, async function (obs, res) {
      if (!res.success) {
        obs.unobserve(this);
        await wait(1000);
        console.log('Loading Challenge again', currentChallenge.id, count);
        await loadChallenge(currentChallenge, count + 1);
        reject(res.status);
      } else {
        resolve(res.data);
      }
    });
  });
};

let fetchSBCData = async (sbcId, challengeId = 0) => {
  //Get SBC Data if given a setId

  let sbcData = await sbcSets();
  if (sbcData === undefined) {
    console.log('SBC DATA is not available');
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

  let uncompletedChallenges = challenges?.challenges.filter((f) => f.status != 'COMPLETED');
  if (uncompletedChallenges.length == 0) {
    showNotification('SBC not available', UINotificationType.NEGATIVE);
    createSBCTab();
    return null;
  }
  if (uncompletedChallenges.length == 1) {
    awards = sbcSet[0].awards.filter((f) => f.isPack || f.isItem).map((m) => m.value);
  }

  if (challengeId == 0) {
    //Get last/hardest SBC if no challenge given

    challengeId = uncompletedChallenges[uncompletedChallenges.length - 1].id;
  }

  await loadChallenge(challenges.challenges.filter((i) => i.id == challengeId)[0]);

  let newSbcSquad = new UTSBCSquadOverviewViewController();
  (newSbcSquad._set = sbcSet[0]),
    (newSbcSquad._challenge = challenges.challenges.filter((i) => i.id == challengeId)[0]);
  newSbcSquad.initWithSquad(challenges.challenges.filter((i) => i.id == challengeId)[0].squad);
  let { _challenge } = newSbcSquad;

  let totwIdx = -1;
  const challengeRequirements = _challenge.eligibilityRequirements.map((eligibility, idx) => {
    let keys = Object.keys(eligibility.kvPairs._collection);
    if (
      SBCEligibilityKey[keys[0]] == 'PLAYER_RARITY_GROUP' &&
      eligibility.kvPairs._collection[keys[0]][0] == 23
    ) {
      totwIdx = idx;
    }
    return {
      scope: SBCEligibilityScope[eligibility.scope],
      count: eligibility.count,
      requirementKey: SBCEligibilityKey[keys[0]],
      eligibilityValues: eligibility.kvPairs._collection[keys[0]],
    };
  });
  if (getSettings(0, 0, 'saveTotw')) {
    if (totwIdx >= 0) {
      challengeRequirements[totwIdx].scope = 'EXACT';
    } else {
      challengeRequirements.push({
        scope: 'EXACT',
        count: 0,
        requirementKey: 'PLAYER_RARITY_GROUP',
        eligibilityValues: [23],
      });
    }
  }

  // Add SBC and challenge names to the loader display
  return {
    constraints: challengeRequirements,
    formation: _challenge.squad._formation.generalPositions.map((m, i) =>
      _challenge.squad.simpleBrickIndices.includes(i) ? -1 : m
    ),
    challengeId: _challenge.id,
    setId: _challenge.setId,
    brickIndices: _challenge.squad.simpleBrickIndices,
    finalSBC: uncompletedChallenges.length == 1,
    currentSolution: _challenge.squad._players.map((m) => m._item._metaData?.id).slice(0, 11),
    subs: _challenge.squad._players
      .map((m) => m._item.definitionId)
      .slice(11, 99)
      .filter((f) => f > 0),
    awards: _challenge.awards
      .filter((f) => f.type == 'pack')
      .map((m) => m.value)
      .concat(awards),
    setAward: sbcSet[0].awards,
    sbcName: sbcSet[0].name,
    challengeName: _challenge.name,
  };
};
let conceptPlayers = [];
let sbcLogin = [];
let players;
let createSbcGrind = false;
const futAutoGrind = async () => {
  try{
  services.Notification.queue(['Starting auto‐grind for favorites…'], UINotificationType.POSITIVE);
  // loop until user clicks STOP
  while (createSbcGrind) {
    let sbcs = await sbcSets();
    // get favourites and run 1 sbc of each continuously, opening packs in between
    let favourites = sbcs.categories.find((f) => f.isFavourite).setIds; // only your “favorite” SBCs
    if (!favourites.length) {
      showNotification('No favorite SBCs found', UINotificationType.NEGATIVE);
      return;
    }

    for (const fav of favourites) {
      await ratingCountUI();

      // after your regular SBC loop
      // check storage for 76–83 rated players
      const storageNow = await getStoragePlayers();
      const players = await fetchPlayers();
      const midCount = storageNow.filter((p) => p.rating > 75 && p.rating < 83).length;
      const midPlayerCount = players.filter((p) => p.rating > 75 && p.rating < 84).length;
      let targetSet;

      if (midCount > 0) {
        // find SBC set whose name contains “83+”
        targetSet = sbcs.sets.find((f) => /83\+/.test(f.name));
      }
      // if (storageNow.length < 50 && players.filter(p => p.rating > 88 && p.rating < 94).length + storageNow.filter(p => p.rating > 88 && p.rating < 94).length > 3) {
      //     // if club storage drops below 50, target the "89 OVR" SBC
      //     targetSet = sbcs.sets.find(s => s.name.includes("89 OVR"));
      //   }
      if (targetSet && storageNow.length==100) {
        services.Notification.queue(
          [`Running SBC: ${targetSet.name}`],
          UINotificationType.POSITIVE
        );
        await solveSBC(targetSet.id, 0, true, 0);
        await ratingCountUI();
        continue;
      }

      services.Notification.queue(
        [`Running SBC: ${sbcs.sets.find((f) => f.id == fav).name}`],
        UINotificationType.POSITIVE
      );
      // solve one challenge of this set
      const numberToSolve = getSettings(fav, 0, 'repeatCount') || 0;
      if (!createSbcGrind) break;
      await solveSBC(fav, 0, true, 0);
      if (!createSbcGrind) break;
      // open your reward pack (if any)
      // after solving an SBC, open every pending player‐pick if there are any
      const unassignedAfter = await fetchUnassigned();
      const pendingPicks = unassignedAfter.filter((item) => item.isPlayerPickItem());

      for (const pick of pendingPicks) {
        await openPick(pick.definitionId);
      }
      try {
        const freeCoins = unassignedAfter.filter((item) => item.isFreeCoins());
        services.Item.redeem(freeCoins[0]);
      } catch (e) {}
      let packs = await getPacks();
         let unassignedCount = await fetchUnassigned();
      let myPack = packs.packs.find((p) => p.isMyPack);
      if (myPack && unassignedCount.length==0) {
        let i = services.Localization;

        services.Notification.queue([
          'Opening Pack:  ' + i.localize(myPack.packName),
          UINotificationType.POSITIVE,
        ]);
        await openPack(myPack, 0, true);
      }
    }
    await ratingCountUI();
  }
}
catch (err) {
      console.warn( err);
      futAutoGrind()
      }
};

const ratingCountUI = async () => { 
if  (!getSettings(0, 0, 'ratingUI')){
    return
}
  // fetch current club players and storage players
  const clubPlayers = await fetchPlayers();
  const storagePlayers = await getStoragePlayers();

  // helper to count by rating bins
  const countByRating = (arr) => {
    const bins = { '<65': 0, '<75': 0, '<83': 0 };
    // initialize bins for ratings 83–99
    for (let r = 83; r <= 99; r++) {
      bins[r] = 0;
    }

    let total = 0;
    arr.forEach((p) => {
      const r = p.rating;
      if (r < 65) bins['<65']++;
      else if (r < 75) bins['<75']++;
      else if (r < 83) bins['<83']++;
      else if (r <= 99) bins[r]++;
      total++;
    });

    bins.total = total;
    return bins;
  };

  const clubCounts = countByRating(clubPlayers.filter((item) => item.loans < 0));
  const storageCounts = countByRating(storagePlayers);
  const allRatings = Array.from(
    new Set([...Object.keys(clubCounts), ...Object.keys(storageCounts)])
  )
    // remove the "total" key from sorting
    .filter((key) => key !== 'total')
    // sort by numeric value (strip leading "<" if present)
    .sort((a, b) => {
      const parseKey = (x) => {
        if (typeof x === 'string' && x.startsWith('<')) {
          return parseInt(x.substring(1), 10);
        }
        return Number(x);
      };
      return parseKey(b) - parseKey(a);
    });
  // put "total" at the end
  allRatings.push('total');
  // inject CSS for plus/minus flash
  if (!document.getElementById('rating-count-anim-style')) {
    const style = document.createElement('style');
    style.id = 'rating-count-anim-style';
    style.textContent = `
          .delta-plus   { animation: plusAnim   3s; }
          .delta-minus  { animation: minusAnim  3s; }
          @keyframes plusAnim  { from { background: #4caf50; } to { background: transparent; } }
          @keyframes minusAnim { from { background: #f44336; } to { background: transparent; } }
        `;
    document.head.appendChild(style);
  }
  // override the default 0.6s animation so cells stay highlighted for 3 seconds
  const animStyle = document.getElementById('rating-count-anim-style');
  if (animStyle) {
    animStyle.textContent = `
          .delta-plus   { animation: plusAnim   3s forwards; }
          .delta-minus  { animation: minusAnim  3s forwards; }
          @keyframes plusAnim  { from { background: #4caf50; } to { background: transparent; } }
          @keyframes minusAnim { from { background: #f44336; } to { background: transparent; } }
        `;
  }
  // create container if missing
  let container = document.getElementById('rating-count-ui');
  if (!container) {
    container = document.createElement('div');
    container.id = 'rating-count-ui';
    container.style.cssText = `
          position: fixed; bottom: 0; left: 6.5rem;  right: 6.5rem;
          background: rgba(0,0,0,0.8); color: #fff;
          font-size: 12px; padding: 8px; z-index: 9999;
          overflow-x: auto; white-space: nowrap;
        `;
    const header = ['Type', ...allRatings].map((x) => `<th>${x}</th>`).join('');
    const clubRow = ['Club', ...allRatings.map((r) => clubCounts[r] || 0)]
      .map((x) => `<td>${x}</td>`)
      .join('');
    const storageRow = ['Storage', ...allRatings.map((r) => storageCounts[r] || 0)]
      .map((x) => `<td>${x}</td>`)
      .join('');
    container.innerHTML = `
          <table style="width:100%;border-collapse:collapse;text-align:center">
            <thead><tr>${header}</tr></thead>
            <tbody>
              <tr>${clubRow}</tr>
              <tr>${storageRow}</tr>
            </tbody>
          </table>
        `;
    const target = document.querySelector('section.ut-navigation-container-view');
    if (target) {
      target.appendChild(container);
    } else {
      console.warn('ut-navigation-container-view not found');
    }
    return;
  }

  // update existing table cells with animations
  const table = container.querySelector('table');
  if (!table) return;
  const ths = Array.from(table.querySelectorAll('thead th')).map((e) => e.textContent);
  const bodyRows = table.tBodies[0].rows;
  const clubRow = bodyRows[0];
  const storageRow = bodyRows[1];

  allRatings.forEach((r) => {
    const col = ths.indexOf(r.toString());
    if (col > -1) {
      // Removed offset: column index now matches the cell index directly
      const clubCell = clubRow.cells[col];
      const storageCell = storageRow.cells[col];
      const oldClub = parseInt(clubCell.textContent) || 0;
      const newClub = clubCounts[r] || 0;
      if (newClub !== oldClub) {
        clubCell.textContent = newClub;
        clubCell.classList.add(newClub > oldClub ? 'delta-plus' : 'delta-minus');
        setTimeout(() => clubCell.classList.remove('delta-plus', 'delta-minus'), 3000);
      }
      const oldSto = parseInt(storageCell.textContent) || 0;
      const newSto = storageCounts[r] || 0;
      if (newSto !== oldSto) {
        storageCell.textContent = newSto;
        storageCell.classList.add(newSto > oldSto ? 'delta-plus' : 'delta-minus');
        setTimeout(() => storageCell.classList.remove('delta-plus', 'delta-minus'), 3000);
      }
    }
  });
};

const futHomeOverride = async () => {
  const homeHubInit = UTHomeHubView.prototype.init;
  UTHomeHubView.prototype.init = async function () {
    createSBCTab();
    players = await fetchPlayers();
    let storage = await getStoragePlayers();

    players = players.filter((f) => !storage.map((m) => m.definitionId).includes(f.definitionId));
    players = players.concat(storage);
    await fetchLowestPriceByRating();
    //    await fetchPlayerPrices(players);
    let sbcs = await sbcSets();
    await fetchPlayerPrices(
      sbcs.sets.filter((s) => s.awards[0]?.item).map((s) => s.awards[0]?.item)
    );
    homeHubInit.call(this);
    let sbcSettingsLogin = findSBCLogin(getSolverSettings(), 'sbcOnLogin');

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
      // Create progress bar for login SBCs

      // Track total SBCs to complete
      const totalSbcs = sbcLogin.length;
      let completedSbcs = 0;

      const processNextSbc = () => {
        console.log('Processing next SBC:', sbcLogin);
        if (sbcLogin.length === 0) {
          return;
        }

        let sbcToTry = sbcLogin.shift();
        sbcLogin = sbcLogin.slice();

        services.Notification.queue([
          `${sbcToTry[2]} SBC Started (${completedSbcs}/${totalSbcs})`,
          UINotificationType.POSITIVE,
        ]);

        solveSBC(sbcToTry[0], sbcToTry[1], true);
      };

      processNextSbc();
    }

    if (getSettings(0, 0, 'collectConcepts')) {
      conceptPlayers = await getConceptPlayers();
      await fetchPlayerPrices(conceptPlayers);
    }
  };
};

let count;

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function countDown() {
  count = Math.max(0, count - 1);
  counter.count(pad(count, 4));
}
var counter;
let failedChallenges;
let getSBCPrice = (item, sbcId = 0, challengeId = 0) => {
  if (isItemFixed(item)) {
    return 1;
  }

  let sbcPrice = Math.max(getPrice(item), getPrice({ definitionId: item.rating + '_CBR' }), 100);

  if (getPrice(item) == -1) {
    return sbcPrice * 1.5;
  }

  if (item.concept) {
    return getSettings(0, 0, 'conceptPremium') * sbcPrice;
  }
  if (
    (
      (item.isSpecial()
        ? ''
        : services.Localization.localize('search.cardLevels.cardLevel' + item.getTier()) + ' ') +
      services.Localization.localize('item.raretype' + item.rareflag)
    ).includes('volution')
  ) {
    return getSettings(0, 0, 'evoPremium') * sbcPrice;
  }
  sbcPrice = sbcPrice - (100 - item.rating); //Rating Discount

  sbcPrice = sbcPrice * (item.duplicateId > 0 ? getSettings(sbcId, challengeId, 'duplicateDiscount') / 100 : 1); // Dupe Discount

  sbcPrice = sbcPrice * (item?.isStorage ? getSettings(sbcId, challengeId, 'duplicateDiscount') / 100 : 1);
  sbcPrice = sbcPrice * (!item.isTradeable() ? getSettings(sbcId, challengeId, 'untradeableDiscount') / 100 : 1);

  return sbcPrice;
};
let countDownInterval;
let logPollInterval;
let createSbc = true;
let concepts = false;
let solveSBC = async (sbcId, challengeId, autoSubmit = false, repeat = null, autoOpen = false , trynext = false) => {
  if (createSbc != true) {
    showNotification('SBC Stopped');
    createSbc = true;
    return;
  }
   let sbcData = await fetchSBCData(sbcId, challengeId);
  console.log('Sbc Started',sbcData?.sbcName, sbcData?.challengeName,sbcData);
  await ratingCountUI();
  counter = new Counter('.numCounter', {
    direction: 'rtl',
    delay: 200,
    digits: 3,
  });

  showLoader(true);
  if (sbcData == null) {
    hideLoader();
    if (sbcLogin.length > 0) {
      let sbcToTry = sbcLogin.shift();
      sbcLogin = sbcLogin.slice();
      services.Notification.queue([sbcToTry[2] + ' SBC Started', UINotificationType.POSITIVE]);
      goToPacks();
      await solveSBC(sbcToTry[0], sbcToTry[1], true);
      return;
    }
    showNotification('SBC not available', UINotificationType.NEGATIVE);
    return;
  }
  addSbcInfo(sbcData.sbcName, sbcData.challengeName);
  await dealWithUnassigned();
  // await sendUnassignedtoTeam();
  // await swapDuplicates();
  // await sendDuplicatesToStorage();
  // await discardNonPlayerDupes();
  let players = await fetchPlayers();
  let storage = await getStoragePlayers();
  let unassigned = await fetchUnassigned();
  let PriceItems = getPriceItems();
  if (getSettings(sbcId, sbcData.challengeId, 'useConcepts')) {
    if (conceptPlayersCollected) {
      players = players.concat(
        conceptPlayers?.filter((f) => !PriceItems[f.definitionId].isExtinct)
      );
      console.log('conceptPlayers', conceptPlayers, conceptPlayers.length);
    } else {
      showNotification(
        'Still Collecting Concept Players, They will not be used for this solution',
        UINotificationType.NEGATIVE
      );
    }
  }
  showLoader(true);
  let allSbcData = await sbcSets();
  let sbcSet = allSbcData.sets.filter((e) => e.id == sbcData.setId)[0];
  let challenges = await getChallenges(sbcSet);
  let sbcChallenge = challenges.challenges.filter((i) => i.id == sbcData.challengeId)[0];
  for (let challenge of challenges.challenges) {
    await loadChallenge(challenge);
  }

  // storage = storage.concat(unassigned)
  players = players.filter((f) => !storage.map((m) => m.definitionId).includes(f?.definitionId));
  players = players.concat(storage);
  players = players.filter((item) => item != undefined);
  await fetchPlayerPrices(players);

  let maxRating = getSettings(sbcId, sbcData.challengeId, 'maxRating');
  let useDupes = getSettings(sbcId, sbcData.challengeId, 'useDupes');

  let duplicateIds = await fetchDuplicateIds();
  let storageIds = storage.map((m) => m.id);
  let chemUtil = new UTSquadChemCalculatorUtils();
  chemUtil.chemService = services.Chemistry;
  chemUtil.teamConfigRepo = repositories.TeamConfig;
  let sbcPlayerIds = services.SBC.repository.getSets().filter(s => s.id === sbcId).reduce(function(e,t){t=t.getChallenges().filter(f=>f.id!=sbcData.challengeId);return 0<t.length&&t.forEach(function(t){t.squad&&e.push(t.squad._players.filter(f=>f._item.id>0).map(m=>m._item.id))}),e},[]).flat()
  console.log('sbcPlayerIds', sbcPlayerIds);
  players.forEach((item) => {
    item.isStorage = storageIds.includes(item?.id);
    item.isSbcPlayer = sbcPlayerIds.includes(item?.id);
    item.isDuplicate = duplicateIds.includes(item?.id) || unassigned.includes(item?.id);
    item.profile = chemUtil.getChemProfileForPlayer(item);
    item.normalizeClubId = chemUtil.normalizeClubId(item.teamId);
  });
  let excludeLeagues = getSettings(sbcId, sbcData.challengeId, 'excludeLeagues') || [];
  let excludeNations = getSettings(sbcId, sbcData.challengeId, 'excludeNations') || [];
  let excludeRarity = getSettings(sbcId, sbcData.challengeId, 'excludeRarity') || [];
  let excludeTeams = getSettings(sbcId, sbcData.challengeId, 'excludeTeams') || [];
  let excludePlayers = getSettings(sbcId, sbcData.challengeId, 'excludePlayers') || [];
  let excludeSbc = getSettings(sbcId, sbcData.challengeId, 'excludeSbc') || false;
  let excludeObjective = getSettings(sbcId, sbcData.challengeId, 'excludeObjective') || false;
  let excludeSpecial = getSettings(sbcId, sbcData.challengeId, 'excludeSpecial') || false;
  let excludeTradable = getSettings(sbcId, sbcData.challengeId, 'excludeTradable') || false;
  let excludeExtinct = getSettings(sbcId, sbcData.challengeId, 'excludeExtinct') || false;
  let onlyStorage = getSettings(sbcId, sbcData.challengeId, 'onlyStorage') || false;
  let excludeSbcSquads = getSettings(sbcId, sbcData.challengeId, 'excludeSbcSquads') || false;
  let backendPlayersInput = players
    .filter(
      (item) =>
        (useDupes && (item.isStorage || item.isDuplicate)) ||
        (item.loans < 0 &&
          getSBCPrice(item) < 100000 &&
          item.rating <= maxRating &&
          !excludePlayers.includes(item.definitionId) &&
          !excludeLeagues.includes(item.leagueId) &&
          !excludeNations.includes(item.nationId) &&
          !excludeRarity.includes(
            services.Localization.localize('item.raretype' + item.rareflag)
          ) &&
          (!item?.isSbcPlayer || !excludeSbcSquads) &&
          !excludeTeams.includes(item.teamId) &&
          !item.isTimeLimited() &&
          !(PriceItems[item.definitionId]?.isSbc && excludeSbc) &&
          !(PriceItems[item.definitionId]?.isObjective && excludeObjective) &&
          !(item?.isSpecial() && excludeSpecial) &&
          !(item?.isTradeable() && excludeTradable) &&
          !(PriceItems[item.definitionId]?.isExtinct && excludeExtinct) &&
          (item?.isStorage || !onlyStorage) &&
          !sbcData.subs.includes(item.definitionId))
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
            ? ''
            : services.Localization.localize('search.cardLevels.cardLevel' + item.getTier()) +
              ' ') + services.Localization.localize('item.raretype' + item.rareflag),
        assetId: item._metaData?.id,
        definitionId: item.definitionId,
        rating: item.rating,
        teamId: item.teamId,
        leagueId: item.leagueId,
        nationId: item.nationId,
        rarityId: item.rareflag,
        ratingTier: item.getTier(),
        isUntradeable: item.isTradeable(),
        isDuplicate: duplicateIds.includes(item.id),
        isStorage: storageIds.includes(item.id),
        preferredPosition: item.preferredPosition,
        possiblePositions: item.possiblePositions,
        groups: item.groups,
        isFixed: isItemFixed(item),
        concept: item.concept,
        price: getSBCPrice(item, sbcId, challengeId) || -1,
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
    maxSolveTime: getSettings(sbcId, sbcData.challengeId, 'maxSolveTime'),
  });

  count = getSettings(sbcId, sbcData.challengeId, 'maxSolveTime');

  clearInterval(countDownInterval);
  countDownInterval = setInterval(countDown, 1000);

  // Reset log index and start polling
  lastLogIndex = 0;
  logPollInterval = setInterval(pollSolverLogs, 1000);
  showLoader(true);
  let solution = await makePostRequest(apiUrl + '/solve', input);

  // Stop polling when solve is complete
  clearInterval(logPollInterval);
  clearInterval(countDownInterval);
  pollSolverLogs();
  if (createSbc != true) {
    hideLoader();
    showNotification('SBC Stopped');
    createSbc = true;
    return;
  }
  if (solution.status_code != 2 && solution.status_code != 4) {
    hideLoader();
    if (getSettings(0, 0, 'playSounds')) {
      wompSound.play();
    }
    showNotification(solution.status, UINotificationType.NEGATIVE);
    
    if (sbcLogin.length > 0) {
      let sbcToTry = sbcLogin.shift();
      sbcLogin = sbcLogin.slice();
      services.Notification.queue([sbcToTry[2] + ' SBC Started', UINotificationType.POSITIVE]);
      goToPacks();
      solveSBC(sbcToTry[0], sbcToTry[1], true);
      return;
    }
  }

  showNotification(
    solution.status,
    solution.status_code != 4 ? UINotificationType.NEUTRAL : UINotificationType.POSITIVE
  );



  window.sbcSet = sbcSet;
  window.challengeId = sbcData.challengeId;

  let newSbcSquad = new UTSBCSquadOverviewViewController();
  newSbcSquad.initWithSBCSet(sbcSet, sbcData.challengeId);
  let { _squad, _challenge } = newSbcSquad;

  _squad.removeAllItems();

  let _solutionSquad = [...Array(11)];
  sbcData.brickIndices.forEach(function (item, index) {
    _solutionSquad[item] = new UTItemEntity();
  });
  try {
    JSON.parse(solution.results)
      .sort((a, b) => b.Is_Pos - a.Is_Pos)
      .forEach(function (item, index) {
        let findMap = sbcData.formation.map(
          (currValue, idx) =>
            ((currValue == item.possiblePositions && item.Is_Pos == 1) || item.Is_Pos == 0) &&
            _solutionSquad[idx] == undefined
        );
        if (item.concept) {
          concepts = true;
        }
        _solutionSquad[
          findMap.findIndex((element) => {
            return element;
          })
        ] = players.filter((f) => item.id == f.id)[0];
      });
  } catch (error) {
    hideLoader();
    return;
  }
  sbcData.subs.forEach(function (item, index) {
    _solutionSquad.push(players.filter((f) => item == f.definitionId)[0]);
  });
  _squad.setPlayers(_solutionSquad, true);

  await loadChallenge(_challenge);

  let autoSubmitId = getSettings(sbcId, sbcData.challengeId, 'autoSubmit');
  let sbcSubmitted = false;
  if ((solution.status_code == autoSubmitId || autoSubmitId == 1) && autoSubmit && !concepts) {
    try {
      await sbcSubmit(_challenge, sbcSet);
      sbcSubmitted = true;
    } catch (error) {
      console.error('Error submitting SBC:', error);
      hideLoader();
      sbcSubmitted = false;
    }
  }
  if (sbcSubmitted) {
    if (getSettings(sbcId, sbcData.challengeId, 'autoOpenPacks')) {
      repositories.Store.setDirty();
      let item = sbcData.awards[0];
      
   
        let packs = await getPacks();
        await openPack(packs.packs.filter((f) => f.id == item)[0]);
     
    }
    if (!getSettings(sbcId, sbcData.challengeId, 'autoOpenPacks')) {
      goToPacks();
    }
    if (repeat == null) {
      //  console.log('getRepeatCount')
      repeat = getSettings(sbcId, sbcData.challengeId, 'repeatCount');
    }

    let totalRepeats = getSettings(sbcId, sbcData.challengeId, 'repeatCount') + 1;
    if (repeat != 0) {
      if (repeat < 0) {
        showNotification(`${Math.abs(repeat)} Completed`);
      } else {
        showNotification(`${totalRepeats - repeat} / ${totalRepeats} Completed`);
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
    getCurrentViewController().rootController.getRootNavigationController().popViewController();
    getCurrentViewController()
      .rootController.getRootNavigationController()
      .pushViewController(showSBC);
    services.SBC.saveChallenge(_challenge).observe(undefined, async function (sender, data) {
      if (!data.success) {
        if (getSettings(0, 0, 'playSounds')) {
          wompSound.play();
        }
        showNotification('Failed to save squad.', UINotificationType.NEGATIVE);

        if (data.error) {
          if (getSettings(0, 0, 'playSounds')) {
            wompSound.play();
          }
          showNotification(`Error code: ${data.error.code}`, UINotificationType.NEGATIVE);
        }
        hideLoader();

        return;
      }
    });
    hideLoader();
    if (getSettings(sbcId, sbcData.challengeId, 'sbcAllGroup') && trynext) {
      try {
      // Track which challenges in this set have already been tried during this solve cycle
      window.__sbcTried = window.__sbcTried || {};
      const key = String(sbcId);
      const tried = window.__sbcTried[key] || new Set();
      tried.add(sbcData.challengeId);
      window.__sbcTried[key] = tried;

      const all = await sbcSets();
      const setObj = all?.sets?.find(s => s.id == sbcId);
      if (setObj) {
        const chData = await getChallenges(setObj);
        const uncompleted = (chData?.challenges || []).filter(c => c.status !== 'COMPLETED');
        // Only consider challenges we haven't tried yet in this chain
        const remaining = uncompleted.filter(c => !tried.has(c.id));
        if (remaining.length > 0) {
        // Try from the "hardest"/last first to preserve prior behavior
        const nextChallenge = remaining[remaining.length - 1];
        services.Notification.queue(
          [`Trying another challenge: ${nextChallenge.name}`],
          UINotificationType.NEUTRAL
        );
        await solveSBC(sbcId, nextChallenge.id, autoSubmit, repeat, autoOpen, trynext);
        return;
        } else {
          if (window.__sbcTried[key].length>1){
        services.Notification.queue(
          [`All uncompleted challenges in "${setObj.name}" have been tried`],
          UINotificationType.NEUTRAL
        );
      }
        window.__sbcTried = {};
        }
      }
      } catch (err) {
      console.warn('Could not try next challenge in set:', err);
      }
    }
  }

  if (sbcLogin.length > 0) {
    let sbcToTry = sbcLogin.shift();
    sbcLogin = sbcLogin.slice();
    services.Notification.queue([sbcToTry[2] + ' SBC Started', UINotificationType.POSITIVE]);
    solveSBC(sbcToTry[0], sbcToTry[1], true);
  }
  hideLoader();
  //getAppMain().getRootViewController().getPresentedViewController().getCurrentViewController().rootController.getRootNavigationController().pushViewController(currentView);
};

let goToPacks = async () => {
  await dealWithUnassigned();
  let ulist = await fetchUnassigned();

  if (ulist.length > 0) {
    goToUnassignedView();
    return;
  }
  repositories.Store.setDirty();
  let n = new UTStorePackViewController();
  n.init();
  getCurrentViewController().rootController.getRootNavigationController().popViewController();
  getCurrentViewController().rootController.getRootNavigationController().pushViewController(n);
};
let goToUnassignedView = async () => {
  return new Promise((resolve, reject) => {
    repositories.Item.unassigned.clear();
    repositories.Item.unassigned.reset();
    var r = getCurrentViewController().rootController;
    hideLoader(),
      showLoader(),
      services.Item.requestUnassignedItems().observe(this, async function (e, t) {
        var i;

        e.unobserve(r);
        var o = r.getRootNavigationController();
        if (o) {
          var n = isPhone()
            ? new UTUnassignedItemsViewController()
            : new UTUnassignedItemsSplitViewController();
          t.success && JSUtils.isObject(t.response)
            ? n.initWithItems(
                null === (i = t.response) || void 0 === i
                  ? void 0
                  : i.items.sort(function (t, e) {
                      return getSBCPrice(e) - getSBCPrice(t);
                    })
              )
            : n.init();
          services.Item.clearTransferMarketCache();

          o.popToRootViewController();
          o.pushViewController(n);
        }
        hideLoader();
        resolve();
      });

    hideLoader();
  });
};
let getPacks = async () => {
  return new Promise((resolve, reject) => {
    let packResponse;
    repositories.Store.setDirty();
    services.Store.getPacks('ALL', true, true).observe(this, function (obs, res) {
      if (!res.success) {
        obs.unobserve(this);
        reject(res.status);
      } else {
        packResponse = res.response;
        resolve(packResponse);
      }
    });
  });
};

const sbcSubmitChallengeOverride = () => {
  const sbcSubmit = PopupQueueViewController.prototype.closeActivePopup;
  PopupQueueViewController.prototype.closeActivePopup = function () {
    sbcSubmit.call(this);
    createSBCTab();
  };
};
let ppView;
let ppController;
const unassignedItemsOverride = () => {
  const popupDisplay = PopupQueueViewController.prototype.displayPopup;
  PopupQueueViewController.prototype.displayPopup = function (e) {
    popupDisplay.call(this, e);
    console.log(this.queue[0]);
    if (this.queue[0] instanceof UTGameRewardsViewController) {
      this.closeActivePopup();
      goToUnassignedView();
    }
  };
  UTSectionedItemListView.prototype.addItems = function (e, t, i) {
    e.sort(function (a, b) {
      return getSBCPrice(b) - getSBCPrice(a);
    });
    var o = this;
    return (
      void 0 === i && (i = ListItemPriority.DEFAULT),
      (this.listRows = e.map(function (e) {
        return o.generateListRow(e, t, i);
      })),
      this.listRows
    );
  };

  const unassignedItems = UTSectionedItemListView.prototype.render;
  UTSectionedItemListView.prototype.render = async function (...args) {
    let players = [];
    for (const { data } of this.listRows) {
      players.push(data);
    }

    await fetchPlayerPrices(players);
    unassignedItems.call(this, ...args);
  };
  const ppItems = UTPlayerPicksView.prototype.setCarouselItems;
  UTPlayerPicksView.prototype.setCarouselItems = async function (...args) {
    await fetchPlayerPrices(args[0]);

    // Only show player picks if above minimum rating threshold
    const minRating = getSettings(0, 0, 'animateWalkouts');
    const hasHighRatedPlayer = args[0].some((player) => player.rating >= minRating);

    console.table(
      args[0]
        .sort(function (t, e) {
          const priceDiff = getPrice(e) - getPrice(t);
          if (priceDiff === 0) {
            return e.rating - t.rating;
          }
          return priceDiff;
        })
        .map((item) => {
          return {
            name: item._staticData.name,
            cardType:
              (item.isSpecial()
                ? ''
                : services.Localization.localize('search.cardLevels.cardLevel' + item.getTier()) +
                  ' ') + services.Localization.localize('item.raretype' + item.rareflag),
            rating: item.rating,
            futggPrice: getPrice(item),
            sbcPrice: getSBCPrice(item),
            fodderPrice: getPrice({ definitionId: item.rating + '_CBR' }),
            isFodder: isFodder(item),
          };
        })
    );
    if (hasHighRatedPlayer) {
      console.log('tada');
      let packs = await getPacks();
      await showPack(packs.packs[0], {
        items: args[0].sort(function (t, e) {
          const priceDiff = getPrice(e) - getPrice(t);
          if (priceDiff === 0) {
            return e.rating - t.rating;
          }
          return priceDiff;
        }),
      });
    }
    args[0] = args[0].sort(function (t, e) {
      const priceDiff = getPrice(e) - getPrice(t);
      if (priceDiff === 0) {
        return e.rating - t.rating;
      }
      return priceDiff;
    });
    ppItems.call(this, ...args);
  };

  const ppRender = UTPlayerPicksViewController.prototype.render;

  UTPlayerPicksViewController.prototype.render = async function (...args) {
    ppController = this;
    await fetchPlayerPrices(this.picks);
    this.selectedPicks = this.picks
      .sort(function (t, e) {
        const priceDiff = getPrice(e) - getPrice(t);
        if (priceDiff === 0) {
          return e.rating - t.rating;
        }
        return priceDiff;
      })
      .slice(0, this.availablePicks);
    r = this.getView();

    await ppRender.call(this, ...args);
    console.log('here');
    // ppController.view._triggerActions(UTPlayerPicksView.Event.CONTINUE);
    // ppController.view._triggerActions(UTPlayerPicksView.Event.CONFIRM_PICK);
  };
};
let sbcSubmit = async function (challenge, sbcSet, i) {
  services.Chemistry.resetCustomProfiles();
  services.Chemistry.requestChemistryProfiles().observe(this, function (e, t) {
    services.SBC.getCachedSBCSquads().map(function (e) {
      e.updateChemistry();
      e.update(e);
    });
  });
  return new Promise((resolve, reject) => {
    services.SBC.submitChallenge(
      challenge,
      sbcSet,
      true,
      services.Chemistry.isFeatureEnabled()
    ).observe(this, async function (obs, res) {
      if (!res.success) {
        obs.unobserve(this);

        if (getSettings(0, 0, 'playSounds')) {
          wompSound.play();
        }
        showNotification('Failed to submit', UINotificationType.NEGATIVE);
        hideLoader();

        reject(res);
      } else {
        showNotification('SBC Submitted', UINotificationType.POSITIVE);
        createSBCTab();
        resolve(res);
      }
    });
  });
};

const sbcViewOverride = () => {
  UTSquadEntity.prototype._calculateRating = function () {
    var t = this.isSBC() ? this.getFieldPlayers() : this.getFieldAndSubPlayers(),
      e = services.Configuration.checkFeatureEnabled(
        UTServerSettingsRepository.KEY.SQUAD_RATING_FLOAT_CALCULATION_ENABLED
      ),
      n = 0,
      r = UTSquadEntity.FIELD_PLAYERS;
    if (
      (t.forEach(function (t, e) {
        var i = t.item;
        i.isValid() && ((n += i.rating), UTSquadEntity.FIELD_PLAYERS <= e && r++);
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
            a += e < UTSquadEntity.FIELD_PLAYERS ? i.rating - o : 0.5 * (i.rating - o);
          }
        }),
        (n = Math.round(a, 2));
    } else {
      var s = Math.min(Math.floor(n / r), 99);
      t.forEach(function (t, e) {
        var i = t.item;
        if (i.isValid()) {
          if (i.rating <= s) return;
          n += e < UTSquadEntity.FIELD_PLAYERS ? i.rating - s : Math.floor(0.5 * (i.rating - s));
        }
      });
    }
    this._rating = new Intl.NumberFormat('en', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Math.min(Math.max(n / r, 0), 99));
  };

  const squadDetailPanelView = UTSBCSquadDetailPanelView.prototype.init;
  UTSBCSquadDetailPanelView.prototype.init = function (...args) {
    const response = squadDetailPanelView.call(this, ...args);

    const button = createButton('idSolveSbc', 'Solve SBC', async function () {
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
        createElem('span', null, `COMPLETED: ${this.data.timesCompleted}. `),
        this.__rewardsHeader
      );
    }
  };
};

const lockedLabel = 'SBC Unlock';
const unlockedLabel = 'SBC Lock';
const fixedLabel = 'SBC Use actual prices';
const unfixedLabel = 'SBC Set Price to Zero';

const playerItemOverride = () => {
  UTItemEntity.prototype.init = UTItemEntity.prototype.update;
  UTItemEntity.prototype.isDuplicateLoanPlayer = function () {
    return this.isValid() && this.isPlayer() && this.duplicateId > 0 && this.isLimitedUse();
  };
  UTItemEntity.prototype.isDuplicate = function () {
    return this.isValid() && this.isPlayer() && this.duplicateId > 0;
  };
  const UTDefaultSetItem = UTSlotActionPanelView.prototype.setItem;
  UTSlotActionPanelView.prototype.setItem = function (e, t) {
    e.isDuplicate = function () {
      return e.isValid() && e.isPlayer() && e.duplicateId > 0;
    };
    e.isDuplicateLoanPlayer = function () {
      return e.isValid() && e.isPlayer() && e.duplicateId > 0 && e.isLimitedUse();
    };
    const result = UTDefaultSetItem.call(this, e, t);
    // Add refresh price button
    if (!this.refreshPriceButton && e.isPlayer()) {
      const refreshButton = new UTGroupButtonControl();
      refreshButton.init();
      refreshButton.setInteractionState(true);
      refreshButton.setText('Refresh Price');
      insertAfter(refreshButton, this._btnBio.__root);
      refreshButton.addTarget(
        this,
        async () => {
          // Remove existing price data for this player before refreshing
          let PriceItems = getPriceItems();
          if (e.definitionId in PriceItems) {
            delete PriceItems[e.definitionId];
            updateCBRMinPrice();
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

    if (e.loans > -1 || !e.isPlayer() || !e.id || e.isTimeLimited()) {
      return result;
    }
    // console.log(e)
    if (!e?.duplicateId > 0 && !isItemFixed(e) && !this.lockUnlockButton) {
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
    e.isDuplicate = function () {
      return e.isValid() && e.isPlayer() && e.duplicateId > 0;
    };
    e.isDuplicateLoanPlayer = function () {
      return e.isValid() && e.isPlayer() && e.duplicateId > 0 && e.isLimitedUse();
    };
    const result = UTDefaultAction.call(this, e, t, i, o, n, r, s);
    // Add refresh price button in default action panel
    if (!this.refreshPriceButton && e.isPlayer()) {
      const refreshButton = new UTGroupButtonControl();
      refreshButton.init();
      refreshButton.setInteractionState(true);
      refreshButton.setText('Refresh Price');
      insertAfter(refreshButton, this._bioButton.__root);
      refreshButton.addTarget(
        this,
        async () => {
          await fetchPlayerPrices([e]);
          showNotification(`Price refreshed`, UINotificationType.POSITIVE);
          try {
            getCurrentViewController().getCurrentController().leftController.renderView();
            getCurrentViewController()
              .getCurrentController()
              .rightController.currentController.renderView();
          } catch (error) {
            getCurrentViewController().getCurrentController().leftController.refreshList();
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
      refreshButton.setText('Refresh Price');
      insertAfter(refreshButton, this._bioButton.__root);
      refreshButton.addTarget(
        this,
        async () => {
          await fetchPlayerPrices([e]);
          showNotification(`Price refreshed`, UINotificationType.POSITIVE);
          try {
            getCurrentViewController().getCurrentController().leftController.renderView();
            getCurrentViewController()
              .getCurrentController()
              .rightController.currentController.renderView();
          } catch (error) {
            getCurrentViewController().getCurrentController().leftController.refreshList();
          }
        },
        EventType.TAP
      );
      this.refreshPriceButton = refreshButton;
    }

    if (e.loans > -1 || !e.isPlayer() || !e.id || e.isTimeLimited()) {
      return result;
    }

    if (!e?.duplicateId > 0 && !isItemFixed(e)) {
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
              getCurrentViewController().getCurrentController().leftController.renderView();
              getCurrentViewController()
                .getCurrentController()
                .rightController.currentController.renderView();
            } catch (error) {
              getCurrentViewController().getCurrentController().leftController.refreshList();
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
              showNotification(`Removed Must Use`, UINotificationType.POSITIVE);
            } else {
              fixItem(e);
              button.setText(fixedLabel);
              showNotification(`Must Use Set`, UINotificationType.POSITIVE);
            }
            try {
              getCurrentViewController().getCurrentController().leftController.renderView();
              getCurrentViewController()
                .getCurrentController()
                .rightController.currentController.renderView();
            } catch (error) {
              getCurrentViewController().getCurrentController().leftController.refreshList();
            }
          },
          EventType.TAP
        );
        this.fixUnfixButton = button;
      }
    }

    return result;
  };

  const UTPlayerItemView_renderItem = UTPlayerItemView.prototype.renderItem;
  UTPlayerItemView.prototype.renderItem = async function (item, t) {
    const result = UTPlayerItemView_renderItem.call(this, item, t);
    const duplicateIds = await fetchDuplicateIds();
    let storage = await getStoragePlayers();
    if (duplicateIds.includes(item.id) || storage.map((m) => m.id).includes(item.id)) {
      this.__root.style.opacity = '0.4';
    }
    let priceElement = await getPriceDiv(item);
    // Add the price element to the player item
    if (this.__root && priceElement) {
      this.__root.prepend(priceElement);
    }

    if (isItemLocked(item)) {
      addClass(this, 'locked');
    } else {
      removeClass(this, 'locked');
    }
    if (isItemFixed(item)) {
      addClass(this, 'fixed');
    } else {
      removeClass(this, 'fixed');
    }
    return result;
  };
};
const getPriceDiv = async (item) => {
  if (getSettings(0, 0, 'showPrices') && item.definitionId > 0) {
    let PriceItems = getPriceItems();
    if (!PriceItems[item.definitionId]) {
      return null;
    }
    let price = getPrice(item) * (isItemFixed(item) ? 0 : 1);
    if (!(item.definitionId in PriceItems) || !('isSbc' in PriceItems[item.definitionId])) {
    }

    let symbol = PriceItems[item.definitionId]?.isSbc
      ? 'currency-sbc'
      : PriceItems[item.definitionId]?.isObjective
      ? 'currency-objective'
      : 'currency-coins';
    const priceElement = document.createElement('div');
    priceElement.className = `${symbol} item-price`;

    if (isFodder(item)) {
      priceElement.style.border = '1px solid red'; // Add red border for fodder players
      priceElement.style.color = '#ff0000'; // Change text color to red as well
    }
    priceElement.textContent = PriceItems[item.definitionId]?.isExtinct
      ? 'EXTINCT'
      : PriceItems[item.definitionId]?.isObjective
      ? ''
      : price.toLocaleString();

    return priceElement;
  }
  return null;
};
let priceCacheMinutes = 60;
let PRICE_ITEMS_KEY = 'futggPrices';
let cachedPriceItems;
let isPriceOld = function (item) {
  let PriceItems = getPriceItems();
  if (!(item?.definitionId in PriceItems)) {
    return true;
  }
  let cacheMin = getSettings(0, 0, 'priceCacheMinutes');
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
  let cacheMin = item.concept ? 1440 : getSettings(0, 0, 'priceCacheMinutes');
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

// Function to update minimum prices for CBR (Common Base Rating)
const updateCBRMinPrice = () => {
  const PriceItems = getPriceItems();
  if (!PriceItems) return {};

  // Build a map: rating → min non-extinct price found
  const minByRating = new Map();

  for (const key of Object.keys(PriceItems)) {
    // Skip rating reference entries
    if (key.endsWith('_CBR')) continue;
    const entry = PriceItems[key];
    if (!entry || typeof entry.rating !== 'number') continue;
    if (!entry.price || entry.isExtinct) continue;

    const currentMin = minByRating.get(entry.rating) ?? Infinity;
    if (entry.price < currentMin) {
      minByRating.set(entry.rating, entry.price);
    }
  }

  // Update CBR entries based on minByRating
  for (const [rating, minPrice] of minByRating.entries()) {
    const cbrKey = `${rating}_CBR`;
    const existing = PriceItems[cbrKey] || {};
    PriceItems[cbrKey] = {
      ...existing,
      eaId: cbrKey,
      rating,
      price: minPrice,
      timeStamp: new Date(),
      isExtinct: false,
    };
  }

  savePriceItems();
  cachedPriceItems = PriceItems;
  return cachedPriceItems;
};
let PriceItem = function (items) {
  //  console.log(item, price, lastUpdated)

  cachedPriceItems = getPriceItems();
  let timeStamp = new Date(Date.now());
  for (let key in items) {
    items[key]['timeStamp'] = timeStamp;
    cachedPriceItems[items[key]['eaId']] = items[key];

    // Check if this is a rating reference item (CBR)
    if (items[key]['eaId'] && items[key]['eaId'].toString().includes('_CBR')) {
      const rating = parseInt(items[key]['eaId'].toString().split('_')[0]);
      let cheapestPrice = items[key].price;

      // Look through all cached items to find cheaper options with same rating
      for (let cachedKey in cachedPriceItems) {
        const cachedItem = cachedPriceItems[cachedKey];
        if (
          cachedItem &&
          !cachedKey.includes('_CBR') &&
          cachedItem.rating === rating &&
          cachedItem.price &&
          cachedItem.price < cheapestPrice &&
          !cachedItem.isExtinct
        ) {
          console.log('Cheaper item found', items[key], cachedItem);
          cheapestPrice = cachedItem.price;
        }
      }

      // Use the cheapest price found
      items[key] = cachedItem;
    }
  }
  updateCBRMinPrice();
};

let getPriceItems = function () {
  if (cachedPriceItems) {
    return cachedPriceItems;
  }
  cachedPriceItems = {};
  function getFromIndexedDB() {
    return new Promise((resolve) => {
      const dbName = 'futSBCDatabase';
      const storeName = 'priceItems';
      const request = indexedDB.open(dbName, 1);

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      };

      request.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        // Get the single entry that contains all price items
        const getAllRequest = store.get('allPriceItems');

        getAllRequest.onsuccess = function (event) {
          if (event.target.result && event.target.result.data) {
            resolve(event.target.result.data || {});
          } else {
            resolve({});
          }
        };

        transaction.onerror = function () {
          console.error('Error reading from IndexedDB');
          resolve(null);
        };
      };

      request.onerror = function (event) {
        console.error('Error opening IndexedDB:', event.target.error);
        resolve(null);
      };
    });
  }

  getFromIndexedDB().then((idbItems) => {
    cachedPriceItems = idbItems;
  });
  return cachedPriceItems;
};

let isFodder = function (item) {
  let PriceItems = getPriceItems();
  if (PriceItems[item.definitionId]?.isExtinct || PriceItems[item.definitionId]?.isObjective) {
    return false;
  }
  let price = getPrice(item);
  let fodderPrice = Math.max(
    getPrice({ definitionId: item.rating + '_CBR' }),
    item?._itemPriceLimits?.minimum || 0
  );
  // console.table(item.rating,price,fodderPrice)
  if (price <= fodderPrice * 1.1) {
    return true;
  }
  return false;
};

let savePriceItems = function () {
  function saveToIndexedDB() {
    const dbName = 'futSBCDatabase';
    const storeName = 'priceItems';
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };

    request.onsuccess = function (event) {
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // First clear existing data
      store.clear().onsuccess = function () {
        // Store the entire price items collection in a single entry
        const allItems = {
          id: 'allPriceItems',
          data: cachedPriceItems,
        };

        store.put(allItems);
      };

      transaction.oncomplete = function () {
        console.log('Price items saved to IndexedDB');
      };

      transaction.onerror = function (error) {
        console.error('Error saving to IndexedDB:', error);
        // Fallback to localStorage if IndexedDB fails
        localStorage.setItem(PRICE_ITEMS_KEY, JSON.stringify(cachedPriceItems));
      };
    };

    request.onerror = function (event) {
      console.error('IndexedDB error:', event.target.error);
      // Fallback to localStorage if IndexedDB cannot be opened
      localStorage.setItem(PRICE_ITEMS_KEY, JSON.stringify(cachedPriceItems));
    };
  }

  // Call the function to save the data
  saveToIndexedDB();
};

function makeGetRequest(url) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
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
      method: 'POST',
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
        if (getSettings(0, 0, 'playSounds')) {
          wompSound.play();
        }
        showNotification(`Please check backend API is running`, UINotificationType.NEGATIVE);
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

  for (let i = 45; i <= 81; i++) {
    PriceItems[i + '_CBR'] = {
      price: i < 75 ? 200 : 400,
      timestamp: timeStamp,
      rating: i,
    };
  }
  cachedPriceItems = PriceItems;
  let highestRating = await getConceptPlayers(1);
  updateCBRMinPrice();
  for (let i = 81; i <= Math.max(...highestRating.map((m) => m.rating)); i++) {
    if (isPriceOld({ definitionId: i + '_CBR' })) {
      await fetchSingleCheapest(i);
    }
    await fetchSingleCheapest(i);
  }
  updateCBRMinPrice();
};
const fetchSingleCheapest = async (rating) => {
  return //this doesnt work any more since futgg changed their site
  const futggSingleCheapestByRatingResponse = await makeGetRequest(
    `https://www.fut.gg/players/?overall__gte=${rating}&overall__lte=${rating}&price__gte=100&sorts=current_price&market_players=1`
  );

  const doc = new DOMParser().parseFromString(futggSingleCheapestByRatingResponse, 'text/html');

  try {
    let playerLink = doc
      .getElementsByClassName('fut-card-container')[0]
      .href?.split('25-')[1]
      .replace('/', '');

    const futggResponse = await makeGetRequest(
      `https://www.fut.gg/api/fut/player-prices/25/?ids=${playerLink}`
    );
    //  console.log(rating,doc,`https://www.fut.gg/api/fut/player-prices/25/?ids=${playerLink}`, doc.getElementsByClassName("fut-card-container")[0].href)

    priceResponse = JSON.parse(futggResponse);
    priceResponse = priceResponse.data;
  } catch (error) {
    console.error(error, doc);

    return;
  }
  let PriceItems = getPriceItems();
  let timeStamp = new Date(Date.now());
  for (let key in priceResponse) {
    priceResponse[key]['timeStamp'] = timeStamp;
    priceResponse[key]['rating'] = rating;
    PriceItems[rating + '_CBR'] = priceResponse[key];
  }
  cachedPriceItems = PriceItems;
  console.log(rating, PriceItems[rating + '_CBR']);
};
let fetchPlayerPrices = async (players) => {
  // Filter out players that need price updates
  let idsArray = players.filter((f) => isPriceOld(f) && f?.isPlayer()).map((p) => p.definitionId);

  // If no prices to fetch, return early
  if (idsArray.length === 0) return;

  // Create progress bar
  const progressBarId = 'prices-progress-bar';
  const containerId = 'prices-progress-container';
  createProgressBar(progressBarId, containerId, 'Fetching Player Prices');

  let duplicateIds = await fetchDuplicateIds();
  let totalPrices = idsArray.length;
  let fetched = 0;

  while (idsArray.length) {
    const playersIdArray = idsArray.splice(0, 50);

    try {
      const futggResponse = await makeGetRequest(
        `https://www.fut.gg/api/fut/player-prices/25/?ids=${playersIdArray}`
      );

      let priceResponse = JSON.parse(futggResponse).data;
      // Add rating and name information to the price response
      for (let key in priceResponse) {
        // Find the matching player in the players array
        const matchingPlayer = players.find((p) => p.definitionId == priceResponse[key]['eaId']);

        priceResponse[key].rating = matchingPlayer.rating;
        priceResponse[key].name = matchingPlayer._staticData?.name || '';
      }
      PriceItem(priceResponse);

      // Update progress
      fetched += playersIdArray.length;
      const progress = (fetched / totalPrices) * 100;
      updateProgressBar(progressBarId, progress);
    } catch (error) {
      console.error(error);
      await wait();
      continue;
    }
    updateCBRMinPrice();
  }

  // Remove progress bar after completion
  removeProgressBar(containerId);

  if (totalPrices > 0) {
    showNotification(`Fetched ${totalPrices} player prices`, UINotificationType.POSITIVE);
  }
};
let sound = new Audio('https://raw.githubusercontent.com/Yousuke777/sound/main/kansei.mp3');
let wompSound = new Audio('https://www.myinstants.com/media/sounds/downer_noise.mp3');
let nopeSound = new Audio('https://www.myinstants.com/media/sounds/engineer_no01.mp3');
const openPick = async (id) => {
  try {
    let pp = await fetchUnassigned();
    let playerPicks = pp.filter((m) => m.isPlayerPickItem() && m.definitionId === id);
    services.Item.redeem(playerPicks[0]);
    let n = new UTItemDetailsViewController();
    services.Item.requestPendingPlayerPickItemSelection().observe(n, function (e, t) {
      e.unobserve(n),
        t.success && JSUtils.isObject(t.response)
          ? n.showPlayerPicks(t.response.items, t.response.availablePicks, !0)
          : NetworkErrorManager.handleStatus(t.status);
    });
  } catch (err) {
    console.error('Error fetching or filtering:', err);
  }
};
let openPack = async (pack, repeat = 0, allPacks = false) => {
  hideLoader();
  showLoader();
  await dealWithUnassigned();
  let ulist = await fetchUnassigned();

  if (ulist.length > 0) {
    goToUnassignedView();
    return;
  }

  return new Promise(async (resolve, reject) => {
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
              return getSBCPrice(e) - getSBCPrice(t);
            })
            .map((item) => {
              return {
                name: item._staticData.name,
                cardType:
                  (item.isSpecial()
                    ? ''
                    : services.Localization.localize(
                        'search.cardLevels.cardLevel' + item.getTier()
                      ) + ' ') + services.Localization.localize('item.raretype' + item.rareflag),
                rating: item.rating,
                futggPrice: getPrice(item),
                sbcPrice: getSBCPrice(item),
              };
            })
        );
        if (
          packPlayers.items.filter(function (e) {
            return e.rating >= getSettings(0, 0, 'animateWalkouts');
          }).length > 0
        ) {
          createSbc = false;
          await showPack(pack, packPlayers);
        }

        createSBCTab();
        repeat = repeat - 1;
        if (repeat > 0) {
          await openPack(pack, repeat, false);
        } else if (allPacks) {
          let packs = await getPacks();
          let nextPack = packs.packs.find((p) => p.isMyPack);

          if (nextPack) {
            await openPack(nextPack, 0, true);
          }
        }
        await goToUnassignedView();
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
          return getSBCPrice(e) - getSBCPrice(t);
        });
      o = s[0];
    } else
      packPlayers.items.forEach(function (e) {
        (!o || o.discardValue < e.discardValue) && (o = e);
      });

    if (o && o.rating >= getSettings(0, 0, 'animateWalkouts')) {
      if (getSettings(0, 0, 'playSounds')) {
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
        (a.modalDisplayStyle = 'fullscreen'),
        c.presentViewController(a, !0);
    }

    resolve();
  });
};
const packOverRide = async () => {
  const packOpen = UTStoreViewController.prototype.eOpenPack;
  UTStoreViewController.prototype.eOpenPack = async function (...args) {
    hideLoader();
    showLoader();
    await dealWithUnassigned();
    createSBCTab();

    let packs = await getPacks();
    let item = args[2].articleId;
    let packToOpen = packs.packs.filter((f) => f.id == item)[0];

    let i = services.Localization;

    services.Notification.queue([
      'Opening Pack:  ' + i.localize(packToOpen.packName),
      UINotificationType.POSITIVE,
    ]);
    if (packs.packs.filter((f) => f.id == item).length > 0) {
      if (packToOpen.isMyPack) {
        await openPack(packToOpen);
      } else {
        let e = args[1];
        let m =
          e === 'UTStorePackDetailsView.Event.BUY_POINTS' ||
          e === 'UTStoreBundleDetailsView.Event.BUY_POINTS' ||
          e === 'UTStoreRevealModalListView.Event.POINTS_PURCHASE'
            ? GameCurrency.POINTS
            : GameCurrency.COINS;

        packToOpen.purchase(m).observe(new UTStoreViewController(), (obs, event) => {
          console.log('coin pack', obs, event);
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
  let PriceItems = getPriceItems();
  for (const { rootElement, item } of squadSlots) {
    if (duplicateIds.includes(item.id)) {
      rootElement.style.opacity = '0.4';
    }

    const element = rootElement;
    appendPriceToSlot(element, item);

    total += getPrice(item);
  }
  appendSquadTotal(total);
};
const appendSquadTotal = (total) => {
  if (getSettings(0, 0, 'showPrices')) {
    // Check if any element with class "squadTotal" exists
    if (document.querySelector('.squadTotal')) {
      // Update textContent of all elements with class "squadTotal"
      document.querySelectorAll('.squadTotal').forEach(function (el) {
        el.textContent = total.toLocaleString();
      });
    } else {
      // Create the new element from HTML string
      var html = `<div class="rating chemistry-inline">
                <span class="ut-squad-summary-label">Squad Price</span>
                <div>
                  <span class="ratingValue squadTotal currency-coins">${total.toLocaleString()}</span>
                </div>
              </div>`;
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      var newElem = tempDiv.firstElementChild;

      // Find the element with class "chemistry"
      var chemistryElem = document.querySelector('.chemistry');
      if (chemistryElem && chemistryElem.parentNode) {
        // Insert newElem immediately after the chemistry element
        chemistryElem.parentNode.insertBefore(newElem, chemistryElem.nextSibling);
      }
    }
  }
};
const appendPriceToSlot = async (rootElement, item) => {
  let priceElement = await getPriceDiv(item);
  if (priceElement) {
    rootElement.prepend(priceElement);
  }
};

const getUserPlatform = () => {
  if (services.User.getUser().getSelectedPersona().isPC) {
    return 'pc';
  }
  return 'ps';
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
  const button = document.createElement('button');
  button.classList.add('ut-tab-bar-item');
  button.id = id;
  const defaultStyles = {
    width: '100%',
    background: '#1e1f1f',
    marginTop: '0px',
  };

  const combinedStyles = { ...defaultStyles, ...style };
  Object.keys(combinedStyles).forEach((key) => {
    button.style[key] = combinedStyles[key];
  });
  button.innerHTML = content;
  button.addEventListener('click', () => {
    let hoverNav = document.getElementById('hoverNav');

    if (hoverNav) {
      hoverNav.remove();
    }
    callback();
  });
  button.addEventListener('mouseenter', async (e) => {
    button.classList.add('sbcToolBarHover');

    let parentElement = e.target.parentElement;
    while (parentElement && parentElement.tagName !== 'NAV') {
      parentElement = parentElement.parentElement;
    }
    if (parentElement.id == 'sbcToolbar') {
      let hoverNav = document.getElementById('hoverNav');

      if (hoverNav) {
        hoverNav.remove();
      }
    }

    if (hover) {
      let sbcToolbar = document.getElementById('sbcToolbar');
      if (sbcToolbar) {
        let hoverTimeout = setTimeout(async () => {
          let hoverBtn = await hover();
          let sbcToolbar = document.getElementById('sbcToolbar');
          if (sbcToolbar) {
            sbcToolbar.appendChild(hoverBtn);
          }
        }, 500);

        button.addEventListener('mouseleave', () => {
          clearTimeout(hoverTimeout);
        });
      }
    }
  });
  button.addEventListener('mouseleave', () => {
    button.classList.remove('sbcToolBarHover');
  });
  return button;
};

const createHoverNav = (id, title, footer, buttons, style = {}) => {
  const nav = document.createElement('nav');
  nav.classList.add('ut-tab-bar', 'sbc-auto');
  nav.id = 'hoverNav';
  const defaultStyles = {
    backgroundImage: 'none',
    paddingTop: '5px',
    right: '6.5rem',
    width: 'auto',
    position: 'absolute',
    zIndex: '1000',
    direction: 'rtl',
    maxHeight: '70vh',
    background: 'none',
  };
  const combinedStyles = { ...defaultStyles, ...style };
  Object.keys(combinedStyles).forEach((key) => {
    nav.style[key] = combinedStyles[key];
  });

  if (title) {
    let navTitle = document.createElement('span');
    navTitle.innerHTML = `<b>${title}</b>`;
    navTitle.style.display = 'block';
    navTitle.style.textAlign = 'center';
    navTitle.style.background = '#1e1f1f';
    nav.appendChild(navTitle);
  }
  let btnDiv = createDiv(`btnDiv${id}`, {});
  btnDiv.style.overflowY = 'auto';
  btnDiv.style.height = 'auto';
  btnDiv.style.width = 'auto !important';
  btnDiv.style.display = 'block';
  btnDiv.style.textAlign = 'center';
  btnDiv.style.borderBottomLeftRadius = '20px';
  btnDiv.style.borderBottomRightRadius = '20px';
  buttons.forEach((button) => {
    btnDiv.appendChild(button);
  });
  nav.appendChild(btnDiv);
  if (footer) {
    let navFooter = document.createElement('span');
    navFooter.innerHTML = `<i>${footer}</i>`;
    navFooter.style.display = 'block';
    navFooter.style.textAlign = 'center';
    nav.appendChild(navFooter);
  }
  nav.addEventListener('mouseleave', () => {
    nav.remove();
  });

  return nav;
};

const createDiv = (id, style) => {
  const div = document.createElement('div');
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
    packs.packs.filter((f) => f.isMyPack || f?.prices?._collection?.COINS?.amount < 101).length
  }</span>`;
  let packCounts = packs.packs
    .filter((f) => f.isMyPack || f?.prices?._collection?.COINS?.amount < 101)
    .reduce((acc, pack) => {
      let key = `${pack.packName} ${pack.tradeable ? '(Tradable)' : '(Untradable)'}`;

      acc[key] = acc[key] || {};
      acc[key].count = (acc[key]?.count || 0) + 1;
      acc[key].packName =
        i.localize(pack.packName) +
        (pack?.prices?._collection?.COINS?.amount
          ? ` (${pack.prices._collection.COINS.amount} coins)`
          : '');
      acc[key].class = pack.tradable ? 'tradable' : 'untradable';
      acc[key].description = i.localize(pack.packDesc);
      acc[key].pack = pack;

      return acc;
    }, {});

  if (Object.keys(packCounts).length > 1) {
    packCounts['Open All Packs'] = {
      count: 0,
      packName: 'Open All Packs',
      class: 'OpenAll',
      description: 'Open all available packs',
      pack: Object.values(packCounts)[0]?.pack || null,
    };
  }
  let packHoverButtons = Object.keys(packCounts).map((packName) => {
    let pack = packCounts[packName];

    let navLabelSpan = document.createElement('span');
    navLabelSpan.title = pack.description; // Add tooltip with pack description
    navLabelSpan.classList.add(pack.class);
    navLabelSpan.style.direction = 'ltr';
    let packCountLabel = document.createElement('div');
    packCountLabel.classList.add('ut-tab-bar-item-notif');
    packCountLabel.style.left = '5px';
    packCountLabel.innerHTML = pack.count;
    navLabelSpan.innerHTML = pack.packName;
    if (pack.count > 1) {
      navLabelSpan.prepend(packCountLabel);
    }

    let btn = createNavButton(
      'openPackItem',
      navLabelSpan.outerHTML,
      async () => {},
      async () => {
        let packToOpen = pack.pack;
        if (pack.pack.isMyPack) {
          await openPack(packToOpen, pack.count, packName === 'Open All Packs');
        } else {
          packToOpen
            .purchase(GameCurrency.COINS)
            .observe(new UTStoreViewController(), async (obs, event) => {
              await openPack(packToOpen);
            });
        }
      },
      { width: '20vw', marginTop: '0px' }
    );

    return btn;
  });

  let packDiv = document.createElement('div');
  packHoverButtons.forEach((button) => {
    packDiv.appendChild(button);
  });
  let packNavBtn = createNavButton(
    'navPacks',
    packContent,
    async () => {
      if (Object.keys(packCounts).length > 0) {
        return createHoverNav('myPacks', 'My Packs', 'click to open', [packDiv], { width: '20vw' });
      }
      return null;
    },
    async () => {
      packToOpen = Object.values(packCounts)[0]?.pack || null;
      if (!packToOpen) {
        await openPack(packToOpen, 0, true);
      }
    },
    { background: 'none' }
  );

  return packNavBtn;
};

const createCategoryPicker = async () => {
  let sets = await sbcSets();
  if (sets === undefined) {
    console.log('createCategoryPicker: sets are undefined');
    return null;
  }
  // Only keep categories that contain at least one incomplete set
  const incompleteSetIds = (sets.sets || []).filter((s) => !s.isComplete()).map((s) => s.id);
  const filteredCategories = (sets.categories || []).filter(
    (cat) => Array.isArray(cat.setIds) && cat.setIds.some((id) => incompleteSetIds.includes(id))
  );
  // Fallback to original categories if filtering results in none (avoids empty UI)
  let categories = filteredCategories.length ? filteredCategories.map((c) => c.name) : (sets.categories || []).map((c) => c.name);


  // Add a "Daily" category if it doesn't already exist
  if (!categories.includes('Daily')) {
    // Find all SBCs with "daily" in their name (case insensitive)
    let dailySbcs = sets.sets.filter((set) => set.name.toLowerCase().includes('daily'));

    // If we found any daily SBCs, add a Daily category
    if (dailySbcs.length > 0) {
      // Create a new "Daily" category with the set IDs of matching SBCs
      sets.categories.push({
        name: 'Daily',
        setIds: dailySbcs.map((sbc) => sbc.id),
      });

      // Update the categories list for the dropdown
      categories.push('Daily');
    }
  }
  let categoryButtons = [];
  categories.forEach((category) => {
    let navLabelSpan = document.createElement('span');
    navLabelSpan.innerHTML = category;
    navLabelSpan.style.display = 'inline-block';
    navLabelSpan.style.verticalAlign = 'middle';
    navLabelSpan.style.width = '50px';
    let navBtn = createNavButton(
      category,
      navLabelSpan.outerHTML,
      () => {},
      async () => {
        saveSettings(0, 0, 'sbcType', category);
        services.Notification.queue([
          'Updating SBC toolbar to ' + category,
          UINotificationType.POSITIVE,
        ]);
        createSBCTab();
      },
      { width: '20vw', marginTop: '0px' }
    );
    categoryButtons.push(navBtn);
  });

  let categoryNavBtn = createNavButton(
    'navCategory',
    `SBC 1-click <br>${getSettings(0, 0, 'sbcType')}`,
    async () => {
      return createHoverNav(
        'categoryPicker',
        'SBC Categories',
        'click to select',
        categoryButtons,
        { width: '20vw' }
      );
    },
    () => {},
    { background: 'none' }
  );
  return categoryNavBtn;
};

const createSBCButtons = async () => {
  let sets = await sbcSets();
  if (sets === undefined) {
    console.log('createSBCButtons: sets are undefined');
    return null;
  }

  let sbcSetIds;
  if (getSettings(0, 0, 'sbcType') === 'Daily') {
    // Find all SBCs with "daily" in their name (case insensitive)
    sbcSetIds = sets.sets
      .filter((set) => set.name.toLowerCase().includes('daily'))
      .map((set) => set.id);
  } else {
    // Use the normal category method for other types
    sbcSetIds =
      sets.categories.filter((f) => f.name == getSettings(0, 0, 'sbcType'))[0]?.setIds || [];
  }

  let allSbcSets = sets.sets.filter((f) => sbcSetIds.includes(f.id) && !f.isComplete()).reverse();
  if (getSettings(0, 0, 'sbcType') === 'Favourites') {
    allSbcSets = allSbcSets.sort((a, b) => b.timesCompleted - a.timesCompleted);
  }
  let sbcTiles = [];
  allSbcSets.forEach((set) => {
    var t = new UTSBCSetTileView();
    t.init(), (t.title = set.name), t.setData(set), t.render();
    let pb = t._progressBar;
    let sbcDiv = document.createElement('div');
    var img = document.createElement('img');
    img.setAttribute('src', t._setImage.src);
    img.width = img.height = '64';
    sbcDiv.appendChild(img);
    if (!t.data.isSingleChallenge) {
      sbcDiv.appendChild(pb.getRootElement());
    }
    var label = document.createElement('span');
    label.innerHTML = set.name;
    sbcDiv.appendChild(label);

    //     console.log(set)

    sbcTiles.push(
      createNavButton(
        `navSBC${set.id}`,
        sbcDiv.outerHTML,
        async () => {
          let hoverSet = await createSBCHover(set);

          let hoverNav = createHoverNav(set.id, '', 'click to start', [hoverSet]);
          return hoverNav;
        },
        () => {
          createSbc = true;
          createSBCTab();
          services.Notification.queue([set.name + ' SBC Started', UINotificationType.POSITIVE]);

          solveSBC(set.id, 0, true ,null, true, true);
        },
        { background: 'none' }
      )
    );
  });
  return sbcTiles;
};

const createSBCHover = async (set) => {
  let layoutHubDiv = document.createElement('div');
  layoutHubDiv.style.padding = '0';
  layoutHubDiv.style.width = '50vw';
  layoutHubDiv.style.maxWidth = '500px';
  layoutHubDiv.style.direction = 'ltr';
  layoutHubDiv.style.overflowY = 'none';
  var s = new UTSBCSetTileView();
  s.init(), (s.title = set.name), s.setData(set), s.render();
  layoutHubDiv.appendChild(s.getRootElement());
  layoutHubDiv.querySelectorAll('div').forEach((div) => {
    div.classList.remove('col-1-2-md');
  });
  let progressBlock = layoutHubDiv.querySelector('.ut-sbc-set-tile-view--progress-block');
  if (progressBlock) {
    progressBlock.insertBefore(s._progressBar.getRootElement(), progressBlock.firstChild);
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
      rowRoot.querySelectorAll('div').forEach((div) => {
        div.classList.remove('has-tap-callback');
        if (div.classList.contains('ut-progress-bar')) {
          div.remove();
        }

        rowRoot.querySelectorAll('img').forEach((img) => {
          img.style.width = '15%';
        });
      });
      rowRoot.addEventListener('mouseenter', async () => {
        let s = new UTSBCChallengeRequirementsView();
        s.renderChallengeRequirements(e, true);
        let challengeDiv = document.createElement('div');
        challengeDiv.id = 'challengeNav';
        challengeDiv.style.position = 'absolute';

        challengeDiv.style.top = '355px';
        challengeDiv.style.right = 'calc(100% + 5px)';
        challengeDiv.style.padding = '5px';
        challengeDiv.style.width = '25vw';
        challengeDiv.style.borderRadius = '20px';
        challengeDiv.style.background = '#1e1f1f';
        challengeDiv.appendChild(s.getRootElement());
        layoutHubDiv.appendChild(challengeDiv);
      });
      rowRoot.addEventListener('mouseleave', () => {
        let challengeDiv = document.getElementById('challengeNav');
        if (challengeDiv) {
          challengeDiv.remove();
        }
      });
      rowRoot.addEventListener('click', () => {
        let hoverNav = document.getElementById('hoverNav');

        if (hoverNav) {
          hoverNav.remove();
        }
        createSbc = true;
        createSBCTab();
        services.Notification.queue([set.name + ' SBC Started', UINotificationType.POSITIVE]);

        solveSBC(e.setId, e.id, true);
      });
      return rowRoot;
    });

  let rowDiv = document.createElement('div');
  rowDiv.id = 'challengeRow';
  rowDiv.style.padding = '5px';
  rowDiv.style.borderRadius = '20px';
  rowDiv.style.background = '#1e1f1f';
  rowDiv.style.overflowY = 'auto';
  row.forEach((r) => {
    rowDiv.appendChild(r);
  });
  layoutHubDiv.appendChild(rowDiv);

  return layoutHubDiv;
};

let createSBCTab = async () => {
  if (!getSettings(0, 0, 'showSbcTab')) {
    document.querySelectorAll('.sbc-auto').forEach((el) => el.remove());
    return;
  }

  // inject spinner CSS once
  if (!document.getElementById('auto-grind-spinner-style')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'auto-grind-spinner-style';
    styleTag.textContent = `
        .button-spinner {
          display: inline-block;
          width: 1em;
          height: 1em;
          border: 2px solid #fff;
          border-top-color: transparent;
          border-radius: 50%;
          margin-left: 5px;
          vertical-align: middle;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
    document.head.appendChild(styleTag);
  }

  services.SBC.repository.reset();
  const nav = document.createElement('nav');
  nav.id = 'sbcToolbar';
  nav.classList.add('ut-tab-bar', 'sbc-auto');
  // inside createSBCTab, before appending autoGrindBtn:
  const sbcData = await sbcSets();
  const favCategory = sbcData.categories.find((c) => c.isFavourite);
  const favSets = sbcData.sets.filter((s) => favCategory?.setIds.includes(s.id));
  const totalFavCompleted = favSets.reduce((sum, s) => sum + (s.timesCompleted || 0), 0);

  const autoGrindBtn = createNavButton(
    'btnAutoGrind',
    /* html */ `
        <div style="text-align:center;line-height:1.2">
          <span>Auto Grind</span>
          <span style="font-size:0.8em;color:#07f468">
            ✪ ${totalFavCompleted}
          </span>
          <span id="btnAutoGrind-spinner"
                class="button-spinner"
                style="display:none"></span>
        </div>
      `,
    null,
    async () => {
      const spinner = document.getElementById('btnAutoGrind-spinner');
      if (createSbcGrind) {
        createSbcGrind = false;
        spinner.style.display = 'none';
        return;
      }
      createSbcGrind = true;
      spinner.style.display = 'inline-block';
      try {
        await futAutoGrind();
      } finally {
        spinner.style.display = 'none';
        autoGrindBtn.disabled = false;
      }
    },
    { background: 'none', color: '#fff' }
  );

  nav.appendChild(autoGrindBtn);

  let packList = await createPackList();
  nav.appendChild(packList);

  let categoryPicker = await createCategoryPicker();
  nav.appendChild(categoryPicker);

  let sbcDiv = document.createElement('div');
  sbcDiv.style.overflowY = 'auto';
  sbcDiv.style.height = 'auto';
  let sbcTiles = await createSBCButtons();
  sbcTiles.forEach((tile) => sbcDiv.appendChild(tile));
  nav.appendChild(sbcDiv);

  document.querySelectorAll('.sbc-auto').forEach((el) => el.remove());
  document.querySelectorAll('.ut-tab-bar-view').forEach((el) => {
    el.insertBefore(nav, el.firstChild);
  });
};

const sideBarNavOverride = () => {
  const navViewInit = UTGameTabBarController.prototype.initWithViewControllers;
  UTGameTabBarController.prototype.initWithViewControllers = function (tabs) {
    // Check if SBC Solver tab already exists
    const sbcSolverExists = tabs.some(
      (tab) => tab.tabBarItem && tab.tabBarItem.getText && tab.tabBarItem.getText() === 'SBC Solver'
    );

    // Check if Club Analysis tab already exists
    const clubAnalysisExists = tabs.some(
      (tab) =>
        tab.tabBarItem && tab.tabBarItem.getText && tab.tabBarItem.getText() === 'Club Analysis'
    );

    // Add SBC Solver tab if it doesn't exist
    if (!sbcSolverExists) {
      const navBar = new UTGameFlowNavigationController();
      navBar.initWithRootController(new sbcSettingsController());
      navBar.tabBarItem = generateSbcSolveTab();
      tabs.push(navBar);
    }

    navViewInit.call(this, tabs);
  };
};

let SOLVER_SETTINGS_KEY = 'sbcSolverSettings';
let cachedSolverSettings;

let setSolverSettings = function (key, Settings) {
  let SolverSettings = getSolverSettings();
  SolverSettings[key] = Settings;
  cachedSolverSettings = SolverSettings;
  localStorage.setItem(SOLVER_SETTINGS_KEY, JSON.stringify(cachedSolverSettings));
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
  sbcSolveTab.setText('SBC Solver');
  sbcSolveTab.addClass('icon-sbcSettings');
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
  return 'SBC Solver';
};
sbcSettingsView.prototype.destroyGeneratedElements = function destroyGeneratedElements() {
  DOMKit.remove(this.__root), (this.__root = null);
};

sbcSettingsView.prototype._generate = function _generate() {
  if (document.contains(document.getElementsByClassName('ut-sbc-challenge-requirements-view')[0])) {
    document.getElementsByClassName('ut-sbc-challenge-requirements-view')[0].remove();
  }

  var e = document.createElement('div');
  e.classList.add('ut-market-search-filters-view'), e.classList.add('floating');
  e.classList.add('sbc-settings-container');
  e.setAttribute('id', 'SettingsPanel');

  var f = document.createElement('div');
  f.classList.add('ut-pinned-list'), f.classList.add('sbc-settings');
  e.appendChild(f);

  var g = document.createElement('div');

  g.classList.add('sbc-settings-header'), g.classList.add('main-header');
  var h1 = document.createElement('H1');
  h1.innerHTML = 'SBC Solver Settings';
  g.appendChild(h1);
  f.appendChild(g);
  let sbcUITile = createSettingsTile(f, 'Customise UI', 'ui');
  createToggle(
    sbcUITile,
    'Collect Concept Player Prices (Must be enabled to use concepts in SBC)',
    'collectConcepts',
    getSettings(0, 0, 'collectConcepts'),
    (toggleCC) => {
      saveSettings(0, 0, 'collectConcepts', toggleCC.getToggleState());
      if (getSettings(0, 0, 'collectConcepts')) {
        getConceptPlayers();
      }
    }
  );
  createToggle(
    sbcUITile,
    'Play Sounds',
    'playSounds',
    getSettings(0, 0, 'playSounds'),
    (togglePS) => {
      saveSettings(0, 0, 'playSounds', togglePS.getToggleState());
    }
  );

  createNumberSpinner(
    sbcUITile,
    'Min Rating for Pack Animation',
    'animateWalkouts',
    1,
    100,
    getSettings(0, 0, 'animateWalkouts'),
    (toggleAW) => {
      saveSettings(0, 0, 'animateWalkouts', toggleAW.getValue());
    }
  );
  createToggle(
    sbcUITile,
    'Show Club and storage stats',
    'ratingUI',
    getSettings(0, 0, 'ratingUI'),
    (toggleST) => {
      saveSettings(0, 0, 'ratingUI', toggleST.getToggleState());
    }
  );
  createToggle(
    sbcUITile,
    'Show Prices',
    'showPrices',
    getSettings(0, 0, 'showPrices'),
    (toggleSP) => {
      saveSettings(0, 0, 'showPrices', toggleSP.getToggleState());
    }
  );
  createNumberSpinner(
    sbcUITile,
    'Price Cache Minutes',
    'priceCacheMinutes',
    1,
    1440,
    getSettings(0, 0, 'priceCacheMinutes'),
    (numberspinnerPCM) => {
      saveSettings(0, 0, 'priceCacheMinutes', numberspinnerPCM.getValue());
    }
  );
  createToggle(
    sbcUITile,
    'Show SBCs Tab',
    'showSbcTab',
    getSettings(0, 0, 'showSbcTab'),
    (toggleSBCT) => {
      saveSettings(0, 0, 'showSbcTab', toggleSBCT.getToggleState());
      createSBCTab();
    }
  );
  createToggle(
    sbcUITile,
    'Show Debug Log Overlay',
    'showLogOverlay',
    getSettings(0, 0, 'showLogOverlay'),
    (toggleLog) => {
      saveSettings(0, 0, 'showLogOverlay', toggleLog.getToggleState());
    }
  );
  let panel = createPanel();

  let clearPricesBtn = createButton('clearPrices', 'Clear All Prices', () => {
    cachedPriceItems = null;
    // Clear prices from localStorage
    localStorage.removeItem(PRICE_ITEMS_KEY);

    // Clear prices from IndexedDB
    const dbName = 'futSBCDatabase';
    const storeName = 'priceItems';
    const request = indexedDB.open(dbName, 1);

    request.onsuccess = function (event) {
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Clear all data from the store
      store.clear().onsuccess = function () {
        cachedPriceItems = {};
        showNotification('All price data has been cleared', UINotificationType.POSITIVE);
        console.log('IndexedDB price data cleared successfully');
      };

      transaction.onerror = function (error) {
        console.error('Error clearing IndexedDB:', error);
      };
    };

    request.onerror = function (event) {
      console.error('Error opening IndexedDB:', event.target.error);
    };
  });
  panel.appendChild(clearPricesBtn);
  sbcUITile.appendChild(panel);

  let sbcRulesTile = createSettingsTile(f, 'Customise SBC', 'customRules');
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
  SBCList.unshift(new UTDataProviderEntryDTO(0, 0, 'All SBCS'));
  createDropDown(parent, 'Choose SBC', 'sbcId', SBCList, '1', async (dropdown) => {
    if (
      document.contains(document.getElementsByClassName('ut-sbc-challenge-requirements-view')[0])
    ) {
      document.getElementsByClassName('ut-sbc-challenge-requirements-view')[0].remove();
    }
    let challenge = [];
    if (dropdown.getValue() != 0) {
      let allSbcData = await sbcSets();
      sbcSet = allSbcData.sets.filter((e) => e.id == dropdown.getValue())[0];

      challenges = await getChallenges(sbcSet);

      challenge = challenges.challenges.map((e) => new UTDataProviderEntryDTO(e.id, e.id, e.name));
    }
    challenge.unshift(new UTDataProviderEntryDTO(0, 0, 'All Challenges'));

    createDropDown(
      parent,
      'Choose Challenge',
      'sbcChallengeId',
      challenge,
      null,
      async (dropdownChallenge) => {
        if (
          document.contains(
            document.getElementsByClassName('ut-sbc-challenge-requirements-view')[0]
          )
        ) {
          document.getElementsByClassName('ut-sbc-challenge-requirements-view')[0].remove();
        }
        let sbcParamsTile = createSettingsTile(parent, 'SBC Solver Paramaters', 'submitParams');

        // Create a "Restore to Default" button
        const resetButton = createButton('resetSettings', 'Restore to Default', () => {
          // Get the current SBC and challenge IDs
          const sbcId = dropdown.getValue();
          const challengeId = dropdownChallenge.getValue();

          // Get the current settings
          let settings = getSolverSettings();

          // Check if the settings exist and remove them
          if (
            settings['sbcSettings'] &&
            settings['sbcSettings'][sbcId] &&
            settings['sbcSettings'][sbcId][challengeId]
          ) {
            // Delete the specific challenge settings
            delete settings['sbcSettings'][sbcId][challengeId];

            // If this was the only challenge for this SBC, clean up the SBC entry too
            if (Object.keys(settings['sbcSettings'][sbcId]).length === 0) {
              delete settings['sbcSettings'][sbcId];
            }
            initDefaultSettings();
            // Save the updated settings
            setSolverSettings('sbcSettings', settings['sbcSettings']);

            // Show notification
            showNotification('Settings restored to default', UINotificationType.POSITIVE);

            // Refresh the view to reflect changes
            let currentController = getCurrentViewController();
            if (currentController) {
              currentController.getNavigationController().popViewController();
              currentController
                .getNavigationController()
                .pushViewController(new sbcSettingsController());
            }
          }
        });

        const resetPanel = createPanel();
        resetPanel.appendChild(resetButton);
        sbcParamsTile.appendChild(resetPanel);
        createDropDown(
          sbcParamsTile,
          '1-click Auto Submit',
          'autoSubmit',
          [
            { name: 'Always', id: 1 },
            { name: 'Optimal', id: 4 },
            { name: 'Never', id: 0 },
          ].map((e) => new UTDataProviderEntryDTO(e.id, e.id, e.name)),
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'autoSubmit'),
          (dropdownAS) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'autoSubmit',
              parseInt(dropdownAS.getValue())
            );
          },
          'Controls when SBCs are automatically submitted: Always (any solution), Optimal (only best solutions), or Never (manual submission)'
        );
        createNumberSpinner(
          sbcParamsTile,
          'Repeat Count (-1 repeats infinitely)',
          'repeatCount',
          -1,
          100,
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'repeatCount'),
          (numberspinnerRC) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'repeatCount',
              numberspinnerRC.getValue()
            );
          },
          'Number of times to repeat this SBC: -1 repeats indefinitely, 0 performs once, positive numbers repeat that many times'
        );
         createToggle(
          sbcParamsTile,
          'Automatically try All Sbcs in Group',
          'sbcAllGroup',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'sbcAllGroup'),
          (toggleSBC) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'sbcAllGroup',
              toggleSBC.getToggleState()
            );
          },
          'When enabled, this SBC will automatically try all sbcs in the group'
        );
        createToggle(
          sbcParamsTile,
          'Automatically try SBC on Login',
          'sbcOnLogin',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'sbcOnLogin'),
          (toggleLOG) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'sbcOnLogin',
              toggleLOG.getToggleState()
            );
          },
          'When enabled, this SBC will automatically run when you log into FUT'
        );
        createToggle(
          sbcParamsTile,
          'Use Concepts',
          'useConcepts',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'useConcepts'),
          (toggleUC) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'useConcepts',
              toggleUC.getToggleState()
            );
          },
          'When enabled, includes concept players in SBC solutions (requires concept collection to be enabled)'
        );
        createToggle(
          sbcParamsTile,
          'Automatically Open Reward Packs',
          'autoOpenPacks',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'autoOpenPacks'),
          (toggleAO) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'autoOpenPacks',
              toggleAO.getToggleState()
            );
          },
          'When enabled, automatically opens reward packs after SBC completion'
        );
        createNumberSpinner(
          sbcParamsTile,
          'Player Max Rating',
          'maxRating',
          48,
          99,
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'maxRating'),
          (numberspinnerMR) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'maxRating',
              numberspinnerMR.getValue()
            );
          },
          'Sets maximum player rating to use in SBC solutions (protects high-rated players)'
        );
        createToggle(
          sbcParamsTile,
          'Ignore Exclusions & Max Ratings for Storage',
          'useDupes',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'useDupes'),
          (toggleUD) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'useDupes',
              toggleUD.getToggleState()
            );
          },
          'When enabled, duplicate players can be used in SBCs regardless of their rating'
        );
        createNumberSpinner(
          sbcParamsTile,
          'Duplicate Value %',
          'duplicateDiscount',
          0,
          100,
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'duplicateDiscount') ?? 51,
          (spinnerDD) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'duplicateDiscount',
              spinnerDD.getValue()
            );
          },
          'Sets how much duplicate players are valued compared to their market price (lower % = more likely to be used)'
        );
        createNumberSpinner(
          sbcParamsTile,
          'Untradeable Value %',
          'untradeableDiscount',
          0,
          100,
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'untradeableDiscount') ??
            80,
          (spinnerUD) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'untradeableDiscount',
              spinnerUD.getValue()
            );
          },
          'Sets how much untradeable players are valued compared to their market price (lower % = more likely to be used)'
        );
        createNumberSpinner(
          sbcParamsTile,
          'Concept Premium (e.g. 10 = 10x price)',
          'conceptPremium',
          1,
          100,
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'conceptPremium') ?? 10,
          (spinnerCP) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'conceptPremium',
              spinnerCP.getValue()
            );
          },
          'Sets how much concept players are valued compared to their market price (higher = less likely to be used)'
        );
        createNumberSpinner(
          sbcParamsTile,
          'API Max Solve Time',
          'maxSolveTime',
          10,
          990,
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'maxSolveTime'),
          (numberspinnerMST) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'maxSolveTime',
              numberspinnerMST.getValue()
            );
          },
          'Maximum time in seconds to spend searching for an optimal SBC solution'
        );
        //  (parentDiv,label,id,options,value,target)
        createToggle(
          sbcParamsTile,
          'Only use Storage Players',
          'onlyStorage',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'onlyStorage'),
          (toggleOS) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'onlyStorage',
              toggleOS.getToggleState()
            );
          },
          'When enabled, only players from your storage will be used in SBC solutions'
        );
          createToggle(
          sbcParamsTile,
          'Do not include Players from other SBC solutions',
          'excludeSbcSquads',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'excludeSbcSquads'),
          (toggleOS) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'excludeSbcSquads',
              toggleOS.getToggleState()
            );
          },
          'When enabled, players pending from other SBC solutions will not be used in SBC solutions'
        );
        
        createToggle(
          sbcParamsTile,
          'Exclude Objective Players',
          'excludeObjective',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'excludeObjective'),
          (toggleXO) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'excludeObjective',
              toggleXO.getToggleState()
            );
          },
          'When enabled, players earned from objectives will not be used in SBC solutions'
        );
        createToggle(
          sbcParamsTile,
          'Exclude Special Players',
          'excludeSpecial',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'excludeSpecial'),
          (toggleSP) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'excludeSpecial',
              toggleSP.getToggleState()
            );
          },
          'When enabled, special cards (TOTW, TOTS, Heroes, etc.) will not be used in SBC solutions'
        );
        createToggle(
          sbcParamsTile,
          'Exclude Tradable Players',
          'excludeTradable',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'excludeTradable'),
          (toggleSP) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'excludeTradable',
              toggleSP.getToggleState()
            );
          },
          'When enabled, tradable players will not be used in SBC solutions'
        );
        createToggle(
          sbcParamsTile,
          'Exclude SBC Players',
          'excludeSbc',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'excludeSbc'),
          (toggleXSBC) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'excludeSbc',
              toggleXSBC.getToggleState()
            );
          },
          'When enabled, players earned from SBCs will not be used in SBC solutions'
        );
        createToggle(
          sbcParamsTile,
          'Exclude Extinct Players',
          'excludeExtinct',
          getSettings(dropdown.getValue(), dropdownChallenge.getValue(), 'excludeExtinct'),
          (toggleXE) => {
            saveSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              'excludeExtinct',
              toggleXE.getToggleState()
            );
          },
          'When enabled, players that are extinct on the transfer market will not be used in SBC solutions'
        );
        createChoice(
          sbcParamsTile,
          'EXCLUDE - Players',
          'excludePlayers',
          players.map((item) => {
            return {
              label: item._staticData.firstName + ' ' + item._staticData.lastName,
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
          dropdownChallenge.getValue(),
          'Select specific players to exclude from SBC solutions'
        );
        console.log("herer")
        createChoice(
          sbcParamsTile,
          'EXCLUDE - Leagues',
          'excludeLeagues',
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
                    
                  )}'/>`,
                },
              };
            }),
 
          dropdown.getValue(),
          dropdownChallenge.getValue(),
          'Select leagues whose players will be excluded from SBC solutions'
        );
        
        createChoice(
          sbcParamsTile,
          'EXCLUDE - Nations',
          'excludeNations',
          factories.DataProvider.getNationDP()
            .map((m) => {
              return {
                id: m.id,
                value: m.id,
                label: m.label,
                customProperties: {
                  icon: `<img width="30" src='${AssetLocationUtils.getFlagImageUri(
                    m.id,
                    
                  )}'/>`,
                },
              };
            })
            .filter((f) => f.id > 0),

          dropdown.getValue(),
          dropdownChallenge.getValue(),
          'Select nations whose players will be excluded from SBC solutions'
        );
        createChoice(
          sbcParamsTile,
          'EXCLUDE - Teams',
          'excludeTeams',
          factories.DataProvider.getTeamDP()
            .map((m) => {
              return {
                id: m.id,
                value: m.id,
                label:
                  m.label +
                  ' ( ' +
                  repositories.TeamConfig.leagues._collection[
                    repositories.TeamConfig.teams._collection[m.id]?.league
                  ]?.name +
                  ' )',
                customProperties: {
                  icon: `<img width="30" src='${AssetLocationUtils.getBadgeImageUri(
                    m.id,
                    
                  )}'/>`,
                },
              };
            })
            .filter((f) => f.id > 0 && !f.label.includes('*')),
          dropdown.getValue(),
          dropdownChallenge.getValue(),
          'Select clubs whose players will be excluded from SBC solutions'
        );
        createChoice(
          sbcParamsTile,
          'EXCLUDE - Rarity',
          'excludeRarity',
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
            .filter((f) => f.id > 0 && !f.label.includes('*')),
          dropdown.getValue(),
          dropdownChallenge.getValue(),
          'Select card rarities that will be excluded from SBC solutions'
        );

        createChoice(
          sbcParamsTile,
          'EXCLUDE - Players',
          'excludePlayers',
          players.map((item) => {
            return {
              label: item._staticData.firstName + ' ' + item._staticData.lastName,
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
          'EXCLUDE - Leagues',
          'excludeLeagues',
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
                    
                  )}'/>`,
                },
              };
            }),

          dropdown.getValue(),
          dropdownChallenge.getValue()
        );
        createChoice(
          sbcParamsTile,
          'EXCLUDE - Nations',
          'excludeNations',
          factories.DataProvider.getNationDP()
            .map((m) => {
              return {
                id: m.id,
                value: m.id,
                label: m.label,
                customProperties: {
                  icon: `<img width="30" src='${AssetLocationUtils.getFlagImageUri(
                    m.id,
                    
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
          'EXCLUDE - Teams',
          'excludeTeams',
          factories.DataProvider.getTeamDP()
            .map((m) => {
              return {
                id: m.id,
                value: m.id,
                label:
                  m.label +
                  ' ( ' +
                  repositories.TeamConfig.leagues._collection[
                    repositories.TeamConfig.teams._collection[m.id]?.league
                  ]?.name +
                  ' )',
                customProperties: {
                  icon: `<img width="30" src='${AssetLocationUtils.getBadgeImageUri(
                    m.id,
                    
                  )}'/>`,
                },
              };
            })
            .filter((f) => f.id > 0 && !f.label.includes('*')),
          dropdown.getValue(),
          dropdownChallenge.getValue()
        );
        createChoice(
          sbcParamsTile,
          'EXCLUDE - Rarity',
          'excludeRarity',
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
            .filter((f) => f.id > 0 && !f.label.includes('*')),
          dropdown.getValue(),
          dropdownChallenge.getValue()
        );
      }
    );
  });
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
  settings['sbcSettings'] ??= {};
  let sbcSettings = settings['sbcSettings'];
  sbcSettings[sbc] ??= {};
  sbcSettings[sbc][challenge] ??= {};
  sbcSettings[sbc][challenge][id] = value;
  setSolverSettings('sbcSettings', sbcSettings);
};
const getSettings = (sbc, challenge, id) => {
  let settings = getSolverSettings();
  let returnValue =
    settings['sbcSettings']?.[sbc]?.[challenge]?.[id] ??
    settings['sbcSettings']?.[sbc]?.[0]?.[id] ??
    settings['sbcSettings']?.[0]?.[0]?.[id];
  return returnValue;
};
const defaultSBCSolverSettings = {
  apiUrl: 'http://127.0.0.1:8000',
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
  onlyStorage: false,
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
  sbcType: 'Favourites',
  showLogOverlay: false,
  duplicateDiscount: 50,
  untradeableDiscount: 80,
  conceptPremium: 10,
  evoPremium: 2,
  ratingUI: false
};

const createStopOverlayButton = () => {
  const stopButtonContainer = document.createElement('div');
  stopButtonContainer.id = 'sbc-stop-overlay';
  stopButtonContainer.style.position = 'fixed';
  stopButtonContainer.style.bottom = '45px';
  stopButtonContainer.style.right = '130px';
  stopButtonContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  stopButtonContainer.style.color = '#fff';
  stopButtonContainer.style.padding = '10px';
  stopButtonContainer.style.borderRadius = '5px';
  stopButtonContainer.style.zIndex = '9999';
  stopButtonContainer.style.fontSize = '12px';
  stopButtonContainer.style.fontFamily = 'Arial, sans-serif';

  const stopButton = document.createElement('button');
  stopButton.textContent = 'STOP';
  stopButton.style.marginLeft = '5px';
  stopButton.style.padding = '5px 10px';
  stopButton.style.border = 'none';
  stopButton.style.borderRadius = '3px';
  stopButton.style.cursor = 'pointer';
  stopButton.style.backgroundColor = '#ff0000';
  stopButton.style.color = '#000';

  stopButton.addEventListener('click', () => {
    createSbc = false;
    createSbcGrind = false;
    hideLoader();
    // fetch(apiUrl + "/stop-solver", {
    //     method: "POST"
    // }).then(response => {
    //     if (response.ok) {
    //         showNotification("Solver stopped successfully", UINotificationType.POSITIVE);
    //     } else {
    //         showNotification("Failed to stop solver", UINotificationType.NEGATIVE);
    //     }
    // }).catch(error => {
    //     console.error("Error stopping solver:", error);
    //     showNotification("Error stopping solver", UINotificationType.NEGATIVE);
    // });
  });

  stopButtonContainer.appendChild(stopButton);
  let shield = getElement('.ut-click-shield');
  shield.appendChild(stopButtonContainer);
};

const createLogOverlayToggle = () => {
  const toggleContainers = document.querySelectorAll('#sbc-log-toggle');
  toggleContainers.forEach((toggleContainer) => {
    toggleContainer.remove();
  });

  const toggleContainer = document.createElement('div');
  toggleContainer.id = 'sbc-log-toggle';
  toggleContainer.style.position = 'fixed';
  toggleContainer.style.bottom = '10px';
  toggleContainer.style.left = '10px';
  toggleContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  toggleContainer.style.color = '#fff';
  toggleContainer.style.padding = '10px';
  toggleContainer.style.borderRadius = '5px';
  toggleContainer.style.zIndex = '9999';
  toggleContainer.style.fontSize = '12px';
  toggleContainer.style.fontFamily = 'Arial, sans-serif';

  const toggleLabel = document.createElement('span');
  toggleLabel.textContent = 'Show Solver Logs';
  toggleContainer.appendChild(toggleLabel);

  const toggleButton = document.createElement('button');
  toggleButton.textContent = getSettings(0, 0, 'showLogOverlay') ? 'ON' : 'OFF';
  toggleButton.style.marginLeft = '5px';
  toggleButton.style.padding = '5px 10px';
  toggleButton.style.border = 'none';
  toggleButton.style.borderRadius = '3px';
  toggleButton.style.cursor = 'pointer';
  toggleButton.style.backgroundColor = getSettings(0, 0, 'showLogOverlay') ? '#00ff00' : '#ff0000';
  toggleButton.style.color = '#000';

  toggleButton.addEventListener('click', () => {
    const currentState = getSettings(0, 0, 'showLogOverlay');
    saveSettings(0, 0, 'showLogOverlay', !currentState);
    toggleButton.textContent = !currentState ? 'ON' : 'OFF';
    toggleButton.style.backgroundColor = !currentState ? '#00ff00' : '#ff0000';
    updateLogOverlay();
  });

  toggleContainer.appendChild(toggleButton);
  let shield = getElement('.ut-click-shield');
  shield.appendChild(toggleContainer);
};

// Create or update the log overlay
const updateLogOverlay = () => {
  let shield = getElement('.ut-click-shield');
  let logOverlay = document.getElementById('sbc-log-overlay');

  if (getSettings(0, 0, 'showLogOverlay')) {
    if (!logOverlay) {
      logOverlay = document.createElement('div');
      logOverlay.id = 'sbc-log-overlay';
      logOverlay.style.position = 'fixed';
      logOverlay.style.bottom = '75px';
      logOverlay.style.left = '10px';
      logOverlay.style.maxHeight = '15vh';
      logOverlay.style.width = '40vw';
      logOverlay.style.overflowY = 'auto';
      logOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      logOverlay.style.color = '#00ff00';
      logOverlay.style.padding = '10px';
      logOverlay.style.fontSize = '12px';
      logOverlay.style.fontFamily = 'monospace';
      logOverlay.style.zIndex = '9999';
      logOverlay.style.borderRadius = '5px';
      shield.appendChild(logOverlay);
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
  if (!getSettings(0, 0, 'showLogOverlay')) {
    return; // Don't poll if log overlay is disabled
  }

  try {
    const response = await makeGetRequest(apiUrl + '/solver-logs');
    const data = JSON.parse(response);

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
    console.error('Error polling solver logs:', error);
  }
};

let initDefaultSettings = () => {
  Object.keys(defaultSBCSolverSettings).forEach((id) =>
    saveSettings(0, 0, id, getSettings(0, 0, id) ?? defaultSBCSolverSettings[id])
  );
};
const createPanel = () => {
  var panel = document.createElement('div');
  panel.classList.add('sbc-settings-field');

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
  tooltip = ''
) => {
  var i = document.createElement('div');
  i.classList.add('panelActionRow');
  var o = document.createElement('div');
  o.classList.add('buttonInfoLabel');
  var spinnerLabel = document.createElement('span');
  spinnerLabel.classList.add('spinnerLabel');
  spinnerLabel.innerHTML = label;
  o.appendChild(spinnerLabel);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    const tooltipIcon = document.createElement('span');
    tooltipIcon.innerHTML = '&#9432;'; // info icon
    tooltipIcon.style.marginLeft = '6px';
    tooltipIcon.style.cursor = 'pointer';
    tooltipIcon.title = tooltip;
    o.appendChild(tooltipIcon);
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
const createChoice = (parentDiv, label, id, options, sbc, challenge, tooltip = '') => {
  if (document.contains(document.getElementById(id))) {
    document.getElementById(id).remove();
  }
  const i = document.createElement('div');
  i.classList.add('panelActionRow');
  const o = document.createElement('div');
  o.classList.add('buttonInfoLabel');
  const choicesLabel = document.createElement('span');
  choicesLabel.classList.add('choicesLabel');
  choicesLabel.innerHTML = label;
  o.appendChild(choicesLabel);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    const tooltipIcon = document.createElement('span');
    tooltipIcon.innerHTML = '&#9432;'; // info icon
    tooltipIcon.style.marginLeft = '6px';
    tooltipIcon.style.cursor = 'pointer';
    tooltipIcon.title = tooltip;
    o.appendChild(tooltipIcon);
  }

  i.appendChild(o);

  let panel = createPanel();
  panel.appendChild(i);
  panel.setAttribute('id', id);
  let select = document.createElement('select');
  select.multiple = 'multiple';
  select.setAttribute('id', 'choice' + id);

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
          const customProps = data.customProperties ? data.customProperties : {};
          return template(`
              <div class="choices__item choices__item--selectable ${
                data.highlighted ? 'choices__item--highlighted' : ''
              }" data-item data-deletable data-id="${data.id}" data-value="${
            data.value
          }" data-custom-properties='${data.customProperties}' ${
            data.active ? 'aria-selected="true"' : ''
          }>
                ${customProps.icon || ''} ${data.label}
                <button type="button" class="choices__button" aria-label="Remove item: ${
                  data.value
                }" data-button>Remove item</button>
             </div>
            `);
        },
        choice: (classNames, data) => {
          const customProps = data.customProperties ? data.customProperties : {};
          return template(`
              <div class=" choices__item choices__item--choice ${
                data.disabled ? 'choices__item--disabled' : 'choices__item--selectable'
              }" data-select-text="${this.config.itemSelectText}" data-choice data-id="${
            data.id
          }" data-value="${data.value}" ${
            data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'
          }>
                ${customProps.icon || ''} ${data.label}
               </div>
            `);
        },
      };
    },
  });

  choices.setChoiceByValue(currentSettings);
  select.addEventListener(
    'change',
    function (event) {
      saveSettings(sbc, challenge, id, choices.getValue(true));
    },
    false
  );
};
const createDropDown = (parentDiv, label, id, options, value, target, tooltip = '') => {
  if (document.contains(document.getElementById(id))) {
    document.getElementById(id).remove();
  }

  const i = document.createElement('div');
  i.classList.add('panelActionRow');

  const o = document.createElement('div');
  o.classList.add('buttonInfoLabel');

  // Add label
  const spinnerLabel = document.createElement('span');
  spinnerLabel.classList.add('spinnerLabel');
  spinnerLabel.innerHTML = label;
  o.appendChild(spinnerLabel);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    const tooltipIcon = document.createElement('span');
    tooltipIcon.textContent = '\uE0AC';
    tooltipIcon.style.fontFamily = 'UltimateTeam-Icons, sans-serif';
    tooltipIcon.style.marginLeft = '.5rem';
    tooltipIcon.style.fontSize = '0.8rem';
    tooltipIcon.style.right = '0';
    tooltipIcon.style.bottom = '5px';
    tooltipIcon.style.position = 'absolute';
    tooltipIcon.style.marginLeft = '6px';
    tooltipIcon.style.cursor = 'pointer';
    tooltipIcon.title = tooltip;
    o.appendChild(tooltipIcon);
  }

  i.appendChild(o);

  let dropdown = new UTDropDownControl();
  let panel = createPanel();
  panel.appendChild(i);
  panel.appendChild(dropdown.getRootElement());
  panel.setAttribute('id', id);
  dropdown.init();

  dropdown.setOptions(options);

  dropdown.addTarget(dropdown, target, EventType.CHANGE);
  parentDiv.appendChild(panel);
  dropdown.setIndexById(value);
  dropdown._triggerActions(EventType.CHANGE);
  return dropdown;
};
const createToggle = (parentDiv, label, id, value, target, tooltip = '') => {
  let toggle = new UTToggleCellView();
  let panel = createPanel();

  // Create label container
  const labelContainer = document.createElement('div');
  labelContainer.style.display = 'flex';
  labelContainer.style.alignItems = 'center';

  // Add label text
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  labelContainer.appendChild(labelSpan);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    const tooltipIcon = document.createElement('span');
    // Create tooltip element using proper CSS styling
    const labelWrapper = document.createElement('div');
    labelWrapper.style.position = 'relative';
    labelWrapper.style.display = 'inline-block';
    labelWrapper.style.paddingRight = '25px';
    labelWrapper.appendChild(labelSpan);

    // Add a data attribute for the tooltip text
    labelWrapper.dataset.tooltip = tooltip;

    // Add a class that we'll style with CSS ::after
    if (tooltip) {
      labelWrapper.classList.add('tooltip-container');
    }

    // Replace the labelContainer with our wrapper
    labelContainer.appendChild(labelWrapper);

    // Add the required CSS for the tooltip
    const tooltipStyle = document.createElement('style');
    tooltipStyle.textContent = `
        .tooltip-container {
          position: relative;
        }
        .tooltip-container::after {
          content: "\\E0AC";
          font-family: UltimateTeam-Icons, sans-serif;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          color: #07f468;
          font-size: 0.8rem;
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
          border-radius: 5px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 1000;
        }
      `;
    document.head.appendChild(tooltipStyle);
    labelContainer.appendChild(tooltipIcon);
  }

  // Set label container as toggle label
  toggle.setLabel('');
  toggle.getRootElement().prepend(labelContainer);

  panel.appendChild(toggle.getRootElement());
  toggle.init();

  if (value) {
    toggle.toggle();
  }

  toggle.addTarget(toggle, target, EventType.TAP);
  toggle._triggerActions(EventType.TAP);
  parentDiv.appendChild(panel);
  return panel;
};
const createSettingsTile = (parentDiv, label, id) => {
  if (document.contains(document.getElementById(id))) {
    document.getElementById(id).remove();
  }

  var tile = document.createElement('div');
  tile.setAttribute('id', id);
  tile.classList.add('tile');
  tile.classList.add('col-1-1');
  tile.classList.add('sbc-settings-wrapper');
  tile.classList.add('main-header');

  var tileheader = document.createElement('div');
  tileheader.classList.add('sbc-settings-header');
  var h1 = document.createElement('H1');
  h1.innerHTML = label;
  tileheader.appendChild(h1);
  tile.appendChild(tileheader);
  var tileContent = document.createElement('div');
  tileContent.classList.add('sbc-settings-section');
  tile.appendChild(tileContent);
  parentDiv.appendChild(tile);
  return tileContent;
};

function Counter(selector, settings) {
  let shield = getElement('.ut-click-shield');
  if (!document.contains(document.getElementsByClassName('numCounter')[0])) {
    var counterContent = document.createElement('div');
    counterContent.classList.add('numCounter');
    counterContent.addEventListener('click', () => {
      createSbc = false;
      hideLoader();
    });
    shield.appendChild(counterContent);
  }
  this.settings = Object.assign(
    {
      digits: 5,
      delay: 250, // ms
      direction: '', // ltr is default
    },
    settings || {}
  );

  var scopeElm = document.querySelector(selector);

  // generate digits markup
  var digitsHTML = Array(this.settings.digits + 1).join('<div><b data-value="0"></b></div>');
  scopeElm.innerHTML = digitsHTML;

  this.DOM = {
    scope: scopeElm,
    digits: scopeElm.querySelectorAll('b'),
  };

  this.DOM.scope.addEventListener('transitionend', (e) => {
    if (e.pseudoElement === '::before' && e.propertyName == 'margin-top') {
      e.target.classList.remove('blur');
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
  countTo = (this.value + '').split('');

  if (settings.direction == 'rtl') {
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
          if (diff > 3) item.className = 'blur';
        },
        i * settings.delay,
        i
      );
  });
};

function findSBCLogin(obj, keyToFind) {
  let results = [];

  function recursiveSearch(obj, parents = []) {
    if (typeof obj === 'object' && obj !== null) {
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

const popupOverride = () => {};

document.addEventListener('keydown', async function onKeyR(e) {
  if (e.key === 'z' && !e.repeat) {
    let storage = await getStorage();
    console.log('Pressed “z”: fetching storage items…');

    let counts = {};
    for (const item of storage.map((m) => m.rating)) {
      counts[item] = (counts[item] || 0) + 1;
      counts.total = (counts.total || 0) + 1;
    }
    console.log('Storage item counts:', counts);
  }
  if (e.key === 'q' && !e.repeat) {
    console.log('Pressed “q”: quickselling unassigned items…');
    dealWithUnassigned();

    goToUnassignedView();
    let packs = await getPacks();
    let nextPack = packs.packs.find((p) => p.isMyPack);
    if (nextPack) {
      let pp = await fetchUnassigned();
      // analyze unassigned player ratings
      const playerRatings = pp.filter((item) => item.isPlayer()).map((item) => item.rating);
      const avgRating = playerRatings.reduce((sum, r) => sum + r, 0) / playerRatings.length;
      console.log('Unassigned ratings:', playerRatings, 'Average rating:', avgRating);

      // pick next SBC set based on count rating
      const tierCounts = {
        below82: playerRatings.filter((r) => r < 82).length,
        between82and88: playerRatings.filter((r) => r >= 82 && r <= 88).length,
        between89and91: playerRatings.filter((r) => r > 88 && r < 92).length,
        above92: playerRatings.filter((r) => r >= 92).length,
      };
      console.log('Unassigned rating tiers count:', tierCounts);

      let nextSetId;

      // kick off the solver for the chosen SBC
      solveSBC(nextSetId, 0, true);
    }
  }
  // ignore repeats, only respond to lower‐case r
  if (e.key === 'r' && !e.repeat) {
    console.log('Pressed “r”: fetching unassigned items…');
    try {
      let pp = await fetchUnassigned();
      let playerPicks = pp.filter((m) => m.isPlayerPickItem());
      services.Item.redeem(playerPicks[0]);
      let n = new UTItemDetailsViewController();
      services.Item.requestPendingPlayerPickItemSelection().observe(n, function (e, t) {
        e.unobserve(n),
          t.success && JSUtils.isObject(t.response)
            ? n.showPlayerPicks(t.response.items, t.response.availablePicks, !0)
            : NetworkErrorManager.handleStatus(t.status);
      });
    } catch (err) {
      console.error('Error fetching or filtering:', err);
    }
  }
});

const init = () => {
  // Static flag to track if initialization has already occurred
  let sbcSolverInitialized = false;
  if (sbcSolverInitialized) {
    return;
  }

  let isAllLoaded = false;
  if (services.Localization) {
    isAllLoaded = true;
  }
  if (isAllLoaded) {
    // Mark as initialized
    sbcSolverInitialized = true;
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
    console.log('SBC Solver: Waiting for all services to load before initializing.');
  }
};
init();
})();
