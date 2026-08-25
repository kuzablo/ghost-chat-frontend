import { useEffect, useRef, useState } from 'react';

const PrivateChat = ({ 
  userId, 
  nickname, 
  myId, 
  ws, 
  onClose,
  initialMessages = [],
  typingUser = null,
  onTyping,
}) => {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [localTypingUser, setLocalTypingUser] = useState(typingUser);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setLocalTypingUser(typingUser);
  }, [typingUser]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'private_message',
      data: { recipientId: userId, text: input.trim() }
    }));
    setInput('');
    ws.send(JSON.stringify({
      type: 'private_typing',
      data: { recipientId: userId, isTyping: false }
    }));
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (e.target.value.trim()) {
      ws.send(JSON.stringify({
        type: 'private_typing',
        data: { recipientId: userId, isTyping: true }
      }));
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'private_typing',
            data: { recipientId: userId, isTyping: false }
          }));
        }
      }, 1500);
    } else {
      ws.send(JSON.stringify({
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
          {messages.map((m, i) => (
            <div key={i} className="private-msg">
              <span className="private-msg-nick">
                {m.senderId === myId ? 'Я' : nickname}
              </span>
              <span className="private-msg-text">{m.text}</span>
            </div>
          ))}
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