import { useState, useEffect } from 'react';

/*
  [новый хук, рефакторинг 2.14.26]
  [правка 2.14.29] showPassword переехал в useAuth.
  [правка 2.14.32] sending и isUploading переехали в useChat.

  Здесь только чистые UI-флаги.
*/
export const useChatUI = () => {
  const storedTheme = localStorage.getItem('ghost-chat-theme') || 'light';

  const [isDark, setIsDark] = useState(storedTheme === 'dark');
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [showPlayers, setShowPlayers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [banConfirm, setBanConfirm] = useState(null);
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
    banConfirm, setBanConfirm,
    fullscreenImage, setFullscreenImage,
    showFullscreenReactions, setShowFullscreenReactions,
    closeFullscreen,
    showMobileInput, setShowMobileInput,
  };
};