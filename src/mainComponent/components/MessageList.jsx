import React, { useState, useEffect } from 'react';
import { getAvatarColor, getInitial, formatMessageDate, formatDateDivider, isNewDay } from '../utils';
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
  containerRef,
}) => {
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // [правка 2.14.19] pop-анимация при тапе по сообщению — как в приватном чате
  const [poppingId, setPoppingId] = useState(null);

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
    setTimeout(() => window.scrollTo(0, 0), 50);
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

  const didIReact = (message, emoji) =>
    !!message?.reactions?.[emoji]?.includes(nickname);

  // [правка 2.14.19] тап по сообщению = pop + toggle пикера
  // (та же логика, что handleMessageTap в PrivateChat.jsx)
  const handleMessageTap = (messageId) => {
    setPoppingId(messageId);
    setTimeout(() => setPoppingId(null), 380);
    toggleReactions(messageId);
  };

  return (
    <>
      <div className="messages" ref={containerRef}>
        {messages.map((m, i) => {
          const isOwn = m.userId === myId;
          const isEditingThis = editingMessageId === m.id;
          const isImageOnly = !m.text?.trim() && !!m.imageUrl && !isEditingThis;
          const prevMessage = messages[i - 1];
          const showDateDivider = isNewDay(prevMessage?.time, m.time);

          const dateDivider = showDateDivider ? (
            <div className="date-divider" key={`date-${m.id}`}>
              <span>{formatDateDivider(m.time)}</span>
            </div>
          ) : null;

          // ==== Image-only ====
          // [правка 2.14.18]
          //  - время вынесено вниз-справа с градиентом (Telegram-style);
          //  - реакции — под карточкой, вылезают за нижнюю границу,
          //    визуал скопирован с private-reaction-badge (круглые 15×15);
          //  - верхний оверлей: только ник + действия.
          if (isImageOnly) {
            return (
              <React.Fragment key={i}>
                {dateDivider}
                <div className="msg msg--image-only">
                  <div className="msg-avatar" style={{ background: getAvatarColor(m.nickname) }}>
                    {getInitial(m.nickname)}
                  </div>
                  <div className="msg-content msg-content--image-only">
                    <div className="msg-image-only-wrap">
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
                          setFullscreenImage({ url: m.imageUrl, messageId: m.id });
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
                      </div>

                      <div className="msg-image-bottom-overlay">
                        <span className="msg-time msg-time--bottom">
                          {formatMessageDate(m.time)}
                        </span>
                      </div>

                      {hasReactions(m) && (
                        <div className="msg-image-only-reactions">
                          {Object.entries(m.reactions).map(([emoji, users]) => (
                            <span
                              key={emoji}
                              className={`image-only-reaction-badge ${users.includes(nickname) ? 'own' : ''}`}
                            >
                              {emoji}
                              {users.length > 1 && (
                                <span className="image-only-reaction-count">{users.length}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          }

          // ==== Обычное сообщение ====
          // [правка 2.14.19] реакции и пикер — под карточкой, как в личке:
          //   - бейджи .msg-reaction-badge (круглые 15×15, вылезают за границу);
          //   - пикер .msg-reaction-picker — 5 эмодзи, появляется под карточкой;
          //   - pop-анимация карточки при тапе;
          //   - из шапки убраны .reactions-header и .reactions-panel.
          return (
            <React.Fragment key={i}>
              {dateDivider}
              <div className="msg">
                <div className="msg-avatar" style={{ background: getAvatarColor(m.nickname) }}>
                  {getInitial(m.nickname)}
                </div>
                <div
                  className={`msg-content ${poppingId === m.id ? 'msg-content--pop' : ''} ${activeMessageId === m.id ? 'msg-content--picker-open' : ''}`}
                  onClick={() => handleMessageTap(m.id)}
                >
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
                        style={{ touchAction: 'manipulation', fontSize: '16px' }}
                        onFocus={() => setTimeout(() => window.scrollTo(0, 0), 10)}
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
                          setFullscreenImage({ url: m.imageUrl, messageId: m.id });
                        }}
                      />
                    </div>
                  )}

                  {/* реакции — под карточкой, вылезают за нижнюю границу */}
                  {hasReactions(m) && (
                    <div className="msg-reactions">
                      {Object.entries(m.reactions).map(([emoji, users]) => (
                        <span
                          key={emoji}
                          className={`msg-reaction-badge ${users.includes(nickname) ? 'own' : ''}`}
                        >
                          {emoji}
                          {users.length > 1 && (
                            <span className="msg-reaction-count">{users.length}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* пикер реакций — 5 эмодзи, как в личке */}
                  {activeMessageId === m.id && !isEditingThis && (
                    <div
                      className="msg-reaction-picker"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {['👍', '👎', '❤️', '🔥', '😢'].map(emoji => {
                        const isActive = didIReact(m, emoji);
                        return (
                          <button
                            key={emoji}
                            className={isActive ? 'active' : ''}
                            onClick={() => {
                              sendReaction(m.id, emoji);
                              toggleReactions(m.id); // [правка 2.14.21] закрываем пикер после выбора — как в личке
                            }}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
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