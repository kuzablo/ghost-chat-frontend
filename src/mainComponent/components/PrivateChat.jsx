import { useRef, useState, useEffect } from 'react';
import { formatTime } from '../utils';
import ChatInput from './ChatInput';
import InstagramCard, { extractInstagramUrl } from './InstagramCard';
import StickerPanel from './StickerPanel';

const REACTIONS = ['👍', '👎', '❤️', '🔥', '😢'];
const PICKER_AUTOHIDE_MS = 2000;
const MAX_UPLOAD_MB = 25;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/*
  [2.35.21] input-icon-btn вместо приватных стилей
  [2.35.16] стикеры в личке
  [2.35.0] Instagram-карточка
  [2.33.6] загрузка фото
  [2.26.1] ChatInput вместо <input>
*/

const StickerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h7l7-7V6a3 3 0 0 0-3-3z" />
    <path d="M13 21v-5a3 3 0 0 1 3-3h5" />
  </svg>
);

const ClipIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const PrivateChat = ({
  userId,
  nickname,
  myId,
  sendMessage,
  onClose,
  initialMessages = [],
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

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastMsgIdRef = useRef(null);
  const fileInputRef = useRef(null);

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