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

  // Блокировка скролла и зума
  useEffect(() => {
    if (isEditing) {
      const html = document.documentElement;
      const body = document.body;
      const scrollY = window.scrollY;
      // Сохраняем текущий скролл
      html.style.setProperty('--scroll-y', `${scrollY}px`);
      // Блокируем
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.width = '100%';
      body.style.height = '100%';
      // Отключаем зум
      const metaViewport = document.querySelector('meta[name=viewport]');
      if (metaViewport) {
        metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      } else {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        document.head.appendChild(meta);
      }
      // Принудительно скроллим вверх
      window.scrollTo(0, 0);

      return () => {
        // Восстанавливаем
        const scrollY = parseInt(html.style.getPropertyValue('--scroll-y')) || 0;
        html.style.overflow = '';
        body.style.overflow = '';
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.width = '';
        body.style.height = '';
        window.scrollTo(0, scrollY);
        // Восстанавливаем viewport
        if (metaViewport) {
          metaViewport.content = 'width=device-width, initial-scale=1.0';
        }
      };
    }
  }, [isEditing]);

  const startEdit = (message) => {
    setEditingMessageId(message.id);
    setEditText(message.text);
    setIsEditing(true);
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