import { useRef, useState, useCallback, useEffect } from 'react';

/*
  [2.39.2] Убран HANDOFF_MS — удаление летающего через двойной RAF
           после onfinish. React успевает отрисовать целевой элемент
           (оригинал в шапке / маскот в панели / орбита в центре),
           потом летающий уходит. Без пустого кадра и без двух маскотов.
  [2.39.0] Двусторонний полёт. startFlight({ toRef, reverse, fromLanded }).
  [2.37.9] Fallback на центр экрана.
  [2.37.7] Web Animations API.
*/

const DEFAULT_DURATION = 600;
const CENTER_SIZE = 80;

const getRect = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
  };
};

const isUsableRect = (r) => r && r.width > 0 && r.height > 0;

const getCenterRect = (size) => ({
  left: (window.innerWidth - size) / 2,
  top: (window.innerHeight - size) / 2,
  width: size,
  height: size,
});

export const useMascotFlight = ({
  fromRef,
  toRef,
  duration = DEFAULT_DURATION,
  onLand,
} = {}) => {
  const [flying, setFlying] = useState(false);

  const flyingRef = useRef(false);
  const nodeRef = useRef(null);
  const animRef = useRef(null);
  const mountedRef = useRef(true);
  const lastLandedRectRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try { animRef.current?.cancel(); } catch { /* noop */ }
      try { nodeRef.current?.remove(); } catch { /* noop */ }
      nodeRef.current = null;
      animRef.current = null;
      flyingRef.current = false;
    };
  }, []);

  const startFlight = useCallback((options = {}) => {
    const { reverse = false, fromLanded = false, toRef: toRefOverride } = options;

    if (flyingRef.current) return;

    let from = null;
    let to = null;

    if (reverse) {
      from = lastLandedRectRef.current;
      to = getRect(fromRef?.current);
    } else if (fromLanded) {
      from = lastLandedRectRef.current;
      to = getRect(toRefOverride?.current || toRef?.current);
    } else {
      from = getRect(fromRef?.current);
      const targetEl = toRefOverride?.current || toRef?.current;
      to = getRect(targetEl);
    }

    if (!isUsableRect(from)) {
      console.warn('[useMascotFlight] нет источника — не летим');
      return;
    }

    if (!isUsableRect(to)) {
      to = getCenterRect(CENTER_SIZE);
    }

    const el = document.createElement('div');
    el.className = 'mascot-flying';
    el.style.left = `${from.left}px`;
    el.style.top = `${from.top}px`;
    el.style.width = `${from.width}px`;
    el.style.height = `${from.height}px`;
    document.body.appendChild(el);
    nodeRef.current = el;

    flyingRef.current = true;
    setFlying(true);

    const dx = (to.left - from.left) + (to.width - from.width) / 2;
    const dy = (to.top - from.top) + (to.height - from.height) / 2;
    const scale = from.width > 0 ? to.width / from.width : 1;

    const anim = el.animate(
      [
        { transform: 'translate3d(0, 0, 0) scale(1)' },
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})` },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)',
        fill: 'forwards',
      }
    );
    animRef.current = anim;

    anim.onfinish = () => {
      lastLandedRectRef.current = to;
      if (!mountedRef.current) {
        el.remove();
        return;
      }
      // Снимаем флаг → ререндер → целевой элемент появляется на своём месте.
      flyingRef.current = false;
      setFlying(false);
      if (onLand) onLand();
      // Двойной RAF — даём React отрисовать целевой элемент, потом
      // убираем летающий. Он визуально окажется ровно под целевым.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try { el.remove(); } catch { /* noop */ }
        });
      });
    };
  }, [fromRef, toRef, duration, onLand]);

  return { flying, startFlight };
};