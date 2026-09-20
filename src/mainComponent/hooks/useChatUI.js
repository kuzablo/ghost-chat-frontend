import { useState, useEffect, useCallback } from 'react';

/*
  [2.21.0] toggleTheme(event) — плавное переключение темы
          через View Transitions API (radial reveal из точки клика).
          Фолбэк: если API нет — мгновенное переключение.
  [2.17.0] showInfo — состояние инфо-панели «Что умеет чат».
*/
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

  const toggleTheme = useCallback((event) => {
    const next = !isDark;

    // Точка старта: место клика, либо правый-верхний угол
    const x = event?.clientX ?? window.innerWidth - 30;
    const y = event?.clientY ?? 30;

    // Фолбэк — если API не поддерживается
    if (typeof document.startViewTransition !== 'function') {
      setIsDark(next);
      return;
    }

    // Синхронно переключаем класс, чтобы снапшот "нового" состояния был корректным
    document.body.classList.toggle('dark', next);
    setIsDark(next);

    const transition = document.startViewTransition(() => {
      // пусто — DOM уже переключён выше
    });

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
      .catch(() => { /* transition отменён — молча */ });

    transition.finished.catch(() => { /* то же */ });
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