import { useRef, useState, useEffect } from 'react';
import { formatTime } from '../utils';

const REACTIONS = ['👍', '👎', '❤️', '🔥', '😢'];

const PrivateChat = ({
  userId,
  nickname,
  myId,
  ws,
  onClose,
  initialMessages = [],
  typingUser = null,
}) => {
  const [input, setInput] = useState('');
  const [localTypingUser, setLocalTypingUser] = useState(typingUser);
  const [pickerFor, setPickerFor] = useState(null);
  const [poppingId, setPoppingId] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const wsRef = useRef(ws);

  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  useEffect(() => {
    setLocalTypingUser(typingUser);
  }, [typingUser]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [initialMessages]);

  const sendMessage = () => {
    const currentWs = wsRef.current;
    if (!input.trim() || !currentWs || currentWs.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket не готов');
      return;
    }
    currentWs.send(JSON.stringify({
      type: 'private_message',
      data: { recipientId: userId, text: input.trim() }
    }));
    setInput('');
    currentWs.send(JSON.stringify({
      type: 'private_typing',
      data: { recipientId: userId, isTyping: false }
    }));
  };

  const sendReaction = (messageId, emoji) => {
    const currentWs = wsRef.current;
    if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;
    currentWs.send(JSON.stringify({
      type: 'private_reaction',
      data: { messageId, emoji },
    }));
    setPickerFor(null);
  };

  // Клик по сообщению → «пуньк» + открыть/закрыть пикер
  const handleMessageTap = (id, e) => {
    // если клик пришёл из пикера или его кнопок — не обрабатываем
    if (e.target.closest('.private-reaction-picker')) return;

    setPoppingId(id);
    setTimeout(() => setPoppingId(null), 380);
    setPickerFor(prev => (prev === id ? null : id));
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const currentWs = wsRef.current;
    if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;
    if (e.target.value.trim()) {
      currentWs.send(JSON.stringify({
        type: 'private_typing',
        data: { recipientId: userId, isTyping: true }
      }));
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (currentWs.readyState === WebSocket.OPEN) {
          currentWs.send(JSON.stringify({
            type: 'private_typing',
            data: { recipientId: userId, isTyping: false }
          }));
        }
      }, 1500);
    } else {
      currentWs.send(JSON.stringify({
        type: 'private_typing',
        data: { recipientId: userId, isTyping: false }
      }));
    }
  };

  return (
    <>
      <div className="blur-overlay" onClick={onClose} />
      <div className="private-chat-overlay">
        <div className="private-chat-header">
          <h4>Чат с {nickname}</h4>
          <button className="private-chat-close" onClick={onClose}>×</button>
        </div>
        <div className="private-typing">
          {localTypingUser ? `${localTypingUser} печатает...` : ''}
        </div>
        <div className="private-messages">
          {initialMessages.map((m, i) => {
            const isOwn = m.senderId === myId;
            const reactions = m.reactions || {};
            const reactionEntries = Object.entries(reactions);
            const hasReactions = reactionEntries.length > 0;
            return (
              <div
                key={i}
                className={`private-msg ${isOwn ? 'private-msg--own' : 'private-msg--other'} ${poppingId === m.id ? 'private-msg--pop' : ''} ${hasReactions ? 'private-msg--has-reactions' : ''}`}
                onClick={(e) => handleMessageTap(m.id, e)}
              >
                <span className="private-msg-nick">
                  {isOwn ? 'Я' : nickname}
                </span>
                <span className="private-msg-text">{m.text}</span>

                {hasReactions && (
                  <div className="private-msg-reactions">
                    {reactionEntries.map(([emoji, users]) => (
                      <span
                        key={`${emoji}-${users.length}`}
                        className={`private-reaction-badge ${users.includes(myId) ? 'own' : ''}`}
                      >
                        {emoji}
                        {users.length > 1 && (
                          <span className="private-reaction-count">{users.length}</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {pickerFor === m.id && (
                  <div
                    className="private-reaction-picker"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {REACTIONS.map(emoji => {
                      const isActive = reactions[emoji]?.includes(myId);
                      return (
                        <button
                          key={emoji}
                          className={isActive ? 'active' : ''}
                          onClick={() => sendReaction(m.id, emoji)}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="private-msg-footer">
                  <span className="private-msg-time">{formatTime(m.created_at)}</span>
                  <span className="private-msg-status">
                    {m.is_read ? 'прочитано' : 'не прочитано'}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="private-input-row">
          <input
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Напишите сообщение..."
          />
          <button className="btn" onClick={sendMessage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
};

export default PrivateChat;