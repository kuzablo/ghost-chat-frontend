import { useRef, useState, useCallback, useEffect } from 'react';

/*
  [2.39.6] Плавнее: duration 600→700, easing cubic-bezier(0.4, 0, 0.2, 1)
           без отскока. Летающий маскот появляется через opacity 0→1
           за первые ~10% времени — без резкого «выскакивания».
  [2.39.5] Анимация через left/top/width/height вместо transform: scale —
           border не масштабируется вместе с маскотом, обводка 2px везде.
  [2.39.4] fromLanded — старт из lastLandedRect в новую цель.
  [2.39.3] Целевая точка = центр элемента + размер size.
*/

const DEFAULT_DURATION = 700;
const CENTER_SIZE = 82;
const LANDED_HOLD_MS = 260;

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

const getTargetRect = (el, size) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!size) {
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  return {
    left: r.left + r.width / 2 - size / 2,
    top: r.top + r.height / 2 - size / 2,
    width: size,
    height: size,
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
    const {
      reverse = false,
      fromLanded = false,
      toRef: toRefOverride,
      toSize = null,
    } = options;

    if (flyingRef.current) return;

    let from = null;
    let to = null;

    if (reverse) {
      from = lastLandedRectRef.current;
      to = getRect(fromRef?.current);
    } else if (fromLanded) {
      from = lastLandedRectRef.current;
      const targetEl = toRefOverride?.current || toRef?.current;
      to = getTargetRect(targetEl, toSize);
    } else {
      from = getRect(fromRef?.current);
      const targetEl = toRefOverride?.current || toRef?.current;
      to = getTargetRect(targetEl, toSize);
    }

    if (!isUsableRect(from)) {
      console.warn('[useMascotFlight] нет источника — не летим');
      return;
    }

    if (!isUsableRect(to)) {
      to = getCenterRect(toSize || CENTER_SIZE);
    }

    const el = document.createElement('div');
    el.className = 'mascot-flying';
    el.style.left = `${from.left}px`;
    el.style.top = `${from.top}px`;
    el.style.width = `${from.width}px`;
    el.style.height = `${from.height}px`;
    el.style.opacity = '0';
    document.body.appendChild(el);
    nodeRef.current = el;

    flyingRef.current = true;
    setFlying(true);

    const anim = el.animate(
      [
        {
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          opacity: 0,
        },
        {
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          opacity: 1,
          offset: 0.1,
        },
        {
          left: `${to.left}px`,
          top: `${to.top}px`,
          width: `${to.width}px`,
          height: `${to.height}px`,
          opacity: 1,
        },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
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
      flyingRef.current = false;
      setFlying(false);
      if (onLand) onLand();
      setTimeout(() => {
        try { el.remove(); } catch { /* noop */ }
      }, LANDED_HOLD_MS);
    };
  }, [fromRef, toRef, duration, onLand]);

  return { flying, startFlight };
};