import { useState, useRef, useEffect } from 'react';

/*
  [новый хук, рефакторинг 2.14.29]
  Вынесено из Chat.jsx — вся авторизация:
    - state: token, nickname, isAuth, isAdmin, myId, serverVersion;
    - поля формы: isRegisterMode, authNickname, authPassword, authError, showPassword;
    - handleAuthSubmit — запрос /api/register | /api/login;
    - applyAuthOk — успешный WS auth_ok (устанавливает userId/role/version);
    - forceLogout — выход по бану/idle;
    - showIdleNotice — «вы были отключены за неактивность»;
    - nicknameRef, tokenRef — для useWebSocket и других хуков.

  WS-обработка (switch) остаётся в Chat.jsx, чтобы не рвать
  зависимость на sendMessage. Хук отдаёт чистые методы.
*/

const API_URL = 'https://api.banjoboy420.ru';

export const useAuth = () => {
  const storedToken = localStorage.getItem('ghost-chat-token') || '';
  const storedNickname = localStorage.getItem('ghost-chat-nickname') || '';

  const [token, setToken] = useState(storedToken);
  const [nickname, setNickname] = useState(storedNickname);
  const [isAuth, setIsAuth] = useState(!!storedToken);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myId, setMyId] = useState(null);
  const [serverVersion, setServerVersion] = useState('');

  const [isRegisterMode, setIsRegisterMode] = useState(true);
  const [authNickname, setAuthNickname] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showIdleNotice, setShowIdleNotice] = useState(false);

  const nicknameRef = useRef(storedNickname);
  const tokenRef = useRef(storedToken);

  // При разлогине — подсветить причину (idle/бан)
  useEffect(() => {
    if (!isAuth) {
      setShowIdleNotice(true);
      const timer = setTimeout(() => setShowIdleNotice(false), 10000);
      return () => clearTimeout(timer);
    } else {
      setShowIdleNotice(false);
    }
  }, [isAuth]);

  const handleAuthSubmit = async () => {
    if (!authNickname.trim() || !authPassword.trim()) {
      setAuthError('Заполни оба поля');
      return;
    }
    setAuthError('');
    const endpoint = isRegisterMode ? '/api/register' : '/api/login';
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: authNickname.trim(), password: authPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error || 'Ошибка');
        return;
      }
      try {
        localStorage.setItem('ghost-chat-token', data.token);
        localStorage.setItem('ghost-chat-nickname', data.nickname);
      } catch (e) {
        console.error('localStorage error:', e);
      }
      tokenRef.current = data.token;
      nicknameRef.current = data.nickname;
      setToken(data.token);
      setNickname(data.nickname);
      setIsAuth(true);
      setAuthNickname('');
      setAuthPassword('');
    } catch (error) {
      console.error('Auth error:', error);
      setAuthError('Сеть недоступна, попробуй позже');
    }
  };

  // [правка 2.14.29] успешный WS auth_ok — вынести из switch
  const applyAuthOk = (data) => {
    setMyId(data.userId);
    setNickname(data.nickname);
    setIsAuth(true);
    setIsAdmin(data.role === 'admin');
    setServerVersion(data.serverVersion || '');
  };

  // [правка 2.14.29] выход — по бану или idle. Логика была в Chat.jsx.
  const forceLogout = (reason) => {
    setAuthError(reason || '');
    setIsAuth(false);
    localStorage.removeItem('ghost-chat-token');
    localStorage.removeItem('ghost-chat-nickname');
    setToken('');
    setNickname('');
  };

  return {
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
  };
};