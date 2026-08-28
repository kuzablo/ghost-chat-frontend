import React, { useState, useEffect } from 'react';
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
  const [isEditing, setIsEditing] = useState(false);

  // Блокировка скролла
  useEffect(() => {
    if (isEditing) {
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      // Блокируем скролл через touchmove
      const preventTouchMove = (e) => {
        if (e.target.closest('.msg-edit-area')) return;
        e.preventDefault();
      };
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = '';
        document.removeEventListener('touchmove', preventTouchMove);
      };
    }
  }, [isEditing]);

  const startEdit = (message) => {
    setEditingMessageId(message.id);
    setEditText(message.text);
    setIsEditing(true);
    // Принудительно скроллим к началу, чтобы инпут не уезжал
    window.scrollTo(0, 0);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
    setIsEditing(false);
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

  const hasReactions = (message) => message?.reactions && Object.keys(message.reactions).length > 0;

  return (
    <div className="messages">
      {messages.map((m, i) => {
        const isOwn = m.userId === myId;
        const isEditingThis = editingMessageId === m.id;

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

              {isEditingThis ? (
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
                    inputMode="text"
                    style={{ touchAction: 'manipulation' }}
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

              {activeMessageId === m.id && !isEditingThis && (
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