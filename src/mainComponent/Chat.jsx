import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import LatestVersionLink from './LatestVersionLink';
import PrivateChat from './components/PrivateChat';
import PlayersPanel from './components/PlayersPanel';
import AuthModal from './components/AuthModal';
import MessageList from './components/MessageList';
import DuelBox from './components/DuelBox';
import InfoPanel from './components/InfoPanel';
import DialogsPanel from './components/DialogsPanel';
import ConfirmModal from './components/ConfirmModal';
import ChatInput from './components/ChatInput';
import NotificationPermissionModal from './components/NotificationPermissionModal';
import ProfilePanel from './components/ProfilePanel';
import FriendshipRitual from './components/FriendshipRitual';
import { QRCodeSVG } from 'qrcode.react';
import { useWebSocket } from './useWebSocket';
import {
  getAvatarColor,
  getInitial,
  formatMessageDate,
} from './utils';
import { useAudio } from './hooks/useAudio';
import { useChatUI } from './hooks/useChatUI';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useAuth } from './hooks/useAuth';
import { useDuel } from './hooks/useDuel';
import { usePrivateChat } from './hooks/usePrivateChat';
import { useChat } from './hooks/useChat';
import { useYouTubePlayer } from './hooks/useYouTubePlayer';
import InstallPwaBanner from './components/InstallPwaBanner';

import '../styles/Chat.css';
import '../styles/Chat.image.css';
import '../styles/Chat.players.css';
import '../styles/Chat.private.css';
import '../styles/Chat.modals.css';
import '../styles/Chat.mobile.css';
import '../styles/Chat.mascot.css';
import '../styles/Chat.info.css';
import '../styles/Chat.dialogs.css';
import '../styles/Chat.stickers.css';
import '../styles/Chat.profile.css';
import '../styles/Chat.friendship.css';

// [2.33.1] лимит загрузки 25 МБ, клиентская проверка размера
// [2.33.0] Ритуал дружбы — огонь и вода, компонент FriendshipRitual
// [2.32.42] avatarCache от useChat — аватарки не пропадают при офлайне
// [2.32.41] bannedUsers прокинут в MessageList — метка на аватарках
// [2.32.40] ConfirmBanModal удалён — бан идёт через ConfirmModal с danger.
// [2.32.39] useMemo для imageMessages — не пересобираем на каждом WS.
// [2.32.38] свайп влево от правого края → диалоги
// [2.32.37] свайп DialogsPanel через DOM
// [2.32.36] свайпы сообщений через DOM
// [2.32.35] 8 визуальных демо в InfoPanel
const VERSION = '2.33.1';
const WS_URL = 'wss://api.banjoboy420.ru';
const API_URL = 'https://api.banjoboy420.ru';
const BASE_TITLE = "banjoboy's crew";
const FS_SWIPE_THRESHOLD = 80;
const FS_CLOSE_THRESHOLD = 120;
const FS_DOUBLE_TAP_MS = 250;
const NOTIF_SNOOZE_MS = 24 * 60 * 60 * 1000;
const VAPID_PUBLIC_KEY = 'BJVBCXRoQMBcgEAIrgMo8Wrs7wG_jCjriBY6yS7EkST7EyOhB7ohpMrbujcLtUPjAo7GcKB0Z7Jin-5Uj450muo';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
};

const ThemeIcon = () => (
  <span className="theme-icon" aria-hidden="true">
    <svg
      className="theme-icon-sun"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
    <svg
      className="theme-icon-moon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </span>
);

const Chat = () => {
  const auth = useAuth();
  const {
    token, nickname, isAuth, isAdmin, myId, serverVersion,
    adminUserId, adminNickname,
    isRegisterMode, setIsRegisterMode,
    authNickname, setAuthNickname,
    authPassword, setAuthPassword,
    authError, setAuthError,
    showPassword, setShowPassword,
    showIdleNotice,
    handleAuthSubmit,
    applyAuthOk,
    forceLogout,
    nicknameRef,
    tokenRef,
  } = auth;

  const {
    isDark, setIsDark,
    toggleTheme,
    activeMessageId,
    toggleReactions,
    showPlayers, setShowPlayers,
    showInfo, setShowInfo,
    searchQuery, setSearchQuery,
    banConfirm, setBanConfirm,
    fullscreenImage, setFullscreenImage,
    showFullscreenReactions, setShowFullscreenReactions,
    closeFullscreen,
    showMobileInput, setShowMobileInput,
  } = useChatUI();

  const [isConnected, setIsConnected] = useState(false);
  const [duelNotice, setDuelNotice] = useState('');
  const [fsHeart, setFsHeart] = useState(null);
  const [fsReactionListEmoji, setFsReactionListEmoji] = useState(null);
  const [inputDragY, setInputDragY] = useState(0);
  const [volumeTipVisible, setVolumeTipVisible] = useState(false);
  const [trackTitleVisible, setTrackTitleVisible] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [showDialogs, setShowDialogs] = useState(false);
  const [cameFromDialogs, setCameFromDialogs] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);

  const playersOverlayRef = useRef(null);
  const playersBtnRef = useRef(null);
  const mobilePlayersBtnRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const infoPanelRef = useRef(null);

  const fsImgRef = useRef(null);
  const fsOverlayRef = useRef(null);

  const swipeStartXRef = useRef(null);
  const swipeStartYRef = useRef(null);
  const swipeActiveRef = useRef(false);
  const swipeDirectionRef = useRef(null);
  const showPlayersRef = useRef(showPlayers);
  const showInfoRef = useRef(showInfo);
  const showDialogsRef = useRef(showDialogs);

  const inputTouchStartYRef = useRef(null);
  const inputTouchStartXRef = useRef(null);

  const capsuleSwipeRef = useRef({
    startX: 0,
    startY: 0,
    active: false,
    didSwipe: false,
    direction: null,
  });

  const fsGestureRef = useRef({
    startX: 0,
    startY: 0,
    direction: null,
    active: false,
    lastDx: 0,
    lastDy: 0,
  });
  const fsLastTapRef = useRef(0);
  const fsTapPosRef = useRef({ x: 0, y: 0 });

  const mascotGestureRef = useRef({
    startY: 0,
    startTime: 0,
    volumeBase: 50,
    inVolumeDrag: false,
    longPressTimer: null,
    longPressFired: false,
    pointerId: null,
    lastTapTime: 0,
  });

  const titleTimeoutRef = useRef(null);

  const yt = useYouTubePlayer();

  useEffect(() => {
    if (!showMiniPlayer) return;
    if (!yt.hasStarted) return;
    setShowMiniPlayer(false);
  }, [showMiniPlayer, yt.hasStarted]);

  useEffect(() => {
    if (!fullscreenImage) return;
    const img = fsImgRef.current;
    if (img) {
      img.style.transition = '';
      img.style.transform = '';
    }
    const ov = fsOverlayRef.current;
    if (ov) {
      ov.style.background = '';
    }
  }, [fullscreenImage?.messageId]);

  const subscribeToPush = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!tokenRef.current) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const res = await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenRef.current,
          subscription: sub.toJSON(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn('[push] subscribe failed:', res.status, data);
      } else {
        console.log('[push] subscribed');
      }
    } catch (err) {
      console.warn('[push] subscribe error:', err);
    }
  }, [tokenRef]);

  useEffect(() => {
    if (!isAuth) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;

    const isMobile = /Android|iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isMobile) return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (isIos && !isStandalone) return;

    if (Notification.permission === 'granted') {
      subscribeToPush();
      return;
    }

    if (Notification.permission !== 'default') return;

    let snooze = 0;
    try { snooze = Number(localStorage.getItem('ghost-chat-notif-snooze') || 0); } catch { /* noop */ }
    if (Date.now() - snooze < NOTIF_SNOOZE_MS) return;

    const t = setTimeout(() => setShowNotifModal(true), 1500);
    return () => clearTimeout(t);
  }, [isAuth, subscribeToPush]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const onSWMessage = (e) => {
      if (e.data?.type === 'push-received') {
        setHiddenUnread(n => n + 1);
      }
    };

    navigator.serviceWorker.addEventListener('message', onSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSWMessage);
  }, []);

  useEffect(() => {
    if (!yt.hasStarted) return;
    setTrackTitleVisible(true);
    clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => setTrackTitleVisible(false), 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt.trackIndex]);

  const { isConnected: wsConnected, error: wsError, sendMessage, ws } = useWebSocket(
    WS_URL,
    tokenRef.current,
    (msg) => handleWebSocketMessage(msg)
  );

  const audio = useAudio();

  const duel = useDuel({
    sendMessage,
    isAuth,
    onNotice: (text) => {
      setDuelNotice(text);
      setTimeout(() => setDuelNotice(''), 3000);
    },
  });

  const chat = useChat({
    sendMessage,
    isAuth,
    isAdmin,
    myId,
    audio,
    nicknameRef,
    onNotice: (text) => {
      setDuelNotice(text);
      setTimeout(() => setDuelNotice(''), 3000);
    },
  });

  const {
    messages,
    players,
    friends,
    typingUsers,
    friendRequests,
    notices,
    bannedUntil,
    bannedUsers,
    avatarCache,
    friendshipRitual,
    errorMessage,
    setErrorMessage,
    input,
    setInput,
    sending,
    isUploading,
    hiddenUnread,
    setHiddenUnread,
    replyTo,
    setReplyTo,
    profileData,
    handleWs: handleChatWs,
    handleSendMessage,
    handleEditMessage,
    handleFileUpload,
    handleInputChange,
    sendReaction,
    deleteMessage,
    banForever,
    watchChat,
    handleFriendRequest,
    handleAcceptRequest,
    handleDeclineRequest,
    togglePlayers: chatTogglePlayers,
    clearRitual,
  } = chat;

  const priv = usePrivateChat({ sendMessage, myId, players });
  const {
    privateChat,
    privateTypingUser,
    unreadByUser,
    dialogs,
    openPrivateChat,
    closePrivateChat,
    handleWs: handlePrivateWs,
  } = priv;

  const {
    messagesContainerRef,
    messagesEndRef,
    showScrollDown,
    scrollToBottom,
  } = useAutoScroll({ messages, resetKey: isAuth });

  const unreadCount = Object.values(unreadByUser).filter(Boolean).length;
  const friendRequestsCount = friendRequests.length;
  const totalNotifications = unreadCount + friendRequestsCount;
  const totalUnread = hiddenUnread + unreadCount + friendRequestsCount;

  const imageMessages = useMemo(
    () => messages.filter(m => m.imageUrl),
    [messages]
  );

  const currentImageIndex = fullscreenImage
    ? imageMessages.findIndex(m => m.id === fullscreenImage.messageId)
    : -1;
  const currentImageMessage = currentImageIndex >= 0
    ? imageMessages[currentImageIndex]
    : null;
  const hasPrevImage = currentImageIndex > 0;
  const hasNextImage = currentImageIndex >= 0 && currentImageIndex < imageMessages.length - 1;

  const fullscreenMessage = currentImageMessage || null;
  const fullscreenReactions = fullscreenMessage?.reactions || {};
  const fullscreenReactionEntries = Object.entries(fullscreenReactions);

  const fsAuthorAvatarUrl = fullscreenMessage
    ? avatarCache[fullscreenMessage.userId]
    : null;

  useEffect(() => {
    if (!fullscreenImage) return;
    if (currentImageIndex === -1) {
      closeFullscreen();
    }
  }, [fullscreenImage, currentImageIndex, closeFullscreen]);

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) ${BASE_TITLE}` : BASE_TITLE;

    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      try {
        if (totalUnread > 0) {
          navigator.setAppBadge(totalUnread);
        } else if ('clearAppBadge' in navigator) {
          navigator.clearAppBadge();
        }
      } catch { /* noop */ }
    }
  }, [totalUnread]);

  useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
      if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
        try { navigator.clearAppBadge(); } catch { /* noop */ }
      }
    };
  }, []);

  useEffect(() => {
    showPlayersRef.current = showPlayers;
  }, [showPlayers]);

  useEffect(() => {
    showInfoRef.current = showInfo;
  }, [showInfo]);

  useEffect(() => {
    showDialogsRef.current = showDialogs;
  }, [showDialogs]);

  const handleWebSocketMessage = useCallback((msg) => {
    console.log('📩 Входящее сообщение:', msg.type, msg.data);

    if (duel.handleWs(msg)) return;
    if (handlePrivateWs(msg)) return;
    if (handleChatWs(msg)) return;

    switch (msg.type) {
      case 'version':
        console.log(`[CHAT v${VERSION}] Server version: ${msg.data}`);
        break;
      case 'auth_ok':
        applyAuthOk(msg.data);
        sendMessage({ type: 'get_friends' });
        break;
      case 'banned_forever':
        forceLogout('У нас тут таких не любят');
        break;
      case 'idle_disconnect':
        forceLogout('Вы были отключены за неактивность. Войдите снова.');
        break;
      default:
        console.warn(`[CHAT v${VERSION}] Unknown message type:`, msg.type);
    }
  }, [sendMessage, applyAuthOk, forceLogout, duel, handlePrivateWs, handleChatWs]);

  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  useEffect(() => {
    if (wsError) {
      setErrorMessage(wsError);
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    } else {
      setErrorMessage('');
    }
  }, [wsError, setErrorMessage]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (playersBtnRef.current?.contains(e.target)) return;
      if (mobilePlayersBtnRef.current?.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.sticker-menu-overlay')) return;
      if (e.target.closest && e.target.closest('.theme-toggle')) return;
      if (e.target.closest && e.target.closest('.chat-header-theme')) return;
      if (e.target.closest && e.target.closest('.dialogs-toggle')) return;

      if (playersOverlayRef.current && !playersOverlayRef.current.contains(e.target)) {
        setShowPlayers(false);
      }
    };
    if (showPlayers) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPlayers, setShowPlayers]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;

    let raf1 = 0;
    let raf2 = 0;
    let lastKb = -1;

    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable === true
      );
    };

    const apply = () => {
      let kb = 0;
      if (isInputFocused()) {
        kb = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      }
      if (Math.abs(kb - lastKb) < 8) return;
      lastKb = kb;
      document.documentElement.style.setProperty('--kb-height', `${kb}px`);
    };

    const schedule = () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(apply);
      });
    };

    const onFocusChange = () => schedule();

    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);
    schedule();

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
      document.documentElement.style.removeProperty('--kb-height');
    };
  }, []);

  useEffect(() => {
    if (!showMobileInput) return;
    const t = setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [showMobileInput]);

  useEffect(() => {
    const EDGE_ZONE = 40;
    const THRESHOLD = 50;
    const DIRECTION_LOCK = 8;

    const handleStart = (e) => {
      if (e.touches.length !== 1) return;

      const target = e.target;
      if (target && target.closest && target.closest('.chat-header-mascot-wrap')) {
        swipeDirectionRef.current = null;
        return;
      }

      if (target && target.closest && target.closest('.mobile-capsule')) {
        swipeDirectionRef.current = null;
        return;
      }

      const t = e.touches[0];

      if (showInfoRef.current) {
        swipeStartXRef.current = t.clientX;
        swipeStartYRef.current = t.clientY;
        swipeActiveRef.current = false;
        swipeDirectionRef.current = 'closeInfo';
        return;
      }

      if (showPlayersRef.current) {
        swipeStartXRef.current = t.clientX;
        swipeStartYRef.current = t.clientY;
        swipeActiveRef.current = false;
        swipeDirectionRef.current = 'close';
      } else if (t.clientX <= EDGE_ZONE) {
        swipeStartXRef.current = t.clientX;
        swipeStartYRef.current = t.clientY;
        swipeActiveRef.current = false;
        swipeDirectionRef.current = 'open';
      } else if (t.clientX >= window.innerWidth - EDGE_ZONE && !showDialogsRef.current) {
        swipeStartXRef.current = t.clientX;
        swipeStartYRef.current = t.clientY;
        swipeActiveRef.current = false;
        swipeDirectionRef.current = 'openDialogs';
      } else {
        swipeDirectionRef.current = null;
      }
    };

    const handleMove = (e) => {
      if (!swipeDirectionRef.current) return;
      if (swipeStartXRef.current == null) return;
      if (e.touches.length !== 1) return;

      const t = e.touches[0];
      const dx = t.clientX - swipeStartXRef.current;
      const dy = t.clientY - swipeStartYRef.current;

      if (!swipeActiveRef.current) {
        if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;

        if (Math.abs(dy) > Math.abs(dx)) {
          swipeDirectionRef.current = null;
          return;
        }
        if (swipeDirectionRef.current === 'open' && dx < 0) {
          swipeDirectionRef.current = null;
          return;
        }
        if (swipeDirectionRef.current === 'close' && dx > 0) {
          swipeDirectionRef.current = null;
          return;
        }
        if (swipeDirectionRef.current === 'closeInfo' && dx < 0) {
          swipeDirectionRef.current = null;
          return;
        }
        if (swipeDirectionRef.current === 'openDialogs' && dx > 0) {
          swipeDirectionRef.current = null;
          return;
        }
        swipeActiveRef.current = true;
      }

      if (e.cancelable) e.preventDefault();
    };

    const handleEnd = (e) => {
      if (swipeDirectionRef.current && swipeStartXRef.current != null) {
        const t = e.changedTouches[0];
        const dx = t.clientX - swipeStartXRef.current;

        if (swipeDirectionRef.current === 'open' && dx >= THRESHOLD) {
          chatTogglePlayers();
          setShowPlayers(true);
        } else if (swipeDirectionRef.current === 'close' && dx <= -THRESHOLD) {
          setShowPlayers(false);
        } else if (swipeDirectionRef.current === 'closeInfo' && dx >= THRESHOLD) {
          setShowInfo(false);
        } else if (swipeDirectionRef.current === 'openDialogs' && dx <= -THRESHOLD) {
          setShowPlayers(false);
          setShowInfo(false);
          setShowDialogs(true);
        }
      }
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      swipeActiveRef.current = false;
      swipeDirectionRef.current = null;
    };

    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [chatTogglePlayers, setShowPlayers, setShowInfo]);

  const togglePlayers = () => {
    chatTogglePlayers();
    setShowPlayers(prev => !prev);
  };

  const handleOpenInfo = () => {
    setShowPlayers(false);
    setShowInfo(true);
  };

  const handleOpenDialogs = () => {
    setShowPlayers(false);
    setShowInfo(false);
    setShowDialogs(true);
  };

  const handleCloseDialogs = () => {
    setShowDialogs(false);
  };

  const handleOpenFromDialogs = (userId, nick) => {
    setCameFromDialogs(true);
    setShowDialogs(false);
    openPrivateChat(userId, nick);
  };

  const handleClosePrivate = () => {
    const wasFromDialogs = cameFromDialogs;
    closePrivateChat();
    setCameFromDialogs(false);
    if (wasFromDialogs) {
      setShowDialogs(true);
    }
  };

  const handleOpenProfile = (userId, nick) => {
    setShowPlayers(false);
    setProfileTarget({ userId, nickname: nick });
    sendMessage({ type: 'profile_get', data: { userId } });
  };

  const handleCloseProfile = () => {
    setProfileTarget(null);
  };

  const handleProfileSave = (bio, avatarUrl, font, textColor, textRotation) => {
    sendMessage({
      type: 'profile_update',
      data: { bio, avatarUrl, font, textColor, textRotation },
    });
  };

  const handleProfileRemoveFriend = (friendId) => {
    sendMessage({ type: 'friend_remove', data: { friendId } });
  };

  const handleProfilePrivateChat = (userId, nick) => {
    setProfileTarget(null);
    openPrivateChat(userId, nick);
  };

  const handleProfileDuel = () => {
    if (!profileTarget) return;
    const online = players.find(p => p.userId === profileTarget.userId);
    if (online) {
      duel.requestDuel(online.id);
      setProfileTarget(null);
    } else {
      setDuelNotice('Игрок офлайн');
      setTimeout(() => setDuelNotice(''), 3000);
    }
  };

  const compareVersions = (v1, v2) => {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  };

  const isNewVersionAvailable = serverVersion && compareVersions(serverVersion, VERSION) > 0;

  const sendText = 'ОТПРАВИТЬ';
  const sendChars = sendText.split('');

  const fsGoPrev = (e) => {
    if (e) e.stopPropagation();
    if (!hasPrevImage) return;
    const prev = imageMessages[currentImageIndex - 1];
    setFullscreenImage({ url: prev.imageUrl, messageId: prev.id });
  };
  const fsGoNext = (e) => {
    if (e) e.stopPropagation();
    if (!hasNextImage) return;
    const next = imageMessages[currentImageIndex + 1];
    setFullscreenImage({ url: next.imageUrl, messageId: next.id });
  };

  const handleFsTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    fsGestureRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      direction: null,
      active: true,
      lastDx: 0,
      lastDy: 0,
    };
  };

  const handleFsTouchMove = (e) => {
    const g = fsGestureRef.current;
    if (!g.active) return;
    if (e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - g.startX;
    const dy = t.clientY - g.startY;

    if (!g.direction) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }

    const img = fsImgRef.current;
    if (!img) return;

    if (g.direction === 'horizontal') {
      if ((dx > 0 && hasPrevImage) || (dx < 0 && hasNextImage)) {
        g.lastDx = dx;
        img.style.transition = 'none';
        img.style.transform = `translate3d(${dx}px, 0, 0)`;
        if (e.cancelable) e.preventDefault();
      }
    } else {
      if (dy > 0) {
        g.lastDy = dy;
        const scale = Math.max(0.85, 1 - dy / 800);
        img.style.transition = 'none';
        img.style.transform = `translate3d(0, ${dy}px, 0) scale(${scale})`;
        const ov = fsOverlayRef.current;
        if (ov) {
          const alpha = Math.max(0.15, 0.95 - (dy / 200) * 0.6);
          ov.style.background = `rgba(10, 10, 10, ${alpha})`;
        }
        if (e.cancelable) e.preventDefault();
      }
    }
  };

  const handleFsTouchEnd = (e) => {
    const g = fsGestureRef.current;
    g.active = false;

    const img = fsImgRef.current;
    if (!img) {
      g.direction = null;
      return;
    }

    if (!g.direction) {
      g.direction = null;
      return;
    }

    const t = e.changedTouches[0];
    const dx = t.clientX - g.startX;
    const dy = t.clientY - g.startY;

    if (g.direction === 'horizontal') {
      img.style.transition = 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)';
      if (dx <= -FS_SWIPE_THRESHOLD && hasNextImage) {
        const next = imageMessages[currentImageIndex + 1];
        setFullscreenImage({ url: next.imageUrl, messageId: next.id });
      } else if (dx >= FS_SWIPE_THRESHOLD && hasPrevImage) {
        const prev = imageMessages[currentImageIndex - 1];
        setFullscreenImage({ url: prev.imageUrl, messageId: prev.id });
      } else {
        img.style.transform = 'translate3d(0,0,0)';
      }
    } else {
      if (dy > FS_CLOSE_THRESHOLD) {
        closeFullscreen();
      } else {
        img.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
        img.style.transform = 'translate3d(0,0,0) scale(1)';
        const ov = fsOverlayRef.current;
        if (ov) {
          ov.style.transition = 'background 0.25s';
          ov.style.background = '';
          setTimeout(() => {
            if (ov) ov.style.transition = '';
          }, 300);
        }
      }
    }

    g.direction = null;
  };

  const handleFsDoubleTap = (e) => {
    if (!fullscreenImage) return;
    const stage = e.currentTarget.closest('.fs-stage') || e.currentTarget;
    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const now = Date.now();
    const last = fsLastTapRef.current;
    const pos = fsTapPosRef.current;
    const isDouble =
      now - last < FS_DOUBLE_TAP_MS &&
      Math.abs(x - pos.x) < 40 &&
      Math.abs(y - pos.y) < 40;

    if (isDouble) {
      fsLastTapRef.current = 0;

      const msgId = fullscreenImage.messageId;
      const msg = messages.find(m => m.id === msgId);
      const alreadyHeart = msg?.reactions?.['❤️']?.includes(nickname);
      if (!alreadyHeart) {
        sendReaction(msgId, '❤️');
      }

      setFsHeart({ x, y, key: now });
      setTimeout(() => setFsHeart(null), 800);
    } else {
      fsLastTapRef.current = now;
      fsTapPosRef.current = { x, y };
    }
  };

  const INPUT_DRAG_THRESHOLD = 60;

  const handleInputTouchStart = (e) => {
    const t = e.touches[0];
    inputTouchStartYRef.current = t.clientY;
    inputTouchStartXRef.current = t.clientX;
  };

  const handleInputTouchMove = (e) => {
    if (inputTouchStartYRef.current == null) return;
    const t = e.touches[0];
    const dy = t.clientY - inputTouchStartYRef.current;
    const dx = t.clientX - inputTouchStartXRef.current;

    if (Math.abs(dx) > Math.abs(dy)) return;
    if (dy > 0) setInputDragY(dy);
  };

  const handleInputTouchEnd = () => {
    if (inputDragY > INPUT_DRAG_THRESHOLD) setShowMobileInput(false);
    setInputDragY(0);
    inputTouchStartYRef.current = null;
    inputTouchStartXRef.current = null;
  };

  const LONG_PRESS_MS = 600;
  const VOLUME_PIXELS_PER_PERCENT = 2;

  const handleMascotPointerDown = (e) => {
    const ref = mascotGestureRef.current;
    ref.startY = e.clientY;
    ref.startTime = Date.now();
    ref.volumeBase = yt.volume;
    ref.inVolumeDrag = false;
    ref.longPressFired = false;
    ref.pointerId = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }

    ref.longPressTimer = setTimeout(() => {
      ref.longPressFired = true;
      ref.longPressTimer = null;

      if (!yt.hasStarted) {
        setShowMiniPlayer(true);
        yt.next();
      } else {
        yt.next();
      }
    }, LONG_PRESS_MS);
  };

  const handleMascotPointerMove = (e) => {
    const ref = mascotGestureRef.current;
    if (ref.pointerId !== e.pointerId) return;
    const dy = e.clientY - ref.startY;

    if (Math.abs(dy) > 8) {
      if (!ref.inVolumeDrag) {
        ref.inVolumeDrag = true;
        if (ref.longPressTimer) {
          clearTimeout(ref.longPressTimer);
          ref.longPressTimer = null;
        }
        setVolumeTipVisible(true);
      }
      const delta = -dy / VOLUME_PIXELS_PER_PERCENT;
      yt.setVolume(ref.volumeBase + delta);
    }
  };

  const handleMascotPointerUp = (e) => {
    const ref = mascotGestureRef.current;
    if (ref.pointerId !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    ref.pointerId = null;

    if (ref.longPressTimer) {
      clearTimeout(ref.longPressTimer);
      ref.longPressTimer = null;
    }

    if (ref.inVolumeDrag) {
      ref.inVolumeDrag = false;
      setTimeout(() => setVolumeTipVisible(false), 600);
      return;
    }

    if (ref.longPressFired) {
      ref.longPressFired = false;
      ref.lastTapTime = 0;
      return;
    }

    if (!yt.hasStarted) {
      return;
    }

    yt.toggle();
  };

  const handleMascotContextMenu = (e) => {
    e.preventDefault();
  };

  const handleNotifAllow = async () => {
    try {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          await subscribeToPush();
        }
      }
    } catch { /* noop */ }
    setShowNotifModal(false);
  };

  const handleNotifLater = () => {
    try {
      localStorage.setItem('ghost-chat-notif-snooze', String(Date.now()));
    } catch { /* noop */ }
    setShowNotifModal(false);
  };

  const handleReply = (m) => {
    setReplyTo({
      id: m.id,
      nickname: m.nickname,
      text: m.text || '',
      imageUrl: m.imageUrl || null,
    });
    setShowMobileInput(true);
  };

  const handleMessageAdmin = () => {
    setShowInfo(false);
    if (!adminUserId) {
      setDuelNotice('Админ ещё не назначен');
      setTimeout(() => setDuelNotice(''), 3000);
      return;
    }
    const adminOnline = players.find(p => p.userId === adminUserId);
    const nick = adminOnline?.nickname || adminNickname || 'admin';
    openPrivateChat(adminUserId, nick);
  };

  const handleLogoutClick = () => {
    setLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    setLogoutConfirm(false);
    setShowPlayers(false);
    forceLogout('');
  };

  const CAPSULE_SWIPE_UP = 30;
  const CAPSULE_SWIPE_DOWN = 40;
  const CAPSULE_DIRECTION_LOCK = 8;

  const handleCapsuleTap = () => {
    if (capsuleSwipeRef.current.didSwipe) return;
    if (!capsuleOpen) setCapsuleOpen(true);
  };

  const handlePlayersCapsuleTap = (e) => {
    e.stopPropagation();
    togglePlayers();
    setCapsuleOpen(false);
  };

  const handleWriteCapsuleTap = (e) => {
    e.stopPropagation();
    setShowMobileInput(v => !v);
    setCapsuleOpen(false);
  };

  const handleCapsuleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    capsuleSwipeRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      active: true,
      didSwipe: false,
      direction: null,
    };
  };

  const handleCapsuleTouchMove = (e) => {
    const s = capsuleSwipeRef.current;
    if (!s.active) return;
    if (e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - s.startX;
    const dy = t.clientY - s.startY;

    if (!s.direction) {
      if (
        Math.abs(dx) < CAPSULE_DIRECTION_LOCK &&
        Math.abs(dy) < CAPSULE_DIRECTION_LOCK
      ) {
        return;
      }
      s.direction = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
    }
    if (s.direction === 'horizontal') return;

    if (e.cancelable) e.preventDefault();

    if (dy <= -CAPSULE_SWIPE_UP) {
      s.didSwipe = true;
      s.active = false;

      if (!capsuleOpen) {
        setCapsuleOpen(true);
        setShowMobileInput(true);
      } else if (!showMobileInput) {
        setShowMobileInput(true);
      }
      return;
    }

    if (dy >= CAPSULE_SWIPE_DOWN) {
      s.didSwipe = true;
      s.active = false;

      if (showMobileInput) {
        setShowMobileInput(false);
      } else if (capsuleOpen) {
        setCapsuleOpen(false);
      }
    }
  };

  const handleCapsuleTouchEnd = () => {
    const s = capsuleSwipeRef.current;
    s.active = false;
    if (s.didSwipe) {
      setTimeout(() => {
        if (capsuleSwipeRef.current) {
          capsuleSwipeRef.current.didSwipe = false;
        }
      }, 250);
    }
  };

  return (
    <>
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label="Переключить тему"
      >
        <ThemeIcon />
      </button>

      {isAuth && (
        <button
          className="players-toggle"
          ref={playersBtnRef}
          onClick={togglePlayers}
        >
          👥
          {totalNotifications > 0 && <span className="unread-badge">!</span>}
        </button>
      )}

      {isAuth && (
        <button
          className="dialogs-toggle"
          onClick={handleOpenDialogs}
          title="Диалоги"
        >
          💬
          {Object.values(unreadByUser).filter(Boolean).length > 0 && (
            <span className="unread-badge">!</span>
          )}
        </button>
      )}

      {showPlayers && isAuth && (
        <PlayersPanel
          ref={playersOverlayRef}
          players={players}
          friends={friends}
          friendRequests={friendRequests}
          myId={myId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          unreadByUser={unreadByUser}
          isAdmin={isAdmin}
          onWatchChat={watchChat}
          onBanConfirm={(userId, nickname) => setBanConfirm({ userId, nickname })}
          onRequestDuel={duel.requestDuel}
          onOpenPrivateChat={openPrivateChat}
          onFriendRequest={handleFriendRequest}
          onAcceptRequest={handleAcceptRequest}
          onDeclineRequest={handleDeclineRequest}
          onOpenInfo={handleOpenInfo}
          onLogout={handleLogoutClick}
          onOpenDialogs={handleOpenDialogs}
          onOpenProfile={handleOpenProfile}
        />
      )}

      {showDialogs && isAuth && (
        <DialogsPanel
          dialogs={dialogs}
          players={players}
          myId={myId}
          onOpen={handleOpenFromDialogs}
          onClose={handleCloseDialogs}
        />
      )}

      {showInfo && (
        <InfoPanel
          ref={infoPanelRef}
          onClose={() => setShowInfo(false)}
          onMessageAdmin={handleMessageAdmin}
        />
      )}

      {profileTarget && (
        <ProfilePanel
          data={profileData?.userId === profileTarget.userId ? profileData : null}
          onClose={handleCloseProfile}
          onSave={handleProfileSave}
          onRemoveFriend={handleProfileRemoveFriend}
          onOpenPrivateChat={handleProfilePrivateChat}
          onRequestDuel={handleProfileDuel}
          token={token}
          apiUrl={API_URL}
        />
      )}

      {privateChat && (
        <PrivateChat
          key={privateChat.userId}
          userId={privateChat.userId}
          nickname={privateChat.nickname}
          myId={myId}
          sendMessage={sendMessage}
          initialMessages={privateChat.messages || []}
          typingUser={privateTypingUser}
          onClose={handleClosePrivate}
        />
      )}

      {friendshipRitual && (
        <FriendshipRitual
          open={!!friendshipRitual}
          myId={myId}
          initiatorId={friendshipRitual.initiatorId}
          initiatorNick={friendshipRitual.initiatorNick}
          initiatorAvatar={
            friendshipRitual.initiatorAvatar ||
            avatarCache[friendshipRitual.initiatorId] ||
            null
          }
          targetId={friendshipRitual.targetId}
          targetNick={friendshipRitual.targetNick}
          targetAvatar={
            friendshipRitual.targetAvatar ||
            avatarCache[friendshipRitual.targetId] ||
            null
          }
          phase={friendshipRitual.phase}
          onAccept={() => {
            if (friendshipRitual.requestId) {
              handleAcceptRequest(friendshipRitual.requestId);
            }
          }}
          onDecline={() => {
            if (friendshipRitual.requestId) {
              handleDeclineRequest(friendshipRitual.requestId);
            }
          }}
          onDone={clearRitual}
        />
      )}

      <ConfirmModal
        open={!!banConfirm}
        title={`Забанить ${banConfirm?.nickname || 'пользователя'} навсегда?`}
        description="Пользователь больше не сможет войти в чат."
        confirmText="Да, забанить"
        danger
        onConfirm={() => {
          if (banConfirm) {
            banForever(banConfirm.userId);
            setBanConfirm(null);
          }
        }}
        onCancel={() => setBanConfirm(null)}
      />

      <ConfirmModal
        open={logoutConfirm}
        title="Выйти из аккаунта?"
        description="Вы выйдете из banjoboy's crew. Зайти снова можно в любой момент."
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutConfirm(false)}
      />

      <NotificationPermissionModal
        open={showNotifModal}
        onAllow={handleNotifAllow}
        onLater={handleNotifLater}
      />

      <div className="chat-container">
        <div className={`chat-main ${showMobileInput ? 'mobile-input-open' : ''}`}>
          <div className="chat-header">
            <div className="chat-header-mascot-wrap">
              <img
                src="/mascot.png"
                alt="banjoboy"
                className={
                  `chat-header-logo` +
                  (yt.isPlaying ? ' mascot-playing' : '')
                }
                draggable={false}
                onPointerDown={handleMascotPointerDown}
                onPointerMove={handleMascotPointerMove}
                onPointerUp={handleMascotPointerUp}
                onPointerCancel={handleMascotPointerUp}
                onContextMenu={handleMascotContextMenu}
              />
              {volumeTipVisible && (
                <div className="mascot-volume-tip">🔊 {yt.volume}</div>
              )}
              {yt.isPlaying && (
                <div className="mascot-equalizer">
                  <span /><span /><span /><span />
                </div>
              )}
            </div>

            <div className="chat-header-text">
              {trackTitleVisible && yt.trackTitle ? (
                <div className="chat-header-track-title" title={yt.trackTitle}>
                  ♫ {yt.trackTitle}
                </div>
              ) : (
                <div className="chat-header-title">banjoboy's crew</div>
              )}
              <div className="chat-header-subtitle">
                {isConnected ? 'онлайн' : 'оффлайн'}
              </div>
              <div className="chat-header-version">v{VERSION}</div>
            </div>
            <button
              className="chat-header-theme"
              onClick={toggleTheme}
              title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              aria-label="Переключить тему"
            >
              <ThemeIcon />
            </button>
          </div>

          <div className="qr-wrap">
            <QRCodeSVG value={window.location.href} size={100} />
            <span className="qr-label">QR для входа</span>
          </div>

          <div className="messages-wrapper">
            <MessageList
              messages={messages}
              isAdmin={isAdmin}
              deleteMessage={deleteMessage}
              toggleReactions={toggleReactions}
              activeMessageId={activeMessageId}
              nickname={nickname}
              sendReaction={sendReaction}
              setFullscreenImage={setFullscreenImage}
              messagesEndRef={messagesEndRef}
              myId={myId}
              onEditMessage={handleEditMessage}
              containerRef={messagesContainerRef}
              onReply={handleReply}
              avatarByUser={avatarCache}
              bannedUsers={bannedUsers}
            />

            {notices.length > 0 && (
              <div className="join-notices">
                {notices.map(n => (
                  <div key={n.id} className="join-notice">
                    <div
                      className="join-notice-avatar"
                      style={{ background: getAvatarColor(n.nickname) }}
                    >
                      {getInitial(n.nickname)}
                    </div>
                    <span className="join-notice-text">
                      {n.nickname} {n.type === 'join' ? 'зашёл' : 'вышел'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {showScrollDown && (
              <button className="scroll-down-btn" onClick={scrollToBottom} title="Вниз">
                ↓
              </button>
            )}
          </div>

          <div className="typing-indicator">
            {typingUsers.length > 0 && `${typingUsers.join(', ')} печатает...`}
          </div>

          {replyTo && (
            <div className="reply-preview">
              <div className="reply-preview-body">
                <div className="reply-preview-nick">{replyTo.nickname}</div>
                <div className="reply-preview-text">
                  {replyTo.text || (replyTo.imageUrl ? '📷 фото' : '')}
                </div>
              </div>
              <button
                className="reply-preview-close"
                onClick={() => setReplyTo(null)}
                aria-label="Отменить ответ"
              >
                ×
              </button>
            </div>
          )}

          <div
            className="input-row"
            onTouchStart={handleInputTouchStart}
            onTouchMove={handleInputTouchMove}
            onTouchEnd={handleInputTouchEnd}
            style={{
              transform: `translateY(${inputDragY}px)`,
              transition: inputDragY === 0 ? 'transform 0.2s ease-out' : 'none',
            }}
          >
            <ChatInput
              ref={inputRef}
              value={input}
              onChange={(text) => handleInputChange({ target: { value: text } })}
              onSend={handleSendMessage}
              disabled={!isAuth || isUploading}
              placeholder={isUploading ? 'Загрузка фото...' : 'Сообщение'}
              maxLength={2000}
            />
            <button
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isAuth || isUploading}
              title="Прикрепить фото"
            >
              📎
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              style={{ display: 'none' }}
              capture="environment"
            />
            <button
              className={`send-btn ${sending ? 'sending' : ''}`}
              onClick={handleSendMessage}
              disabled={!isAuth || !input.trim() || isUploading || sending}
            >
              <div className="rotating-text">
                {sendChars.map((char, idx) => {
                  const angle = (360 / sendChars.length) * idx;
                  return (
                    <span
                      key={idx}
                      style={{ transform: `rotate(${angle}deg) translate(0, -28px)` }}
                    >
                      {char}
                    </span>
                  );
                })}
              </div>
              <div className="send-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </div>
              <div className="send-spinner" />
            </button>
          </div>

          <div
            className={`mobile-capsule ${capsuleOpen ? 'mobile-capsule--open' : ''}`}
            onClick={handleCapsuleTap}
            onTouchStart={handleCapsuleTouchStart}
            onTouchMove={handleCapsuleTouchMove}
            onTouchEnd={handleCapsuleTouchEnd}
            onTouchCancel={handleCapsuleTouchEnd}
          >
            {!capsuleOpen && totalNotifications > 0 && (
              <span className="capsule-pulse" />
            )}

            <div className="capsule-content">
              <button
                type="button"
                className="capsule-btn capsule-btn--players"
                ref={mobilePlayersBtnRef}
                onClick={handlePlayersCapsuleTap}
                aria-label="Игроки"
              >
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {totalNotifications > 0 && (
                  <span className="capsule-badge">!</span>
                )}
              </button>

              <button
                type="button"
                className="capsule-btn capsule-btn--write"
                onClick={handleWriteCapsuleTap}
                aria-label="Написать"
              >
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="status">
            {bannedUntil && ` — бан до ${new Date(bannedUntil).toLocaleTimeString()}`}
            {errorMessage && <div style={{ color: 'var(--danger)', marginTop: 4 }}>{errorMessage}</div>}
            {isUploading && <div style={{ color: 'var(--btn-bg)', marginTop: 4 }}>Загрузка фото...</div>}
          </div>

          <DuelBox
            duelInvite={duel.duelInvite}
            duelState={duel.duelState}
            duelNotice={duelNotice}
            onAcceptDuel={duel.acceptDuel}
            onDeclineDuel={duel.clearInvite}
            onChoose={duel.choose}
            onCloseDuelNotice={() => setDuelNotice('')}
          />
        </div>
      </div>

      {!isAuth && (
        <AuthModal
          isRegisterMode={isRegisterMode}
          setIsRegisterMode={setIsRegisterMode}
          authNickname={authNickname}
          setAuthNickname={setAuthNickname}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          authError={authError}
          showIdleNotice={showIdleNotice}
          handleAuthSubmit={handleAuthSubmit}
        />
      )}

      <InstallPwaBanner />
      {isNewVersionAvailable && <LatestVersionLink />}

      {fullscreenImage && (
        <div
          className="fullscreen-overlay"
          ref={fsOverlayRef}
          onClick={closeFullscreen}
        >
          <div className="fs-topbar" onClick={(e) => e.stopPropagation()}>
            <div className="fs-author">
              <div
                className="fs-author-avatar"
                style={
                  fsAuthorAvatarUrl
                    ? { backgroundImage: `url(${fsAuthorAvatarUrl})` }
                    : { background: getAvatarColor(fullscreenMessage?.nickname || '?') }
                }
              >
                {!fsAuthorAvatarUrl && getInitial(fullscreenMessage?.nickname || '?')}
              </div>
              <div className="fs-author-meta">
                <div className="fs-author-nick">
                  {fullscreenMessage?.nickname || '—'}
                </div>
                <div className="fs-author-date">
                  {fullscreenMessage ? formatMessageDate(fullscreenMessage.time) : ''}
                </div>
              </div>
            </div>

            {currentImageIndex >= 0 && imageMessages.length > 0 && (
              <div className="fs-counter">
                {currentImageIndex + 1} / {imageMessages.length}
              </div>
            )}

            <button
              className="fs-close"
              onClick={closeFullscreen}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          <div className="fs-stage" onClick={closeFullscreen}>
            <button
              type="button"
              className="fs-nav fs-nav--prev"
              onClick={fsGoPrev}
              disabled={!hasPrevImage}
              aria-label="Предыдущее фото"
            >
              ‹
            </button>

            <img
              key={fullscreenImage.messageId}
              ref={fsImgRef}
              src={fullscreenImage.url}
              alt=""
              className="fs-image"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleFsTouchStart}
              onTouchMove={handleFsTouchMove}
              onTouchEnd={handleFsTouchEnd}
              onTouchCancel={handleFsTouchEnd}
              onDoubleClick={handleFsDoubleTap}
            />

            <button
              type="button"
              className="fs-nav fs-nav--next"
              onClick={fsGoNext}
              disabled={!hasNextImage}
              aria-label="Следующее фото"
            >
              ›
            </button>

            {fsHeart && (
              <span
                key={fsHeart.key}
                className="fs-heart-burst"
                style={{ left: fsHeart.x, top: fsHeart.y }}
              >
                ❤️
              </span>
            )}

            {imageMessages.length > 1 && imageMessages.length <= 12 && (
              <div className="fs-dots" aria-hidden="true">
                {imageMessages.map((im, idx) => (
                  <span
                    key={im.id}
                    className={`fs-dot ${idx === currentImageIndex ? 'fs-dot--active' : ''}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="fs-bottombar" onClick={(e) => e.stopPropagation()}>
            {fullscreenReactionEntries.length > 0 && (
              <div className="fs-reactions-strip">
                {fullscreenReactionEntries.map(([emoji, users]) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`fs-reaction-badge ${users.includes(nickname) ? 'own' : ''}`}
                    onClick={() =>
                      setFsReactionListEmoji(prev => (prev === emoji ? null : emoji))
                    }
                  >
                    <span className="fs-reaction-badge-emoji">{emoji}</span>
                    <span className="fs-reaction-badge-count">{users.length}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className={`fs-reaction-toggle ${showFullscreenReactions ? 'active' : ''}`}
              onClick={() => setShowFullscreenReactions(v => !v)}
              aria-label="Реакции"
            >
              😀
            </button>
          </div>

          {showFullscreenReactions && (
            <div
              className="fs-reaction-picker"
              onClick={(e) => e.stopPropagation()}
            >
              {['👍', '👎', '❤️', '🔥', '😢'].map(emoji => {
                const isActive = fullscreenMessage?.reactions?.[emoji]?.includes(nickname);
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`fs-reaction-picker-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      sendReaction(fullscreenImage.messageId, emoji);
                      setShowFullscreenReactions(false);
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          )}

          {fsReactionListEmoji &&
            fullscreenMessage?.reactions?.[fsReactionListEmoji] && (
              <div
                className="fs-reaction-list"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="fs-reaction-list-header">
                  <span className="fs-reaction-list-emoji">{fsReactionListEmoji}</span>
                  <span className="fs-reaction-list-count">
                    {fullscreenMessage.reactions[fsReactionListEmoji].length}
                  </span>
                </div>
                <div className="fs-reaction-list-users">
                  {fullscreenMessage.reactions[fsReactionListEmoji].map((user, i) => (
                    <span key={i} className="fs-reaction-user">
                      {user}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="fs-reaction-list-close"
                  onClick={() => setFsReactionListEmoji(null)}
                >
                  Закрыть
                </button>
              </div>
            )}
        </div>
      )}

      <div className={`yt-hidden-host ${showMiniPlayer ? 'yt-hidden-host--visible' : ''}`}>
        <div id={yt.containerId} />
      </div>
    </>
  );
};

export default Chat;