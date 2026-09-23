import { forwardRef, useState, useRef, useEffect, useCallback } from 'react';
import { getAvatarColor, getInitial } from '../utils';

/*
  [2.36.0] InfoPanel — 5 глав, орбита-оглавление, живой маскот,
           свайп-закрытие, динамическая версия, заготовка под пасхалку.
*/

const CHAPTERS = [
  { id: 'voice',    icon: '💬', label: 'Голос' },
  { id: 'personal', icon: '✉️', label: 'Личное' },
  { id: 'circle',   icon: '🤝', label: 'Круг' },
  { id: 'you',      icon: '👤', label: 'Ты' },
  { id: 'small',    icon: '✨', label: 'Мелочи' },
];

const SWIPE_THRESHOLD = 90;
const SWIPE_MAX = 220;
const DIRECTION_LOCK = 10;

const InfoPanel = forwardRef(({
  onClose,
  onMessageAdmin,
  blockedUsers = [],
  onUnblockUser,
  version = '—',
}, ref) => {
  const [activeChapter, setActiveChapter] = useState('voice');
  const [easterTaps, setEasterTaps] = useState(0);
  const [easterOpen, setEasterOpen] = useState(false);

  const panelRef = useRef(null);
  const scrollRef = useRef(null);

  const voiceRef = useRef(null);
  const personalRef = useRef(null);
  const circleRef = useRef(null);
  const youRef = useRef(null);
  const smallRef = useRef(null);

  const sectionRefs = {
    voice: voiceRef,
    personal: personalRef,
    circle: circleRef,
    you: youRef,
    small: smallRef,
  };

  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    dir: null,
    lastDx: 0,
  });

  useEffect(() => {
    if (typeof ref === 'function') ref(panelRef.current);
    else if (ref) ref.current = panelRef.current;
  }, [ref]);

  // Scroll-spy — активная глава
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let rafId = null;
    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const top = el.scrollTop + 120;
        let cur = 'voice';
        for (const c of CHAPTERS) {
          const r = sectionRefs[c.id].current;
          if (r && r.offsetTop <= top) cur = c.id;
        }
        setActiveChapter(cur);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToChapter = useCallback((id) => {
    const el = sectionRefs[id]?.current;
    const container = scrollRef.current;
    if (!el || !container) return;
    container.scrollTo({ top: el.offsetTop - 70, behavior: 'smooth' });
    setActiveChapter(id);
  }, []);

  // Свайп вправо — закрыть
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const s = swipeRef.current;
    s.active = true;
    s.startX = t.clientX;
    s.startY = t.clientY;
    s.dir = null;
    s.lastDx = 0;
    if (panelRef.current) panelRef.current.style.transition = 'none';
  };

  const handleTouchMove = (e) => {
    const s = swipeRef.current;
    if (!s.active) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - s.startX;
    const dy = t.clientY - s.startY;

    if (!s.dir) {
      if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
      s.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (s.dir === 'v') return;

    const off = Math.max(0, Math.min(dx, SWIPE_MAX));
    s.lastDx = off;
    if (panelRef.current) {
      panelRef.current.style.transform = `translateX(${off}px)`;
      panelRef.current.style.opacity = String(Math.max(0.35, 1 - off / 400));
    }
    if (e.cancelable) e.preventDefault();
  };

  const handleTouchEnd = () => {
    const s = swipeRef.current;
    if (!s.active) return;
    s.active = false;

    if (s.dir === 'h' && s.lastDx > SWIPE_THRESHOLD) {
      onClose();
      return;
    }
    if (panelRef.current) {
      panelRef.current.style.transition = 'transform 0.24s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.24s';
      panelRef.current.style.transform = '';
      panelRef.current.style.opacity = '1';
      setTimeout(() => {
        if (panelRef.current) panelRef.current.style.transition = '';
      }, 260);
    }
    s.dir = null;
    s.lastDx = 0;
  };

  const handleMascotTap = () => {
    const next = easterTaps + 1;
    if (next >= 5) {
      setEasterOpen(true);
      setEasterTaps(0);
    } else {
      setEasterTaps(next);
      setTimeout(() => setEasterTaps(0), 1400);
    }
  };

  return (
    <>
      <div className="info-overlay" onClick={onClose} />
      <aside
        className="info-panel"
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <header className="info-header">
          <div className="info-brand">
            <button
              type="button"
              className="info-brand-mascot"
              onClick={handleMascotTap}
              aria-label="Маскот"
            >
              <img src="/mascot.png" alt="" draggable={false} />
              <span className="info-brand-mascot-halo" aria-hidden="true" />
            </button>
            <div className="info-brand-text">
              <h2 className="info-brand-title">banjoboy's crew</h2>
              <div className="info-brand-subtitle">v{version} · живой</div>
            </div>
          </div>
          <button
            className="info-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </header>

        <nav className="info-orbit" aria-label="Оглавление">
          {CHAPTERS.map(c => (
            <button
              key={c.id}
              type="button"
              className={`info-orbit-btn ${activeChapter === c.id ? 'info-orbit-btn--active' : ''}`}
              onClick={() => scrollToChapter(c.id)}
              aria-label={c.label}
              title={c.label}
            >
              <span className="info-orbit-icon">{c.icon}</span>
              <span className="info-orbit-label">{c.label}</span>
            </button>
          ))}
        </nav>

        <div className="info-body" ref={scrollRef}>

          <p className="info-intro">
            Это не список. Это короткий разговор о том, как устроен crew.
            Пять глав. Прочитаешь — поймёшь всё.
          </p>

          {/* ===== 1. ГОЛОС ===== */}
          <section ref={voiceRef} className="info-chapter">
            <div className="info-chapter-head">
              <span className="info-chapter-num">01</span>
              <h3 className="info-chapter-title">Голос</h3>
            </div>
            <p className="info-chapter-lede">
              Общий чат. Здесь говорят все — кто онлайн, тот и слышен.
            </p>

            <div className="info-block">
              <div className="info-block-title">Написать</div>
              <p>
                Текст, фото до 25 МБ, стикеры, голосовое до минуты.
                Enter — отправить. Свайп вниз по полю ввода — спрятать клавиатуру.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Ответить</div>
              <p>
                Свайп влево по сообщению — цитата поднимется к полю ввода.
                Оригинал коротко мигнёт, когда тапнешь по ней.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Реакции</div>
              <p>
                Тап по сообщению — из точки тапа расцветает колесо эмодзи.
                Шесть главных на внутренней орбите. Плюс — двенадцать свежих снаружи.
              </p>
              <p className="info-block-note">
                Двойной тап по фото — ❤️ прямо в точку.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Своё</div>
              <p>
                Своё можно менять и убирать. Долгий тап — меню.
                Свайп вправо — красная подсветка, отпустил — удалить.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Голосовое</div>
              <p>
                Зажми кнопку отправки на пустом поле — запись начнётся.
                Тапни маскота — пауза. Потяни вверх — отправить, вниз — отменить.
              </p>
            </div>
          </section>

          {/* ===== 2. ЛИЧНОЕ ===== */}
          <section ref={personalRef} className="info-chapter">
            <div className="info-chapter-head">
              <span className="info-chapter-num">02</span>
              <h3 className="info-chapter-title">Личное</h3>
            </div>
            <p className="info-chapter-lede">
              Один на один. Никто не подслушивает.
            </p>

            <div className="info-block">
              <div className="info-block-title">Открыть личку</div>
              <p>
                Из панели игроков — кнопка ✉️. Или свайп от правого края — там все диалоги.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Внутри</div>
              <p>
                Реакции, «печатает…», статус «прочитано».
                Фото и голосовые — тоже сюда.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Поиск</div>
              <p>
                Строка сверху. Ищешь по тексту — совпадения пульсируют голубым.
                Рядом — фильтр по дате: сегодня / 7 дней / 30 / всё.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Фон</div>
              <p>
                Кнопка-картинка в шапке лички. Семь пресетов, или своё фото до 15 МБ.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Удаление</div>
              <p>
                Своё можно убрать — долгий тап, потом 🗑️.
                Уйдёт у обоих. Чужое — не тронешь.
              </p>
            </div>
          </section>

          {/* ===== 3. КРУГ ===== */}
          <section ref={circleRef} className="info-chapter">
            <div className="info-chapter-head">
              <span className="info-chapter-num">03</span>
              <h3 className="info-chapter-title">Круг</h3>
            </div>
            <p className="info-chapter-lede">
              Те, кто рядом. Друзья, дуэли, блокировки.
            </p>

            <div className="info-block">
              <div className="info-block-title">Дружба — это ритуал</div>
              <p>
                Огонь слева, вода справа. Между ними нить.
                Один тянется — другой отвечает.
              </p>
              <p>
                Принять — нить стягивается, две половины становятся одним.
                Отклонить — нить гаснет. Чем больше отказов — тем холоднее цвет.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Дуэли</div>
              <p>
                Камень, ножницы, бумага. Проиграл — минута бана в общий чат.
                Счёт побед копится в профиле.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Блокировка</div>
              <p>
                Заблокированный исчезает из онлайна и из твоих диалогов.
                Разблокировать — в конце этого панели, в разделе «Заблокированные».
              </p>
            </div>
          </section>

          {/* ===== 4. ТЫ ===== */}
          <section ref={youRef} className="info-chapter">
            <div className="info-chapter-head">
              <span className="info-chapter-num">04</span>
              <h3 className="info-chapter-title">Ты</h3>
            </div>
            <p className="info-chapter-lede">
              Как ты выглядишь и как звучишь.
            </p>

            <div className="info-block">
              <div className="info-block-title">Профиль</div>
              <p>
                Зажми себя в панели игроков — откроется меню, там пункт «Профиль».
                Аватарка, пара слов о себе, оформление: 8 шрифтов, свой цвет, поворот.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Темы</div>
              <p>
                Светлая и тёмная. Кнопка справа сверху. Новая тема растекается кругом
                из точки тапа — иконка переворачивается.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Радио</div>
              <p>
                Маскот в шапке — это радио. Три трека по кругу.
                Короткий тап — пауза, долгий — следующий, свайп вверх-вниз — громкость.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Уведомления</div>
              <p>
                На iPhone — сначала установи на домашний экран, потом разреши.
                На Android — просто разреши в браузере. На иконке появится число непрочитанных.
              </p>
            </div>
          </section>

          {/* ===== 5. МЕЛОЧИ ===== */}
          <section ref={smallRef} className="info-chapter">
            <div className="info-chapter-head">
              <span className="info-chapter-num">05</span>
              <h3 className="info-chapter-title">Мелочи</h3>
            </div>
            <p className="info-chapter-lede">
              Жесты и пасхалки. Всё, что делает crew — живым.
            </p>

            <div className="info-block">
              <div className="info-block-title">Свайпы</div>
              <ul className="info-list">
                <li>Слева от края — панель игроков.</li>
                <li>Справа от края — диалоги.</li>
                <li>Влево по сообщению — ответ.</li>
                <li>Вправо по своему — удалить.</li>
                <li>Вниз по фото — закрыть.</li>
                <li>Вверх по капсуле — открыть меню.</li>
              </ul>
            </div>

            <div className="info-block">
              <div className="info-block-title">Полоска-пульс</div>
              <p>
                Под шапкой — тонкая волна. Она ничего не измеряет.
                Просто дышит вместе с теми, кто сейчас в чате.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">PWA</div>
              <p>
                iPhone: Safari → Поделиться → «На экран "Домой"».
                Android: меню браузера → Установить приложение.
                Откроется без адресной строки, во весь экран, с бейджем непрочитанного.
              </p>
            </div>

            <div className="info-block">
              <div className="info-block-title">Пасхалка</div>
              <p className="info-block-note">
                Пять тапов по маскоту в шапке. Дальше — тишина и ты.
              </p>
            </div>
          </section>

          {/* ===== ЗАБЛОКИРОВАННЫЕ ===== */}
          <section className="info-chapter info-chapter--outro">
            <div className="info-chapter-head">
              <span className="info-chapter-num">✦</span>
              <h3 className="info-chapter-title">Заблокированные</h3>
            </div>
            {blockedUsers.length === 0 ? (
              <p className="info-blocks-empty">Пока никого. Хорошо живёшь.</p>
            ) : (
              <ul className="info-blocks-list">
                {blockedUsers.map(u => (
                  <li key={u.userId} className="info-block-item">
                    <div
                      className="info-block-avatar"
                      style={u.avatarUrl
                        ? { backgroundImage: `url(${u.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { background: getAvatarColor(u.nickname) }
                      }
                    >
                      {!u.avatarUrl && getInitial(u.nickname)}
                    </div>
                    <span className="info-block-nick">{u.nickname}</span>
                    <button
                      type="button"
                      className="info-block-unblock"
                      onClick={() => onUnblockUser && onUnblockUser(u.userId)}
                      title="Разблокировать"
                    >
                      Вернуть
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ===== OUTRO ===== */}
          <section className="info-chapter info-chapter--end">
            <p className="info-end-line">
              Этот чат сделан братом и его Дзенами.
            </p>
            <p className="info-end-line info-end-line--muted">
              Ты — часть этого. Иначе бы не читал.
            </p>
            {onMessageAdmin && (
              <button
                type="button"
                className="info-admin-btn"
                onClick={onMessageAdmin}
              >
                ✉️ Написать админу
              </button>
            )}
          </section>

        </div>

        {easterOpen && (
          <div className="info-easter" onClick={() => setEasterOpen(false)}>
            <div className="info-easter-inner" onClick={(e) => e.stopPropagation()}>
              <div className="info-easter-mascot">
                <img src="/mascot.png" alt="" draggable={false} />
              </div>
              <p className="info-easter-text">
                Ты нашёл это. Значит, ты — свой.
              </p>
              <p className="info-easter-sub">
                Здесь пахнет розовым, звучит нить дружбы, и живёт маскот, который ждал.
              </p>
              <button
                type="button"
                className="info-easter-close"
                onClick={() => setEasterOpen(false)}
              >
                Я здесь
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
});

InfoPanel.displayName = 'InfoPanel';

export default InfoPanel;