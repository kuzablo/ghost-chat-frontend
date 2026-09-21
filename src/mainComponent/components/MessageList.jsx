import React, { useState, useEffect, useRef } from 'react';
import { getAvatarColor, getInitial, formatMessageDate, formatDateDivider, isNewDay } from '../utils';
import ConfirmModal from './ConfirmModal';

const DOUBLE_TAP_MS = 250;

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
  onReply,
}) => {
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [poppingId, setPoppingId] = useState(null);

  const [pickerAbove, setPickerAbove] = useState(false);

  const [swipeState, setSwipeState] = useState({ id: null, dx: 0, direction: null });
  const swipeStartRef = useRef(null);
  const swipeActiveRef = useRef(false);

  const [editRingId, setEditRingId] = useState(null);
  const longPressRef = useRef({
    timer: null,
    ringTimer: null,
    completedAt: 0,
  });
  // ВАЖНО: LONG_PRESS_EDIT_MS − RING_START_DELAY === --ring-duration-msg (Chat.css)
  const LONG_PRESS_EDIT_MS = 1500;
  const LONG_PRESS_IGNORE_MS = 500;
  // [2.31.2] кольцо появляется только на второй трети удержания
  const RING_START_DELAY = 500;

  const tapTimerRef = useRef(null);
  const lastTapRef = useRef({ id: null, time: 0, x: 0, y: 0 });
  const [heartBurst, setHeartBurst] = useState(null);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

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

  const handleConfirmDelete = () => {
    if (confirmData) {
      deleteMessage(confirmData.messageId);
      setConfirmData(null);
    }
  };

  const hasReactions = (message) => message?.reactions && Object.keys(message.reactions).length > 0;

  const didIReact = (message, emoji) =>
    !!message?.reactions?.[emoji]?.includes(nickname);

  const canDelete = (m) => isAdmin || m.userId === myId;

  const handleImageTap = (e, m) => {
    e.stopPropagation();
    if (swipeState.id === m.id) return;
    if (Date.now() - longPressRef.current.completedAt < LONG_PRESS_IGNORE_MS) return;

    const now = Date.now();
    const last = lastTapRef.current;
    const parent = e.currentTarget.parentElement;
    const rect = (parent || e.currentTarget).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isDouble =
      last.id === m.id &&
      now - last.time < DOUBLE_TAP_MS &&
      Math.abs(x - last.x) < 40 &&
      Math.abs(y - last.y) < 40;

    if (isDouble) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapRef.current = { id: null, time: 0, x: 0, y: 0 };

      const alreadyHeart = m.reactions?.['❤️']?.includes(nickname);
      if (!alreadyHeart) {
        sendReaction(m.id, '❤️');
      }

      setHeartBurst({ id: m.id, x, y, key: now });
      setTimeout(() => {
        setHeartBurst(prev => (prev && prev.key === now ? null : prev));
      }, 800);
      return;
    }

    lastTapRef.current = { id: m.id, time: now, x, y };
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      setFullscreenImage({ url: m.imageUrl, messageId: m.id });
    }, DOUBLE_TAP_MS);
  };

  const handleMessageTap = (messageId, e) => {
    if (activeMessageId === messageId) {
      toggleReactions(messageId);
      return;
    }

    setPoppingId(messageId);
    setTimeout(() => setPoppingId(null), 380);

    const cardEl = e?.currentTarget;
    const containerEl = containerRef?.current;
    if (cardEl && containerEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      const pickerHeight = 54;
      const spaceBelow = containerRect.bottom - cardRect.bottom;
      setPickerAbove(spaceBelow < pickerHeight);
    } else {
      setPickerAbove(false);
    }

    toggleReactions(messageId);
  };

  const handleQuoteClick = (replyId, e) => {
    if (e) e.stopPropagation();
    if (!replyId) return;
    const container = containerRef?.current;
    if (!container) return;
    const el = container.querySelector(`[data-msg-id="${replyId}"]`);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('msg--highlight');
    setTimeout(() => {
      el.classList.remove('msg--highlight');
    }, 1600);
  };

  const SWIPE_THRESHOLD = 60;
  const SWIPE_MAX = 80;
  const DIRECTION_LOCK = 8;

  const cancelLongPress = () => {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
    if (longPressRef.current.ringTimer) {
      clearTimeout(longPressRef.current.ringTimer);
      longPressRef.current.ringTimer = null;
    }
    setEditRingId(null);
  };

  const handleMsgTouchStart = (e, m) => {
    if (e.touches.length !== 1) return;
    if (editingMessageId === m.id) return;
    swipeStartRef.current = {
      id: m.id,
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    swipeActiveRef.current = false;

    if (m.userId === myId) {
      longPressRef.current.ringTimer = setTimeout(() => {
        longPressRef.current.ringTimer = null;
        setEditRingId(m.id);
      }, RING_START_DELAY);

      longPressRef.current.timer = setTimeout(() => {
        longPressRef.current.timer = null;
        longPressRef.current.completedAt = Date.now();
        setEditRingId(null);
        startEdit(m);
      }, LONG_PRESS_EDIT_MS);
    }
  };

  const handleMsgTouchMove = (e, m) => {
    const start = swipeStartRef.current;
    if (!start || start.id !== m.id) return;
    if (e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!swipeActiveRef.current) {
      if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;

      cancelLongPress();

      if (Math.abs(dy) > Math.abs(dx)) {
        swipeStartRef.current = null;
        return;
      }
      if (dx > 0 && !canDelete(m)) {
        swipeStartRef.current = null;
        return;
      }
      swipeActiveRef.current = true;
    }

    if (e.cancelable) e.preventDefault();

    if (dx < 0) {
      setSwipeState({ id: m.id, dx: Math.max(dx, -SWIPE_MAX), direction: 'reply' });
    } else if (dx > 0) {
      setSwipeState({ id: m.id, dx: Math.min(dx, SWIPE_MAX), direction: 'delete' });
    }
  };

  const handleMsgTouchEnd = (e, m) => {
    cancelLongPress();

    const start = swipeStartRef.current;
    if (!start || start.id !== m.id) {
      setSwipeState({ id: null, dx: 0, direction: null });
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dir = swipeState.direction;
    swipeStartRef.current = null;
    swipeActiveRef.current = false;

    if (dir === 'reply' && dx <= -SWIPE_THRESHOLD && onReply) {
      onReply(m);
    } else if (dir === 'delete' && dx >= SWIPE_THRESHOLD && canDelete(m)) {
      setConfirmData({ messageId: m.id });
    }

    setSwipeState({ id: null, dx: 0, direction: null });
  };

  const handleMsgClick = (e, m) => {
    if (swipeActiveRef.current) return;
    if (Date.now() - longPressRef.current.completedAt < LONG_PRESS_IGNORE_MS) return;
    handleMessageTap(m.id, e);
  };

  const getSwipeStyle = (m) => {
    if (swipeState.id !== m.id) return {};
    return {
      transform: `translateX(${swipeState.dx}px)`,
      transition: swipeState.dx === 0 ? 'transform 0.2s ease-out' : 'none',
    };
  };

  const getArrowOpacity = (m, dir) => {
    if (swipeState.id !== m.id) return 0;
    if (swipeState.direction !== dir) return 0;
    const abs = Math.abs(swipeState.dx);
    return Math.min(abs / SWIPE_THRESHOLD, 1);
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

          const replyBlock = m.replyTo ? (
            <div
              className="msg-reply-quote"
              onClick={(e) => handleQuoteClick(m.replyTo.id, e)}
              onTouchStart={(e) => e.stopPropagation()}
              role="button"
              tabIndex={0}
            >
              <div className="msg-reply-quote-nick">{m.replyTo.nickname}</div>
              <div className="msg-reply-quote-text">
                {m.replyTo.text || (m.replyTo.imageUrl ? '📷 фото' : '')}
              </div>
            </div>
          ) : null;

          const heartBurstNode = heartBurst && heartBurst.id === m.id ? (
            <span
              key={heartBurst.key}
              className="msg-heart-burst"
              style={{ left: heartBurst.x, top: heartBurst.y }}
            >
              ❤️
            </span>
          ) : null;

          if (isImageOnly) {
            return (
              <React.Fragment key={i}>
                {dateDivider}
                <div className="msg msg--image-only" data-msg-id={m.id}>
                  <div className="msg-avatar" style={{ background: getAvatarColor(m.nickname) }}>
                    {getInitial(m.nickname)}
                  </div>
                  <div className="msg-content msg-content--image-only">
                    {swipeState.id === m.id && swipeState.direction === 'reply' && (
                      <div
                        className="msg-reply-arrow"
                        style={{ opacity: getArrowOpacity(m, 'reply') }}
                      >
                        ↩
                      </div>
                    )}
                    {swipeState.id === m.id && swipeState.direction === 'delete' && (
                      <div
                        className="msg-delete-arrow"
                        style={{ opacity: getArrowOpacity(m, 'delete') }}
                      >
                        🗑
                      </div>
                    )}

                    <div
                      className="msg-image-only-wrap"
                      style={getSwipeStyle(m)}
                      onTouchStart={(e) => handleMsgTouchStart(e, m)}
                      onTouchMove={(e) => handleMsgTouchMove(e, m)}
                      onTouchEnd={(e) => handleMsgTouchEnd(e, m)}
                    >
                      {editRingId === m.id && <div className="msg-edit-ring" />}

                      {replyBlock && (
                        <div className="msg-image-only-reply-wrap">{replyBlock}</div>
                      )}
                      <img
                        src={m.imageUrl}
                        alt="photo"
                        className="msg-image-only-img"
                        loading="lazy"
                        draggable={false}
                        onError={(e) => {
                          console.error('❌ Ошибка загрузки фото:', m.imageUrl);
                          e.target.style.display = 'none';
                        }}
                        onClick={(e) => handleImageTap(e, m)}
                      />
                      {heartBurstNode}

                      <div className="msg-image-overlay">
                        <span className="msg-nick msg-nick--overlay">{m.nickname}</span>

                        <div className="msg-actions msg-actions--overlay">
                          {isOwn && (
                            <button
                              className="msg-action-btn msg-action-btn--overlay msg-action-btn--edit"
                              onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                              title="Редактировать"
                            >
                              ✏️
                            </button>
                          )}
                          {canDelete(m) && (
                            <button
                              className="msg-action-btn msg-action-btn--overlay msg-action-btn--delete"
                              onClick={(e) => { e.stopPropagation(); setConfirmData({ messageId: m.id }); }}
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
                    </div>

                    {hasReactions(m) && (
                      <div
                        className={`msg-image-only-reactions ${
                          activeMessageId === m.id ? 'msg-image-only-reactions--above-picker' : ''
                        }`}
                      >
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
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={i}>
              {dateDivider}
              <div className="msg" data-msg-id={m.id}>
                <div className="msg-avatar" style={{ background: getAvatarColor(m.nickname) }}>
                  {getInitial(m.nickname)}
                </div>
                <div
                  className={`msg-content ${poppingId === m.id ? 'msg-content--pop' : ''} ${activeMessageId === m.id ? 'msg-content--picker-open' : ''}`}
                  style={getSwipeStyle(m)}
                  onClick={(e) => handleMsgClick(e, m)}
                  onTouchStart={(e) => handleMsgTouchStart(e, m)}
                  onTouchMove={(e) => handleMsgTouchMove(e, m)}
                  onTouchEnd={(e) => handleMsgTouchEnd(e, m)}
                >
                  {swipeState.id === m.id && swipeState.direction === 'reply' && (
                    <div
                      className="msg-reply-arrow"
                      style={{ opacity: getArrowOpacity(m, 'reply') }}
                    >
                      ↩
                    </div>
                  )}
                  {swipeState.id === m.id && swipeState.direction === 'delete' && (
                    <div
                      className="msg-delete-arrow"
                      style={{ opacity: getArrowOpacity(m, 'delete') }}
                    >
                      🗑
                    </div>
                  )}

                  {editRingId === m.id && <div className="msg-edit-ring" />}

                  <div className="msg-header">
                    <span className="msg-nick">{m.nickname}</span>

                    <div className="msg-actions">
                      {isOwn && (
                        <button
                          className="msg-action-btn msg-action-btn--edit"
                          onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                          title="Редактировать"
                        >
                          ✏️
                        </button>
                      )}
                      {canDelete(m) && (
                        <button
                          className="msg-action-btn msg-action-btn--delete"
                          onClick={(e) => { e.stopPropagation(); setConfirmData({ messageId: m.id }); }}
                          title="Удалить"
                        >
                          🗑️
                        </button>
                      )}
                    </div>

                    <span className="msg-time">{formatMessageDate(m.time)}</span>
                  </div>

                  {replyBlock}

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
                        draggable={false}
                        onError={(e) => {
                          console.error('❌ Ошибка загрузки фото:', m.imageUrl);
                          e.target.style.display = 'none';
                        }}
                        onClick={(e) => handleImageTap(e, m)}
                      />
                      {heartBurstNode}
                    </div>
                  )}

                  {hasReactions(m) && (
                    <div
                      className={`msg-reactions ${
                        activeMessageId === m.id ? 'msg-reactions--above-picker' : ''
                      }`}
                    >
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

                  {activeMessageId === m.id && !isEditingThis && (
                    <div
                      className={`msg-reaction-picker ${pickerAbove ? 'msg-reaction-picker--top' : ''}`}
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
                              toggleReactions(m.id);
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