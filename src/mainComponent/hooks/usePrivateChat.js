import { useState, useRef, useEffect, useCallback } from 'react';

/*
  [новый хук, рефакторинг 2.14.31]
  Вынесено из Chat.jsx — всё про личные сообщения:
    - state: privateChat, privateTypingUser, unreadByUser;
    - openPrivateChat / closePrivateChat;
    - handleWs(msg) — WS-фильтр для 7 типов;
    - эффект фильтрации unreadByUser при смене players.

  players передаётся аргументом (из useChat).
*/
export const usePrivateChat = ({ sendMessage, myId, players }) => {
  const [privateChat, setPrivateChat] = useState(null);
  const [privateTypingUser, setPrivateTypingUser] = useState(null);
  const [unreadByUser, setUnreadByUser] = useState({});

  const sendMessageRef = useRef(sendMessage);
  const myIdRef = useRef(myId);
  const playersRef = useRef(players);
  const privateChatRef = useRef(privateChat);

  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);
  useEffect(() => { myIdRef.current = myId; }, [myId]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { privateChatRef.current = privateChat; }, [privateChat]);

  const openPrivateChat = useCallback((userId, nickname) => {
    if (userId === myIdRef.current) return;
    setPrivateChat({ userId, nickname, messages: [] });
    setUnreadByUser(prev => {
      const { [userId]: _, ...rest } = prev;
      return rest;
    });
    if (sendMessageRef.current) {
      sendMessageRef.current({ type: 'private_history', data: { userId } });
      sendMessageRef.current({ type: 'mark_read', data: { senderId: userId } });
    }
  }, []);

  const closePrivateChat = useCallback(() => {
    setPrivateChat(null);
    setPrivateTypingUser(null);
  }, []);

  // Непрочитанные: фильтруем при смене списка онлайн-игроков
  useEffect(() => {
    const onlineUserIds = new Set(players.map(p => p.userId));
    setUnreadByUser(prev => {
      const newUnread = {};
      for (const [userId, hasUnread] of Object.entries(prev)) {
        if (onlineUserIds.has(userId)) {
          newUnread[userId] = hasUnread;
        }
      }
      return newUnread;
    });
  }, [players]);

  const handleWs = useCallback((msg) => {
    switch (msg.type) {
      case 'unread_private_list': {
        const onlineUserIds = new Set(playersRef.current.map(p => p.userId));
        const newUnread = {};
        msg.data.forEach(senderId => {
          if (onlineUserIds.has(senderId)) {
            newUnread[senderId] = true;
          }
        });
        setUnreadByUser(prev => {
          const updated = { ...prev, ...newUnread };
          const filtered = {};
          for (const [userId, val] of Object.entries(updated)) {
            if (onlineUserIds.has(userId)) {
              filtered[userId] = val;
            }
          }
          return filtered;
        });
        return true;
      }

      case 'private_message': {
        setPrivateChat(prev => {
          if (!prev || prev.userId !== msg.data.senderId) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), { ...msg.data, is_read: false }],
          };
        });
        const cur = privateChatRef.current;
        if (!cur || cur.userId !== msg.data.senderId) {
          setUnreadByUser(prev => ({ ...prev, [msg.data.senderId]: true }));
        } else {
          if (sendMessageRef.current) {
            sendMessageRef.current({ type: 'mark_read', data: { senderId: msg.data.senderId } });
          }
          setPrivateChat(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map(m =>
                m.senderId === msg.data.senderId ? { ...m, is_read: true } : m
              ),
            };
          });
        }
        return true;
      }

      case 'private_message_sent': {
        setPrivateChat(prev => {
          if (!prev || prev.userId !== msg.data.recipientId) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), { ...msg.data, is_read: false }],
          };
        });
        return true;
      }

      case 'private_typing':
        if (msg.data.senderId !== myIdRef.current) {
          setPrivateTypingUser(msg.data.isTyping ? msg.data.senderNickname : null);
        }
        return true;

      case 'private_history':
        setPrivateChat(prev => {
          if (!prev || prev.userId !== msg.data.userId) return prev;
          return { ...prev, messages: msg.data.messages };
        });
        setUnreadByUser(prev => {
          const { [msg.data.userId]: _, ...rest } = prev;
          return rest;
        });
        return true;

      case 'private_reaction_update': {
        const { messageId, reactions } = msg.data;
        setPrivateChat(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map(m =>
              m.id === messageId ? { ...m, reactions } : m
            ),
          };
        });
        return true;
      }

      case 'message_read': {
        const { senderId, recipientId, messageIds } = msg.data;
        setPrivateChat(prev => {
          if (!prev) return prev;
          if (prev.userId === senderId || prev.userId === recipientId) {
            return {
              ...prev,
              messages: prev.messages.map(m =>
                messageIds.includes(m.id) ? { ...m, is_read: true } : m
              ),
            };
          }
          return prev;
        });
        return true;
      }

      default:
        return false;
    }
  }, []);

  return {
    privateChat,
    privateTypingUser,
    unreadByUser,
    openPrivateChat,
    closePrivateChat,
    handleWs,
  };
};