import React, { useState } from 'react';
import { getAvatarColor, getInitial, formatMessageDate } from '../utils';

const MessageList = ({
  messages,
  isAdmin,
  deleteMessage,
  toggleReactions,
  activeMessageId,
  nickname,
  sendReaction,
  setFullscreenImage,
  messagesEndRef,
  myId,
  onEditMessage,
}) => {
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');

  const hasReactions = (message) => message?.reactions && Object.keys(message.reactions).length > 0;

  const startEdit = (message) => {
    setEditingMessageId(message.id);
    setEditText(message.text);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const saveEdit = (messageId) => {
    if (editText.trim() && editText !== messages.find(m => m.id === messageId)?.text) {
      onEditMessage(messageId, editText.trim());
    }
    cancelEdit();
  };

  const handleDeleteClick = (messageId, e) => {
    e.stopPropagation();
    if (window.confirm('Вы подтверждаете удаление этого сообщения?')) {
      deleteMessage(messageId);
    }
  };

  return (
    <div className="messages">
      {messages.map((m, i) => {
        const isOwn = m.userId === myId;
        const isEditing = editingMessageId === m.id;

        return (
          <div className="msg" key={i} onClick={() => toggleReactions(m.id)}>
            <div className="msg-avatar" style={{ background: getAvatarColor(m.nickname) }}>
              {getInitial(m.nickname)}
            </div>
            <div className="msg-content">
              <div className="msg-header">
                <span className="msg-nick">{m.nickname}</span>

                <div className="msg-actions">
                  {isOwn && (
                    <button
                      className="msg-action-btn"
                      onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                  )}
                  {(isAdmin || isOwn) && (
                    <button
                      className="msg-action-btn"
                      onClick={(e) => handleDeleteClick(m.id, e)}
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                <div className="reactions-header">
                  {hasReactions(m) && Object.entries(m.reactions).map(([emoji, users]) => (
                    <span key={emoji} className="reaction-badge">
                      {emoji} {users.length}
                    </span>
                  ))}
                </div>
                <span className="msg-time">{formatMessageDate(m.time)}</span>
              </div>

              {isEditing ? (
                <div className="msg-edit-area">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(m.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="msg-edit-input"
                  />
                  <button className="btn" onClick={(e) => { e.stopPropagation(); saveEdit(m.id); }}>
                    Сохранить
                  </button>
                  <button className="btn" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                    Отмена
                  </button>
                </div>
              ) : (
                <div className="msg-text">{m.text}</div>
              )}

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

              {activeMessageId === m.id && !isEditing && (
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
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;