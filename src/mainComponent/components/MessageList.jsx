import React from 'react';
import { getAvatarColor, getInitial, formatTime } from '../utils';

const MessageList = ({
  messages,
  isAdmin,
  deleteMessage,
  toggleReactions,
  activeMessageId,
  nickname,
  sendReaction,
  setFullscreenImage,
}) => {
  const hasReactions = (message) => message?.reactions && Object.keys(message.reactions).length > 0;

  return (
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
  );
};

export default MessageList;