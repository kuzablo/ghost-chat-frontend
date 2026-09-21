import { useState, useEffect, useCallback } from 'react';

/*
  [2.32.19] активная реакция-пикер автоскрывается через 2 сек
  [2.21.0] toggleTheme(event) — плавное переключение темы
  [2.17.0] showInfo
*/
const PICKER_AUTOHIDE_MS = 2000;

export const useChatUI = () => {
  const storedTheme = localStorage.getItem('ghost-chat-theme') || 'light';

  const [isDark, setIsDark] = useState(storedTheme === 'dark');
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [banConfirm, setBanConfirm] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showFullscreenReactions, setShowFullscreenReactions] = useState(false);
  const [showMobileInput, setShowMobileInput] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('ghost-chat-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // [2.32.19] автоскрытие пикера реакций
  useEffect(() => {
    if (!activeMessageId) return;
    const t = setTimeout(() => setActiveMessageId(null), PICKER_AUTOHIDE_MS);
    return () => clearTimeout(t);
  }, [activeMessageId]);

  const toggleTheme = useCallback((event) => {
    const next = !isDark;
    const x = event?.clientX ?? window.innerWidth - 30;
    const y = event?.clientY ?? 30;

    if (typeof document.startViewTransition !== 'function') {
      setIsDark(next);
      return;
    }

    document.body.classList.toggle('dark', next);
    setIsDark(next);

    const transition = document.startViewTransition(() => {});

    transition.ready
      .then(() => {
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 550,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      })
      .catch(() => { /* noop */ });

    transition.finished.catch(() => { /* noop */ });
  }, [isDark]);

  const toggleReactions = (messageId) => {
    setActiveMessageId(prev => (prev === messageId ? null : messageId));
  };

  const closeFullscreen = () => {
    setFullscreenImage(null);
    setShowFullscreenReactions(false);
  };

  return {
    isDark, setIsDark,
    toggleTheme,
    activeMessageId, setActiveMessageId,
    toggleReactions,
    showPlayers, setShowPlayers,
    showInfo, setShowInfo,
    searchQuery, setSearchQuery,
    banConfirm, setBanConfirm,
    fullscreenImage, setFullscreenImage,
    showFullscreenReactions, setShowFullscreenReactions,
    closeFullscreen,
    showMobileInput, setShowMobileInput,
  };
};