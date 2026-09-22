import { useRef, useState, useEffect } from 'react';
import { formatTime } from '../utils';
import ChatInput from './ChatInput';
import InstagramCard, { extractInstagramUrl } from './InstagramCard';
import StickerPanel from './StickerPanel';

const REACTIONS = ['👍', '👎', '❤️', '🔥', '😢'];
const PICKER_AUTOHIDE_MS = 2000;
const MAX_UPLOAD_MB = 25;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const SWIPE_THRESHOLD = 90;
const SWIPE_MAX = 220;
const DIRECTION_LOCK = 10;

/*
  [2.35.41] Свайп-закрытие, фон из dialogsBg, маскот загрузки
  [2.35.21] input-icon-btn
  [2.35.16] стикеры
*/

const StickerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h7l7-7V6a3 3 0 0 0-3-3z" />
    <path d="M13 21v-5a3 3 0 0 1 3-3h5" />
  </svg>
);

const ClipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const getBgCss = (bg) => {
  if (!bg) return null;
  if (bg.startsWith('preset:')) {
    return null;
  }
  if (bg.startsWith('url:')) {
    return `url(${bg.slice('url:'.length)})`;
  }
  return null;
};

const isUrlBg = (bg) => !!(bg && bg.startsWith('url:'));

const PrivateChat = ({
  userId,
  nickname,
  myId,
  sendMessage,
  onClose,
  initialMessages = [],
  historyLoaded = true,
  dialogsBg = null,
  typingUser = null,
  stickers = [],
  isAdmin = false,
  token = '',
  onStickersUpdated,
}) => {
  const [input, setInput] = useState('');
  const [localTypingUser, setLocalTypingUser] = useState(typingUser);
  const [pickerFor, setPickerFor] = useState(null);
  const [poppingId, setPoppingId] = useState(null);
  const [pickerAbove, setPickerAbove] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [stickerPanelOpen, setStickerPanelOpen] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastMsgIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);

  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    direction: null,
    lastDx: 0,
  });

  useEffect(() => {
    setLocalTypingUser(typingUser);
  }, [typingUser]);

  useEffect(() => {
    if (!pickerFor) return;
    const t = setTimeout(() => setPickerFor(null), PICKER_AUTOHIDE_MS);
    return () => clearTimeout(t);
  }, [pickerFor]);

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

  // Преload URL-фона
  useEffect(() => {
    const isUrl = isUrlBg(dialogsBg);
    if (!isUrl) {
      setBgLoaded(true);
      return;
    }
    setBgLoaded(false);
    const url = dialogsBg.slice('url:'.length);
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.onerror = () => setBgLoaded(true);
    img.src = url;
    return () => { img.onload = null; img.onerror = null; };
  }, [dialogsBg]);

  // ===== Свайп-закрытие =====
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const s = swipeRef.current;
    s.active = true;
    s.startX = t.clientX;
    s.startY = t.clientY;
    s.direction = null;
    s.lastDx = 0;
    if (panelRef.current) panelRef.current.style.transition = 'none';
  };

  const handleTouchMove = (e) => {
    const s = swipeRef.current;
    if (!s.active) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - s.startX;
    const dy = t.clientY - s.startY;

    if (!s.direction) {
      if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
      s.direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    if (s.direction === 'vertical') return;

    const off = Math.min(Math.abs(dx), SWIPE_MAX);
    s.lastDx = off;
    if (panelRef.current) {
      const sign = dx > 0 ? 1 : -1;
      panelRef.current.style.transform = `translateX(calc(-50% + ${sign * off}px))`;
      panelRef.current.style.opacity = String(Math.max(0.35, 1 - off / 400));
    }
    if (e.cancelable) e.preventDefault();
  };

  const handleTouchEnd = () => {
    const s = swipeRef.current;
    if (!s.active) return;
    s.active = false;

    if (s.direction === 'horizontal' && s.lastDx > SWIPE_THRESHOLD) {
      onClose();
      return;
    }
    if (panelRef.current) {
      panelRef.current.style.transition = 'transform 0.24s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.24s';
      panelRef.current.style.transform = 'translateX(-50%)';
      panelRef.current.style.opacity = '1';
      setTimeout(() => {
        if (panelRef.current) panelRef.current.style.transition = '';
      }, 260);
    }
    s.direction = null;
    s.lastDx = 0;
  };

  // ===== Отправка =====
  const handleSend = () => {
    if (!input.trim()) return;
    if (!sendMessage) return;
    const ok = sendMessage({
      type: 'private_message',
      data: { recipientId: userId, text: input.trim() },
    });
    if (!ok) return;
    setInput('');
    sendMessage({
      type: 'private_typing',
      data: { recipientId: userId, isTyping: false },
    });
  };

  const handleStickerPick = (stickerUrl) => {
    if (!sendMessage || !stickerUrl) return;
    sendMessage({
      type: 'private_message',
      data: { recipientId: userId, stickerUrl },
    });
    setStickerPanelOpen(false);
    sendMessage({
      type: 'private_typing',
      data: { recipientId: userId, isTyping: false },
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Только изображения');
      setTimeout(() => setUploadError(''), 4000);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`Файл больше ${MAX_UPLOAD_MB} МБ`);
      setTimeout(() => setUploadError(''), 4000);
      return;
    }

    setIsUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('https://api.banjoboy420.ru/api/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      sendMessage({
        type: 'private_message',
        data: { recipientId: userId, text: '', imageUrl: data.imageUrl },
      });
    } catch (err) {
      console.error('Ошибка загрузки фото:', err);
      setUploadError('Не удалось загрузить');
      setTimeout(() => setUploadError(''), 4000);
    } finally {
      setIsUploading(false);
    }
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
    if (e.target.closest('.private-msg-image')) return;
    if (e.target.closest('.private-attach-btn')) return;
    if (e.target.closest('.ig-card')) return;
    if (e.target.closest('.private-msg-sticker')) return;

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

  const bgCss = getBgCss(dialogsBg);
  const hasBg = !!bgCss;
  const bgIsUrl = isUrlBg(dialogsBg);
  const showBgLoading = bgIsUrl && !bgLoaded;

  const panelStyle = hasBg && !showBgLoading
    ? {
        backgroundImage: bgCss,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : undefined;

  return (
    <>
      <div className="blur-overlay" onClick={onClose} />
      <div
        className={`private-chat-overlay ${hasBg ? 'private-chat-overlay--custom' : ''}`}
        ref={panelRef}
        style={panelStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div className="private-chat-header">
          <h4>Чат с {nickname}</h4>
          {/* кнопки закрытия нет — свайп влево/вправо */}
        </div>
        <div className="private-typing">
          {localTypingUser ? `${localTypingUser} печатает...` : ''}
        </div>

        <div className="private-messages" ref={messagesContainerRef}>
          {showBgLoading || !historyLoaded ? (
            <div className="private-loading" aria-hidden="true">
              <div className="private-loading-mascot" />
            </div>
          ) : (
            <>
              {initialMessages.map((m, i) => {
                const isOwn = m.senderId === myId;

                if (m.stickerUrl) {
                  return (
                    <div
                      key={m.id || i}
                      className={`private-msg private-msg--sticker ${
                        isOwn ? 'private-msg--own' : 'private-msg--other'
                      }`}
                    >
                      <div className="private-msg-sticker-nick">
                        {isOwn ? 'Я' : nickname}
                      </div>
                      <img
                        src={m.stickerUrl}
                        alt=""
                        className="private-msg-sticker"
                        draggable={false}
                        loading="lazy"
                      />
                    </div>
                  );
                }

                const reactions = m.reactions || {};
                const reactionEntries = Object.entries(reactions);
                const hasReactions = reactionEntries.length > 0;
                const igUrl = extractInstagramUrl(m.text);

                return (
                  <div
                    key={m.id || i}
                    className={`private-msg ${isOwn ? 'private-msg--own' : 'private-msg--other'} ${poppingId === m.id ? 'private-msg--pop' : ''} ${hasReactions ? 'private-msg--has-reactions' : ''} ${pickerFor === m.id ? 'private-msg--picker-open' : ''}`}
                    onClick={(e) => handleMessageTap(m.id, e)}
                  >
                    <span className="private-msg-nick">
                      {isOwn ? 'Я' : nickname}
                    </span>

                    <div className="private-msg-text-wrap">
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt="photo"
                          className="private-msg-image"
                          loading="lazy"
                          draggable={false}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenImage(m.imageUrl);
                          }}
                        />
                      )}
                      {m.text && (
                        <span className="private-msg-text">{m.text}</span>
                      )}

                      {igUrl && (
                        <InstagramCard url={igUrl} />
                      )}

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
            </>
          )}
        </div>

        {uploadError && (
          <div className="private-upload-error">{uploadError}</div>
        )}

        <div className="private-input-row">
          <button
            type="button"
            className="input-icon-btn input-icon-btn--compact"
            onClick={() => setStickerPanelOpen(v => !v)}
            title="Стикеры"
            aria-label="Стикеры"
          >
            <StickerIcon />
          </button>
          <button
            type="button"
            className="input-icon-btn input-icon-btn--compact"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Прикрепить фото"
            aria-label="Прикрепить фото"
          >
            {isUploading ? '⏳' : <ClipIcon />}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
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

      <StickerPanel
        open={stickerPanelOpen}
        onClose={() => setStickerPanelOpen(false)}
        stickers={stickers}
        onPick={handleStickerPick}
        isAdmin={isAdmin}
        token={token}
        onUploaded={onStickersUpdated}
      />

      {fullscreenImage && (
        <div
          className="private-image-overlay"
          onClick={() => setFullscreenImage(null)}
        >
          <img
            src={fullscreenImage}
            alt=""
            className="private-image-full"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="private-image-close"
            onClick={() => setFullscreenImage(null)}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};

export default PrivateChat;