/* Keep the original desktop icons and per-user layout, with space for widgets. */
(() => {
  'use strict';
  let surface, queued = false, ready = false;
  const visibleIcons = () => Desktop_iconElements().filter(icon =>
    getComputedStyle(icon).display !== 'none');
  const overlaps = (a, b) => a.left < b.right && a.right > b.left &&
    a.top < b.bottom && a.bottom > b.top;
  const rectAt = (icon, left, top) => ({left, top,
    right: left + (icon.offsetWidth || 86), bottom: top + (icon.offsetHeight || 86)});

  function widgetRect() {
    const widgets = surface.querySelector('.mac-widgets');
    if (!widgets || getComputedStyle(widgets).display === 'none') return null;
    const outer = surface.getBoundingClientRect(), rect = widgets.getBoundingClientRect();
    return {left: rect.left - outer.left + surface.scrollLeft - 12,
      top: rect.top - outer.top + surface.scrollTop - 12,
      right: rect.right - outer.left + surface.scrollLeft + 12,
      bottom: rect.bottom - outer.top + surface.scrollTop + 12};
  }

  function bounds() {
    const columns = Math.max(1, Math.floor((surface.clientWidth - 40) / DesktopGrid.colWidth));
    // Extra rows remain reachable by scrolling when the desktop is crowded.
    const rows = Math.ceil((visibleIcons().length + 1) / columns) + (widgetRect() ? 3 : 0);
    return {maxCol: columns - 1, maxRow: Math.max(rows - 1,
      Math.floor((surface.clientHeight - DesktopGrid.startY - 86) / DesktopGrid.rowHeight))};
  }

  function findPosition(icon, wantedLeft, wantedTop, ignoreId) {
    const grid = bounds(), blocked = widgetRect();
    const maxY = DesktopGrid.startY + grid.maxRow * DesktopGrid.rowHeight;
    const col = Math.max(0, Math.min(grid.maxCol,
      Math.round(((Number(wantedLeft) || 0) - DesktopGrid.startX) / DesktopGrid.colWidth)));
    const row = Math.max(0, Math.min(grid.maxRow,
      Math.round(((Number(wantedTop) || 0) - DesktopGrid.startY) / DesktopGrid.rowHeight)));
    const base = Desktop_slotToPosition({col, row});
    const otherIcons = visibleIcons().filter(other => other !== icon && other.dataset.layoutId !== ignoreId);
    const others = otherIcons.map(other => rectAt(other, parseFloat(other.style.left) || 0, parseFloat(other.style.top) || 0));
    const free = point => {
      const rect = rectAt(icon, point.left, point.top);
      return (!blocked || !overlaps(rect, blocked)) && !others.some(other => overlaps(rect, other));
    };
    // During a drop the dragged icon takes the requested cell. Displace any
    // occupants forward, skipping widget cells, until an empty cell is reached.
    if (DesktopState.dragSession?.icon === icon && DesktopState.dragSession.moved) {
      let destination = base;
      if (blocked && overlaps(rectAt(icon, destination.left, destination.top), blocked)) {
        const allowed = [];
        for (let r = 0; r <= grid.maxRow; r++) for (let c = 0; c <= grid.maxCol; c++) {
          const point = Desktop_slotToPosition({col: c, row: r});
          if (!overlaps(rectAt(icon, point.left, point.top), blocked)) allowed.push(point);
        }
        allowed.sort((a,b) => Math.hypot(a.left-base.left,a.top-base.top)-Math.hypot(b.left-base.left,b.top-base.top));
        destination = allowed[0] || {left: DesktopGrid.startX, top: maxY + DesktopGrid.rowHeight};
      }
      let cell = destination;
      let occupant = otherIcons.find(other => overlaps(rectAt(icon, cell.left, cell.top),
        rectAt(other, parseFloat(other.style.left)||0, parseFloat(other.style.top)||0)));
      const moves = [], shifted = new Set();
      while (occupant) {
        shifted.add(occupant);
        let c = Math.round((cell.left - DesktopGrid.startX) / DesktopGrid.colWidth);
        let r = Math.round((cell.top - DesktopGrid.startY) / DesktopGrid.rowHeight);
        do {
          if (++c > grid.maxCol) { c = 0; r++; }
          cell = Desktop_slotToPosition({col: c, row: r});
        } while (blocked && overlaps(rectAt(occupant,cell.left,cell.top),blocked));
        moves.push({icon: occupant, point: cell});
        occupant = otherIcons.find(other => !shifted.has(other) && overlaps(
          rectAt(moves[moves.length-1].icon,cell.left,cell.top),
          rectAt(other,parseFloat(other.style.left)||0,parseFloat(other.style.top)||0)));
      }
      for (const move of moves.reverse()) {
        move.icon.style.left = move.point.left + 'px'; move.icon.style.top = move.point.top + 'px';
        Desktop_saveLayout(move.icon.dataset.layoutId, {...move.point,
          slot: Desktop_positionExactSlot(move.point.left, move.point.top)}, Desktop_resolveLayoutUser());
      }
      return destination;
    }
    if (free(base)) return base;
    const candidates = [];
    for (let row = 0; row <= grid.maxRow; row++) for (let col = 0; col <= grid.maxCol; col++) {
      const point = Desktop_slotToPosition({col, row});
      if (free(point)) candidates.push(point);
    }
    candidates.sort((a, b) => Math.hypot(a.left - base.left, a.top - base.top) -
      Math.hypot(b.left - base.left, b.top - base.top) || a.top - b.top || a.left - b.left);
    if (candidates.length) return candidates[0];
    // Tall icons or densely packed free-form positions must never force an overlap.
    let fallback = {left: DesktopGrid.startX, top: maxY + DesktopGrid.rowHeight};
    while (!free(fallback)) fallback.top += DesktopGrid.rowHeight;
    return fallback;
  }

  function repairLayout() {
    if (!ready || DesktopState.dragSession || DesktopState.nativeDrag) return;
    const icons = visibleIcons();
    const user = Desktop_resolveLayoutUser();
    for (const icon of icons) {
      const left = parseFloat(icon.style.left) || 0, top = parseFloat(icon.style.top) || 0;
      const next = findPosition(icon, left, top, icon.dataset.layoutId);
      if (left === next.left && top === next.top) continue;
      icon.style.position = 'absolute';
      icon.style.left = next.left + 'px'; icon.style.top = next.top + 'px';
      Desktop_saveLayout(icon.dataset.layoutId, {...next,
        slot: Desktop_positionExactSlot(next.left, next.top)}, user);
    }
  }

  function refresh() {
    if (!ready || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; repairLayout(); });
  }

  function init() {
    surface = document.querySelector('#desktop > .desktop');
    if (!surface || typeof Desktop_findFreePosition !== 'function') return;
    ready = true;
    window.Desktop_findFreePosition = findPosition;
    window.Desktop_gridBounds = bounds;
    for (const name of ['Desktop_applyUserLayout', 'Desktop_cleanUp', 'Desktop_showApp']) {
      const original = window[name];
      window[name] = function(...args) { const result = original.apply(this, args); repairLayout(); return result; };
    }
    new MutationObserver(refresh).observe(surface, {childList: true});
    new MutationObserver(refresh).observe(document.getElementById('desktop'), {attributes: true, attributeFilter: ['class']});
    window.addEventListener('resize', refresh);
    refresh();
  }
  window.JackOSMacDesktop = {refresh};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
