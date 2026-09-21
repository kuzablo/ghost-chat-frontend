import { useEffect, useRef, useState } from 'react';

/*
  [2.32.21] постоянный ResizeObserver: если юзер у низа — держим у низа
            при изменении размера контейнера (клавиатура, редактирование)
  [2.32.8] первый скролл — мгновенный
  [2.31.9] ResizeObserver на 2 секунды после mount для PWA
  [2.18.6] подстраховка для картинок
*/

export const useAutoScroll = ({ messages, resetKey }) => {
  const [showScrollDown, setShowScrollDown] = useState(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Автоскролл: всегда мгновенно в низ при новых сообщениях
  useEffect(() => {
    if (messages.length === 0) return;

    let raf1 = null;
    let raf2 = null;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = messagesContainerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    });

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [messages]);

  /* ResizeObserver — первые 2 секунды после mount (PWA) */
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;

    let alive = true;
    const start = Date.now();

    const ro = new ResizeObserver(() => {
      if (!alive) return;
      if (Date.now() - start > 2000) {
        ro.disconnect();
        return;
      }
      el.scrollTop = el.scrollHeight;
    });

    ro.observe(el);
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);

    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [resetKey]);

  /* [2.32.21] постоянный ResizeObserver — держим скролл у низа,
     если юзер не ушёл вверх. Срабатывает при открытии/закрытии
     клавиатуры и при входе/выходе из режима редактирования. */
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;

    const KEEP_BOTTOM_PX = 80;

    const ro = new ResizeObserver(() => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < KEEP_BOTTOM_PX) {
        el.scrollTop = el.scrollHeight;
      }
    });

    ro.observe(el);

    return () => ro.disconnect();
  }, []);

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
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  return {
    messagesContainerRef,
    messagesEndRef,
    showScrollDown,
    scrollToBottom,
  };
};