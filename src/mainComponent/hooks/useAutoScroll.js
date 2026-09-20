import { useEffect, useRef, useState } from 'react';

/*
  [2.18.6] Автоскролл при загрузке.
  Причина бага на ПК: mobile-capsule рендерилась пустым блоком и съедала
  место, из-за чего scrollHeight в момент двойного RAF был меньше финального.
  Теперь:
    - capsule на десктопе скрыт через CSS (Chat.css);
    - в хуке добавляем подстраховку: ещё один скролл через 300мс.
*/

const cubicBezier = (p1x, p1y, p2x, p2y) => {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  const solveT = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const x2 = sampleX(t) - x;
      if (Math.abs(x2) < 1e-6) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= x2 / d;
    }
    let lo = 0, hi = 1;
    t = x;
    while (lo < hi) {
      const x2 = sampleX(t);
      if (Math.abs(x2 - x) < 1e-6) return t;
      if (x2 < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (x) => sampleY(solveT(x));
};

const animateScrollToBottom = (el, duration = 1400) => {
  if (!el) return;
  const startTop = el.scrollTop;
  const targetTop = el.scrollHeight - el.clientHeight;
  const distance = targetTop - startTop;
  if (distance <= 0) return;

  const ease = cubicBezier(0.16, 0.84, 0.44, 1);
  const startTime = performance.now();

  const tick = (now) => {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    el.scrollTop = startTop + distance * ease(t);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

export const useAutoScroll = ({ messages, resetKey }) => {
  const [showScrollDown, setShowScrollDown] = useState(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);

  // Автоскролл: первый раз — плавной анимацией, дальше — мгновенно.
  useEffect(() => {
    if (messages.length === 0) return;

    let raf1 = null;
    let raf2 = null;
    let lateTimer = null;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = messagesContainerRef.current;
        if (!el) return;

        if (!hasAutoScrolledRef.current) {
          animateScrollToBottom(el, 1400);
          hasAutoScrolledRef.current = true;
        } else {
          el.scrollTop = el.scrollHeight;
        }

        // [2.18.6] подстраховка: если картинки/лейаут догрузились —
        // добиваем в самый низ через 300мс
        clearTimeout(lateTimer);
        lateTimer = setTimeout(() => {
          const el2 = messagesContainerRef.current;
          if (!el2) return;
          el2.scrollTop = el2.scrollHeight;
        }, 300);
      });
    });

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(lateTimer);
    };
  }, [messages]);

  // Индикатор «вниз»
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    let rafId = null;
    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollDown(distanceFromBottom > 200);
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [resetKey]);

  const scrollToBottom = () => {
    animateScrollToBottom(messagesContainerRef.current, 800);
  };

  return {
    messagesContainerRef,
    messagesEndRef,
    showScrollDown,
    scrollToBottom,
  };
};