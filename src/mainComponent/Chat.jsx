import { useEffect, useRef, useState, useCallback } from 'react';
import ConfirmBanModal from './ConfirmBanModal';
import LatestVersionLink from './LatestVersionLink';
import PrivateChat from './components/PrivateChat';
import PlayersPanel from './components/PlayersPanel';
import AuthModal from './components/AuthModal';
import MessageList from './components/MessageList';
import DuelBox from './components/DuelBox';
import { QRCodeSVG } from 'qrcode.react';
import { useWebSocket } from './useWebSocket';
import {
  getAvatarColor,
  getInitial,
  formatTime,
  ensureAudioContext,
  playNotificationSound,
  playSendSound,
} from './utils';
import './Chat.css';

const VERSION = '2.12.12';
const API_URL = 'https://api.banjoboy420.ru';
const WS_URL = 'wss://api.banjoboy420.ru';

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

const Chat = () => {
  const storedToken = localStorage.getItem('ghost-chat-token') || '';
  const storedNickname = localStorage.getItem('ghost-chat-nickname') || '';
  const storedTheme = localStorage.getItem('ghost-chat-theme') || 'light';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [nickname, setNickname] = useState(storedNickname);
  const [token, setToken] = useState(storedToken);
  const [isAuth, setIsAuth] = useState(!!storedToken);
  const [players, setPlayers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [myId, setMyId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [duelInvite, setDuelInvite] = useState(null);
  const [duelState, setDuelState] = useState(null);
  const [bannedUntil, setBannedUntil] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [isDark, setIsDark] = useState(storedTheme === 'dark');
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [showPlayers, setShowPlayers] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(true);
  const [authNickname, setAuthNickname] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [privateChat, setPrivateChat] = useState(null);
  const [privateTypingUser, setPrivateTypingUser] = useState(null);
  const [duelNotice, setDuelNotice] = useState('');
  const [showIdleNotice, setShowIdleNotice] = useState(false);
  const [unreadByUser, setUnreadByUser] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [serverVersion, setServerVersion] = useState('');
  const [banConfirm, setBanConfirm] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showFullscreenReactions, setShowFullscreenReactions] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [notices, setNotices] = useState([]);

  const wsRef = useRef(null);
  const nicknameRef = useRef(storedNickname);
  const tokenRef = useRef(storedToken);
  const unmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const playersOverlayRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevPlayerNicksRef = useRef(new Set());
  const firstPlayersLoadRef = useRef(true);

  const unreadCount = Object.values(unreadByUser).filter(Boolean).length;
  const friendRequestsCount = friendRequests.length;
  const totalNotifications = unreadCount + friendRequestsCount;

  const { isConnected: wsConnected, error: wsError, sendMessage, close, ws } = useWebSocket(
    WS_URL,
    tokenRef.current,
    (msg) => handleWebSocketMessage(msg)
  );

  const handleWebSocketMessage = useCallback((msg) => {
    console.log('📩 Входящее сообщение:', msg.type, msg.data);
    switch (msg.type) {
      case 'friends_list':
        setFriends(msg.data);
        break;
      case 'unread_private_list': {
        const onlineUserIds = new Set(players.map(p => p.userId));
        const newUnread = {};
        msg.data.forEach(senderId => {
          if (onlineUserIds.has(senderId)) {
            newUnread[senderId] = true;
          }
        });
        setUnreadByUser(prev => {
          const updated = { ...prev, ...newUnread };
          const filtered = {};
          for (const [userId, val] of Object.entries(updated)) {
            if (onlineUserIds.has(userId)) {
              filtered[userId] = val;
            }
          }
          return filtered;
        });
        break;
      }
      case 'version':
        console.log(`[CHAT v${VERSION}] Server version: ${msg.data}`);
        break;
      case 'auth_ok':
        setMyId(msg.data.userId);
        setNickname(msg.data.nickname);
        setIsAuth(true);
        setIsAdmin(msg.data.role === 'admin');
        setServerVersion(msg.data.serverVersion || '');
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'get_friends' }));
        }
        break;
      case 'history':
        setMessages(msg.data);
        break;
      case 'message':
        setMessages(prev => [...prev, msg.data]);
        playNotificationSound();
        break;
      case 'message_update':
        if (msg.data.id) {
          setMessages(prev => prev.map(m => m.id === msg.data.id ? msg.data : m));
        }
        break;
      case 'message_deleted':
        setMessages(prev => prev.filter(m => m.id !== msg.data.messageId));
        break;
      case 'players':
        setPlayers(msg.data);
        break;
      case 'typing': {
        const { nickname: typingNick, isTyping } = msg.data;
        setTypingUsers(prev => {
          if (isTyping && !prev.includes(typingNick)) return [...prev, typingNick];
          if (!isTyping) return prev.filter(n => n !== typingNick);
          return prev;
        });
        break;
      }
      case 'duel_invite':
        setDuelInvite(msg.data);
        break;
      case 'duel_request_sent':
        setDuelNotice(`Вызов ${msg.data.targetNick} отправлен`);
        setTimeout(() => setDuelNotice(''), 3000);
        break;
      case 'duel_timeout':
        setDuelNotice(`${msg.data.targetNick} не ответил на вызов`);
        setTimeout(() => setDuelNotice(''), 3000);
        break;
      case 'duel_start':
        setDuelState({ opponentNick: msg.data.opponentNick, myChoice: null });
        setDuelInvite(null);
        break;
      case 'duel_result':
        setDuelState(prev => prev ? { ...prev, result: msg.data.result } : null);
        setTimeout(() => setDuelState(null), 5000);
        break;
      case 'banned':
        setBannedUntil(msg.data.until);
        break;
      case 'banned_forever':
        setAuthError('У нас тут таких не любят');
        setIsAuth(false);
        localStorage.removeItem('ghost-chat-token');
        localStorage.removeItem('ghost-chat-nickname');
        setToken('');
        setNickname('');
        break;
      case 'idle_disconnect':
        setAuthError('Вы были отключены за неактивность. Войдите снова.');
        setIsAuth(false);
        localStorage.removeItem('ghost-chat-token');
        localStorage.removeItem('ghost-chat-nickname');
        setToken('');
        setNickname('');
        break;
      case 'admin_error':
        setDuelNotice(msg.data.message);
        setTimeout(() => setDuelNotice(''), 3000);
        break;
      case 'friend_request_sent':
        setDuelNotice(`Запрос дружбы отправлен пользователю ${msg.data.receiverNickname}`);
        setTimeout(() => setDuelNotice(''), 3000);
        break;
      case 'new_friend_request':
        setFriendRequests(prev => [...prev, msg.data]);
        break;
      case 'friend_request_accepted_notification':
        setDuelNotice(`🎉 ${msg.data.user1Nickname} и ${msg.data.user2Nickname} теперь друзья!`);
        setTimeout(() => setDuelNotice(''), 4000);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'get_friends' }));
        }
        break;
      case 'friend_request_accepted':
      case 'friend_request_declined':
        setFriendRequests(prev => prev.filter(r => r.senderId !== msg.data.userId));
        break;
      case 'friend_requests_list':
        setFriendRequests(msg.data);
        break;
      case 'private_message': {
        setPrivateChat(prev => {
          if (!prev || prev.userId !== msg.data.senderId) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), {
              ...msg.data,
              is_read: false
            }],
          };
        });
        if (!privateChat || privateChat.userId !== msg.data.senderId) {
          setUnreadByUser(prev => ({ ...prev, [msg.data.senderId]: true }));
        } else {
          if (sendMessage) {
            sendMessage({ type: 'mark_read', data: { senderId: msg.data.senderId } });
          }
          setPrivateChat(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map(m =>
                m.senderId === msg.data.senderId ? { ...m, is_read: true } : m
              )
            };
          });
        }
        break;
      }
      case 'private_message_sent': {
        setPrivateChat(prev => {
          if (!prev || prev.userId !== msg.data.recipientId) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), {
              ...msg.data,
              is_read: false
            }],
          };
        });
        break;
      }
      case 'private_typing':
        if (msg.data.senderId !== myId) {
          setPrivateTypingUser(msg.data.isTyping ? msg.data.senderNickname : null);
        }
        break;
      case 'private_history':
        setPrivateChat(prev => {
          if (!prev || prev.userId !== msg.data.userId) return prev;
          return { ...prev, messages: msg.data.messages };
        });
        setUnreadByUser(prev => {
          const { [msg.data.userId]: _, ...rest } = prev;
          return rest;
        });
        break;
      case 'message_read': {
        const { senderId, recipientId, messageIds } = msg.data;
        setPrivateChat(prev => {
          if (!prev) return prev;
          if (prev.userId === senderId || prev.userId === recipientId) {
            return {
              ...prev,
              messages: prev.messages.map(m =>
                messageIds.includes(m.id) ? { ...m, is_read: true } : m
              )
            };
          }
          return prev;
        });
        break;
      }
      default:
        console.warn(`[CHAT v${VERSION}] Unknown message type:`, msg.type);
    }
  }, [myId, privateChat, sendMessage]);

  useEffect(() => {
    wsRef.current = ws;
    setIsConnected(wsConnected);
  }, [ws, wsConnected]);

  useEffect(() => {
    if (wsError) {
      setErrorMessage('WebSocket error: ' + wsError);
      const timer = setTimeout(() => setErrorMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [wsError]);

  useEffect(() => {
    if (messages.length === 0) return;

    if (!hasAutoScrolledRef.current) {
      setTimeout(() => {
        animateScrollToBottom(messagesContainerRef.current, 1400);
        hasAutoScrolledRef.current = true;
      }, 60);
      return;
    }

    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(distanceFromBottom > 200);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => el.removeEventListener('scroll', handleScroll);
  }, [isAuth]);

  // ===== Уведомления "ник зашёл/вышел" =====
  useEffect(() => {
    const currentNicks = new Set(players.map(p => p.nickname));

    // Первый раз — запоминаем список без показа уведомлений
    if (firstPlayersLoadRef.current) {
      prevPlayerNicksRef.current = currentNicks;
      firstPlayersLoadRef.current = false;
      return;
    }

    const prev = prevPlayerNicksRef.current;
    const joined = [...currentNicks].filter(n => !prev.has(n));
    const left = [...prev].filter(n => !currentNicks.has(n));

    prevPlayerNicksRef.current = currentNicks;

    // Отфильтровываем себя — не показываем свой же заход/выход
    const myNick = nicknameRef.current;
    const filteredJoined = joined.filter(n => n !== myNick);
    const filteredLeft = left.filter(n => n !== myNick);

    if (filteredJoined.length === 0 && filteredLeft.length === 0) return;

    const stamp = Date.now();
    const added = [];
    filteredJoined.forEach((nick, i) => {
      added.push({ id: `j-${stamp}-${i}`, nickname: nick, type: 'join' });
    });
    filteredLeft.forEach((nick, i) => {
      added.push({ id: `l-${stamp}-${i}`, nickname: nick, type: 'leave' });
    });

    setNotices(p => [...p, ...added].slice(-3));

    added.forEach(n => {
      setTimeout(() => {
        setNotices(p => p.filter(x => x.id !== n.id));
      }, 4000);
    });
  }, [players]);

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('ghost-chat-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (!isAuth) {
      setShowIdleNotice(true);
      const timer = setTimeout(() => setShowIdleNotice(false), 10000);
      return () => clearTimeout(timer);
    } else {
      setShowIdleNotice(false);
    }
  }, [isAuth]);

  useEffect(() => {
    const handleClickOutside = (e) => {
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
  }, [showPlayers]);

  useEffect(() => {
    const onlineUserIds = new Set(players.map(p => p.userId));
    setUnreadByUser(prev => {
      const newUnread = {};
      for (const [userId, hasUnread] of Object.entries(prev)) {
        if (onlineUserIds.has(userId)) {
          newUnread[userId] = hasUnread;
        }
      }
      return newUnread;
    });
  }, [players]);

  const handleAuthSubmit = async () => {
    if (!authNickname.trim() || !authPassword.trim()) {
      setAuthError('Заполни оба поля');
      return;
    }
    setAuthError('');
    const endpoint = isRegisterMode ? '/api/register' : '/api/login';
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: authNickname.trim(), password: authPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error || 'Ошибка');
        return;
      }
      try {
        localStorage.setItem('ghost-chat-token', data.token);
        localStorage.setItem('ghost-chat-nickname', data.nickname);
      } catch (e) {
        console.error('localStorage error:', e);
      }
      tokenRef.current = data.token;
      nicknameRef.current = data.nickname;
      setToken(data.token);
      setNickname(data.nickname);
      setIsAuth(true);
      setAuthNickname('');
      setAuthPassword('');
    } catch (error) {
      console.error('Auth error:', error);
      setAuthError('Сеть недоступна, попробуй позже');
    }
  };

  const handleSendMessage = () => {
    if (sending || !sendMessage || !input.trim() || !isAuth) return;
    setSending(true);
    sendMessage({
      type: 'message',
      data: { text: input.trim() }
    });
    playSendSound();
    setInput('');
    sendMessage({ type: 'typing', data: { isTyping: false } });
    setTimeout(() => setSending(false), 800);
  };

  const handleEditMessage = (messageId, newText) => {
    if (sendMessage) {
      sendMessage({ type: 'edit_message', data: { messageId, text: newText } });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isAuth || !sendMessage) {
      setErrorMessage('Не авторизован или нет соединения');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      sendMessage({
        type: 'message',
        data: {
          text: '',
          imageUrl: data.imageUrl
        }
      });
      playSendSound();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Ошибка загрузки фото:', err);
      setErrorMessage('Не удалось загрузить фото: ' + (err?.message || ''));
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (sendMessage && isAuth) {
      if (e.target.value.trim()) {
        sendMessage({ type: 'typing', data: { isTyping: true } });
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          if (sendMessage) {
            sendMessage({ type: 'typing', data: { isTyping: false } });
          }
        }, 1500);
      } else {
        sendMessage({ type: 'typing', data: { isTyping: false } });
      }
    }
  };

  const sendReaction = (messageId, emoji) => {
    if (sendMessage && isAuth) {
      sendMessage({ type: 'reaction', data: { messageId, emoji } });
    }
  };

  const requestDuel = (targetId) => {
    if (sendMessage && isAuth) {
      sendMessage({ type: 'duel_request', data: { targetId } });
    }
  };

  const acceptDuel = () => {
    if (duelInvite && sendMessage && isAuth) {
      sendMessage({ type: 'duel_accept', data: { fromId: duelInvite.fromId } });
    }
  };

  const choose = (choice) => {
    if (duelState && sendMessage && isAuth) {
      sendMessage({ type: 'duel_choice', data: { choice } });
      setDuelState(prev => ({ ...prev, myChoice: choice }));
    }
  };

  const toggleReactions = (messageId) => {
    setActiveMessageId(prev => prev === messageId ? null : messageId);
  };

  const openPrivateChat = (userId, nickname) => {
    if (userId === myId) return;
    setPrivateChat({ userId, nickname, messages: [] });
    setUnreadByUser(prev => {
      const { [userId]: _, ...rest } = prev;
      return rest;
    });
    if (sendMessage) {
      sendMessage({ type: 'private_history', data: { userId } });
      sendMessage({ type: 'mark_read', data: { senderId: userId } });
    }
  };

  const closePrivateChat = () => {
    setPrivateChat(null);
    setPrivateTypingUser(null);
  };

  const banForever = (userId) => {
    if (sendMessage && isAdmin) {
      sendMessage({ type: 'ban_forever', data: { userId } });
    }
  };

  const deleteMessage = (messageId) => {
    if (sendMessage) {
      sendMessage({ type: 'delete_message', data: { messageId } });
    }
  };

  const watchChat = (userId) => {
    if (sendMessage && isAdmin) {
      sendMessage({ type: 'watch_chat', data: { userId } });
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

  const handleFriendRequest = (receiverId) => {
    if (sendMessage) {
      sendMessage({ type: 'friend_request', data: { receiverId } });
    }
  };

  const handleAcceptRequest = (requestId) => {
    if (sendMessage) {
      sendMessage({ type: 'friend_request_accept', data: { requestId } });
    }
    setFriendRequests(prev => prev.filter(r => r.requestId !== requestId));
  };

  const handleDeclineRequest = (requestId) => {
    if (sendMessage) {
      sendMessage({ type: 'friend_request_decline', data: { requestId } });
    }
    setFriendRequests(prev => prev.filter(r => r.requestId !== requestId));
  };

  const togglePlayers = () => {
    if (sendMessage) {
      sendMessage({ type: 'get_friends' });
    }
    setShowPlayers(prev => !prev);
  };

  const closeFullscreen = () => {
    setFullscreenImage(null);
    setShowFullscreenReactions(false);
  };

  const scrollToBottom = () => {
    animateScrollToBottom(messagesContainerRef.current, 800);
  };

  const sendText = 'ОТПРАВИТЬ';
  const sendChars = sendText.split('');

  const fullscreenMessage = fullscreenImage
    ? messages.find(m => m.id === fullscreenImage.messageId)
    : null;
  const fullscreenReactions = fullscreenMessage?.reactions || {};
  const fullscreenReactionEntries = Object.entries(fullscreenReactions);

  return (
    <>
      <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
        {isDark ? '☀️' : '🌙'}
      </button>

      {isAuth && (
        <button className="players-toggle" onClick={togglePlayers}>
          👥
          {totalNotifications > 0 && <span className="unread-badge">!</span>}
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
          onRequestDuel={requestDuel}
          onOpenPrivateChat={openPrivateChat}
          onFriendRequest={handleFriendRequest}
          onAcceptRequest={handleAcceptRequest}
          onDeclineRequest={handleDeclineRequest}
        />
      )}

      {privateChat && (
        <PrivateChat
          key={privateChat.userId}
          userId={privateChat.userId}
          nickname={privateChat.nickname}
          myId={myId}
          ws={wsRef.current}
          initialMessages={privateChat.messages || []}
          typingUser={privateTypingUser}
          onClose={closePrivateChat}
        />
      )}

      <ConfirmBanModal
        open={!!banConfirm}
        nickname={banConfirm?.nickname}
        onConfirm={() => {
          if (banConfirm) {
            banForever(banConfirm.userId);
            setBanConfirm(null);
          }
        }}
        onCancel={() => setBanConfirm(null)}
      />

      <div className="chat-container">
        <div className="chat-main">
          <div className="chat-header">
            <img src="/mascot.png" alt="banjoboy" className="chat-header-logo" />
            <div className="chat-header-text">
              <div className="chat-header-title">banjoboy's crew</div>
              <div className="chat-header-subtitle">
                {isConnected ? 'онлайн' : 'оффлайн'}
              </div>
            </div>
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
            />

            {/* ===== Уведомления "зашёл/вышел" ===== */}
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

          <div className="input-row">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={!isAuth || isUploading}
              placeholder={isUploading ? 'Загрузка фото...' : 'Сообщение'}
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
                    <span key={idx} style={{ transform: `rotate(${angle}deg) translate(0, -28px)` }}>
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

          <div className="status">
            {bannedUntil && ` — бан до ${new Date(bannedUntil).toLocaleTimeString()}`}
            {errorMessage && <div style={{ color: 'var(--danger)', marginTop: 4 }}>{errorMessage}</div>}
            {isUploading && <div style={{ color: 'var(--btn-bg)', marginTop: 4 }}>Загрузка фото...</div>}
          </div>

          <DuelBox
            duelInvite={duelInvite}
            duelState={duelState}
            duelNotice={duelNotice}
            onAcceptDuel={acceptDuel}
            onDeclineDuel={() => setDuelInvite(null)}
            onChoose={choose}
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

      {isNewVersionAvailable && <LatestVersionLink />}
      <div className="version">v{VERSION}</div>

      {fullscreenImage && (
        <div className="fullscreen-overlay" onClick={closeFullscreen}>
          <div className="fullscreen-reactions">
            <button
              className="fullscreen-reactions-toggle"
              onClick={(e) => { e.stopPropagation(); setShowFullscreenReactions(v => !v); }}
              title="Реакции"
            >
              😀
            </button>
            {showFullscreenReactions && (
              <div className="fullscreen-reactions-picker" onClick={(e) => e.stopPropagation()}>
                {['👍', '🔥', '😂'].map(emoji => {
                  const isActive = fullscreenMessage?.reactions?.[emoji]?.includes(nickname);
                  return (
                    <button
                      key={emoji}
                      className={`fullscreen-reaction-btn ${isActive ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
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
          </div>

          {fullscreenReactionEntries.length > 0 && (
            <div className="fullscreen-existing-reactions" onClick={(e) => e.stopPropagation()}>
              {fullscreenReactionEntries.map(([emoji, users]) => (
                <span
                  key={emoji}
                  className={`fullscreen-reaction-badge ${users.includes(nickname) ? 'own' : ''}`}
                >
                  {emoji} {users.length}
                </span>
              ))}
            </div>
          )}

          <img
            src={fullscreenImage.url}
            alt="fullscreen"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default Chat;