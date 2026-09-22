import { useState, useEffect, useCallback } from 'react';

/*
  [2.35.26] theme-switching на время смены темы — гасим CSS transitions, нет фриза
  [2.32.39] useCallback на toggleReactions/closeFullscreen
  [2.32.34] toggleTheme: класс внутри callback View Transition
  [2.32.19] активная реакция-пикер автоскрывается через 2 сек
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

  useEffect(() => {
    if (!activeMessageId) return;
    const t = setTimeout(() => setActiveMessageId(null), PICKER_AUTOHIDE_MS);
    return () => clearTimeout(t);
  }, [activeMessageId]);

  const toggleTheme = useCallback((event) => {
    const next = !isDark;
    const x = event?.clientX ?? window.innerWidth - 30;
    const y = event?.clientY ?? 30;

    // [2.35.26] На время смены темы гасим CSS transitions.
    // Иначе сотни цветовых интерполяций стартуют одновременно — фриз.
    const freeze = () => document.body.classList.add('theme-switching');
    const unfreeze = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.classList.remove('theme-switching');
        });
      });
    };

    if (typeof document.startViewTransition !== 'function') {
      freeze();
      document.body.classList.toggle('dark', next);
      setIsDark(next);
      unfreeze();
      return;
    }

    const transition = document.startViewTransition(() => {
      freeze();
      document.body.classList.toggle('dark', next);
    });
    setIsDark(next);

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
            duration: 320,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      })
      .catch(() => { /* noop */ });

    transition.finished
      .then(unfreeze)
      .catch(unfreeze);
  }, [isDark]);

  const toggleReactions = useCallback((messageId) => {
    setActiveMessageId(prev => (prev === messageId ? null : messageId));
  }, []);

  const closeFullscreen = useCallback(() => {
    setFullscreenImage(null);
    setShowFullscreenReactions(false);
  }, []);

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