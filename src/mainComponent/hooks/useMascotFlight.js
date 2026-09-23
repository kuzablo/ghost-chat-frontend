import { useRef, useState, useCallback, useEffect } from 'react';

/*
  [2.37.7] Каркас полёта маскота. FLIP-техника:
  замер from/to, отрисовка летающего элемента в стартовой точке,
  transform к целевой точке за duration, завершение по таймауту.

  Пока без привязки к unread — триггерится вручную для теста.
  В Шаге 2 свяжем с unreadUserObjects.length.

  flyingStyle — стиль для летающего <div>, приходит в ready-виде,
  родителю нужно только разложить его по элементу.
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
  const [style, setStyle] = useState(null);

  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const flyingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const cancelFlight = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    flyingRef.current = false;
    if (!mountedRef.current) return;
    setFlying(false);
    setStyle(null);
  }, []);

  const startFlight = useCallback(() => {
    if (flyingRef.current) return;

    const from = getRect(fromRef?.current);
    const to = getRect(toRef?.current);
    if (!from || !to) {
      console.warn('[useMascotFlight] from или to ref не навешан');
      return;
    }

    if (onTakeoff) onTakeoff();
    flyingRef.current = true;

    // Стартовая геометрия: летающий элемент стоит ровно на from.
    // transform — точка отсчёта, без смещения.
    setStyle({
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      transform: 'translate3d(0, 0, 0) scale(1)',
      opacity: 1,
      transition: 'none',
    });
    setFlying(true);

    // Смещение центра from → центр to, и коэффициент роста.
    // transform-origin: center (в CSS), поэтому считаем по центрам.
    const dx = to.left - from.left + (to.width - from.width) / 2;
    const dy = to.top - from.top + (to.height - from.height) / 2;
    const scale = from.width > 0 ? to.width / from.width : 1;

    // Двойной RAF — даём браузеру отрисовать стартовое состояние,
    // потом меняем transform. Так transition сработает плавно.
    requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      requestAnimationFrame(() => {
        if (!mountedRef.current) return;
        setStyle({
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`,
          opacity: 1,
          transition: `transform ${duration}ms cubic-bezier(0.34, 1.2, 0.64, 1), opacity ${duration}ms ease-out`,
        });
      });
    });

    // Завершение по таймауту (надёжнее transitionend).
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flyingRef.current = false;
      if (!mountedRef.current) return;
      setFlying(false);
      setStyle(null);
      if (onLand) onLand();
    }, duration + 30);
  }, [fromRef, toRef, duration, onLand, onTakeoff]);

  return {
    flying,
    flyingStyle: style,
    startFlight,
    cancelFlight,
  };
};