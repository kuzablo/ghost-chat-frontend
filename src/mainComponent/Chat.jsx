import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [players, setPlayers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [duelInvite, setDuelInvite] = useState(null);
  const [duelState, setDuelState] = useState(null);
  const [bannedUntil, setBannedUntil] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:3000')
    wsRef.current = ws;
    ws.onopen = () => setIsConnected(true);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
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
          break;
      }
    };
    ws.onclose = () => setIsConnected(false);
    return () => ws.close();
  }, []);

  const sendNickname = () => {
    if (nickname.trim()) {
      wsRef.current?.send(JSON.stringify({ type: 'join', data: { nickname: nickname.trim() } }));
    }
  };

  const sendMessage = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && input.trim() && !bannedUntil) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        data: { nickname: nickname || 'Аноним', text: input.trim() }
      }));
      setInput('');
    }
  };

  const requestDuel = (targetId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'duel_request', data: { targetId } }));
    }
  };

  const acceptDuel = () => {
    if (duelInvite && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'duel_accept', data: { fromId: duelInvite.fromId } }));
    }
  };

  const choose = (choice) => {
    if (duelState && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'duel_choice', data: { choice } }));
      setDuelState(prev => ({ ...prev, myChoice: choice }));
    }
  };

  return (
    <>
      <style>{`
        body {
          background: #1a1a2e;
          color: #eee;
          font-family: 'Segoe UI', sans-serif;
          margin: 0;
          padding: 20px;
        }
        .chat-container {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .chat-main {
          flex: 2;
          min-width: 300px;
          background: #16213e;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 0 20px rgba(0,0,0,0.5);
        }
        .chat-side {
          flex: 1;
          min-width: 220px;
          background: #0f3460;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 0 20px rgba(0,0,0,0.5);
        }
        .nickname-input {
          width: calc(100% - 16px);
          padding: 8px;
          border-radius: 8px;
          border: none;
          margin-bottom: 10px;
        }
        .qr-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 10px;
        }
        .messages {
          height: 400px;
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
        .players-list {
          max-height: 300px;
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
      `}</style>

      <div className="chat-container">
        <div className="chat-main">
          <input
            className="nickname-input"
            placeholder="Твой ник"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onBlur={sendNickname}
          />

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
              disabled={!!bannedUntil}
              placeholder={bannedUntil ? 'Вы в бане...' : 'Сообщение'}
            />
            <button className="btn" onClick={sendMessage} disabled={!!bannedUntil}>
              Отправить
            </button>
          </div>

          <div className="status">
            {isConnected ? 'Онлайн' : 'Оффлайн'}
            {bannedUntil && ` — бан до ${new Date(bannedUntil).toLocaleTimeString()}`}
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
                  disabled={p.id === myId}
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
    </>
  );
};

export default Chat;