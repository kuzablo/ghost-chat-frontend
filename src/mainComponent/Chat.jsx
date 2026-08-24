import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const VERSION = '1.0.3';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameSet, setNicknameSet] = useState(false);
  const [players, setPlayers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [duelInvite, setDuelInvite] = useState(null);
  const [duelState, setDuelState] = useState(null);
  const [bannedUntil, setBannedUntil] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const wsRef = useRef(null);
  const nicknameRef = useRef('');
  const unmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);

  const connect = () => {
    if (unmountedRef.current) return;

    const ws = new WebSocket('wss://ghost-chat-backend-production-5faf.up.railway.app');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setErrorMessage('');
      console.log(`[CHAT v${VERSION}] Connected`);
      // при успешном переподключении повторно отправляем ник
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
            break;
          case 'players':
            setPlayers(msg.data);
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
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendNickname = () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    nicknameRef.current = trimmed;
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
          background: #1a1a2e;
          color: #eee;
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
          background: #16213e;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 0 20px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
        }

        .chat-side {
          flex: 1;
          min-width: 220px;
          background: #0f3460;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 0 20px rgba(0,0,0,0.5);
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        .nickname-input {
          width: 100%;
          padding: 8px;
          border-radius: 8px;
          border: none;
          margin-bottom: 10px;
          box-sizing: border-box;
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
          background: #1a1a2e;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 10px;
        }

        .msg {
          margin-bottom: 8px;
          word-break: break-word;
        }
        .msg strong {
          color: #e94560;
        }

        .input-row {
          display: flex;
          gap: 8px;
        }
        .input-row input {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          border: none;
        }

        .btn {
          background: #e94560;
          border: none;
          color: white;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .btn:active {
          transform: scale(0.95);
        }

        .status {
          margin-top: 10px;
          font-size: 14px;
          color: #4ecca3;
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
          padding: 6px 0;
        }

        .duel-box {
          background: #e94560;
          border-radius: 10px;
          padding: 10px;
          margin-top: 10px;
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
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 998;
        }

        .nickname-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #16213e;
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 360px;
          z-index: 1000;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          text-align: center;
        }
        .nickname-modal h3 {
          margin-top: 0;
          color: #eee;
        }
        .nickname-modal input {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: none;
          margin: 10px 0;
          font-size: 16px;
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
          }
          .chat-main {
            min-width: auto;
            height: 70%;
          }
          .chat-side {
            min-width: auto;
            height: 30%;
          }
          .messages {
            min-height: 150px;
          }
          .nickname-input,
          .input-row input,
          .nickname-modal input {
            font-size: 16px;
          }
        }
      `}</style>

      <div className="chat-container" style={{ filter: nicknameSet ? 'none' : 'blur(6px)', pointerEvents: nicknameSet ? 'auto' : 'none' }}>
        <div className="chat-main">
          <div className="qr-wrap">
            <QRCodeSVG value={window.location.href} size={100} />
            <span style={{ fontSize: 12, marginTop: 4 }}>QR для входа</span>
          </div>

          <div className="messages">
            {messages.map((m, i) => (
              <div className="msg" key={i}>
                <strong>{m.nickname}</strong>: {m.text}
              </div>
            ))}
          </div>

          <div className="input-row">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
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
          <h4 style={{ marginTop: 0 }}>Онлайн: {players.length}</h4>
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