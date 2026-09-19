import React, { useState, useEffect } from 'react';
import { getAvatarColor, getInitial, formatMessageDate } from '../utils';
import ConfirmModal from './ConfirmModal';

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
  const [confirmData, setConfirmData] = useState(null); // { messageId }

  // Блокировка скролла и зума на время редактирования
  useEffect(() => {
    if (isEditing) {
      const html = document.documentElement;
      const body = document.body;

      const scrollY = window.scrollY;
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.width = '100%';
      body.style.height = '100%';
      body.style.transform = 'scale(1)';

      const metaViewport = document.querySelector('meta[name=viewport]');
      if (metaViewport) {
        metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      } else {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        document.head.appendChild(meta);
      }

      window.scrollTo(0, 0);

      return () => {
        const savedScrollY = parseInt(body.style.top) || 0;
        html.style.overflow = '';
        body.style.overflow = '';
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.width = '';
        body.style.height = '';
        body.style.transform = '';
        window.scrollTo(0, Math.abs(savedScrollY));

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
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
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
    setConfirmData({ messageId });
  };

  const handleConfirmDelete = () => {
    if (confirmData) {
      deleteMessage(confirmData.messageId);
      setConfirmData(null);
    }
  };

  const hasReactions = (message) => message?.reactions && Object.keys(message.reactions).length > 0;

  return (
    <>
      <div className="messages">
        {messages.map((m, i) => {
          const isOwn = m.userId === myId;
          const isEditingThis = editingMessageId === m.id;
          const isImageOnly = !m.text?.trim() && !!m.imageUrl && !isEditingThis;

          // ==== Image-only: изображение вместо бабла, оверлей поверх ====
          if (isImageOnly) {
            return (
              <div className="msg msg--image-only" key={i} onClick={() => toggleReactions(m.id)}>
                <div className="msg-avatar" style={{ background: getAvatarColor(m.nickname) }}>
                  {getInitial(m.nickname)}
                </div>
                <div className="msg-content msg-content--image-only">
                  <img
                    src={m.imageUrl}
                    alt="photo"
                    className="msg-image-only-img"
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

                  <div className="msg-image-overlay">
                    <span className="msg-nick msg-nick--overlay">{m.nickname}</span>

                    <div className="msg-actions msg-actions--overlay">
                      {isOwn && (
                        <button
                          className="msg-action-btn msg-action-btn--overlay"
                          onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                          title="Редактировать"
                        >
                          ✏️
                        </button>
                      )}
                      {(isAdmin || isOwn) && (
                        <button
                          className="msg-action-btn msg-action-btn--overlay"
                          onClick={(e) => handleDeleteClick(m.id, e)}
                          title="Удалить"
                        >
                          🗑️
                        </button>
                      )}
                    </div>

                    <div className="reactions-header reactions-header--overlay">
                      {hasReactions(m) && Object.entries(m.reactions).map(([emoji, users]) => (
                        <span key={emoji} className="reaction-badge reaction-badge--overlay">
                          {emoji} {users.length}
                        </span>
                      ))}
                    </div>

                    <span className="msg-time msg-time--overlay">{formatMessageDate(m.time)}</span>
                  </div>

                  {activeMessageId === m.id && (
                    <div className="reactions-panel reactions-panel--below">
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
          }

          // ==== Обычное сообщение ====
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
                      enterKeyHint="done"
                      style={{
                        touchAction: 'manipulation',
                        fontSize: '16px',
                      }}
                      onFocus={() => {
                        setTimeout(() => window.scrollTo(0, 0), 10);
                      }}
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

      <ConfirmModal
        open={!!confirmData}
        title="Удалить сообщение?"
        description="Вы подтверждаете удаление этого сообщения?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmData(null)}
      />
    </>
  );
};

export default MessageList;