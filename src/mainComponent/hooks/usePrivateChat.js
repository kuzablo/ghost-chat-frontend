import { useState, useRef, useEffect, useCallback } from 'react';

/*
  [2.28.7] После перезахода восстанавливаем unreadByUser из dialogs_list.
           Убран фильтр по онлайн-игрокам — он стирал непрочитанные
           от тех, кто ушёл офлайн.
  [2.17.0] Добавлено:
    - state dialogs (список диалогов);
    - handleWs обрабатывает dialogs_list, dialog_update, dialog_unread_reset;
    - openPrivateChat обнуляет unread в dialogs.
*/
export const usePrivateChat = ({ sendMessage, myId, players }) => {
  const [privateChat, setPrivateChat] = useState(null);
  const [privateTypingUser, setPrivateTypingUser] = useState(null);
  const [unreadByUser, setUnreadByUser] = useState({});
  const [dialogs, setDialogs] = useState([]);

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
    setDialogs(prev => prev.map(d =>
      d.userId === userId ? { ...d, unread: 0 } : d
    ));
    if (sendMessageRef.current) {
      sendMessageRef.current({ type: 'private_history', data: { userId } });
      sendMessageRef.current({ type: 'mark_read', data: { senderId: userId } });
    }
  }, []);

  const closePrivateChat = useCallback(() => {
    setPrivateChat(null);
    setPrivateTypingUser(null);
  }, []);

  const handleWs = useCallback((msg) => {
    switch (msg.type) {
      case 'dialogs_list': {
        const list = msg.data || [];
        setDialogs(list);
        // [2.28.7] восстанавливаем unread-карту из списка диалогов
        setUnreadByUser(prev => {
          const next = { ...prev };
          list.forEach(d => {
            if (d.unread > 0) next[d.userId] = true;
          });
          return next;
        });
        return true;
      }

      case 'dialog_update': {
        const { userId, nickname, lastText, lastAt, unread } = msg.data;
        setDialogs(prev => {
          const existing = prev.find(d => d.userId === userId);
          let updated;
          if (existing) {
            updated = prev.map(d => {
              if (d.userId !== userId) return d;
              const nextUnread =
                unread === 'increment' ? (d.unread || 0) + 1 :
                (typeof unread === 'number' ? unread : d.unread || 0);
              return {
                ...d,
                nickname: nickname || d.nickname,
                lastText,
                lastAt,
                unread: nextUnread,
              };
            });
          } else {
            updated = [
              ...prev,
              {
                userId,
                nickname,
                lastText,
                lastAt,
                unread: unread === 'increment' ? 1 : (typeof unread === 'number' ? unread : 0),
              },
            ];
          }
          return [...updated].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
        });
        return true;
      }

      case 'dialog_unread_reset':
        setDialogs(prev => prev.map(d =>
          d.userId === msg.data.userId ? { ...d, unread: 0 } : d
        ));
        return true;

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
    dialogs,
    openPrivateChat,
    closePrivateChat,
    handleWs,
  };
};