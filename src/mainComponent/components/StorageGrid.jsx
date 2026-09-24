import { useState, useRef, useEffect, useCallback } from 'react';
import StorageTile from './StorageTile';

/*
  [2.47.5] Сетка хранилища с dragndrop.
  - Долгое нажатие 400мс → активация drag.
  - Ghost (клон карточки) летит за пальцем, оригинал становится
    полупрозрачным плейсхолдером.
  - Соседи переставляются в реальном времени (пересчёт порядка).
  - Отпустил → onReorder(ids) на сервер.
  - Движение >8px до активации отменяет drag (скролл).
  - Авто-скролл у краёв .storage-body при перетаскивании.
*/

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 8;
const EDGE_SCROLL_ZONE = 70;
const EDGE_SCROLL_SPEED = 10;

const StorageGrid = ({ items, onDelete, onReorder }) => {
  const [draggingId, setDraggingId] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [orderPreview, setOrderPreview] = useState(null);

  const gridRef = useRef(null);
  const dragRef = useRef({
    active: false,
    timer: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    offsetX: 0,
    offsetY: 0,
    item: null,
    originalOrder: [],
    scrollEl: null,
    autoScrollRaf: null,
  });

  const itemsById = useRef(new Map());
  itemsById.current = new Map(items.map(i => [i.id, i]));

  const currentOrder = orderPreview || items.map(i => i.id);
  const sortedItems = currentOrder.map(id => itemsById.current.get(id)).filter(Boolean);

  const stopAutoScroll = () => {
    const d = dragRef.current;
    if (d.autoScrollRaf) {
      cancelAnimationFrame(d.autoScrollRaf);
      d.autoScrollRaf = null;
    }
  };

  const autoScrollTick = useCallback(() => {
    const d = dragRef.current;
    if (!d.active || !d.scrollEl) return;
    const rect = d.scrollEl.getBoundingClientRect();
    const y = d.lastY;
    if (y < rect.top + EDGE_SCROLL_ZONE) {
      d.scrollEl.scrollTop -= EDGE_SCROLL_SPEED;
    } else if (y > rect.bottom - EDGE_SCROLL_ZONE) {
      d.scrollEl.scrollTop += EDGE_SCROLL_SPEED;
    }
    d.autoScrollRaf = requestAnimationFrame(autoScrollTick);
  }, []);

  const cancelDrag = useCallback(() => {
    const d = dragRef.current;
    if (d.timer) { clearTimeout(d.timer); d.timer = null; }
    stopAutoScroll();
    d.active = false;
    d.pointerId = null;
    setDraggingId(null);
    setGhost(null);
    setOrderPreview(null);
  }, []);

  useEffect(() => () => {
    cancelDrag();
  }, [cancelDrag]);

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target;
    if (target.closest('button')) return;
    if (target.closest('.storage-tile-voice')) return;

    const tileEl = target.closest('[data-storage-tile-id]');
    if (!tileEl) return;

    const id = tileEl.dataset.storageTileId;
    const item = itemsById.current.get(id);
    if (!item) return;

    const rect = tileEl.getBoundingClientRect();
    const scrollEl = tileEl.closest('.storage-body');

    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }

    dragRef.current = {
      active: false,
      timer: setTimeout(() => {
        const d = dragRef.current;
        d.active = true;
        d.timer = null;
        d.item = item;
        d.offsetX = d.startX - rect.left;
        d.offsetY = d.startY - rect.top;
        d.originalOrder = currentOrder.slice();
        d.scrollEl = scrollEl;
        setDraggingId(id);
        setGhost({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          item,
        });
        if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* noop */ } }
        d.autoScrollRaf = requestAnimationFrame(autoScrollTick);
      }, LONG_PRESS_MS),
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      offsetX: 0,
      offsetY: 0,
      item: null,
      originalOrder: [],
      scrollEl: null,
      autoScrollRaf: null,
    };
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.pointerId) return;
    d.lastX = e.clientX;
    d.lastY = e.clientY;

    if (!d.active) {
      const dx = Math.abs(e.clientX - d.startX);
      const dy = Math.abs(e.clientY - d.startY);
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
        if (d.timer) { clearTimeout(d.timer); d.timer = null; }
        try { e.currentTarget.releasePointerCapture(d.pointerId); } catch { /* noop */ }
        d.pointerId = null;
      }
      return;
    }

    e.preventDefault?.();

    setGhost(g => g ? { ...g, left: e.clientX - d.offsetX, top: e.clientY - d.offsetY } : g);

    const grid = gridRef.current;
    if (!grid) return;
    const tiles = grid.querySelectorAll('[data-storage-tile-id]');
    let targetIdx = -1;
    tiles.forEach((el, idx) => {
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top && e.clientY <= r.bottom) {
        targetIdx = idx;
      }
    });
    if (targetIdx < 0) return;

    const preview = orderPreview || currentOrder;
    const fromIdx = preview.indexOf(d.item.id);
    if (fromIdx === -1 || fromIdx === targetIdx) return;

    const next = preview.slice();
    next.splice(fromIdx, 1);
    next.splice(targetIdx, 0, d.item.id);
    setOrderPreview(next);
  };

  const finishDrag = (e, commit) => {
    const d = dragRef.current;
    if (d.timer) { clearTimeout(d.timer); d.timer = null; }

    if (d.active && commit && orderPreview) {
      const before = d.originalOrder.join('|');
      const after = orderPreview.join('|');
      if (before !== after && onReorder) onReorder(orderPreview);
    }

    stopAutoScroll();
    d.active = false;
    try { if (d.pointerId) e.currentTarget.releasePointerCapture(d.pointerId); } catch { /* noop */ }
    d.pointerId = null;
    setDraggingId(null);
    setGhost(null);
    setOrderPreview(null);
  };

  const onPointerUp = (e) => finishDrag(e, true);
  const onPointerCancel = (e) => finishDrag(e, false);

  return (
    <>
      <div
        ref={gridRef}
        className={`storage-grid${draggingId ? ' storage-grid--dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => { if (draggingId) e.preventDefault(); }}
      >
        {sortedItems.map(item => (
          <div
            key={item.id}
            data-storage-tile-id={item.id}
            className={`storage-grid-item${draggingId === item.id ? ' storage-grid-item--dragging' : ''}`}
          >
            <StorageTile item={item} onDelete={onDelete} />
          </div>
        ))}
      </div>

      {ghost && (
        <div
          className="storage-grid-ghost"
          style={{
            left: ghost.left,
            top: ghost.top,
            width: ghost.width,
            height: ghost.height,
          }}
          aria-hidden="true"
        >
          <StorageTile item={ghost.item} onDelete={() => {}} />
        </div>
      )}
    </>
  );
};

export default StorageGrid;