(function () {
  'use strict';

  const GLOBAL_NAME = 'ActualBudgetTweaksDashboardWidgets';
  const CUSTOM_WIDGET_ATTR = 'data-abt-custom-dashboard-widget';
  const MENU_SELECTOR = '[data-popover]';
  const ADD_WIDGET_MENU_KEYS = [
    'cash-flow-card',
    'net-worth-card',
    'markdown-card',
    'custom-report',
  ];
  const MENU_ITEM_HOVER_BACKGROUND =
    'var(--color-menuItemBackgroundHover, var(--color-buttonBareBackgroundHover, rgba(200, 200, 200, .25)))';
  const MENU_ITEM_HOVER_TEXT =
    'var(--color-menuItemTextHover, var(--color-buttonBareTextHover, inherit))';

  if (window[GLOBAL_NAME]) return;

  function parseMeta(meta) {
    if (!meta) return {};
    if (typeof meta === 'string') {
      try { return JSON.parse(meta) || {}; } catch { return {}; }
    }
    return meta;
  }

  function createMarkdownWidgetDefinition({
    key,
    label,
    placeholderText,
    width,
    height,
    meta = {},
  }) {
    return {
      key,
      label,
      matchesRecord(widget) {
        const widgetMeta = parseMeta(widget?.meta);
        return widget?.type === 'markdown-card' &&
          String(widgetMeta.content || '').includes(placeholderText);
      },
      buildWidgetPayload(dashboardPageId) {
        return {
          type: 'markdown-card',
          width,
          height,
          meta: {
            ...meta,
            content: placeholderText,
            name: label,
          },
          dashboard_page_id: dashboardPageId,
        };
      },
    };
  }

  function getReactFiber(element) {
    const key = Object.keys(element).find(name =>
      name.startsWith('__reactFiber$') ||
      name.startsWith('__reactInternalInstance$')
    );
    return key ? element[key] : null;
  }

  function normalizeReactKey(key) {
    if (typeof key !== 'string') return null;
    return key.replace(/^\.\$/, '').replace(/^\$/, '');
  }

  // Actual's Menu does not expose item names as DOM attributes. Its buttons are
  // keyed by item.name, which lets this avoid matching localized text labels.
  function getNativeMenuItemName(button) {
    let fiber = getReactFiber(button);
    while (fiber) {
      const key = normalizeReactKey(fiber.key);
      if (key) return key;
      fiber = fiber.return;
    }
    return null;
  }

  function isVisibleButton(button) {
    const style = window.getComputedStyle?.(button);
    return !button.disabled &&
      style?.display !== 'none' &&
      style?.visibility !== 'hidden';
  }

  function getMenuButtons(menu) {
    return Array.from(menu.querySelectorAll('button')).filter(isVisibleButton);
  }

  function getButtonByMenuItemName(menu, itemName) {
    return getMenuButtons(menu).find(button =>
      getNativeMenuItemName(button) === itemName
    );
  }

  function isDashboardAddWidgetMenu(menu) {
    const itemNames = new Set(
      getMenuButtons(menu)
        .map(getNativeMenuItemName)
        .filter(Boolean)
    );
    return ADD_WIDGET_MENU_KEYS.every(key => itemNames.has(key));
  }

  function removeClonedButtonState(button) {
    [
      'id',
      'aria-controls',
      'aria-describedby',
      'aria-expanded',
      'aria-labelledby',
      'data-focused',
      'data-focus-visible',
      'data-hovered',
      'data-pressed',
      'disabled',
    ].forEach(attr => button.removeAttribute(attr));
  }

  function bindMenuButtonInteractionState(button) {
    const normalBackground = button.style.backgroundColor;
    const normalColor = button.style.color;

    function setHovered() {
      button.setAttribute('data-hovered', '');
      button.style.backgroundColor = MENU_ITEM_HOVER_BACKGROUND;
      button.style.color = MENU_ITEM_HOVER_TEXT;
    }

    function clearHovered() {
      button.removeAttribute('data-hovered');
      button.removeAttribute('data-pressed');
      button.style.backgroundColor = normalBackground;
      button.style.color = normalColor;
    }

    function setPressed() {
      button.setAttribute('data-pressed', '');
    }

    function clearPressed() {
      button.removeAttribute('data-pressed');
    }

    button.addEventListener('pointerenter', setHovered);
    button.addEventListener('pointerleave', clearHovered);
    button.addEventListener('pointerdown', setPressed);
    button.addEventListener('pointerup', clearPressed);
    button.addEventListener('pointercancel', clearPressed);
    button.addEventListener('focus', () => button.setAttribute('data-focused', ''));
    button.addEventListener('blur', () => {
      button.removeAttribute('data-focused');
      clearHovered();
    });
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') setPressed();
    });
    button.addEventListener('keyup', clearPressed);
  }

  function createCustomMenuButton(templateButton, widgetDefinition, onSelect, logger) {
    const button = templateButton.cloneNode(false);
    removeClonedButtonState(button);
    button.type = 'button';
    button.dataset.abtCustomDashboardWidget = widgetDefinition.key;
    button.replaceChildren();

    const label = document.createElement('span');
    label.textContent = widgetDefinition.label;
    label.title = widgetDefinition.label;
    button.appendChild(label);

    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    button.appendChild(spacer);

    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await onSelect(widgetDefinition, button);
      } catch (err) {
        logger?.error?.('[ABT Dashboard Widgets] Failed to add custom widget:', err);
      }
    });
    bindMenuButtonInteractionState(button);

    return button;
  }

  function enhanceAddWidgetMenu({
    widgetDefinitions,
    onWidgetSelected,
    dismissNativeMenu,
    menuSelector = MENU_SELECTOR,
    logger = console,
  }) {
    if (!Array.isArray(widgetDefinitions) || typeof onWidgetSelected !== 'function') {
      return;
    }

    Array.from(document.querySelectorAll(menuSelector))
      .filter(isDashboardAddWidgetMenu)
      .forEach(menu => {
        let anchor = getButtonByMenuItemName(menu, 'markdown-card');
        if (!anchor) return;

        widgetDefinitions.forEach(widgetDefinition => {
          if (!widgetDefinition?.key || !widgetDefinition?.label) return;
          if (menu.querySelector(`[${CUSTOM_WIDGET_ATTR}="${widgetDefinition.key}"]`)) return;

          const button = createCustomMenuButton(
            anchor,
            widgetDefinition,
            async (definition, menuButton) => {
              dismissNativeMenu?.(menuButton);
              await onWidgetSelected(definition);
            },
            logger
          );

          anchor.insertAdjacentElement('afterend', button);
          anchor = button;
        });
      });
  }

  window[GLOBAL_NAME] = Object.freeze({
    createMarkdownWidgetDefinition,
    enhanceAddWidgetMenu,
    getNativeMenuItemName,
  });
})();
