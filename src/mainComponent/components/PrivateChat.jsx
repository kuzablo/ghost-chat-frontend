import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { formatTime, formatMessageDate, getAvatarColor, getInitial } from '../utils';
import ChatInput from './ChatInput';
import InstagramCard, { extractInstagramUrl } from './InstagramCard';
import StickerPanel from './StickerPanel';
import MessageActionsMenu from './MessageActionsMenu';
import ReactionWheel from './ReactionWheel';
import VoiceMessage from './VoiceMessage';
import VoiceRecordingBar from './VoiceRecordingBar';
import { useVoiceRecorder, extFromMime } from '../hooks/useVoiceRecorder';

const PICKER_AUTOHIDE_MS = 5000;
const MAX_UPLOAD_MB = 25;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const SWIPE_THRESHOLD = 90;
const SWIPE_MAX = 220;
const DIRECTION_LOCK = 10;
const LONG_PRESS_MENU_MS = 500;
const LONG_PRESS_IGNORE_MS = 500;

const DATE_FILTERS = [
  { id: 'all',   label: 'Всё',      days: null },
  { id: 'today', label: 'Сегодня',  days: 0 },
  { id: '7d',    label: '7 дней',   days: 7 },
  { id: '30d',   label: '30 дней',  days: 30 },
];

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
  if (bg.startsWith('preset:')) return null;
  if (bg.startsWith('url:')) return `url(${bg.slice('url:'.length)})`;
  return null;
};

const isUrlBg = (bg) => !!(bg && bg.startsWith('url:'));

const getSinceTs = (days) => {
  if (days === null) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - days);
  return d.getTime();
};

const PrivateChat = ({
  userId, nickname, myId, myNickname, sendMessage, onClose,
  initialMessages = [], historyLoaded = true, dialogsBg = null,
  typingUser = null, stickers = [], isAdmin = false, token = '',
  onStickersUpdated, onForward, avatarUrl = null,
}) => {
  const [input, setInput] = useState('');
  const [localTypingUser, setLocalTypingUser] = useState(typingUser);
  const [pickerFor, setPickerFor] = useState(null);
  const [pickerAnchor, setPickerAnchor] = useState(null);
  const [poppingId, setPoppingId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [stickerPanelOpen, setStickerPanelOpen] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [actionsMenu, setActionsMenu] = useState(null);

  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);

  const [voiceRecActive, setVoiceRecActive] = useState(false);
  const [voiceRecCancel, setVoiceRecCancel] = useState(false);
  const voiceLongPressTimerRef = useRef(null);
  const voiceStartXRef = useRef(0);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastMsgIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const longPressRef = useRef({ timer: null, completedAt: 0 });

  const sendVoiceMessageRef = useRef(null);

  const voiceRec = useVoiceRecorder({
    maxDurationSec: 60,
    onAutoStop: () => { sendVoiceMessageRef.current?.(); },
  });

  const swipeRef = useRef({ active: false, startX: 0, startY: 0, direction: null, lastDx: 0 });

  const hitIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set();
    const s = new Set();
    initialMessages.forEach(m => { if (m.text && m.text.toLowerCase().includes(q)) s.add(m.id); });
    return s;
  }, [initialMessages, searchQuery]);

  const filteredMessages = useMemo(() => {
    const filter = DATE_FILTERS.find(f => f.id === dateFilter);
    let list = initialMessages;
    if (filter && filter.days !== null) {
      const since = getSinceTs(filter.days);
      list = list.filter(m => {
        if (!m.created_at) return false;
        return new Date(m.created_at).getTime() >= since;
      });
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter(m => (m.text || '').toLowerCase().includes(q));
    return list;
  }, [initialMessages, dateFilter, searchQuery]);

  useEffect(() => { setLocalTypingUser(typingUser); }, [typingUser]);

  useEffect(() => {
    if (!pickerFor) {
      setPickerAnchor(null);
      return;
    }
    const t = setTimeout(() => setPickerFor(null), PICKER_AUTOHIDE_MS);
    return () => clearTimeout(t);
  }, [pickerFor]);

  useEffect(() => {
    const last = filteredMessages[filteredMessages.length - 1];
    const lastId = last?.id ?? null;
    if (lastId === lastMsgIdRef.current) return;
    lastMsgIdRef.current = lastId;
    const id = requestAnimationFrame(() => {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [filteredMessages]);

  useEffect(() => {
    const isUrl = isUrlBg(dialogsBg);
    if (!isUrl) { setBgLoaded(true); return; }
    setBgLoaded(false);
    const url = dialogsBg.slice('url:'.length);
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.onerror = () => setBgLoaded(true);
    img.src = url;
    return () => { img.onload = null; img.onerror = null; };
  }, [dialogsBg]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    let rafId = null;
    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const d = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollDown(d > 200);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', onScroll);
    };
  }, [searchQuery, dateFilter]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = 0; });
  }, [searchQuery]);

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const openActionsMenuFor = (m, el) => {
    const containerEl = messagesContainerRef.current;
    if (!containerEl) return;
    const target = el?.closest('.private-msg') || el;
    const rect = (target || containerEl).getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    setActionsMenu({
      anchor: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      container: {
        top: containerRect.top, left: containerRect.left,
        right: containerRect.right, bottom: containerRect.bottom,
      },
      msg: m,
    });
  };

  const closeActionsMenu = () => setActionsMenu(null);

  const buildForwardData = (m) => {
    const isOwn = m.senderId === myId;
    const authorNick = isOwn ? (myNickname || 'Я') : nickname;
    const forwardedFrom = m.forwardedFrom
      ? m.forwardedFrom
      : {
          nickname: authorNick,
          originalId: m.id,
          originalTime: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
          fromPrivate: true,
        };
    return {
      text: m.text || '',
      imageUrl: m.imageUrl || null,
      stickerUrl: m.stickerUrl || null,
      voiceUrl: m.voiceUrl || null,
      voiceDuration: m.voiceDuration || null,
      voiceWaveform: m.voiceWaveform || null,
      forwardedFrom,
    };
  };

  const handlePanelTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    if (e.target.closest('.private-msg')) return;
    if (e.target.closest('.private-search-wrap')) return;
    const t = e.touches[0];
    const s = swipeRef.current;
    s.active = true; s.startX = t.clientX; s.startY = t.clientY; s.direction = null; s.lastDx = 0;
    if (panelRef.current) panelRef.current.style.transition = 'none';
  };

  const handlePanelTouchMove = (e) => {
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

  const handlePanelTouchEnd = () => {
    const s = swipeRef.current;
    if (!s.active) return;
    s.active = false;
    if (s.direction === 'horizontal' && s.lastDx > SWIPE_THRESHOLD) { onClose(); return; }
    if (panelRef.current) {
      panelRef.current.style.transition = 'transform 0.24s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.24s';
      panelRef.current.style.transform = 'translateX(-50%)';
      panelRef.current.style.opacity = '1';
      setTimeout(() => { if (panelRef.current) panelRef.current.style.transition = ''; }, 260);
    }
    s.direction = null;
    s.lastDx = 0;
  };

  const cancelLongPress = () => {
    if (longPressRef.current.timer) { clearTimeout(longPressRef.current.timer); longPressRef.current.timer = null; }
  };

  const handleMsgTouchStart = (e, m) => {
    if (e.touches.length !== 1) return;
    const el = e.currentTarget;
    longPressRef.current.timer = setTimeout(() => {
      longPressRef.current.timer = null;
      longPressRef.current.completedAt = Date.now();
      openActionsMenuFor(m, el);
    }, LONG_PRESS_MENU_MS);
  };

  const handleMsgTouchMove = () => { cancelLongPress(); };
  const handleMsgTouchEnd = () => { cancelLongPress(); };

  const handleSend = () => {
    if (!input.trim()) return;
    if (!sendMessage) return;
    const ok = sendMessage({ type: 'private_message', data: { recipientId: userId, text: input.trim() } });
    if (!ok) return;
    setInput('');
    sendMessage({ type: 'private_typing', data: { recipientId: userId, isTyping: false } });
  };

  const handleStickerPick = (stickerUrl) => {
    if (!sendMessage || !stickerUrl) return;
    sendMessage({ type: 'private_message', data: { recipientId: userId, stickerUrl } });
    setStickerPanelOpen(false);
    sendMessage({ type: 'private_typing', data: { recipientId: userId, isTyping: false } });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setUploadError('Только изображения'); setTimeout(() => setUploadError(''), 4000); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setUploadError(`Файл больше ${MAX_UPLOAD_MB} МБ`); setTimeout(() => setUploadError(''), 4000); return; }

    setIsUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('https://api.banjoboy420.ru/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      sendMessage({ type: 'private_message', data: { recipientId: userId, text: '', imageUrl: data.imageUrl } });
    } catch (err) {
      console.error('Ошибка загрузки фото:', err);
      setUploadError('Не удалось загрузить');
      setTimeout(() => setUploadError(''), 4000);
    } finally { setIsUploading(false); }
  };

  const sendReaction = (messageId, emoji) => {
    if (!sendMessage) return;
    sendMessage({ type: 'private_reaction', data: { messageId, emoji } });
    setPickerFor(null);
  };

  const handleMessageTap = (id, e) => {
    if (actionsMenu) { setActionsMenu(null); return; }
    if (Date.now() - longPressRef.current.completedAt < LONG_PRESS_IGNORE_MS) return;
    if (e.target.closest('.reaction-wheel')) return;
    if (e.target.closest('.reaction-wheel-anchor')) return;
    if (e.target.closest('.private-msg-image')) return;
    if (e.target.closest('.private-attach-btn')) return;
    if (e.target.closest('.ig-card')) return;
    if (e.target.closest('.private-msg-sticker')) return;
    if (e.target.closest('.voice-msg')) return;

    if (pickerFor === id) { setPickerFor(null); return; }

    setPoppingId(id);
    setTimeout(() => setPoppingId(null), 380);

    if (e && typeof e.clientX === 'number') {
      setPickerAnchor({ x: e.clientX, y: e.clientY });
    } else {
      setPickerAnchor(null);
    }

    setPickerFor(id);
  };

  const handlePrivateInput = (text) => {
    setInput(text);
    if (!sendMessage) return;
    if (text.trim()) {
      sendMessage({ type: 'private_typing', data: { recipientId: userId, isTyping: true } });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendMessage({ type: 'private_typing', data: { recipientId: userId, isTyping: false } });
      }, 1500);
    } else {
      sendMessage({ type: 'private_typing', data: { recipientId: userId, isTyping: false } });
    }
  };

  const renderForwardLabel = (m) => {
    if (!m.forwardedFrom) return null;
    const ff = m.forwardedFrom;
    return (
      <div className="private-msg-forward-label">
        <span className="private-msg-forward-arrow">↪</span>
        <span className="private-msg-forward-nick">Переслано от {ff.nickname}</span>
        {ff.originalTime && (
          <span className="private-msg-forward-time">· {formatMessageDate(ff.originalTime)}</span>
        )}
      </div>
    );
  };

  // ===== VOICE =====

  const uploadAndSendVoice = useCallback(async (result) => {
    if (!result) return;
    const fd = new FormData();
    const ext = extFromMime(result.mime);
    fd.append('file', result.blob, `voice_${Date.now()}.${ext}`);
    try {
      const res = await fetch('https://api.banjoboy420.ru/api/upload-voice', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      sendMessage({
        type: 'private_message',
        data: {
          recipientId: userId,
          text: '',
          voiceUrl: data.voiceUrl,
          voiceDuration: result.duration,
          voiceWaveform: result.waveform,
        },
      });
    } catch (err) {
      console.error('Ошибка загрузки голосового:', err);
      setUploadError('Не удалось отправить голосовое');
      setTimeout(() => setUploadError(''), 4000);
    }
  }, [sendMessage, userId]);

  const stopVoicePressTimer = useCallback(() => {
    if (voiceLongPressTimerRef.current) {
      clearTimeout(voiceLongPressTimerRef.current);
      voiceLongPressTimerRef.current = null;
    }
  }, []);

  const finishVoice = useCallback(async () => {
    stopVoicePressTimer();
    if (!voiceRecActive) return;
    if (voiceRecCancel) voiceRec.cancel();
    const result = await voiceRec.stop();
    setVoiceRecActive(false);
    setVoiceRecCancel(false);
    if (result) await uploadAndSendVoice(result);
  }, [voiceRecActive, voiceRecCancel, voiceRec, uploadAndSendVoice, stopVoicePressTimer]);

  sendVoiceMessageRef.current = finishVoice;

  const handleVoicePointerDown = useCallback((e) => {
    if (input.trim()) return;
    if (isUploading) return;
    voiceStartXRef.current = e.clientX;
    setVoiceRecCancel(false);
    stopVoicePressTimer();
    voiceLongPressTimerRef.current = setTimeout(async () => {
      voiceLongPressTimerRef.current = null;
      const ok = await voiceRec.start();
      if (ok) setVoiceRecActive(true);
    }, 280);
  }, [input, isUploading, voiceRec, stopVoicePressTimer]);

  const handleVoicePointerMove = useCallback((e) => {
    if (!voiceRecActive) return;
    const dx = e.clientX - voiceStartXRef.current;
    if (dx < -80) setVoiceRecCancel(true);
  }, [voiceRecActive]);

  const handleVoicePointerUp = useCallback(() => {
    if (!voiceRecActive) { stopVoicePressTimer(); return; }
    finishVoice();
  }, [voiceRecActive, finishVoice, stopVoicePressTimer]);

  // ===== /VOICE =====

  const bgCss = getBgCss(dialogsBg);
  const hasBg = !!bgCss;
  const bgIsUrl = isUrlBg(dialogsBg);
  const showBgLoading = bgIsUrl && !bgLoaded;

  const panelStyle = hasBg && !showBgLoading
    ? { backgroundImage: bgCss, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
    : undefined;

  const hasSearch = !!searchQuery.trim();
  const headerAvatarStyle = avatarUrl
    ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: getAvatarColor(nickname) };

  const activeMessage = pickerFor
    ? filteredMessages.find(x => x.id === pickerFor)
    : null;

  const voiceRecording = voiceRecActive || voiceRec.recording;

  return (
    <>
      <div className="blur-overlay" onClick={onClose} />
      <div
        className={`private-chat-overlay ${hasBg ? 'private-chat-overlay--custom' : ''}`}
        ref={panelRef}
        style={panelStyle}
        onTouchStart={handlePanelTouchStart}
        onTouchMove={handlePanelTouchMove}
        onTouchEnd={handlePanelTouchEnd}
        onTouchCancel={handlePanelTouchEnd}
      >
        <div className="private-chat-header">
          <div className="private-chat-header-left">
            <div className="private-chat-avatar" style={headerAvatarStyle}>
              {!avatarUrl && getInitial(nickname)}
            </div>
            <h4>{nickname}</h4>
          </div>
        </div>

        <div className="private-search-wrap">
          <input
            className="private-search-input"
            type="text"
            placeholder="Поиск по сообщениям..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {hasSearch && (
            <>
              <span className="private-search-count">{filteredMessages.length}</span>
              <button type="button" className="private-search-clear" onClick={() => setSearchQuery('')} aria-label="Очистить поиск">✕</button>
            </>
          )}
        </div>

        <div className="private-date-filters">
          {DATE_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={`private-date-chip ${dateFilter === f.id ? 'private-date-chip--active' : ''}`}
              onClick={() => setDateFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
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
              {filteredMessages.length === 0 && (
                <div className="private-empty">
                  {hasSearch ? 'Ничего не найдено' : 'В этом периоде сообщений нет'}
                </div>
              )}

              {filteredMessages.map((m, i) => {
                const isOwn = m.senderId === myId;
                const forwardLabel = renderForwardLabel(m);
                const isHit = hitIds.has(m.id);

                if (m.stickerUrl) {
                  return (
                    <div
                      key={m.id || i}
                      data-msg-id={m.id}
                      className={`private-msg private-msg--sticker ${isOwn ? 'private-msg--own' : 'private-msg--other'} ${isHit ? 'private-msg--hit' : ''}`}
                      onTouchStart={(e) => handleMsgTouchStart(e, m)}
                      onTouchMove={handleMsgTouchMove}
                      onTouchEnd={handleMsgTouchEnd}
                    >
                      <div className="private-msg-sticker-nick">{isOwn ? 'Я' : nickname}</div>
                      {forwardLabel}
                      <img src={m.stickerUrl} alt="" className="private-msg-sticker" draggable={false} loading="lazy" />
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
                    data-msg-id={m.id}
                    className={`private-msg ${isOwn ? 'private-msg--own' : 'private-msg--other'} ${poppingId === m.id ? 'private-msg--pop' : ''} ${hasReactions ? 'private-msg--has-reactions' : ''} ${pickerFor === m.id ? 'private-msg--picker-open' : ''} ${isHit ? 'private-msg--hit' : ''}`}
                    onClick={(e) => handleMessageTap(m.id, e)}
                    onTouchStart={(e) => handleMsgTouchStart(e, m)}
                    onTouchMove={handleMsgTouchMove}
                    onTouchEnd={handleMsgTouchEnd}
                  >
                    <div className="private-msg-text-wrap">
                      {forwardLabel}
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt="photo"
                          className="private-msg-image"
                          loading="lazy"
                          draggable={false}
                          onClick={(e) => { e.stopPropagation(); setFullscreenImage(m.imageUrl); }}
                        />
                      )}
                      {m.voiceUrl && (
                        <VoiceMessage
                          url={m.voiceUrl}
                          duration={m.voiceDuration || 0}
                          waveform={m.voiceWaveform || []}
                          isOwn={isOwn}
                        />
                      )}
                      {m.text && <span className="private-msg-text">{m.text}</span>}
                      {igUrl && <InstagramCard url={igUrl} />}

                      {hasReactions && (
                        <div className="private-msg-reactions">
                          {reactionEntries.map(([emoji, users]) => (
                            <span key={`${emoji}-${users.length}`} className={`private-reaction-badge ${users.includes(myId) ? 'own' : ''}`}>
                              {emoji}
                              {users.length > 1 && (<span className="private-reaction-count">{users.length}</span>)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="private-msg-footer">
                      <span className="private-msg-time">{formatTime(m.created_at)}</span>
                      <span className="private-msg-status">{m.is_read ? 'прочитано' : 'не прочитано'}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {showScrollDown && (
          <button type="button" className="private-scroll-btn" onClick={scrollToBottom} aria-label="Вниз">↓</button>
        )}

        {uploadError && (<div className="private-upload-error">{uploadError}</div>)}

        {voiceRecording ? (
          <VoiceRecordingBar
            duration={voiceRec.duration}
            level={voiceRec.level}
            cancelled={voiceRecCancel}
          />
        ) : (
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
            <button
              className="btn"
              onClick={input.trim() ? handleSend : undefined}
              onPointerDown={handleVoicePointerDown}
              onPointerMove={handleVoicePointerMove}
              onPointerUp={handleVoicePointerUp}
              onPointerCancel={handleVoicePointerUp}
              title={input.trim() ? 'Отправить' : 'Удерживай для записи'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {activeMessage && pickerAnchor && (
        <ReactionWheel
          open
          anchorX={pickerAnchor.x}
          anchorY={pickerAnchor.y}
          boundsRef={messagesContainerRef}
          reactions={activeMessage.reactions || {}}
          nickname={myId}
          onPick={(emoji) => sendReaction(activeMessage.id, emoji)}
          onClose={() => setPickerFor(null)}
        />
      )}

      <MessageActionsMenu
        open={!!actionsMenu}
        anchor={actionsMenu?.anchor}
        container={actionsMenu?.container}
        // !!! ВАЖНО, НАДО СДЕЛАТЬ И НЕ ПОТЕРЯТЬ, БРАТ
        //isOwn={actionsMenu?.msg?.senderId === myId}
        isOwn={false}
        isAdmin={isAdmin}
        isSticker={!!actionsMenu?.msg?.stickerUrl}
        onForward={() => { if (actionsMenu?.msg && onForward) onForward(buildForwardData(actionsMenu.msg)); }}
        onEdit={() => {}}
        onDelete={() => {}}
        onClose={closeActionsMenu}
      />

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
        <div className="private-image-overlay" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="" className="private-image-full" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="private-image-close" onClick={() => setFullscreenImage(null)} aria-label="Закрыть">✕</button>
        </div>
      )}
    </>
  );
};

export default PrivateChat;