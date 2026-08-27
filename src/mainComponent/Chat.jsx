import { useEffect, useRef, useState } from 'react';
import ConfirmBanModal from './ConfirmBanModal';
import LatestVersionLink from './LatestVersionLink';
import PrivateChat from './components/PrivateChat';
import { QRCodeSVG } from 'qrcode.react';

const VERSION = '2.7.3';

const getAvatarColor = (nickname) => {
  if (!nickname) return 'linear-gradient(135deg, #b0c4de, #8a9bb5)';
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${hue2}, 70%, 40%))`;
};

const getInitial = (nickname) => nickname ? nickname.charAt(0).toUpperCase() : '?';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const ensureAudioContext = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!window.__chatAudioCtx) {
    const ctx = new AudioContext();
    window.__chatAudioCtx = ctx;
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  }
  if (window.__chatAudioCtx.state === 'suspended') {
    window.__chatAudioCtx.resume();
  }
};

const playNotificationSound = () => {
  const ctx = window.__chatAudioCtx;
  if (!ctx) return;
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 523.25;
  osc1.connect(gain);
  osc1.start(now);
  osc1.stop(now + 0.2);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 659.25;
  osc2.connect(gain);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.3);
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
  const [friendRequests, setFriendRequests] = useState([]);

  const wsRef = useRef(null);
  const nicknameRef = useRef(storedNickname);
  const tokenRef = useRef(storedToken);
  const unmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const playersOverlayRef = useRef(null);
  const fileInputRef = useRef(null);

  const unreadCount = Object.values(unreadByUser).filter(Boolean).length;
  const friendRequestsCount = friendRequests.length;
  const totalNotifications = unreadCount + friendRequestsCount;

  const connect = () => {
    if (unmountedRef.current) return;

    const ws = new WebSocket('wss://ghost-chat-backend-production-5faf.up.railway.app');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setErrorMessage('');
      console.log(`[CHAT v${VERSION}] Connected`);
      if (tokenRef.current) {
        ws.send(JSON.stringify({ type: 'auth', token: tokenRef.current }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
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
            console.log('📸 Новое сообщение с imageUrl:', msg.data.imageUrl);
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
          case 'friends_list':
            setFriends(msg.data);
            break;
          case 'typing':
            const { nickname: typingNick, isTyping } = msg.data;
            setTypingUsers(prev => {
              if (isTyping && !prev.includes(typingNick)) return [...prev, typingNick];
              if (!isTyping) return prev.filter(n => n !== typingNick);
              return prev;
            });
            break;
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
          case 'private_message':
            setPrivateChat(prev => {
              if (!prev || prev.userId !== msg.data.senderId) return prev;
              return {
                ...prev,
                messages: [...(prev.messages || []), {
                  senderId: msg.data.senderId,
                  text: msg.data.text,
                  created_at: msg.data.created_at,
                }],
              };
            });
            if (!privateChat || privateChat.userId !== msg.data.senderId) {
              setUnreadByUser(prev => ({ ...prev, [msg.data.senderId]: true }));
            }
            break;
          case 'private_message_sent':
            setPrivateChat(prev => {
              if (!prev || prev.userId !== msg.data.recipientId) return prev;
              return {
                ...prev,
                messages: [...(prev.messages || []), {
                  senderId: msg.data.senderId,
                  text: msg.data.text,
                  created_at: msg.data.created_at,
                }],
              };
            });
            break;
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
          default:
            console.warn(`[CHAT v${VERSION}] Unknown message type:`, msg.type);
        }
      } catch (err) {
        console.error(`[CHAT v${VERSION}] Message parse error:`, err);
        setErrorMessage(`v${VERSION}: Ошибка обработки сообщения`);
      }
    };

    ws.onerror = (e) => {
      console.error(`[CHAT v${VERSION}] WebSocket error`, e);
      setErrorMessage(`v${VERSION}: WebSocket error`);
      setIsConnected(false);
    };

    ws.onclose = (e) => {
      console.warn(`[CHAT v${VERSION}] Closed (code ${e.code}, reason ${e.reason})`);
      setErrorMessage(`v${VERSION}: Closed (code ${e.code})`);
      setIsConnected(false);
      if (e.code === 4003) {
        localStorage.removeItem('ghost-chat-token');
        localStorage.removeItem('ghost-chat-nickname');
        setToken('');
        setIsAuth(false);
        setNickname('');
      } else if (e.code === 4002) {
        localStorage.removeItem('ghost-chat-token');
        localStorage.removeItem('ghost-chat-nickname');
        setToken('');
        setIsAuth(false);
        setNickname('');
        setAuthError('Аккаунт уже используется на другом устройстве');
      } else if (e.code === 4005) {
        setAuthError('Вы были отключены за неактивность. Войдите снова.');
        setIsAuth(false);
        localStorage.removeItem('ghost-chat-token');
        localStorage.removeItem('ghost-chat-nickname');
        setToken('');
        setNickname('');
      } else if (e.code === 4006) {
        setAuthError('У нас тут таких не любят');
        setIsAuth(false);
        localStorage.removeItem('ghost-chat-token');
        localStorage.removeItem('ghost-chat-nickname');
        setToken('');
        setNickname('');
      } else if (!unmountedRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };
  };

  useEffect(() => {
    unmountedRef.current = false;
    if (tokenRef.current) {
      connect();
    } else {
      setIsAuth(false);
    }

    const unlockAudio = () => ensureAudioContext();
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });

    const handleVisibility = () => {
      if (!document.hidden && tokenRef.current && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  const handleAuthSubmit = async () => {
    if (!authNickname.trim() || !authPassword.trim()) {
      setAuthError('Заполни оба поля');
      return;
    }
    setAuthError('');
    const endpoint = isRegisterMode ? '/api/register' : '/api/login';
    try {
      const response = await fetch(`https://ghost-chat-backend-production-5faf.up.railway.app${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: authNickname.trim(), password: authPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error || 'Ошибка');
        return;
      }
      localStorage.setItem('ghost-chat-token', data.token);
      localStorage.setItem('ghost-chat-nickname', data.nickname);
      tokenRef.current = data.token;
      nicknameRef.current = data.nickname;
      setToken(data.token);
      setNickname(data.nickname);
      setIsAuth(true);
      setAuthNickname('');
      setAuthPassword('');
      connect();
    } catch (error) {
      console.error('Auth error:', error);
      setAuthError('Сеть недоступна, попробуй позже');
    }
  };

  const handleSendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !input.trim() || !isAuth) return;

    wsRef.current.send(JSON.stringify({
      type: 'message',
      data: { text: input.trim() }
    }));
    setInput('');
    wsRef.current.send(JSON.stringify({ type: 'typing', data: { isTyping: false } }));

    setSending(true);
    setTimeout(() => setSending(false), 800);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isAuth || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setErrorMessage('Не авторизован или нет соединения');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('https://ghost-chat-backend-production-5faf.up.railway.app/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      wsRef.current.send(JSON.stringify({
        type: 'message',
        data: {
          text: '',
          imageUrl: data.imageUrl
        }
      }));

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Ошибка загрузки фото:', err);
      setErrorMessage('Не удалось загрузить фото');
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuth) {
      if (e.target.value.trim()) {
        wsRef.current.send(JSON.stringify({ type: 'typing', data: { isTyping: true } }));
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'typing', data: { isTyping: false } }));
          }
        }, 1500);
      } else {
        wsRef.current.send(JSON.stringify({ type: 'typing', data: { isTyping: false } }));
      }
    }
  };

  const sendReaction = (messageId, emoji) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuth) {
      wsRef.current.send(JSON.stringify({ type: 'reaction', data: { messageId, emoji } }));
    }
  };

  const requestDuel = (targetId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuth) {
      wsRef.current.send(JSON.stringify({ type: 'duel_request', data: { targetId } }));
    }
  };

  const acceptDuel = () => {
    if (duelInvite && wsRef.current?.readyState === WebSocket.OPEN && isAuth) {
      wsRef.current.send(JSON.stringify({ type: 'duel_accept', data: { fromId: duelInvite.fromId } }));
    }
  };

  const choose = (choice) => {
    if (duelState && wsRef.current?.readyState === WebSocket.OPEN && isAuth) {
      wsRef.current.send(JSON.stringify({ type: 'duel_choice', data: { choice } }));
      setDuelState(prev => ({ ...prev, myChoice: choice }));
    }
  };

  const toggleReactions = (messageId) => {
    setActiveMessageId(prev => prev === messageId ? null : messageId);
  };

  const hasReactions = (message) => {
    return message?.reactions && Object.keys(message.reactions).length > 0;
  };

  const openPrivateChat = (userId, nickname) => {
    if (userId === myId) return;
    setPrivateChat({ userId, nickname, messages: [] });
    setUnreadByUser(prev => {
      const { [userId]: _, ...rest } = prev;
      return rest;
    });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'private_history', data: { userId } }));
    }
  };

  const closePrivateChat = () => {
    setPrivateChat(null);
    setPrivateTypingUser(null);
  };

  const filteredPlayers = players.filter(p =>
    p.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sendText = 'ОТПРАВИТЬ';
  const sendChars = sendText.split('');

  const banForever = (userId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAdmin) {
      wsRef.current.send(JSON.stringify({ type: 'ban_forever', data: { userId } }));
    }
  };

  const deleteMessage = (messageId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAdmin) {
      wsRef.current.send(JSON.stringify({ type: 'delete_message', data: { messageId } }));
    }
  };

  const watchChat = (userId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAdmin) {
      wsRef.current.send(JSON.stringify({ type: 'watch_chat', data: { userId } }));
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

  const isFriendOnline = (friendId) => {
    return players.some(p => p.userId === friendId);
  };

  // Разделяем filteredPlayers на друзей и не-друзей
  const friendIds = new Set(friends.map(f => f.userId));
  const friendsList = friends; // все друзья из состояния
  const nonFriends = filteredPlayers.filter(p => !friendIds.has(p.userId) && p.userId !== myId);
  const selfPlayer = filteredPlayers.find(p => p.userId === myId);

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-user-drag: none;
          user-drag: none;
        }

        :root {
          --bg: #f5f7fa;
          --text: #2c3e50;
          --card-bg: rgba(255, 255, 255, 0.8);
          --messages-bg: rgba(249, 251, 253, 0.7);
          --input-bg: rgba(248, 250, 252, 0.9);
          --border: #e0e6ed;
          --nick-color: #5b7a99;
          --msg-text: #34495e;
          --time-color: #a0b0c0;
          --btn-bg: linear-gradient(135deg, #ff8fa3 0%, #ff6b8a 100%);
          --duel-bg: #ffe5ec;
          --duel-text: #b03a5b;
          --shadow: 0 8px 30px rgba(0,0,0,0.06);
          --msg-border: rgba(0,0,0,0.05);
        }
        body.dark {
          --bg: #1a2536;
          --text: #e0e8f0;
          --card-bg: rgba(30, 42, 58, 0.8);
          --messages-bg: rgba(15, 23, 42, 0.6);
          --input-bg: rgba(49, 68, 89, 0.85);
          --border: #3a4a5c;
          --nick-color: #a8c0d8;
          --msg-text: #cbd5e1;
          --time-color: #8296a5;
          --btn-bg: linear-gradient(135deg, #ff8fa3 0%, #e94560 100%);
          --duel-bg: #4a2530;
          --duel-text: #ffb3c1;
          --shadow: 0 8px 30px rgba(0,0,0,0.4);
          --msg-border: rgba(255,255,255,0.05);
        }

        html, body, #root {
          height: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          overscroll-behavior: none;
          touch-action: none;
          -webkit-overflow-scrolling: auto;
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
        }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Segoe UI', sans-serif;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }

        .chat-container {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          height: 100%;
          display: flex;
          gap: 0px;
          flex-wrap: wrap;
          padding: 20px;
          overflow: hidden;
        }

        .chat-main {
          flex: 1;
          min-width: 0;
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 24px;
          padding: 15px;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          touch-action: none;
        }

        .qr-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 8px;
          flex-shrink: 0;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          background: var(--messages-bg);
          border-radius: 18px;
          padding: 10px;
          margin-bottom: 10px;
          text-align: left;
          touch-action: pan-y;
          -webkit-overflow-scrolling: touch;
        }

        .msg {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          touch-action: manipulation;
        }

        .msg-avatar {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }
        .msg-avatar::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          right: 2px;
          height: 40%;
          background: linear-gradient(to bottom, rgba(255,255,255,0.4), transparent);
          border-radius: 6px 6px 50% 50% / 6px 6px 50% 50%;
        }

        .msg-content {
          flex: 1;
          text-align: left;
          background: var(--card-bg);
          border: 1px solid var(--msg-border);
          border-radius: 8px;
          padding: 4px 8px;
          transition: background 0.2s;
          display: flex;
          flex-direction: column;
        }
        .msg-header { display: flex; align-items: baseline; gap: 4px; margin-bottom: 2px; }
        .msg-nick { font-weight: 600; color: var(--nick-color); font-size: 13px; }
        .reactions-header {
          display: flex;
          gap: 2px;
          align-items: center;
          margin-left: auto;
        }
        .reaction-badge {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0 3px;
          font-size: 7px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          gap: 1px;
        }
        .msg-time { font-size: 9px; color: var(--time-color); margin-left: 4px; }
        .msg-text { color: var(--msg-text); line-height: 1.3; font-size: 14px; white-space: pre-wrap; }
        .msg-image-wrapper {
          display: flex;
          justify-content: flex-end;
          margin-top: 2px;
        }
        .msg-image {
          max-width: 40%;
          max-height: 120px;
          border-radius: 8px;
          cursor: pointer;
          object-fit: contain;
          margin-left: auto;
          transition: transform 0.1s;
        }
        .msg-image:active { transform: scale(0.95); }

        .reactions-panel {
          display: flex;
          gap: 4px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .reaction-btn {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2px 6px;
          cursor: pointer;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--text);
        }
        .reaction-btn.active { background: var(--btn-bg); color: white; }

        .admin-delete-btn {
          background: #ff4d4f;
          border: none;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          cursor: pointer;
          font-size: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 4px;
        }

        .input-row {
          display: flex;
          gap: 8px;
          margin-top: auto;
          align-items: center;
        }
        .input-row input[type="text"] {
          flex: 1;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--input-bg);
          color: var(--text);
          font-size: 14px;
          outline: none;
          touch-action: manipulation;
        }

        .attach-btn {
          background: transparent;
          border: none;
          font-size: 24px;
          cursor: pointer;
          touch-action: manipulation;
          padding: 0 4px;
          color: var(--nick-color);
        }
        .attach-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .send-btn {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--btn-bg);
          border: none;
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(255, 143, 163, 0.3);
          touch-action: manipulation;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .send-btn:active { transform: scale(0.95); }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        .send-btn .rotating-text {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          animation: spin 25s linear infinite;
        }
        .send-btn .rotating-text span {
          position: absolute;
          top: 50%;
          left: 50%;
          transform-origin: 0 0;
          font-size: 9px;
          font-weight: 700;
          color: white;
          text-transform: uppercase;
        }
        .send-btn .send-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          color: white;
          z-index: 1;
        }
        .send-btn .send-spinner {
          display: none;
          width: 22px;
          height: 22px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          z-index: 1;
        }
        .send-btn.sending .send-icon { display: none; }
        .send-btn.sending .send-spinner { display: block; }
        .send-btn.sending { animation: spinOnce 0.5s ease-in-out; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes spinOnce {
          from { transform: rotate(0deg) scale(1); }
          to { transform: rotate(360deg) scale(1.3); }
        }

        .btn {
          background: var(--btn-bg);
          border: none;
          color: white;
          padding: 10px 18px;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 600;
          touch-action: manipulation;
          font-size: 14px;
        }

        .status { margin-top: 8px; font-size: 12px; color: #4caf50; flex-shrink: 0; }
        .typing-indicator { font-size: 12px; color: #7f8c8d; margin: 4px 0; min-height: 16px; flex-shrink: 0; }

        .version { position: fixed; bottom: 10px; right: 10px; font-size: 12px; color: #aaa; z-index: 999; }

        .theme-toggle, .players-toggle {
          position: fixed;
          z-index: 1000;
          background: var(--card-bg);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 50%;
          width: 44px;
          height: 44px;
          padding: 0;
          cursor: pointer;
          font-size: 18px;
          touch-action: manipulation;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: none;
        }
        .theme-toggle { top: 10px; right: 10px; }
        .players-toggle { top: 10px; left: 10px; }
        .unread-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ffd700;
          color: #000;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          pointer-events: none;
        }

        .players-overlay {
          position: fixed; top: 60px; left: 10px; z-index: 1000; background: var(--card-bg);
          border-radius: 16px; padding: 10px; box-shadow: var(--shadow); width: 240px; max-height: 70vh; overflow-y: auto;
          touch-action: none; user-select: none; -webkit-user-drag: none;
        }
        .players-overlay h4 { margin-top: 0; color: var(--text); font-size: 15px; margin-bottom: 6px; }
        .search-input { width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); font-size: 13px; outline: none; margin-bottom: 8px; touch-action: manipulation; }
        .search-input::placeholder { color: var(--time-color); }

        .player-item { display: flex; align-items: center; gap: 4px; padding: 3px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 12px; }
        .player-item span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .player-item button { padding: 3px 5px; font-size: 11px; border-radius: 6px; background: transparent; border: 1px solid var(--border); color: var(--text); cursor: pointer; touch-action: manipulation; }
        .unread-excl {
          font-size: 8px;
          font-weight: 800;
          background: #ffd700;
          color: #000;
          border-radius: 50%;
          width: 12px;
          height: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 2px;
          flex-shrink: 0;
        }
        .online-status {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #4caf50;
          margin-left: 4px;
          flex-shrink: 0;
        }
        .friend-request-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          border-bottom: 1px solid var(--border);
          font-size: 12px;
        }
        .friend-request-actions {
          display: flex;
          gap: 4px;
        }
        .friend-request-actions .btn {
          padding: 4px 10px;
          font-size: 11px;
          border-radius: 8px;
        }
        .friends-header {
          margin-top: 12px;
          font-weight: 600;
          font-size: 14px;
          color: var(--nick-color);
          border-top: 1px solid var(--border);
          padding-top: 8px;
        }

        .private-chat-overlay {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 16px;
          padding: 15px;
          width: 480px;
          max-width: 90vw;
          height: 60vh;
          max-height: 600px;
          display: flex;
          flex-direction: column;
          z-index: 1000;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          touch-action: none;
          user-select: none;
          -webkit-user-drag: none;
        }
        .private-chat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-shrink: 0; }
        .private-chat-header h4 { margin: 0; color: var(--text); font-size: 15px; }
        .private-chat-close { background: transparent; border: none; color: var(--text); font-size: 20px; cursor: pointer; padding: 0 4px; touch-action: manipulation; }
        .private-messages { flex: 1; overflow-y: auto; background: var(--messages-bg); border-radius: 10px; padding: 8px; margin-bottom: 8px; touch-action: pan-y; -webkit-overflow-scrolling: touch; }
        .private-msg { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 6px; }
        .private-msg .private-msg-nick { font-weight: 600; color: var(--nick-color); font-size: 11px; margin-bottom: 2px; }
        .private-msg .private-msg-text { color: var(--msg-text); background: var(--card-bg); border: 1px solid var(--msg-border); border-radius: 6px; padding: 4px 8px; max-width: 80%; word-break: break-word; font-size: 13px; }
        .private-input-row { display: flex; gap: 8px; flex-shrink: 0; }
        .private-input-row input { flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); font-size: 13px; outline: none; touch-action: manipulation; }
        .private-input-row .btn { padding: 8px 14px; border-radius: 8px; white-space: nowrap; touch-action: manipulation; font-size: 13px; }
        .private-typing { font-size: 11px; color: var(--nick-color); margin-bottom: 4px; min-height: 14px; flex-shrink: 0; }

        .duel-box { background: var(--duel-bg); border-radius: 12px; padding: 10px; margin-top: 8px; color: var(--duel-text); font-size: 13px; }
        .duel-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .duel-actions .btn { padding: 8px 12px; font-size: 12px; }

        .duel-notice {
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          background: var(--btn-bg); color: white; padding: 8px 16px; border-radius: 20px; z-index: 1000;
          animation: fadeInUp 0.2s;
          touch-action: none; user-select: none; font-size: 13px;
        }

        .blur-overlay {
          position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.4);
          backdrop-filter: blur(8px); z-index: 998;
          touch-action: none;
        }

        .auth-modal {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: var(--card-bg); border-radius: 20px; padding: 20px; width: 90%; max-width: 360px; z-index: 1000;
          text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          touch-action: none; user-select: none; -webkit-user-drag: none;
        }
        .auth-modal h3 { margin-top: 0; color: var(--text); font-size: 16px; }
        .auth-modal input { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); margin: 8px 0; font-size: 14px; background: var(--input-bg); color: var(--text); touch-action: manipulation; }
        .auth-modal .btn { width: 100%; touch-action: manipulation; font-size: 14px; }
        .auth-switch { margin-top: 8px; cursor: pointer; color: var(--nick-color); font-size: 13px; }

        .idle-notice {
          font-size: 12px;
          color: var(--nick-color);
          margin-bottom: 8px;
          opacity: 0;
          transition: opacity 2s ease;
        }
        .idle-notice.visible { opacity: 1; }

        .fullscreen-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.9);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          touch-action: none;
        }
        .fullscreen-overlay img {
          max-width: 95%;
          max-height: 95%;
          object-fit: contain;
          border-radius: 8px;
        }

        @media (max-width: 600px) {
          .chat-container {
            flex-direction: column;
            padding: 10px;
            gap: 10px;
            height: 100%;
            width: 100%;
            max-width: 100%;
          }
          .chat-main {
            min-width: 0;
            width: 100%;
            padding: 10px;
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.1);
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          }
          .qr-wrap { margin-bottom: 4px; }
          .qr-wrap svg { width: 50px; height: 50px; }
          .messages { padding: 4px; min-height: 80px; }
          .msg { gap: 3px; margin-bottom: 4px; }
          .msg-avatar { width: 18px; height: 18px; border-radius: 4px; font-size: 8px; }
          .msg-content { padding: 2px 4px; }
          .msg-text { font-size: 11px; }
          .msg-image { max-width: 60%; max-height: 100px; }
          .input-row { gap: 4px; }
          .input-row input[type="text"] { padding: 6px 8px; font-size: 16px; }
          .send-btn {
            width: 70px;
            height: 70px;
          }
          .send-btn .rotating-text span { font-size: 10px; }
          .send-btn .send-icon { font-size: 30px; }
          .attach-btn { font-size: 28px; }
          .players-overlay { width: 180px; top: 50px; left: 3px; padding: 6px; max-height: 60vh; }
          .search-input { font-size: 16px; padding: 4px 6px; }
          .player-item { font-size: 11px; padding: 2px 0; }
          .player-item button { padding: 2px 4px; font-size: 10px; }
          .private-chat-overlay { bottom: 40px; width: 100vw; height: 80vh; max-height: none; padding: 8px; border-radius: 0; }
          .private-input-row input { font-size: 16px; }
          .duel-box { position: fixed; bottom: 60px; left: 10px; right: 10px; z-index: 1000; margin-top: 0; border-radius: 12px; }
          .auth-modal { width: 95%; padding: 10px; border-radius: 12px; }
          .auth-modal input { font-size: 16px; }
          .friends-header { font-size: 13px; }
        }

        @media (pointer: fine) {
          .attach-btn { display: none !important; }
        }
        @media (pointer: coarse) {
          .attach-btn { display: inline-block; }
        }
      `}</style>

      <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
        {isDark ? '☀️' : '🌙'}
      </button>

      {isAuth && (
        <button className="players-toggle" onClick={() => setShowPlayers(prev => !prev)}>
          👥
          {totalNotifications > 0 && <span className="unread-badge">!</span>}
        </button>
      )}

      {showPlayers && isAuth && (
        <div className="players-overlay" ref={playersOverlayRef}>
          <h4>Онлайн</h4>
          <input
            className="search-input"
            type="text"
            placeholder="Поиск"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="players-list">
            {/* Секция: Друзья (всегда сверху) */}
            {friendsList.length > 0 && <div className="friends-header">Друзья</div>}
            {friendsList.map(f => (
              <div className="player-item" key={f.userId}>
                <span>
                  {f.nickname}
                  {isFriendOnline(f.userId) && <span className="online-status" title="В сети"></span>}
                </span>
                <button onClick={() => openPrivateChat(f.userId, f.nickname)} title="Написать">
                  ✉️
                  {unreadByUser[f.userId] && <span className="unread-excl">!</span>}
                </button>
                <button onClick={() => requestDuel(f.userId)} title="Вызвать на дуэль">⚔️</button>
              </div>
            ))}

            {/* Секция: Остальные онлайн (не друзья) */}
            {nonFriends.length > 0 && <div className="friends-header">Онлайн</div>}
            {nonFriends.map(p => {
              const isSelf = p.userId === myId;
              return (
                <div className="player-item" key={p.id}>
                  <span>
                    {p.nickname}
                    <small>(W:{p.wins} L:{p.losses})</small>
                  </span>
                  {!isSelf && (
                    <>
                      {isAdmin && (
                        <>
                          <button onClick={() => watchChat(p.userId)} title="Просмотр чата">ℹ️</button>
                          <button onClick={() => setBanConfirm({ userId: p.userId, nickname: p.nickname })} title="Забанить навсегда">⛔</button>
                        </>
                      )}
                      <button onClick={() => requestDuel(p.id)} title="Вызвать на дуэль">⚔️</button>
                      <button onClick={() => openPrivateChat(p.userId, p.nickname)} title="Написать">
                        ✉️
                        {unreadByUser[p.userId] && <span className="unread-excl">!</span>}
                      </button>
                      {/* Кнопка добавления в друзья только для не-друзей */}
                      <button
                        onClick={() => {
                          if (wsRef.current?.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({
                              type: 'friend_request',
                              data: { receiverId: p.userId }
                            }));
                          }
                        }}
                        title="Добавить в друзья"
                      >
                        🤝
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Секция: Входящие запросы */}
            {friendRequests.length > 0 && (
              <>
                <div className="friends-header">Входящие запросы</div>
                {friendRequests.map(req => (
                  <div className="friend-request-item" key={req.requestId}>
                    <span>{req.senderNickname} хочет добавить вас в друзья</span>
                    <div className="friend-request-actions">
                      <button className="btn" onClick={() => {
                        if (wsRef.current?.readyState === WebSocket.OPEN) {
                          wsRef.current.send(JSON.stringify({
                            type: 'friend_request_accept',
                            data: { requestId: req.requestId }
                          }));
                        }
                        setFriendRequests(prev => prev.filter(r => r.requestId !== req.requestId));
                      }}>Принять</button>
                      <button className="btn" onClick={() => {
                        if (wsRef.current?.readyState === WebSocket.OPEN) {
                          wsRef.current.send(JSON.stringify({
                            type: 'friend_request_decline',
                            data: { requestId: req.requestId }
                          }));
                        }
                        setFriendRequests(prev => prev.filter(r => r.requestId !== req.requestId));
                      }}>Отклонить</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
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
          <div className="qr-wrap">
            <QRCodeSVG value={window.location.href} size={100} />
            <span style={{ fontSize: 12, marginTop: 4, color: '#8899aa' }}>QR для входа</span>
          </div>

          <div className="messages">
            {messages.map((m, i) => (
              <div className="msg" key={i} onClick={() => toggleReactions(m.id)}>
                <div className="msg-avatar" style={{ background: getAvatarColor(m.nickname) }}>
                  {getInitial(m.nickname)}
                </div>
                <div className="msg-content">
                  <div className="msg-header">
                    <span className="msg-nick">{m.nickname}</span>
                    {isAdmin && (
                      <button
                        className="admin-delete-btn"
                        title="Удалить сообщение"
                        onClick={(e) => { e.stopPropagation(); deleteMessage(m.id); }}
                      >
                        🗑
                      </button>
                    )}
                    <div className="reactions-header">
                      {hasReactions(m) && Object.entries(m.reactions).map(([emoji, users]) => (
                        <span key={emoji} className="reaction-badge">
                          {emoji} {users.length}
                        </span>
                      ))}
                    </div>
                    <span className="msg-time">{formatTime(m.time)}</span>
                  </div>
                  <div className="msg-text">{m.text}</div>
                  {m.imageUrl && (
                    <div className="msg-image-wrapper">
                      <img
                        src={m.imageUrl}
                        alt="photo"
                        className="msg-image"
                        loading="lazy"
                        onError={(e) => {
                          console.error('❌ Ошибка загрузки фото:', m.imageUrl);
                          e.target.style.display = 'none';
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenImage(m.imageUrl);
                        }}
                      />
                    </div>
                  )}
                  {activeMessageId === m.id && (
                    <div className="reactions-panel">
                      {['👍', '🔥', '😂'].map(emoji => (
                        <button
                          key={emoji}
                          className={`reaction-btn ${m.reactions?.[emoji]?.includes(nickname) ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); sendReaction(m.id, emoji); }}
                        >
                          {emoji} {m.reactions?.[emoji]?.length || 0}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="typing-indicator">
            {typingUsers.length > 0 && `${typingUsers.join(', ')} печатает...`}
          </div>

          <div className="input-row">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
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
              disabled={!isAuth || !input.trim() || isUploading}
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
            {isConnected ? 'Онлайн' : 'Оффлайн'}
            {bannedUntil && ` — бан до ${new Date(bannedUntil).toLocaleTimeString()}`}
            {errorMessage && <div style={{ color: '#e94560', marginTop: 4 }}>{errorMessage}</div>}
            {isUploading && <div style={{ color: '#ff8fa3', marginTop: 4 }}>Загрузка фото...</div>}
          </div>

          {duelNotice && <div className="duel-notice">{duelNotice}</div>}

          {duelInvite && (
            <div className="duel-box">
              <p>{duelInvite.fromNick} вызывает вас!</p>
              <div className="duel-actions">
                <button className="btn" onClick={acceptDuel}>Принять</button>
                <button className="btn" onClick={() => setDuelInvite(null)}>Отклонить</button>
              </div>
            </div>
          )}

          {duelState && !duelState.result && (
            <div className="duel-box">
              <p>Дуэль против {duelState.opponentNick}. Твой выбор:</p>
              <div className="duel-actions">
                <button className="btn" onClick={() => choose('rock')}>Камень</button>
                <button className="btn" onClick={() => choose('scissors')}>Ножницы</button>
                <button className="btn" onClick={() => choose('paper')}>Бумага</button>
              </div>
            </div>
          )}
          {duelState?.result && (
            <div className="duel-box">
              {duelState.result === 'win' && '🏆 Победа!'}
              {duelState.result === 'lose' && '💀 Поражение'}
              {duelState.result === 'draw' && '🤝 Ничья'}
            </div>
          )}
        </div>
      </div>

      {!isAuth && (
        <>
          <div className="blur-overlay" />
          <div className="auth-modal">
            <h3>{isRegisterMode ? 'ПИШИ НИКНЕЙМ' : 'ВХОД'}</h3>
            <input
              placeholder="Никнейм"
              value={authNickname}
              onChange={e => setAuthNickname(e.target.value)}
            />
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Пароль"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: 'var(--nick-color)',
                }}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            {authError && <div style={{ color: '#e94560', marginBottom: 8 }}>{authError}</div>}
            {showIdleNotice && (
              <div className={`idle-notice ${showIdleNotice ? 'visible' : ''}`}>
                ⏳ Неактивные пользователи будут автоматически отключены через 3 минуты бездействия.
              </div>
            )}
            {isRegisterMode && (
              <div style={{ fontSize: 12, color: 'var(--nick-color)', marginBottom: 8 }}>
                Пароль будет сохранён в зашифрованном виде, но восстановить его не получится. Придумай надёжный пароль: чем длиннее, тем лучше. Если забудешь — доступ к нику вернуть нельзя.
              </div>
            )}
            <button className="btn" onClick={handleAuthSubmit}>
              {isRegisterMode ? 'Зарегистрироваться' : 'Войти'}
            </button>
            <div className="auth-switch" onClick={() => setIsRegisterMode(!isRegisterMode)}>
              {isRegisterMode ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </div>
          </div>
        </>
      )}

      {isNewVersionAvailable && <LatestVersionLink />}
      <div className="version">v{VERSION}</div>

      {fullscreenImage && (
        <div className="fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="fullscreen" />
        </div>
      )}
    </>
  );
};

export default Chat;