import { useState, useEffect } from 'react';

/*
  [новый хук, рефакторинг 2.14.26]
  [правка 2.14.29] showPassword переехал в useAuth (логически часть формы логина).
  Вынесено из Chat.jsx — чисто UI-состояние, без бизнес-логики.

  Здесь только useState + один эффект для темы (переключение класса
  на body + сохранение в localStorage).

  Что НЕ здесь и почему:
    - notices        → зависит от players (WS-события захода/выхода);
    - showScrollDown → управляется скролл-слушателем (useAutoScroll);
    - input          → тесно связано с отправкой сообщения (useChat).
*/
export const useChatUI = () => {
  const storedTheme = localStorage.getItem('ghost-chat-theme') || 'light';

  const [isDark, setIsDark] = useState(storedTheme === 'dark');
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [showPlayers, setShowPlayers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [banConfirm, setBanConfirm] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showFullscreenReactions, setShowFullscreenReactions] = useState(false);
  const [showMobileInput, setShowMobileInput] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('ghost-chat-theme', isDark ? 'dark' : 'light');
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
    activeMessageId, setActiveMessageId,
    toggleReactions,
    showPlayers, setShowPlayers,
    searchQuery, setSearchQuery,
    sending, setSending,
    banConfirm, setBanConfirm,
    isUploading, setIsUploading,
    fullscreenImage, setFullscreenImage,
    showFullscreenReactions, setShowFullscreenReactions,
    closeFullscreen,
    showMobileInput, setShowMobileInput,
  };
};