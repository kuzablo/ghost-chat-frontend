import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const VERSION = '1.0.11';

const getAvatarColor = (nickname) => {
  if (!nickname) return '#b0c4de';
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 70%)`;
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
          case 'players':
            setPlayers(msg.data);
            break;
          case 'typing': {
            const { nickname: typingNick, isTyping } = msg.data;
            setTypingUsers(prev => {
              if (isTyping && !prev.includes(typingNick)) {
                return [...prev, typingNick];
              }
              if (!isTyping) {
                return prev.filter(name => name !== typingNick);
              }
              return prev;
            });
            break;
          }
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
      // Отправляем, что перестали печатать
      wsRef.current.send(JSON.stringify({ type: 'typing', data: { isTyping: false } }));
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (wsRef.current?.readyState === WebSocket.OPEN && nicknameSet && !bannedUntil) {
      if (e.target.value.trim()) {
        // Пользователь печатает
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

  return (
    <>
      <style>{`
        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        body {
          background: #f2f5f9;
          color: #2c3e50;
          font-family: 'Segoe UI', sans-serif;
        }

        .chat-container {
          max-width: 900px;
          margin: 0 auto;
          height: 100%;
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          padding: 10px;
          box-sizing: border-box;
        }

        .chat-main {
          flex: 2;
          min-width: 300px;
          background: #ffffff;
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
        }

        .chat-side {
          flex: 1;
          min-width: 220px;
          background: #ffffff;
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        .qr-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 10px;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          background: #f9fbfd;
          border-radius: 16px;
          padding: 12px;
          margin-bottom: 10px;
          text-align: left;
        }

        .msg {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
          word-break: break-word;
        }

        .msg-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
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
          gap: 8px;
          margin-bottom: 3px;
        }

        .msg-nick {
          font-weight: 600;
          color: #5b7a99;
          font-size: 14px;
        }

        .msg-time {
          font-size: 11px;
          color: #a0b0c0;
          margin-left: auto;
        }

        .msg-text {
          color: #34495e;
          line-height: 1.5;
          font-size: 15px;
          white-space: pre-wrap;
        }

        .input-row {
          display: flex;
          gap: 8px;
        }
        .input-row input {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #e0e6ed;
          background: #f8fafc;
          color: #2c3e50;
          font-size: 15px;
          outline: none;
        }
        .input-row input:focus {
          border-color: #a0c0e0;
        }

        .btn {
          background: #ff8fa3;
          border: none;
          color: white;
          padding: 12px 20px;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.1s;
          font-weight: 600;
        }
        .btn:active {
          transform: scale(0.95);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .status {
          margin-top: 10px;
          font-size: 14px;
          color: #4caf50;
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

        .players-list {
          flex: 1;
          overflow-y: auto;
        }
        .player-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f0f3f8;
          gap: 8px;
        }
        .player-item span {
          flex: 1;
          min-width: 0;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .duel-box {
          background: #ffe5ec;
          border-radius: 12px;
          padding: 12px;
          margin-top: 10px;
          color: #b03a5b;
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
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 998;
        }

        .nickname-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #ffffff;
          border-radius: 20px;
          padding: 24px;
          width: 90%;
          max-width: 360px;
          z-index: 1000;
          box-shadow: 0 10px 40px rgba(0,0,0,0.12);
          text-align: center;
        }
        .nickname-modal h3 {
          margin-top: 0;
          color: #2c3e50;
        }
        .nickname-modal input {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #e0e6ed;
          margin: 12px 0;
          font-size: 16px;
          background: #f8fafc;
          outline: none;
        }
        .nickname-modal .btn {
          width: 100%;
          font-size: 16px;
        }

        @media (max-width: 600px) {
          .chat-container {
            flex-direction: column;
            height: 100%;
            gap: 10px;
            padding: 5px;
            overflow: hidden;
            box-sizing: border-box;
          }
          .chat-main {
            min-width: 0;
            height: auto;
            flex: 2;
            min-height: 0;
          }
          .chat-side {
            min-width: 0;
            height: auto;
            flex: 1;
            min-height: 0;
            overflow: hidden;
          }
          .messages {
            min-height: 120px;
          }
          .players-list {
            overflow-y: auto;
            overflow-x: hidden;
          }
          .player-item {
            gap: 8px;
            flex-wrap: wrap;
          }
          .player-item span {
            flex: 1;
            min-width: 0;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          .nickname-modal input,
          .input-row input {
            font-size: 16px;
          }
        }
      `}</style>

      <div className="chat-container" style={{ filter: nicknameSet ? 'none' : 'blur(6px)', pointerEvents: nicknameSet ? 'auto' : 'none' }}>
        <div className="chat-main">
          <div className="qr-wrap">
            <QRCodeSVG value={window.location.href} size={100} />
            <span style={{ fontSize: 12, marginTop: 4, color: '#8899aa' }}>QR для входа</span>
          </div>

          <div className="messages">
            {messages.map((m, i) => (
              <div className="msg" key={i}>
                <div className="msg-avatar" style={{ background: getAvatarColor(m.nickname) }}>
                  {getInitial(m.nickname)}
                </div>
                <div className="msg-content">
                  <div className="msg-header">
                    <span className="msg-nick">{m.nickname}</span>
                    <span className="msg-time">{formatTime(m.time)}</span>
                  </div>
                  <div className="msg-text">{m.text}</div>
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
          <h4 style={{ marginTop: 0, color: '#2c3e50' }}>Онлайн: {players.length}</h4>
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