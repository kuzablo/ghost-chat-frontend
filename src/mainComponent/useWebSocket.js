import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (url, token, onMessage) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // [правка 2.14.23] ws отдаётся как state, а не ref.current —
  // иначе в Chat.jsx приходил «залипший» снимок и приходилось синхронизировать вручную
  const [ws, setWs] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const unmountedRef = useRef(false);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const socket = new WebSocket(url);
    wsRef.current = socket;
    setWs(socket); // [правка 2.14.23] публикуем наружу

    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('[useWebSocket] Connected');
      if (token) {
        socket.send(JSON.stringify({ type: 'auth', token }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (onMessageRef.current) {
          onMessageRef.current(msg);
        }
      } catch (err) {
        console.error('[useWebSocket] Parse error:', err);
      }
    };

    socket.onerror = (e) => {
      console.error('[useWebSocket] Error:', e);
      setError('WebSocket error');
      setIsConnected(false);
    };

    socket.onclose = (e) => {
      console.warn('[useWebSocket] Closed:', e.code, e.reason);
      setIsConnected(false);
      setWs(null); // [правка 2.14.23]
      if (!unmountedRef.current && e.code !== 1000) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };
  }, [url, token]);

  useEffect(() => {
    unmountedRef.current = false;
    if (token) {
      connect();
    }

    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, [connect, token]);

  const sendMessage = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const close = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual close');
    }
  }, []);

  return { isConnected, error, sendMessage, close, ws };
};