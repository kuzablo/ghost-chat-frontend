import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const VERSION = '1.0.15';

const getAvatarColor = (nickname) => {
  if (!nickname) return '#b0c4de';
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 62%)`;
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
  const storedNickname = localStorage.getItem('ghost-chat-nickname') || '';
  const storedTheme = localStorage.getItem('ghost-chat-theme') || 'light';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [nickname, setNickname] = useState(storedNickname);
  const [nicknameSet, setNicknameSet] = useState(!!storedNickname);
  const [players, setPlayers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [duelInvite, setDuelInvite] = useState(null);
  const [duelState, setDuelState] = useState(null);
  const [bannedUntil, setBannedUntil] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [isDark, setIsDark] = useState(storedTheme === 'dark');
  const [activeMessageId, setActiveMessageId] = useState(null); // для показа реакций по клику
  const wsRef = useRef(null);
  const nicknameRef = useRef(storedNickname);
  const unmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const connect = () => {
    if (unmountedRef.current) return;

    const ws = new WebSocket('wss://ghost-chat-backend-production-5faf.up.railway.app');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setErrorMessage('');
      console.log(`[CHAT v${VERSION}] Connected`);
      if (nicknameRef.current) {
        ws.send(JSON.stringify({ type: 'join', data: { nickname: nicknameRef.current } }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'version':
            console.log(`[CHAT v${VERSION}] Server version: ${msg.data}`);
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
          case 'duel_start':
            setDuelState({ opponentNick: msg.data.opponentNick, myChoice: null });
            setDuelInvite(null);
            break;
          case 'duel_result':
            setDuelState(prev => prev ? { ...prev, result: msg.data.result } : null);
            break;
          case 'banned':
            setBannedUntil(msg.data.until);
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
      if (!unmountedRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };
  };

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    const unlockAudio = () => ensureAudioContext();
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });

    const handleVisibility = () => {
      if (!document.hidden && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
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

  const sendNickname = () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    ensureAudioContext();
    nicknameRef.current = trimmed;
    localStorage.setItem('ghost-chat-nickname', trimmed);
    wsRef.current?.send(JSON.stringify({ type: 'join', data: { nickname: trimmed } }));
    setNicknameSet(true);
  };

  const sendMessage = () => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      input.trim() &&
      !bannedUntil &&
      nicknameSet
    ) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        data: { nickname: nickname || 'Аноним', text: input.trim() }
      }));
      setInput('');
      wsRef.current.send(JSON.stringify({ type: 'typing', data: { isTyping: false } }));
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (wsRef.current?.readyState === WebSocket.OPEN && nicknameSet && !bannedUntil) {
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
    if (wsRef.current?.readyState === WebSocket.OPEN && nicknameSet) {
      wsRef.current.send(JSON.stringify({ type: 'reaction', data: { messageId, emoji } }));
    }
  };

  const requestDuel = (targetId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && nicknameSet) {
      wsRef.current.send(JSON.stringify({ type: 'duel_request', data: { targetId } }));
    }
  };

  const acceptDuel = () => {
    if (duelInvite && wsRef.current?.readyState === WebSocket.OPEN && nicknameSet) {
      wsRef.current.send(JSON.stringify({ type: 'duel_accept', data: { fromId: duelInvite.fromId } }));
    }
  };

  const choose = (choice) => {
    if (duelState && wsRef.current?.readyState === WebSocket.OPEN && nicknameSet) {
      wsRef.current.send(JSON.stringify({ type: 'duel_choice', data: { choice } }));
      setDuelState(prev => ({ ...prev, myChoice: choice }));
    }
  };

  const toggleReactions = (messageId) => {
    setActiveMessageId(prev => prev === messageId ? null : messageId);
  };

  return (
    <>
      <style>{`
        :root {
          --bg: #f5f7fa;
          --bg-gradient: linear-gradient(135deg, #f5f7fa 0%, #e9edf5 100%);
          --text: #2c3e50;
          --card-bg: rgba(255, 255, 255, 0.8);
          --card-border: rgba(255,255,255,0.6);
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
        }
        body.dark {
          --bg: #1a2536;
          --bg-gradient: linear-gradient(135deg, #1a2536 0%, #0f172a 100%);
          --text: #e0e8f0;
          --card-bg: rgba(30, 42, 58, 0.8);
          --card-border: rgba(255,255,255,0.1);
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
        }

        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        body {
          background: var(--bg);
          background-image: var(--bg-gradient);
          color: var(--text);
          font-family: 'Segoe UI', sans-serif;
          transition: background 0.3s, color 0.3s;
        }

        .chat-container {
          max-width: 1200px;
          margin: 0 auto;
          height: 100%;
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          padding: 20px;
          box-sizing: border-box;
        }

        .chat-main, .chat-side {
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--card-border);
          border-radius: 24px;
          padding: 20px;
          box-shadow: var(--shadow);
          transition: all 0.3s;
        }

        .chat-main {
          flex: 2;
          min-width: 300px;
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
        }

        .chat-side {
          flex: 1;
          min-width: 220px;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
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
          scrollbar-width: thin;
          scrollbar-color: #c0c8d0 transparent;
        }
        .messages::-webkit-scrollbar {
          width: 6px;
        }
        .messages::-webkit-scrollbar-thumb {
          background: #c0c8d0;
          border-radius: 3px;
        }

        .msg {
          display: flex;
          align-items: flex-start;
          gap: 6px; /* уменьшенный отступ */
          margin-bottom: 12px;
          word-break: break-word;
          animation: fadeInUp 0.25s ease;
          cursor: pointer; /* кликабельно для показа реакций */
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .msg-avatar {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: 600;
          color: #ffffff;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .msg-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          text-align: left;
        }

        .msg-header {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 0; /* убрали отступ */
        }

        .msg-nick {
          font-weight: 600;
          color: var(--nick-color);
          font-size: 14px;
        }

        .msg-time {
          font-size: 10px;
          color: var(--time-color);
          margin-left: auto;
        }

        .msg-text {
          color: var(--msg-text);
          line-height: 1.4;
          font-size: 15px;
          white-space: pre-wrap;
        }

        .reactions {
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
          transition: background 0.2s, transform 0.2s;
        }
        .reaction-btn:hover {
          background: var(--btn-bg);
          color: white;
          transform: translateY(-1px);
        }
        .reaction-btn.active {
          background: var(--btn-bg);
          color: white;
        }

        .input-row {
          display: flex;
          gap: 10px;
        }
        .input-row input {
          flex: 1;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--input-bg);
          color: var(--text);
          font-size: 15px;
          outline: none;
          transition: border 0.2s, box-shadow 0.2s;
        }
        .input-row input:focus {
          border-color: #a0c0e0;
          box-shadow: 0 0 0 3px rgba(160, 192, 224, 0.2);
        }

        .btn {
          background: var(--btn-bg);
          border: none;
          color: white;
          padding: 14px 24px;
          border-radius: 14px;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.2s;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(255, 143, 163, 0.3);
        }
        .btn:active {
          transform: scale(0.96);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .status {
          margin-top: 10px;
          font-size: 14px;
          color: #4caf50;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .typing-indicator {
          font-size: 13px;
          color: #7f8c8d;
          margin: 5px 0;
          min-height: 18px;
        }

        .version {
          position: fixed;
          bottom: 10px;
          right: 10px;
          font-size: 12px;
          color: #aaa;
          z-index: 999;
        }

        .theme-toggle {
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 1000;
          background: var(--card-bg);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.3s, transform 0.2s;
        }
        .theme-toggle:hover {
          transform: scale(1.05);
        }

        .players-list {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .players-list::-webkit-scrollbar {
          width: 6px;
        }
        .players-list::-webkit-scrollbar-thumb {
          background: #c0c8d0;
          border-radius: 3px;
        }

        .player-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          gap: 8px;
          transition: background 0.2s;
        }
        .player-item:hover {
          background: rgba(0,0,0,0.02);
        }
        .player-item span {
          flex: 1;
          min-width: 0;
          word-break: break-word;
          overflow-wrap: anywhere;
          font-weight: 500;
        }

        .duel-box {
          background: var(--duel-bg);
          border-radius: 12px;
          padding: 12px;
          margin-top: 10px;
          color: var(--duel-text);
          animation: fadeInUp 0.2s ease;
        }
        .duel-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .blur-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255,255,255,0.6);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 998;
        }

        .nickname-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 24px;
          padding: 28px;
          width: 90%;
          max-width: 380px;
          z-index: 1000;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          text-align: center;
          animation: fadeInUp 0.3s ease;
        }
        .nickname-modal h3 {
          margin-top: 0;
          color: var(--text);
          font-weight: 600;
        }
        .nickname-modal input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid var(--border);
          margin: 16px 0;
          font-size: 16px;
          background: var(--input-bg);
          color: var(--text);
          outline: none;
          transition: border 0.2s, box-shadow 0.2s;
        }
        .nickname-modal input:focus {
          border-color: #a0c0e0;
          box-shadow: 0 0 0 3px rgba(160, 192, 224, 0.2);
        }
        .nickname-modal .btn {
          width: 100%;
          font-size: 16px;
        }

        @media (max-width: 600px) {
          .chat-container {
            flex-direction: column;
            height: 100%;
            gap: 12px;
            padding: 12px;
            overflow: hidden;
          }
          .chat-main {
            min-width: 0;
            flex: 2;
            min-height: 0;
            position: relative; /* для дуэли */
          }
          .chat-side {
            min-width: 0;
            flex: 1;
            min-height: 0;
            overflow: hidden;
          }
          .messages {
            min-height: 140px;
          }
          .player-item {
            flex-wrap: wrap;
          }
          .nickname-modal input,
          .input-row input {
            font-size: 16px;
          }
          /* Фикс дуэли: показываем поверх */
          .duel-box {
            position: fixed;
            bottom: 80px;
            left: 10px;
            right: 10px;
            z-index: 1000;
            margin-top: 0;
          }
        }
      `}</style>

      <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
        {isDark ? '☀️' : '🌙'}
      </button>

      <div className="chat-container" style={{ filter: nicknameSet ? 'none' : 'blur(6px)', pointerEvents: nicknameSet ? 'auto' : 'none' }}>
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
                    <span className="msg-time">{formatTime(m.time)}</span>
                  </div>
                  <div className="msg-text">{m.text}</div>
                  {activeMessageId === m.id && (
                    <div className="reactions">
                      {['👍', '🔥', '😂'].map(emoji => {
                        const count = m.reactions?.[emoji]?.length || 0;
                        const hasMyReaction = m.reactions?.[emoji]?.includes(nickname);
                        return (
                          <button
                            key={emoji}
                            className={`reaction-btn ${hasMyReaction ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation(); // чтобы не закрывался блок
                              sendReaction(m.id, emoji);
                            }}
                          >
                            {emoji} {count > 0 && <span>{count}</span>}
                          </button>
                        );
                      })}
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
              disabled={!!bannedUntil || !nicknameSet}
              placeholder={bannedUntil ? 'Вы в бане...' : 'Сообщение'}
            />
            <button className="btn" onClick={sendMessage} disabled={!!bannedUntil || !nicknameSet}>
              Отправить
            </button>
          </div>

          <div className="status">
            {isConnected ? 'Онлайн' : 'Оффлайн'}
            {bannedUntil && ` — бан до ${new Date(bannedUntil).toLocaleTimeString()}`}
            {errorMessage && <div style={{ color: '#e94560', marginTop: 4 }}>{errorMessage}</div>}
          </div>

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

        <div className="chat-side">
          <h4 style={{ marginTop: 0, color: 'var(--text)' }}>Онлайн: {players.length}</h4>
          <div className="players-list">
            {players.map(p => (
              <div className="player-item" key={p.id}>
                <span>{p.nickname} <small>(W:{p.wins} L:{p.losses})</small></span>
                <button
                  className="btn"
                  disabled={p.id === myId || !nicknameSet}
                  onClick={() => requestDuel(p.id)}
                  style={{ padding: '4px 8px', fontSize: 12 }}
                >
                  Вызвать
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!nicknameSet && (
        <>
          <div className="blur-overlay" />
          <div className="nickname-modal">
            <h3>ВВЕДИ НИКНЕЙМ</h3>
            <input
              autoFocus
              placeholder="Твой ник"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') sendNickname();
              }}
            />
            <button className="btn" onClick={sendNickname}>Войти</button>
          </div>
        </>
      )}

      <div className="version">v{VERSION}</div>
    </>
  );
};

export default Chat;