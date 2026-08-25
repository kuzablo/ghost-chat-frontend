import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const VERSION = '2.0.7';

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
  const [privateInput, setPrivateInput] = useState('');
  const [privateTypingUser, setPrivateTypingUser] = useState(null);
  const [duelNotice, setDuelNotice] = useState('');
  const [showIdleNotice, setShowIdleNotice] = useState(false);
  const wsRef = useRef(null);
  const nicknameRef = useRef(storedNickname);
  const tokenRef = useRef(storedToken);
  const unmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const playersOverlayRef = useRef(null);
  const privateMessagesEndRef = useRef(null);
  const privateTypingTimeoutRef = useRef(null);

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
          case 'players':
            setPlayers(msg.data);
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
          case 'idle_disconnect':
            setAuthError('Вы были отключены за неактивность. Войдите снова.');
            setIsAuth(false);
            localStorage.removeItem('ghost-chat-token');
            localStorage.removeItem('ghost-chat-nickname');
            setToken('');
            setNickname('');
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
            break;
          case 'private_message_sent':
            setPrivateChat(prev => {
              if (!prev || prev.userId !== msg.data.recipientId) return prev;
              return {
                ...prev,
                messages: [...(prev.messages || []), {
                  senderId: msg.data.senderId, // ← исправлено: теперь всегда мой ID
                  text: msg.data.text,
                  created_at: msg.data.created_at,
                }],
              };
            });
            break;
          case 'private_typing':
            if (msg.data.senderId !== myId) {
              setPrivateTypingUser(msg.data.isTyping ? msg.data.senderNickname : null);
              clearTimeout(privateTypingTimeoutRef.current);
              privateTypingTimeoutRef.current = setTimeout(() => setPrivateTypingUser(null), 2000);
            }
            break;
          case 'private_history':
            setPrivateChat(prev => {
              if (!prev || prev.userId !== msg.data.userId) return prev;
              return { ...prev, messages: msg.data.messages };
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
    if (privateMessagesEndRef.current) {
      privateMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [privateChat?.messages]);

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

  const sendMessage = () => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      input.trim() &&
      !bannedUntil &&
      isAuth
    ) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        data: { text: input.trim() }
      }));
      setInput('');
      wsRef.current.send(JSON.stringify({ type: 'typing', data: { isTyping: false } }));
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuth && !bannedUntil) {
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'private_history', data: { userId } }));
    }
  };

  const closePrivateChat = () => {
    setPrivateChat(null);
    setPrivateInput('');
    setPrivateTypingUser(null);
  };

  const sendPrivateMessage = () => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      privateInput.trim() &&
      privateChat &&
      privateChat.userId !== myId
    ) {
      wsRef.current.send(JSON.stringify({
        type: 'private_message',
        data: { recipientId: privateChat.userId, text: privateInput.trim() }
      }));
      setPrivateInput('');
      wsRef.current.send(JSON.stringify({
        type: 'private_typing',
        data: { recipientId: privateChat.userId, isTyping: false }
      }));
    }
  };

  const handlePrivateInputChange = (e) => {
    setPrivateInput(e.target.value);
    if (wsRef.current?.readyState === WebSocket.OPEN && privateChat && privateChat.userId !== myId) {
      if (e.target.value.trim()) {
        wsRef.current.send(JSON.stringify({
          type: 'private_typing',
          data: { recipientId: privateChat.userId, isTyping: true }
        }));
        clearTimeout(privateTypingTimeoutRef.current);
        privateTypingTimeoutRef.current = setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'private_typing',
              data: { recipientId: privateChat.userId, isTyping: false }
            }));
          }
        }, 1500);
      } else {
        wsRef.current.send(JSON.stringify({
          type: 'private_typing',
          data: { recipientId: privateChat.userId, isTyping: false }
        }));
      }
    }
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

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
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Segoe UI', sans-serif;
          touch-action: manipulation;
          -webkit-text-size-adjust: 100%;
        }

        .chat-container {
          max-width: 1200px;
          margin: 0 auto;
          height: 100%;
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          padding: 20px;
        }

        .chat-main {
          flex: 1;
          min-width: 300px;
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 24px;
          padding: 20px;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .qr-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 12px;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          background: var(--messages-bg);
          border-radius: 18px;
          padding: 14px;
          margin-bottom: 12px;
          text-align: left;
        }

        .msg {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 12px;
          cursor: pointer;
          touch-action: manipulation;
          justify-content: flex-start;
        }

        .msg-avatar {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
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
          padding: 6px 10px;
          transition: background 0.2s;
        }
        .msg-header { display: flex; align-items: baseline; gap: 4px; margin-bottom: 2px; }
        .msg-nick { font-weight: 600; color: var(--nick-color); font-size: 14px; }
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
          font-size: 8px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          gap: 1px;
        }
        .msg-time { font-size: 10px; color: var(--time-color); margin-left: 4px; }
        .msg-text { color: var(--msg-text); line-height: 1.4; font-size: 15px; white-space: pre-wrap; }

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
          padding: 2px 8px;
          cursor: pointer;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--text);
        }
        .reaction-btn.active { background: var(--btn-bg); color: white; }

        .input-row { display: flex; gap: 10px; }
        .input-row input {
          flex: 1;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--input-bg);
          color: var(--text);
          font-size: 15px;
        }
        .btn {
          background: var(--btn-bg);
          border: none;
          color: white;
          padding: 14px 24px;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 600;
        }

        .status { margin-top: 10px; font-size: 14px; color: #4caf50; }
        .typing-indicator { font-size: 13px; color: #7f8c8d; margin: 5px 0; min-height: 18px; }

        .version { position: fixed; bottom: 10px; right: 10px; font-size: 12px; color: #aaa; z-index: 999; }

        .theme-toggle, .players-toggle {
          position: fixed; z-index: 1000; background: var(--card-bg); color: var(--text);
          border: 1px solid var(--border); border-radius: 20px; padding: 6px 12px; cursor: pointer; font-size: 18px;
        }
        .theme-toggle { top: 10px; right: 10px; }
        .players-toggle { top: 10px; left: 10px; }

        .players-overlay {
          position: fixed; top: 50px; left: 10px; z-index: 1000; background: var(--card-bg);
          border-radius: 16px; padding: 12px; box-shadow: var(--shadow); width: 260px; max-height: 70vh; overflow-y: auto;
          touch-action: manipulation; user-select: none; -webkit-user-drag: none;
        }

        .player-item {
          display: flex; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 13px;
        }
        .player-item span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .player-item button { padding: 4px 6px; font-size: 12px; border-radius: 8px; background: transparent; border: 1px solid var(--border); color: var(--text); cursor: pointer; }
        .player-item button:disabled { opacity: 0.4; }

        .private-chat-overlay {
          position: fixed;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 20px;
          padding: 20px;
          width: 500px;
          max-width: 90vw;
          height: 60vh;
          max-height: 600px;
          display: flex;
          flex-direction: column;
          z-index: 1000;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          touch-action: manipulation;
          user-select: none;
          -webkit-user-drag: none;
        }
        .private-chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .private-chat-header h4 {
          margin: 0;
          color: var(--text);
        }
        .private-chat-close {
          background: transparent;
          border: none;
          color: var(--text);
          font-size: 24px;
          cursor: pointer;
          padding: 0 4px;
        }
        .private-messages {
          flex: 1;
          overflow-y: auto;
          background: var(--messages-bg);
          border-radius: 12px;
          padding: 10px;
          margin-bottom: 10px;
        }
        .private-msg {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        .private-msg .private-msg-nick {
          font-weight: 600;
          color: var(--nick-color);
          font-size: 12px;
          margin-bottom: 2px;
        }
        .private-msg .private-msg-text {
          color: var(--msg-text);
          background: var(--card-bg);
          border: 1px solid var(--msg-border);
          border-radius: 8px;
          padding: 6px 10px;
          max-width: 80%;
          word-break: break-word;
        }
        .private-input-row {
          display: flex;
          gap: 10px;
        }
        .private-input-row input {
          flex: 1;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--input-bg);
          color: var(--text);
          font-size: 15px;
          outline: none;
        }
        .private-input-row .btn {
          padding: 12px 20px;
          border-radius: 12px;
          white-space: nowrap;
        }
        .private-typing {
          font-size: 12px;
          color: var(--nick-color);
          margin-bottom: 5px;
          min-height: 16px;
        }

        .duel-box { background: var(--duel-bg); border-radius: 12px; padding: 12px; margin-top: 10px; color: var(--duel-text); }
        .duel-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        .duel-notice {
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          background: var(--btn-bg); color: white; padding: 10px 20px; border-radius: 20px; z-index: 1000;
          animation: fadeInUp 0.2s;
        }

        .blur-overlay {
          position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.4);
          backdrop-filter: blur(8px); z-index: 998;
        }

        .auth-modal {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: var(--card-bg); border-radius: 24px; padding: 28px; width: 90%; max-width: 400px; z-index: 1000;
          text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          touch-action: manipulation; user-select: none; -webkit-user-drag: none;
        }
        .auth-modal h3 { margin-top: 0; color: var(--text); }
        .auth-modal input { width: 100%; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--border); margin: 10px 0; font-size: 16px; background: var(--input-bg); color: var(--text); }
        .auth-modal .btn { width: 100%; }
        .auth-switch { margin-top: 10px; cursor: pointer; color: var(--nick-color); }

        .idle-notice {
          font-size: 12px;
          color: var(--nick-color);
          margin-bottom: 10px;
          opacity: 0;
          transition: opacity 2s ease;
        }
        .idle-notice.visible {
          opacity: 1;
        }

        @media (max-width: 600px) {
          .chat-container { flex-direction: column; padding: 12px; }
          .chat-main { min-width: 0; }
          .players-overlay { width: 220px; top: 45px; left: 5px; padding: 10px; }
          .player-item { font-size: 12px; padding: 3px 0; }
          .player-item button { padding: 3px 5px; font-size: 11px; }
          .duel-box { position: fixed; bottom: 80px; left: 10px; right: 10px; z-index: 1000; }
          .private-chat-overlay {
            bottom: 60px;
            width: 95vw;
            height: 70vh;
            max-height: none;
          }
          .msg-content {
            padding: 4px 8px;
          }
          .msg-text {
            font-size: 14px;
          }
          .auth-modal { width: 95%; }
        }
      `}</style>

      <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
        {isDark ? '☀️' : '🌙'}
      </button>

      {isAuth && (
        <button className="players-toggle" onClick={() => setShowPlayers(prev => !prev)}>
          👥
        </button>
      )}

      {showPlayers && isAuth && (
        <div className="players-overlay" ref={playersOverlayRef}>
          <h4>Онлайн: {players.length}</h4>
          <div className="players-list">
            {players.map(p => {
              const isSelf = p.userId === myId;
              return (
                <div className="player-item" key={p.id}>
                  <span>{p.nickname} <small>(W:{p.wins} L:{p.losses})</small></span>
                  {!isSelf && (
                    <>
                      <button onClick={() => requestDuel(p.id)}>⚔️</button>
                      <button onClick={() => openPrivateChat(p.userId, p.nickname)}>✉️</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {privateChat && (
        <>
          <div className="blur-overlay" onClick={closePrivateChat} />
          <div className="private-chat-overlay">
            <div className="private-chat-header">
              <h4>Чат с {privateChat.nickname}</h4>
              <button className="private-chat-close" onClick={closePrivateChat}>×</button>
            </div>
            <div className="private-typing">
              {privateTypingUser ? `${privateTypingUser} печатает...` : ''}
            </div>
            <div className="private-messages">
              {privateChat.messages?.map((m, i) => (
                <div key={i} className="private-msg">
                  <span className="private-msg-nick">{m.senderId === myId ? 'Я' : privateChat.nickname}</span>
                  <span className="private-msg-text">{m.text}</span>
                </div>
              ))}
              <div ref={privateMessagesEndRef} />
            </div>
            <div className="private-input-row">
              <input
                value={privateInput}
                onChange={handlePrivateInputChange}
                onKeyDown={e => e.key === 'Enter' && sendPrivateMessage()}
                placeholder="Напишите сообщение..."
              />
              <button className="btn" onClick={sendPrivateMessage}>Отправить</button>
            </div>
          </div>
        </>
      )}

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
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              disabled={!isAuth || !!bannedUntil}
              placeholder={bannedUntil ? 'Вы в бане...' : 'Сообщение'}
            />
            <button className="btn" onClick={sendMessage} disabled={!isAuth || !!bannedUntil}>
              Отправить
            </button>
          </div>

          <div className="status">
            {isConnected ? 'Онлайн' : 'Оффлайн'}
            {bannedUntil && ` — бан до ${new Date(bannedUntil).toLocaleTimeString()}`}
            {errorMessage && <div style={{ color: '#e94560', marginTop: 4 }}>{errorMessage}</div>}
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
            <input
              type="password"
              placeholder="Пароль"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()}
            />
            {authError && <div style={{ color: '#e94560', marginBottom: 10 }}>{authError}</div>}
            {showIdleNotice && (
              <div className={`idle-notice ${showIdleNotice ? 'visible' : ''}`}>
                ⏳ Неактивные пользователи будут автоматически отключены через 3 минуты бездействия.
              </div>
            )}
            {isRegisterMode && (
              <div style={{ fontSize: 12, color: 'var(--nick-color)', marginBottom: 10 }}>
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

      <div className="version">v{VERSION}</div>
    </>
  );
};

export default Chat;