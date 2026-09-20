import { useEffect, useRef, useState, useCallback } from 'react';
import ConfirmBanModal from './ConfirmBanModal';
import LatestVersionLink from './LatestVersionLink';
import PrivateChat from './components/PrivateChat';
import PlayersPanel from './components/PlayersPanel';
import AuthModal from './components/AuthModal';
import MessageList from './components/MessageList';
import DuelBox from './components/DuelBox';
import { QRCodeSVG } from 'qrcode.react';
import { useWebSocket } from './useWebSocket';
import {
  getAvatarColor,
  getInitial,
} from './utils';
import { useAudio } from './hooks/useAudio';
import { useChatUI } from './hooks/useChatUI';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useAuth } from './hooks/useAuth';
import { useDuel } from './hooks/useDuel';
import { usePrivateChat } from './hooks/usePrivateChat';
import { useChat } from './hooks/useChat';
import { useYouTubePlayer } from './hooks/useYouTubePlayer';
import '../styles/Chat.css';
import '../styles/Chat.image.css';
import '../styles/Chat.players.css';
import '../styles/Chat.private.css';
import '../styles/Chat.modals.css';
import '../styles/Chat.mobile.css';
import '../styles/Chat.mascot.css';

// [правка 2.15.20 → 2.15.21] видимый мини-плеер для первого play на iOS
const VERSION = '2.15.21';
const WS_URL = 'wss://api.banjoboy420.ru';

const Chat = () => {
  const auth = useAuth();
  const {
    token, nickname, isAuth, isAdmin, myId, serverVersion,
    isRegisterMode, setIsRegisterMode,
    authNickname, setAuthNickname,
    authPassword, setAuthPassword,
    authError, setAuthError,
    showPassword, setShowPassword,
    showIdleNotice,
    handleAuthSubmit,
    applyAuthOk,
    forceLogout,
    nicknameRef,
    tokenRef,
  } = auth;

  const {
    isDark, setIsDark,
    activeMessageId,
    toggleReactions,
    showPlayers, setShowPlayers,
    searchQuery, setSearchQuery,
    banConfirm, setBanConfirm,
    fullscreenImage, setFullscreenImage,
    showFullscreenReactions, setShowFullscreenReactions,
    closeFullscreen,
    showMobileInput, setShowMobileInput,
  } = useChatUI();

  const [isConnected, setIsConnected] = useState(false);
  const [duelNotice, setDuelNotice] = useState('');
  const [dragY, setDragY] = useState(0);
  const [inputDragY, setInputDragY] = useState(0);
  const [volumeTipVisible, setVolumeTipVisible] = useState(false);

  // [правка 2.15.21] показываем мини-плеер для первого user gesture на iOS
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);

  const playersOverlayRef = useRef(null);
  const playersBtnRef = useRef(null);
  const mobilePlayersBtnRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const touchStartYRef = useRef(null);

  const swipeStartXRef = useRef(null);
  const swipeStartYRef = useRef(null);
  const swipeActiveRef = useRef(false);
  const swipeDirectionRef = useRef(null);
  const showPlayersRef = useRef(showPlayers);

  const inputTouchStartYRef = useRef(null);
  const inputTouchStartXRef = useRef(null);

  const mascotGestureRef = useRef({
    startY: 0,
    startTime: 0,
    volumeBase: 50,
    inVolumeDrag: false,
    longPressTimer: null,
    longPressFired: false,
    pointerId: null,
    lastTapTime: 0,
  });

  const yt = useYouTubePlayer();

  // [правка 2.15.21] как только плеер запустился — прячем мини-плеер
  useEffect(() => {
    if (yt.hasStarted) setShowMiniPlayer(false);
  }, [yt.hasStarted]);

  const { isConnected: wsConnected, error: wsError, sendMessage, ws } = useWebSocket(
    WS_URL,
    tokenRef.current,
    (msg) => handleWebSocketMessage(msg)
  );

  const audio = useAudio();

  const duel = useDuel({
    sendMessage,
    isAuth,
    onNotice: (text) => {
      setDuelNotice(text);
      setTimeout(() => setDuelNotice(''), 3000);
    },
  });

  const chat = useChat({
    sendMessage,
    isAuth,
    isAdmin,
    myId,
    audio,
    nicknameRef,
    onNotice: (text) => {
      setDuelNotice(text);
      setTimeout(() => setDuelNotice(''), 3000);
    },
  });

  const {
    messages,
    players,
    friends,
    typingUsers,
    friendRequests,
    notices,
    bannedUntil,
    errorMessage,
    setErrorMessage,
    input,
    setInput,
    sending,
    isUploading,
    handleWs: handleChatWs,
    handleSendMessage,
    handleEditMessage,
    handleFileUpload,
    handleInputChange,
    sendReaction,
    deleteMessage,
    banForever,
    watchChat,
    handleFriendRequest,
    handleAcceptRequest,
    handleDeclineRequest,
    togglePlayers: chatTogglePlayers,
  } = chat;

  const priv = usePrivateChat({ sendMessage, myId, players });
  const {
    privateChat,
    privateTypingUser,
    unreadByUser,
    openPrivateChat,
    closePrivateChat,
    handleWs: handlePrivateWs,
  } = priv;

  const {
    messagesContainerRef,
    messagesEndRef,
    showScrollDown,
    scrollToBottom,
  } = useAutoScroll({ messages, resetKey: isAuth });

  const unreadCount = Object.values(unreadByUser).filter(Boolean).length;
  const friendRequestsCount = friendRequests.length;
  const totalNotifications = unreadCount + friendRequestsCount;

  useEffect(() => {
    showPlayersRef.current = showPlayers;
  }, [showPlayers]);

  const handleWebSocketMessage = useCallback((msg) => {
    console.log('📩 Входящее сообщение:', msg.type, msg.data);

    if (duel.handleWs(msg)) return;
    if (handlePrivateWs(msg)) return;
    if (handleChatWs(msg)) return;

    switch (msg.type) {
      case 'version':
        console.log(`[CHAT v${VERSION}] Server version: ${msg.data}`);
        break;
      case 'auth_ok':
        applyAuthOk(msg.data);
        sendMessage({ type: 'get_friends' });
        break;
      case 'banned_forever':
        forceLogout('У нас тут таких не любят');
        break;
      case 'idle_disconnect':
        forceLogout('Вы были отключены за неактивность. Войдите снова.');
        break;
      default:
        console.warn(`[CHAT v${VERSION}] Unknown message type:`, msg.type);
    }
  }, [sendMessage, applyAuthOk, forceLogout, duel, handlePrivateWs, handleChatWs]);

  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  useEffect(() => {
    if (wsError) {
      setErrorMessage('WebSocket error: ' + wsError);
      const timer = setTimeout(() => setErrorMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [wsError, setErrorMessage]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (playersBtnRef.current?.contains(e.target)) return;
      if (mobilePlayersBtnRef.current?.contains(e.target)) return;

      if (playersOverlayRef.current && !playersOverlayRef.current.contains(e.target)) {
        setShowPlayers(false);
      }
    };
    if (showPlayers) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPlayers, setShowPlayers]);

  useEffect(() => {
    if (showMobileInput && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showMobileInput]);

  // Свайп панели игроков
  useEffect(() => {
    const EDGE_ZONE = 40;
    const THRESHOLD = 50;
    const DIRECTION_LOCK = 8;

    const handleStart = (e) => {
      if (e.touches.length !== 1) return;

      const target = e.target;
      if (target && target.closest && target.closest('.chat-header-mascot-wrap')) {
        swipeDirectionRef.current = null;
        return;
      }

      const t = e.touches[0];

      if (showPlayersRef.current) {
        swipeStartXRef.current = t.clientX;
        swipeStartYRef.current = t.clientY;
        swipeActiveRef.current = false;
        swipeDirectionRef.current = 'close';
      } else if (t.clientX <= EDGE_ZONE) {
        swipeStartXRef.current = t.clientX;
        swipeStartYRef.current = t.clientY;
        swipeActiveRef.current = false;
        swipeDirectionRef.current = 'open';
      } else {
        swipeDirectionRef.current = null;
      }
    };

    const handleMove = (e) => {
      if (!swipeDirectionRef.current) return;
      if (swipeStartXRef.current == null) return;
      if (e.touches.length !== 1) return;

      const t = e.touches[0];
      const dx = t.clientX - swipeStartXRef.current;
      const dy = t.clientY - swipeStartYRef.current;

      if (!swipeActiveRef.current) {
        if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;

        if (Math.abs(dy) > Math.abs(dx)) {
          swipeDirectionRef.current = null;
          return;
        }
        if (swipeDirectionRef.current === 'open' && dx < 0) {
          swipeDirectionRef.current = null;
          return;
        }
        if (swipeDirectionRef.current === 'close' && dx > 0) {
          swipeDirectionRef.current = null;
          return;
        }
        swipeActiveRef.current = true;
      }

      if (e.cancelable) e.preventDefault();
    };

    const handleEnd = (e) => {
      if (swipeDirectionRef.current && swipeStartXRef.current != null) {
        const t = e.changedTouches[0];
        const dx = t.clientX - swipeStartXRef.current;

        if (swipeDirectionRef.current === 'open' && dx >= THRESHOLD) {
          chatTogglePlayers();
          setShowPlayers(true);
        } else if (swipeDirectionRef.current === 'close' && dx <= -THRESHOLD) {
          setShowPlayers(false);
        }
      }
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      swipeActiveRef.current = false;
      swipeDirectionRef.current = null;
    };

    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [chatTogglePlayers, setShowPlayers]);

  const togglePlayers = () => {
    chatTogglePlayers();
    setShowPlayers(prev => !prev);
  };

  const compareVersions = (v1, v2) => {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  };

  const isNewVersionAvailable = serverVersion && compareVersions(serverVersion, VERSION) > 0;

  const sendText = 'ОТПРАВИТЬ';
  const sendChars = sendText.split('');

  const fullscreenMessage = fullscreenImage
    ? messages.find(m => m.id === fullscreenImage.messageId)
    : null;
  const fullscreenReactions = fullscreenMessage?.reactions || {};
  const fullscreenReactionEntries = Object.entries(fullscreenReactions);

  const SWIPE_CLOSE_THRESHOLD = 120;

  const handleFsTouchStart = (e) => {
    const t = e.touches[0];
    touchStartYRef.current = t.clientY;
  };

  const handleFsTouchMove = (e) => {
    if (touchStartYRef.current == null) return;
    const t = e.touches[0];
    const dy = t.clientY - touchStartYRef.current;
    if (dy > 0) setDragY(dy);
  };

  const handleFsTouchEnd = () => {
    if (dragY > SWIPE_CLOSE_THRESHOLD) closeFullscreen();
    setDragY(0);
    touchStartYRef.current = null;
  };

  const fsOverlayOpacity = fullscreenImage
    ? Math.max(0.35, 0.95 - (dragY / 120) * 0.5)
    : 0.95;

  const INPUT_DRAG_THRESHOLD = 60;

  const handleInputTouchStart = (e) => {
    const t = e.touches[0];
    inputTouchStartYRef.current = t.clientY;
    inputTouchStartXRef.current = t.clientX;
  };

  const handleInputTouchMove = (e) => {
    if (inputTouchStartYRef.current == null) return;
    const t = e.touches[0];
    const dy = t.clientY - inputTouchStartYRef.current;
    const dx = t.clientX - inputTouchStartXRef.current;

    if (Math.abs(dx) > Math.abs(dy)) return;
    if (dy > 0) setInputDragY(dy);
  };

  const handleInputTouchEnd = () => {
    if (inputDragY > INPUT_DRAG_THRESHOLD) setShowMobileInput(false);
    setInputDragY(0);
    inputTouchStartYRef.current = null;
    inputTouchStartXRef.current = null;
  };

  // ===== жесты маскота =====
  const LONG_PRESS_MS = 600;
  const DOUBLE_TAP_MS = 250;
  const VOLUME_PIXELS_PER_PERCENT = 2;

  const handleMascotPointerDown = (e) => {
    const ref = mascotGestureRef.current;
    ref.startY = e.clientY;
    ref.startTime = Date.now();
    ref.volumeBase = yt.volume;
    ref.inVolumeDrag = false;
    ref.longPressFired = false;
    ref.pointerId = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }

    ref.longPressTimer = setTimeout(() => {
      ref.longPressFired = true;
      yt.next();
    }, LONG_PRESS_MS);
  };

  const handleMascotPointerMove = (e) => {
    const ref = mascotGestureRef.current;
    if (ref.pointerId !== e.pointerId) return;
    const dy = e.clientY - ref.startY;

    if (Math.abs(dy) > 8) {
      if (!ref.inVolumeDrag) {
        ref.inVolumeDrag = true;
        if (ref.longPressTimer) {
          clearTimeout(ref.longPressTimer);
          ref.longPressTimer = null;
        }
        setVolumeTipVisible(true);
      }
      const delta = -dy / VOLUME_PIXELS_PER_PERCENT;
      yt.setVolume(ref.volumeBase + delta);
    }
  };

  const handleMascotPointerUp = (e) => {
    const ref = mascotGestureRef.current;
    if (ref.pointerId !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    ref.pointerId = null;

    if (ref.longPressTimer) {
      clearTimeout(ref.longPressTimer);
      ref.longPressTimer = null;
    }

    if (ref.inVolumeDrag) {
      ref.inVolumeDrag = false;
      setTimeout(() => setVolumeTipVisible(false), 600);
      return;
    }

    if (ref.longPressFired) {
      ref.longPressFired = false;
      return;
    }

    const duration = Date.now() - ref.startTime;
    if (duration > LONG_PRESS_MS) return;

    const now = Date.now();
    if (now - ref.lastTapTime < DOUBLE_TAP_MS) {
      ref.lastTapTime = 0;
      yt.next();
      return;
    }
    ref.lastTapTime = now;

    // [правка 2.15.21] если плеер никогда не запускался — показываем
    // мини-плеер, чтобы юзер сам тапнул play (iOS требует gesture внутри iframe)
    if (!yt.hasStarted) {
      setShowMiniPlayer(true);
      return;
    }
    yt.toggle();
  };

  const handleMascotContextMenu = (e) => {
    e.preventDefault();
  };

  return (
    <>
      <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
        {isDark ? '☀️' : '🌙'}
      </button>

      {isAuth && (
        <button
          className="players-toggle"
          ref={playersBtnRef}
          onClick={togglePlayers}
        >
          👥
          {totalNotifications > 0 && <span className="unread-badge">!</span>}
        </button>
      )}

      {showPlayers && isAuth && (
        <PlayersPanel
          ref={playersOverlayRef}
          players={players}
          friends={friends}
          friendRequests={friendRequests}
          myId={myId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          unreadByUser={unreadByUser}
          isAdmin={isAdmin}
          onWatchChat={watchChat}
          onBanConfirm={(userId, nickname) => setBanConfirm({ userId, nickname })}
          onRequestDuel={duel.requestDuel}
          onOpenPrivateChat={openPrivateChat}
          onFriendRequest={handleFriendRequest}
          onAcceptRequest={handleAcceptRequest}
          onDeclineRequest={handleDeclineRequest}
        />
      )}

      {privateChat && (
        <PrivateChat
          key={privateChat.userId}
          userId={privateChat.userId}
          nickname={privateChat.nickname}
          myId={myId}
          ws={ws}
          initialMessages={privateChat.messages || []}
          typingUser={privateTypingUser}
          onClose={closePrivateChat}
        />
      )}

      <ConfirmBanModal
        open={!!banConfirm}
        nickname={banConfirm?.nickname}
        onConfirm={() => {
          if (banConfirm) {
            banForever(banConfirm.userId);
            setBanConfirm(null);
          }
        }}
        onCancel={() => setBanConfirm(null)}
      />

      <div className="chat-container">
        <div className={`chat-main ${showMobileInput ? 'mobile-input-open' : ''}`}>
          <div className="chat-header">
            <div className="chat-header-mascot-wrap">
              <img
                src="/mascot.png"
                alt="banjoboy"
                className="chat-header-logo"
                draggable={false}
                onPointerDown={handleMascotPointerDown}
                onPointerMove={handleMascotPointerMove}
                onPointerUp={handleMascotPointerUp}
                onPointerCancel={handleMascotPointerUp}
                onContextMenu={handleMascotContextMenu}
              />
              {volumeTipVisible && (
                <div className="mascot-volume-tip">🔊 {yt.volume}</div>
              )}
              {yt.isPlaying && <span className="mascot-playing-dot" />}
            </div>

            <div className="chat-header-text">
              <div className="chat-header-title">banjoboy's crew</div>
              <div className="chat-header-subtitle">
                {isConnected ? 'онлайн' : 'оффлайн'}
              </div>
              <div className="chat-header-version">v{VERSION}</div>
            </div>
            <button
              className="chat-header-theme"
              onClick={() => setIsDark(!isDark)}
              title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              aria-label="Переключить тему"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>

          <div className="qr-wrap">
            <QRCodeSVG value={window.location.href} size={100} />
            <span className="qr-label">QR для входа</span>
          </div>

          <div className="messages-wrapper">
            <MessageList
              messages={messages}
              isAdmin={isAdmin}
              deleteMessage={deleteMessage}
              toggleReactions={toggleReactions}
              activeMessageId={activeMessageId}
              nickname={nickname}
              sendReaction={sendReaction}
              setFullscreenImage={setFullscreenImage}
              messagesEndRef={messagesEndRef}
              myId={myId}
              onEditMessage={handleEditMessage}
              containerRef={messagesContainerRef}
            />

            {notices.length > 0 && (
              <div className="join-notices">
                {notices.map(n => (
                  <div key={n.id} className="join-notice">
                    <div
                      className="join-notice-avatar"
                      style={{ background: getAvatarColor(n.nickname) }}
                    >
                      {getInitial(n.nickname)}
                    </div>
                    <span className="join-notice-text">
                      {n.nickname} {n.type === 'join' ? 'зашёл' : 'вышел'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {showScrollDown && (
              <button className="scroll-down-btn" onClick={scrollToBottom} title="Вниз">
                ↓
              </button>
            )}
          </div>

          <div className="typing-indicator">
            {typingUsers.length > 0 && `${typingUsers.join(', ')} печатает...`}
          </div>

          <div
            className="input-row"
            onTouchStart={handleInputTouchStart}
            onTouchMove={handleInputTouchMove}
            onTouchEnd={handleInputTouchEnd}
            style={{
              transform: `translateY(${inputDragY}px)`,
              transition: inputDragY === 0 ? 'transform 0.2s ease-out' : 'none',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={!isAuth || isUploading}
              placeholder={isUploading ? 'Загрузка фото...' : 'Сообщение'}
            />
            <button
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isAuth || isUploading}
              title="Прикрепить фото"
            >
              📎
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              style={{ display: 'none' }}
              capture="environment"
            />
            <button
              className={`send-btn ${sending ? 'sending' : ''}`}
              onClick={handleSendMessage}
              disabled={!isAuth || !input.trim() || isUploading || sending}
            >
              <div className="rotating-text">
                {sendChars.map((char, idx) => {
                  const angle = (360 / sendChars.length) * idx;
                  return (
                    <span
                      key={idx}
                      style={{ transform: `rotate(${angle}deg) translate(0, -28px)` }}
                    >
                      {char}
                    </span>
                  );
                })}
              </div>
              <div className="send-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </div>
              <div className="send-spinner" />
            </button>
          </div>

          <div className="mobile-bottom-bar">
            <button
              className="mobile-bar-btn"
              ref={mobilePlayersBtnRef}
              onClick={togglePlayers}
              title="Игроки"
              aria-label="Игроки"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {totalNotifications > 0 && <span className="mobile-bar-badge">!</span>}
            </button>
            <button
              className="mobile-bar-btn"
              onClick={() => setShowMobileInput(v => !v)}
              title="Написать"
              aria-label="Написать"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>

          <div className="status">
            {bannedUntil && ` — бан до ${new Date(bannedUntil).toLocaleTimeString()}`}
            {errorMessage && <div style={{ color: 'var(--danger)', marginTop: 4 }}>{errorMessage}</div>}
            {isUploading && <div style={{ color: 'var(--btn-bg)', marginTop: 4 }}>Загрузка фото...</div>}
          </div>

          <DuelBox
            duelInvite={duel.duelInvite}
            duelState={duel.duelState}
            duelNotice={duelNotice}
            onAcceptDuel={duel.acceptDuel}
            onDeclineDuel={duel.clearInvite}
            onChoose={duel.choose}
            onCloseDuelNotice={() => setDuelNotice('')}
          />
        </div>
      </div>

      {!isAuth && (
        <AuthModal
          isRegisterMode={isRegisterMode}
          setIsRegisterMode={setIsRegisterMode}
          authNickname={authNickname}
          setAuthNickname={setAuthNickname}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          authError={authError}
          showIdleNotice={showIdleNotice}
          handleAuthSubmit={handleAuthSubmit}
        />
      )}

      {isNewVersionAvailable && <LatestVersionLink />}

      {fullscreenImage && (
        <div
          className="fullscreen-overlay"
          onClick={closeFullscreen}
          onTouchStart={handleFsTouchStart}
          onTouchMove={handleFsTouchMove}
          onTouchEnd={handleFsTouchEnd}
          style={{ background: `rgba(0, 0, 0, ${fsOverlayOpacity})` }}
        >
          <div className="fullscreen-reactions">
            <button
              className="fullscreen-reactions-toggle"
              onClick={(e) => { e.stopPropagation(); setShowFullscreenReactions(v => !v); }}
              title="Реакции"
            >
              😀
            </button>
            {showFullscreenReactions && (
              <div className="fullscreen-reactions-picker" onClick={(e) => e.stopPropagation()}>
                {['👍', '👎', '❤️', '🔥', '😢'].map(emoji => {
                  const isActive = fullscreenMessage?.reactions?.[emoji]?.includes(nickname);
                  return (
                    <button
                      key={emoji}
                      className={`fullscreen-reaction-btn ${isActive ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        sendReaction(fullscreenImage.messageId, emoji);
                        setShowFullscreenReactions(false);
                      }}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {fullscreenReactionEntries.length > 0 && (
            <div className="fullscreen-existing-reactions" onClick={(e) => e.stopPropagation()}>
              {fullscreenReactionEntries.map(([emoji, users]) => (
                <span
                  key={emoji}
                  className={`fullscreen-reaction-badge ${users.includes(nickname) ? 'own' : ''}`}
                >
                  {emoji} {users.length}
                </span>
              ))}
            </div>
          )}

          <img
            src={fullscreenImage.url}
            alt="fullscreen"
            style={{
              transform: `translateY(${dragY}px) scale(${Math.max(0.85, 1 - dragY / 800)})`,
              transition: dragY === 0 ? 'transform 0.2s ease-out' : 'none',
            }}
          />
        </div>
      )}

      {/* [правка 2.15.21] класс --visible показывает мини-плеер, пока не запустилось */}
      <div className={`yt-hidden-host ${showMiniPlayer ? 'yt-hidden-host--visible' : ''}`}>
        <div id={yt.containerId} />
        {showMiniPlayer && (
          <div className="yt-mini-hint">▼ нажми play</div>
        )}
      </div>
    </>
  );
};

export default Chat;