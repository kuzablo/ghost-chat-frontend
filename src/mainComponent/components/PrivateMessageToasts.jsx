import { useEffect, useState } from 'react';
import OrbitNotification from './OrbitNotification';

/*
  [2.35.33] Тост о новых личных — обёртка над OrbitNotification.
            Фиксированная позиция сверху по центру, автоскрытие 8с.
            Скрывается, когда открыт PlayersPanel (управление в Chat.jsx).
*/
const AUTO_HIDE_MS = 8000;

const PrivateMessageToasts = ({ users = [], onOpenDialogs }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const key = users.map(u => u.userId).sort().join(',');

  useEffect(() => {
    if (!key) {
      setLeaving(true);
      const t = setTimeout(() => setVisible(false), 340);
      return () => clearTimeout(t);
    }
    setVisible(true);
    setLeaving(false);
    const t = setTimeout(() => setLeaving(true), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [key]);

  useEffect(() => {
    if (!leaving || !visible) return;
    const t = setTimeout(() => setVisible(false), 340);
    return () => clearTimeout(t);
  }, [leaving, visible]);

  if (!visible || users.length === 0) return null;

  const handleClick = () => {
    setLeaving(true);
    onOpenDialogs();
  };

  return (
    <OrbitNotification
      users={users}
      onClick={handleClick}
      className={leaving ? 'pm-orbit--out' : ''}
    />
  );
};

export default PrivateMessageToasts;