import OrbitNotification from './OrbitNotification';

/*
  [2.39.4] Компонент всегда в DOM. Видимость — через проп visible,
           переключается классом .pm-orbit--preparing (opacity 0,
           pointer-events none). Ref на маскота валиден всегда —
           маскот из шапки знает куда лететь.
           mascotOnly=true когда непрочитанных нет — рендерим только
           маскота без орбиты, координаты для будущего полёта.
*/
const PrivateMessageToasts = ({
  users = [],
  visible = false,
  onOpenDialogs,
  mascotRef = null,
}) => {
  const hasUsers = users.length > 0;

  return (
    <OrbitNotification
      users={users}
      mascotOnly={!hasUsers}
      onClick={visible && hasUsers ? onOpenDialogs : undefined}
      className={visible ? '' : 'pm-orbit--preparing'}
      mascotRef={mascotRef}
    />
  );
};

export default PrivateMessageToasts;