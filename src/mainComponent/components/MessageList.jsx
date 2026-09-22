import React, { useState, useEffect, useRef, memo } from 'react';
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
  avatarByUser = {},
  bannedUsers = new Set(),
}) => {
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [poppingId, setPoppingId] = useState(null);

  const [pickerAbove, setPickerAbove] = useState(false);

  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    direction: null,
    cardEl: null,
    replyGlowEl: null,
    deleteGlowEl: null,
    ready: false,
    msg: null,
  });
  const swipeActiveRef = useRef(false);

  const [editRingId, setEditRingId] = useState(null);
  const longPressRef = useRef({
    timer: null,
    ringTimer: null,
    completedAt: 0,
  });
  const LONG_PRESS_EDIT_MS = 1500;
  const LONG_PRESS_IGNORE_MS = 500;
  const RING_START_DELAY = 500;

  const tapTimerRef = useRef(null);
  const lastTapRef = useRef({ id: null, time: 0, x: 0, y: 0 });
  const [heartBurst, setHeartBurst] = useState(null);

  const editTextareaRef = useRef(null);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = editTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [editText, editingMessageId]);

  const startEdit = (message) => {
    if (message?.stickerUrl) return;
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
    const original = messages.find(m => m.id === messageId);
    const nextText = editText.trim();
    const changed = nextText !== (original?.text || '');
    const allowed = nextText.length > 0 || !!original?.imageUrl;

    if (changed && allowed) {
      onEditMessage(messageId, nextText);
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
    if (swipeActiveRef.current) return;
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

  const resetSwipeVisual = (cardEl, replyGlowEl, deleteGlowEl) => {
    if (cardEl) {
      cardEl.style.transition = 'transform 0.2s ease-out';
      cardEl.style.transform = '';
      cardEl.classList.remove('msg-content--ready-reply');
      cardEl.classList.remove('msg-content--ready-delete');
      setTimeout(() => {
        if (cardEl) cardEl.style.transition = '';
      }, 220);
    }
    if (replyGlowEl) replyGlowEl.style.opacity = '0';
    if (deleteGlowEl) deleteGlowEl.style.opacity = '0';
  };

  const handleMsgTouchStart = (e, m) => {
    if (e.touches.length !== 1) return;
    if (editingMessageId === m.id) return;

    const t = e.touches[0];
    const card = e.currentTarget;

    const msgEl = card.closest('.msg');
    const replyGlow = msgEl?.querySelector('.msg-swipe-glow--reply') || null;
    const deleteGlow = msgEl?.querySelector('.msg-swipe-glow--delete') || null;

    const r = swipeRef.current;
    r.active = true;
    r.startX = t.clientX;
    r.startY = t.clientY;
    r.direction = null;
    r.cardEl = card;
    r.replyGlowEl = replyGlow;
    r.deleteGlowEl = deleteGlow;
    r.ready = false;
    r.msg = m;
    swipeActiveRef.current = false;

    if (card) {
      card.style.transition = 'none';
      card.style.transform = '';
    }

    if (m.userId === myId && !m.stickerUrl) {
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
    const r = swipeRef.current;
    if (!r.active) return;
    if (e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - r.startX;
    const dy = t.clientY - r.startY;

    if (!r.direction) {
      if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;

      cancelLongPress();

      if (Math.abs(dy) > Math.abs(dx)) {
        r.active = false;
        r.cardEl = null;
        return;
      }

      if (dx < 0 && m.stickerUrl) {
        r.active = false;
        r.cardEl = null;
        return;
      }

      if (dx > 0 && !canDelete(m)) {
        r.active = false;
        r.cardEl = null;
        return;
      }
      r.direction = dx < 0 ? 'reply' : 'delete';
      swipeActiveRef.current = true;
    }

    if (e.cancelable) e.preventDefault();

    if (r.direction === 'reply') {
      const off = Math.max(dx, -SWIPE_MAX);
      if (r.cardEl) {
        r.cardEl.style.transition = 'none';
        r.cardEl.style.transform = `translateX(${off}px)`;
      }
      if (r.replyGlowEl) {
        const op = Math.min(Math.abs(off) / SWIPE_THRESHOLD, 1);
        r.replyGlowEl.style.opacity = String(op);
      }
    } else if (r.direction === 'delete') {
      const off = Math.min(dx, SWIPE_MAX);
      if (r.cardEl) {
        r.cardEl.style.transition = 'none';
        r.cardEl.style.transform = `translateX(${off}px)`;
      }
      if (r.deleteGlowEl) {
        const op = Math.min(Math.abs(off) / SWIPE_THRESHOLD, 1);
        r.deleteGlowEl.style.opacity = String(op);
      }
    }

    const abs = Math.abs(dx);
    const nextReady = abs >= SWIPE_THRESHOLD;
    if (nextReady !== r.ready) {
      r.ready = nextReady;
      if (r.cardEl) {
        if (r.direction === 'reply') {
          r.cardEl.classList.toggle('msg-content--ready-reply', nextReady);
        } else if (r.direction === 'delete') {
          r.cardEl.classList.toggle('msg-content--ready-delete', nextReady);
        }
      }
    }
  };

  const handleMsgTouchEnd = (e, m) => {
    cancelLongPress();

    const r = swipeRef.current;
    if (!r.active && !r.cardEl) {
      return;
    }

    const t = e.changedTouches[0];
    const dx = t.clientX - r.startX;
    const dir = r.direction;

    const cardEl = r.cardEl;
    const replyGlowEl = r.replyGlowEl;
    const deleteGlowEl = r.deleteGlowEl;

    r.active = false;
    r.direction = null;
    r.cardEl = null;
    r.replyGlowEl = null;
    r.deleteGlowEl = null;
    r.ready = false;
    r.msg = null;

    if (dir === 'reply' && dx <= -SWIPE_THRESHOLD && onReply && !m.stickerUrl) {
      resetSwipeVisual(cardEl, replyGlowEl, deleteGlowEl);
      onReply(m);
    } else if (dir === 'delete' && dx >= SWIPE_THRESHOLD && canDelete(m)) {
      resetSwipeVisual(cardEl, replyGlowEl, deleteGlowEl);
      setConfirmData({ messageId: m.id });
    } else {
      resetSwipeVisual(cardEl, replyGlowEl, deleteGlowEl);
    }

    setTimeout(() => { swipeActiveRef.current = false; }, 50);
  };

  const handleMsgClick = (e, m) => {
    if (swipeActiveRef.current) return;
    if (Date.now() - longPressRef.current.completedAt < LONG_PRESS_IGNORE_MS) return;
    handleMessageTap(m.id, e);
  };

  const renderMsgAvatar = (userId, nick) => {
    const url = avatarByUser[userId];
    const isBanned = bannedUsers.has(userId);
    return (
      <div
        className={`msg-avatar${isBanned ? ' msg-avatar--banned' : ''}`}
        style={url
          ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: getAvatarColor(nick) }
        }
      >
        {!url && getInitial(nick)}
        {isBanned && (
          <span className="msg-avatar-banned-badge" aria-hidden="true">🚫</span>
        )}
      </div>
    );
  };

  const sameMinute = (t1, t2) => {
    const d1 = new Date(t1);
    const d2 = new Date(t2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate() &&
      d1.getHours() === d2.getHours() &&
      d1.getMinutes() === d2.getMinutes()
    );
  };

  const isGroupable = (a, b) => {
    if (!a || !b) return false;
    if (a.userId !== b.userId) return false;
    if (!sameMinute(a.time, b.time)) return false;
    if (b.replyTo) return false;
    if (editingMessageId && (a.id === editingMessageId || b.id === editingMessageId)) return false;

    const aImageOnly = !a.text?.trim() && !!a.imageUrl;
    const bImageOnly = !b.text?.trim() && !!b.imageUrl;
    if (aImageOnly || bImageOnly) return false;

    if (a.stickerUrl || b.stickerUrl) return false;

    return true;
  };

  return (
    <>
      <div className="messages" ref={containerRef}>
        {messages.map((m, i) => {
          const isOwn = m.userId === myId;
          const isEditingThis = editingMessageId === m.id;
          const isSticker = !!m.stickerUrl;
          const isImageOnly = !isSticker && !m.text?.trim() && !!m.imageUrl && !isEditingThis;
          const prevMessage = messages[i - 1];
          const nextMessage = messages[i + 1];
          const showDateDivider = isNewDay(prevMessage?.time, m.time);

          const isGroupStart = !isGroupable(prevMessage, m);
          const isGroupEnd = !isGroupable(m, nextMessage);
          const isInGroup = !isGroupStart || !isGroupEnd;

          const dateDivider = showDateDivider ? (
            <div className="date-divider" key={`date-${m.id}`}>
              <span>{formatDateDivider(m.time)}</span>
            </div>
          ) : null;

          if (isSticker) {
            return (
              <React.Fragment key={m.id}>
                {dateDivider}
                <div
                  className={`msg msg--sticker ${isOwn ? 'msg--own' : 'msg--other'}`}
                  data-msg-id={m.id}
                >
                  <div className="msg-swipe-glow msg-swipe-glow--delete" />
                  <div
                    className="msg-sticker-wrap"
                    onTouchStart={(e) => handleMsgTouchStart(e, m)}
                    onTouchMove={(e) => handleMsgTouchMove(e, m)}
                    onTouchEnd={(e) => handleMsgTouchEnd(e, m)}
                  >
                    <div className="msg-sticker-nick">{m.nickname}</div>
                    <img
                      src={m.stickerUrl}
                      alt=""
                      className="msg-sticker-img"
                      draggable={false}
                      loading="lazy"
                    />
                  </div>
                </div>
              </React.Fragment>
            );
          }

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
              <React.Fragment key={m.id}>
                {dateDivider}
                <div
                  className={`msg msg--image-only ${isOwn ? 'msg--own' : 'msg--other'}`}
                  data-msg-id={m.id}
                >
                  {renderMsgAvatar(m.userId, m.nickname)}

                  <div className="msg-swipe-glow msg-swipe-glow--reply" />
                  <div className="msg-swipe-glow msg-swipe-glow--delete" />

                  <div className="msg-content msg-content--image-only">
                    <div
                      className="msg-image-only-wrap"
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
            <React.Fragment key={m.id}>
              {dateDivider}
              <div
                className={[
                  'msg',
                  isOwn ? 'msg--own' : 'msg--other',
                  isInGroup ? 'msg--in-group' : '',
                  isGroupStart ? 'msg--group-start' : '',
                  isGroupEnd ? 'msg--group-end' : '',
                ].filter(Boolean).join(' ')}
                data-msg-id={m.id}
              >
                {isGroupStart ? renderMsgAvatar(m.userId, m.nickname) : (
                  <div className="msg-avatar msg-avatar--placeholder" />
                )}

                <div className="msg-swipe-glow msg-swipe-glow--reply" />
                <div className="msg-swipe-glow msg-swipe-glow--delete" />

                <div
                  className={`msg-content ${poppingId === m.id ? 'msg-content--pop' : ''} ${activeMessageId === m.id ? 'msg-content--picker-open' : ''} ${isEditingThis ? 'msg-content--editing' : ''}`}
                  onClick={(e) => handleMsgClick(e, m)}
                  onTouchStart={(e) => handleMsgTouchStart(e, m)}
                  onTouchMove={(e) => handleMsgTouchMove(e, m)}
                  onTouchEnd={(e) => handleMsgTouchEnd(e, m)}
                >
                  {editRingId === m.id && <div className="msg-edit-ring" />}

                  {isGroupStart && (
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
                  )}

                  {replyBlock}

                  {isEditingThis ? (
                    <div className="msg-edit-area">
                      <textarea
                        ref={editTextareaRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit(m.id);
                          }
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="msg-edit-input msg-edit-textarea"
                        rows={1}
                        inputMode="text"
                        enterKeyHint="done"
                      />
                      <div className="msg-edit-actions">
                        <button
                          className="btn msg-edit-btn msg-edit-btn--cancel"
                          onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                        >
                          Отмена
                        </button>
                        <button
                          className="btn msg-edit-btn msg-edit-btn--save"
                          onClick={(e) => { e.stopPropagation(); saveEdit(m.id); }}
                        >
                          Сохранить
                        </button>
                      </div>
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

export default memo(MessageList);