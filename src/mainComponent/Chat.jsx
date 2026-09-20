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
// [правка 2.14.31] лички вынесены в отдельный хук
import { usePrivateChat } from './hooks/usePrivateChat';
import '../styles/Chat.css';
import '../styles/Chat.image.css';
import '../styles/Chat.players.css';
import '../styles/Chat.private.css';
import '../styles/Chat.modals.css';
import '../styles/Chat.mobile.css';

// [правка 2.14.30 → 2.14.31] рефакторинг шаг 6: лички вынесены в usePrivateChat
const VERSION = '2.14.31';
const WS_URL = 'wss://api.banjoboy420.ru';

const Chat = () => {
  // ===== Авторизация (useAuth) =====
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

  // ===== Состояние, оставшееся в Chat.jsx (уедет в useChat) =====
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [players, setPlayers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [bannedUntil, setBannedUntil] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [duelNotice, setDuelNotice] = useState('');
  const [friendRequests, setFriendRequests] = useState([]);
  const [notices, setNotices] = useState([]);

  const {
    isDark, setIsDark,
    activeMessageId,
    toggleReactions,
    showPlayers, setShowPlayers,
    searchQuery, setSearchQuery,
    sending, setSending,
    banConfirm, setBanConfirm,
    isUploading, setIsUploading,
    fullscreenImage, setFullscreenImage,
    showFullscreenReactions, setShowFullscreenReactions,
    closeFullscreen,
    showMobileInput, setShowMobileInput,
  } = useChatUI();

  const typingTimeoutRef = useRef(null);
  const playersOverlayRef = useRef(null);
  const playersBtnRef = useRef(null);
  const mobilePlayersBtnRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const prevPlayerNicksRef = useRef(new Set());
  const firstPlayersLoadRef = useRef(true);

  const {
    messagesContainerRef,
    messagesEndRef,
    showScrollDown,
    scrollToBottom,
  } = useAutoScroll({ messages, resetKey: isAuth });

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

  // [правка 2.14.31] лички: state + open/close + WS-фильтр + фильтр unread
  const priv = usePrivateChat({
    sendMessage,
    myId,
    players,
  });
  const {
    privateChat,
    privateTypingUser,
    unreadByUser,
    openPrivateChat,
    closePrivateChat,
    handleWs: handlePrivateWs,
  } = priv;

  const unreadCount = Object.values(unreadByUser).filter(Boolean).length;
  const friendRequestsCount = friendRequests.length;
  const totalNotifications = unreadCount + friendRequestsCount;

  const handleWebSocketMessage = useCallback((msg) => {
    console.log('📩 Входящее сообщение:', msg.type, msg.data);

    // [правка 2.14.31] сначала дуэли и лички, потом общий switch
    if (duel.handleWs(msg)) return;
    if (handlePrivateWs(msg)) return;

    switch (msg.type) {
      case 'friends_list':
        setFriends(msg.data);
        break;
      case 'version':
        console.log(`[CHAT v${VERSION}] Server version: ${msg.data}`);
        break;
      case 'auth_ok':
        applyAuthOk(msg.data);
        sendMessage({ type: 'get_friends' });
        break;
      case 'history':
        setMessages(msg.data);
        break;
      case 'message':
        setMessages(prev => [...prev, msg.data]);
        audio.playNotification();
        break;
      case 'message_update':
        if (msg.data.id) {
          setMessages(prev => prev.map(m => m.id === msg.data.id ? msg.data : m));
        }
        break;
      case 'message_deleted':
        setMessages(prev => prev.filter(m => m.id !== msg.data.messageId));
        break;
      case 'players':
        setPlayers(msg.data);
        break;
      case 'typing': {
        const { nickname: typingNick, isTyping } = msg.data;
        setTypingUsers(prev => {
          if (isTyping && !prev.includes(typingNick)) return [...prev, typingNick];
          if (!isTyping) return prev.filter(n => n !== typingNick);
          return prev;
        });
        break;
      }
      case 'banned':
        setBannedUntil(msg.data.until);
        break;
      case 'banned_forever':
        forceLogout('У нас тут таких не любят');
        break;
      case 'idle_disconnect':
        forceLogout('Вы были отключены за неактивность. Войдите снова.');
        break;
      case 'admin_error':
        setDuelNotice(msg.data.message);
        setTimeout(() => setDuelNotice(''), 3000);
        break;
      case 'friend_request_sent':
        setDuelNotice(`Запрос дружбы отправлен пользователю ${msg.data.receiverNickname}`);
        setTimeout(() => setDuelNotice(''), 3000);
        break;
      case 'new_friend_request':
        setFriendRequests(prev => [...prev, msg.data]);
        break;
      case 'friend_request_accepted_notification':
        setDuelNotice(`🎉 ${msg.data.user1Nickname} и ${msg.data.user2Nickname} теперь друзья!`);
        setTimeout(() => setDuelNotice(''), 4000);
        sendMessage({ type: 'get_friends' });
        break;
      case 'friend_request_accepted':
      case 'friend_request_declined':
        setFriendRequests(prev => prev.filter(r => r.senderId !== msg.data.userId));
        break;
      case 'friend_requests_list':
        setFriendRequests(msg.data);
        break;
      // [правка 2.14.31] приватные кейсы переехали в usePrivateChat.handleWs
      default:
        console.warn(`[CHAT v${VERSION}] Unknown message type:`, msg.type);
    }
  }, [myId, sendMessage, audio, applyAuthOk, forceLogout, duel, handlePrivateWs]);

  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  useEffect(() => {
    if (wsError) {
      setErrorMessage('WebSocket error: ' + wsError);
      const timer = setTimeout(() => setErrorMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [wsError]);

  // ===== Уведомления «ник зашёл/вышел» =====
  useEffect(() => {
    const currentNicks = new Set(players.map(p => p.nickname));

    if (firstPlayersLoadRef.current) {
      prevPlayerNicksRef.current = currentNicks;
      firstPlayersLoadRef.current = false;
      return;
    }

    const prev = prevPlayerNicksRef.current;
    const joined = [...currentNicks].filter(n => !prev.has(n));
    const left = [...prev].filter(n => !currentNicks.has(n));

    prevPlayerNicksRef.current = currentNicks;

    const myNick = nicknameRef.current;
    const filteredJoined = joined.filter(n => n !== myNick);
    const filteredLeft = left.filter(n => n !== myNick);

    if (filteredJoined.length === 0 && filteredLeft.length === 0) return;

    const stamp = Date.now();
    const added = [];
    filteredJoined.forEach((nick, i) => {
      added.push({ id: `j-${stamp}-${i}`, nickname: nick, type: 'join' });
    });
    filteredLeft.forEach((nick, i) => {
      added.push({ id: `l-${stamp}-${i}`, nickname: nick, type: 'leave' });
    });

    setNotices(p => [...p, ...added].slice(-3));

    added.forEach(n => {
      setTimeout(() => {
        setNotices(p => p.filter(x => x.id !== n.id));
      }, 4000);
    });
  }, [players, nicknameRef]);

  // ===== Клик снаружи панели игроков =====
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

  // [правка 2.14.31] эффект фильтрации unreadByUser при смене players — в usePrivateChat

  useEffect(() => {
    if (showMobileInput && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showMobileInput]);

  const handleSendMessage = () => {
    if (sending || !sendMessage || !input.trim() || !isAuth) return;
    setSending(true);
    sendMessage({
      type: 'message',
      data: { text: input.trim() }
    });
    audio.playSend();
    setInput('');
    sendMessage({ type: 'typing', data: { isTyping: false } });
    setTimeout(() => setSending(false), 800);
  };

  const handleEditMessage = (messageId, newText) => {
    if (sendMessage) {
      sendMessage({ type: 'edit_message', data: { messageId, text: newText } });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isAuth || !sendMessage) {
      setErrorMessage('Не авторизован или нет соединения');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('https://api.banjoboy420.ru/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      sendMessage({
        type: 'message',
        data: {
          text: '',
          imageUrl: data.imageUrl
        }
      });
      audio.playSend();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Ошибка загрузки фото:', err);
      setErrorMessage('Не удалось загрузить фото: ' + (err?.message || ''));
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (sendMessage && isAuth) {
      if (e.target.value.trim()) {
        sendMessage({ type: 'typing', data: { isTyping: true } });
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          if (sendMessage) {
            sendMessage({ type: 'typing', data: { isTyping: false } });
          }
        }, 1500);
      } else {
        sendMessage({ type: 'typing', data: { isTyping: false } });
      }
    }
  };

  const sendReaction = (messageId, emoji) => {
    if (sendMessage && isAuth) {
      sendMessage({ type: 'reaction', data: { messageId, emoji } });
    }
  };

  // [правка 2.14.31] openPrivateChat / closePrivateChat — из usePrivateChat

  const banForever = (userId) => {
    if (sendMessage && isAdmin) {
      sendMessage({ type: 'ban_forever', data: { userId } });
    }
  };

  const deleteMessage = (messageId) => {
    if (sendMessage) {
      sendMessage({ type: 'delete_message', data: { messageId } });
    }
  };

  const watchChat = (userId) => {
    if (sendMessage && isAdmin) {
      sendMessage({ type: 'watch_chat', data: { userId } });
    }
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

  const handleFriendRequest = (receiverId) => {
    if (sendMessage) {
      sendMessage({ type: 'friend_request', data: { receiverId } });
    }
  };

  const handleAcceptRequest = (requestId) => {
    if (sendMessage) {
      sendMessage({ type: 'friend_request_accept', data: { requestId } });
    }
    setFriendRequests(prev => prev.filter(r => r.requestId !== requestId));
  };

  const handleDeclineRequest = (requestId) => {
    if (sendMessage) {
      sendMessage({ type: 'friend_request_decline', data: { requestId } });
    }
    setFriendRequests(prev => prev.filter(r => r.requestId !== requestId));
  };

  const togglePlayers = () => {
    if (sendMessage) {
      sendMessage({ type: 'get_friends' });
    }
    setShowPlayers(prev => !prev);
  };

  const sendText = 'ОТПРАВИТЬ';
  const sendChars = sendText.split('');

  const fullscreenMessage = fullscreenImage
    ? messages.find(m => m.id === fullscreenImage.messageId)
    : null;
  const fullscreenReactions = fullscreenMessage?.reactions || {};
  const fullscreenReactionEntries = Object.entries(fullscreenReactions);

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
            <img src="/mascot.png" alt="banjoboy" className="chat-header-logo" />
            <div className="chat-header-text">
              <div className="chat-header-title">banjoboy's crew</div>
              <div className="chat-header-subtitle">
                {isConnected ? 'онлайн' : 'оффлайн'}
              </div>
              <div className="chat-header-version">v{VERSION}</div>
            </div>
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

          <div className="input-row">
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
            >
              👥
              {totalNotifications > 0 && <span className="mobile-bar-badge">!</span>}
            </button>
            <button
              className="mobile-bar-btn"
              onClick={() => setIsDark(!isDark)}
              title="Тема"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <button
              className="mobile-bar-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isAuth || isUploading}
              title="Фото"
            >
              📷
            </button>
            <button
              className="mobile-bar-btn"
              onClick={() => setShowMobileInput(v => !v)}
              title="Написать"
            >
              💬
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
        <div className="fullscreen-overlay" onClick={closeFullscreen}>
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
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default Chat;