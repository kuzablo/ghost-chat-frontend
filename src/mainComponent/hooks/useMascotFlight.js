import { useRef, useState, useCallback, useEffect } from 'react';

/*
  [2.37.7] Полёт маскота через Web Animations API.

  Элемент создаётся императивно (document.createElement) и
  анимируется браузером через element.animate(). React в полёт
  не вмешивается — state flying нужен только чтобы погасить
  оригинал в шапке.

  Почему не FLIP через setState: transition: none → 600ms после
  двух RAF не всегда срабатывает (батчинг setState). WAAPI надёжнее.
*/

const DEFAULT_DURATION = 600;

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

export const useMascotFlight = ({
  fromRef,
  toRef,
  duration = DEFAULT_DURATION,
  onLand,
  onTakeoff,
} = {}) => {
  const [flying, setFlying] = useState(false);

  const flyingRef = useRef(false);
  const nodeRef = useRef(null);
  const animRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Чистим всё, что осталось от полёта
      try { animRef.current?.cancel(); } catch { /* noop */ }
      try { nodeRef.current?.remove(); } catch { /* noop */ }
      nodeRef.current = null;
      animRef.current = null;
      flyingRef.current = false;
    };
  }, []);

  const startFlight = useCallback(() => {
    if (flyingRef.current) return;

    const fromEl = fromRef?.current;
    const toEl = toRef?.current;
    if (!fromEl || !toEl) {
      console.warn('[useMascotFlight] fromRef или toRef не навешан');
      return;
    }

    const from = getRect(fromEl);
    const to = getRect(toEl);
    if (!from || !to) return;

    // Создаём летающий элемент
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
    if (onTakeoff) onTakeoff();

    // Смещение по центрам + коэффициент роста
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
      if (!mountedRef.current) {
        el.remove();
        return;
      }
      el.remove();
      nodeRef.current = null;
      animRef.current = null;
      flyingRef.current = false;
      setFlying(false);
      if (onLand) onLand();
    };
  }, [fromRef, toRef, duration, onTakeoff, onLand]);

  return { flying, startFlight };
};