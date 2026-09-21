import { useRef, useState, useEffect } from 'react';
import { formatTime } from '../utils';
import ChatInput from './ChatInput';

const REACTIONS = ['👍', '👎', '❤️', '🔥', '😢'];
const PICKER_AUTOHIDE_MS = 2000;

/*
  [2.32.20] скролл вниз только при новом последнем сообщении,
            не при реакции/редактировании
  [2.32.19] пикер реакций автоскрывается через 2 сек
  [2.29.3] без плавного скролла при открытии
  [2.26.1] <input> заменён на ChatInput
  [2.19.4] PrivateChat принимает sendMessage
*/
const PrivateChat = ({
  userId,
  nickname,
  myId,
  sendMessage,
  onClose,
  initialMessages = [],
  typingUser = null,
}) => {
  const [input, setInput] = useState('');
  const [localTypingUser, setLocalTypingUser] = useState(typingUser);
  const [pickerFor, setPickerFor] = useState(null);
  const [poppingId, setPoppingId] = useState(null);
  const [pickerAbove, setPickerAbove] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastMsgIdRef = useRef(null);

  useEffect(() => {
    setLocalTypingUser(typingUser);
  }, [typingUser]);

  // [2.32.19] автоскрытие пикера
  useEffect(() => {
    if (!pickerFor) return;
    const t = setTimeout(() => setPickerFor(null), PICKER_AUTOHIDE_MS);
    return () => clearTimeout(t);
  }, [pickerFor]);

  // [2.32.20] скролл только при новом последнем сообщении
  useEffect(() => {
    const last = initialMessages[initialMessages.length - 1];
    const lastId = last?.id ?? null;
    if (lastId === lastMsgIdRef.current) return;
    lastMsgIdRef.current = lastId;

    const id = requestAnimationFrame(() => {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [initialMessages]);

  const handleSend = () => {
    if (!input.trim()) return;
    if (!sendMessage) {
      console.warn('sendMessage не передан в PrivateChat');
      return;
    }
    const ok = sendMessage({
      type: 'private_message',
      data: { recipientId: userId, text: input.trim() },
    });
    if (!ok) {
      console.warn('WebSocket не готов');
      return;
    }
    setInput('');
    sendMessage({
      type: 'private_typing',
      data: { recipientId: userId, isTyping: false },
    });
  };

  const sendReaction = (messageId, emoji) => {
    if (!sendMessage) return;
    sendMessage({
      type: 'private_reaction',
      data: { messageId, emoji },
    });
    setPickerFor(null);
  };

  const handleMessageTap = (id, e) => {
    if (e.target.closest('.private-reaction-picker')) return;

    if (pickerFor === id) {
      setPickerFor(null);
      return;
    }

    setPoppingId(id);
    setTimeout(() => setPoppingId(null), 380);

    const cardEl = e.currentTarget;
    const containerEl = messagesContainerRef.current;
    if (cardEl && containerEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      const pickerHeight = 54;
      const spaceBelow = containerRect.bottom - cardRect.bottom;
      setPickerAbove(spaceBelow < pickerHeight);
    } else {
      setPickerAbove(false);
    }

    setPickerFor(id);
  };

  const handlePrivateInput = (text) => {
    setInput(text);
    if (!sendMessage) return;
    if (text.trim()) {
      sendMessage({
        type: 'private_typing',
        data: { recipientId: userId, isTyping: true },
      });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendMessage({
          type: 'private_typing',
          data: { recipientId: userId, isTyping: false },
        });
      }, 1500);
    } else {
      sendMessage({
        type: 'private_typing',
        data: { recipientId: userId, isTyping: false },
      });
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
        <div className="private-messages" ref={messagesContainerRef}>
          {initialMessages.map((m, i) => {
            const isOwn = m.senderId === myId;
            const reactions = m.reactions || {};
            const reactionEntries = Object.entries(reactions);
            const hasReactions = reactionEntries.length > 0;
            return (
              <div
                key={i}
                className={`private-msg ${isOwn ? 'private-msg--own' : 'private-msg--other'} ${poppingId === m.id ? 'private-msg--pop' : ''} ${hasReactions ? 'private-msg--has-reactions' : ''} ${pickerFor === m.id ? 'private-msg--picker-open' : ''}`}
                onClick={(e) => handleMessageTap(m.id, e)}
              >
                <span className="private-msg-nick">
                  {isOwn ? 'Я' : nickname}
                </span>

                <div className="private-msg-text-wrap">
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
                </div>

                {pickerFor === m.id && (
                  <div
                    className={`private-reaction-picker ${pickerAbove ? 'private-reaction-picker--top' : ''}`}
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
          <ChatInput
            value={input}
            onChange={handlePrivateInput}
            onSend={handleSend}
            placeholder="Напишите сообщение..."
            draftKey={null}
          />
          <button className="btn" onClick={handleSend}>
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