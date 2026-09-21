import { forwardRef } from 'react';

/*
  [2.32.35] 8 визуальных демо: склейка, реакции, удаление, профиль,
            push, радио, темы, fullscreen.
  [2.32.28] Профиль, уведомления, склейка сообщений.
*/
const InfoPanel = forwardRef(({ onClose, onMessageAdmin }, ref) => {
  return (
    <>
      <div className="info-overlay" onClick={onClose} />
      <aside className="info-panel" ref={ref}>
        <header className="info-header">
          <div className="info-brand">
            <img
              src="/mascot.png"
              alt="banjoboy"
              className="info-brand-logo"
              draggable={false}
            />
            <div className="info-brand-text">
              <h2 className="info-brand-title">О приложении</h2>
              <div className="info-brand-subtitle">banjoboy's crew · v2.32.35</div>
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

        <div className="info-body">

          <p className="info-intro">
            Всё, что умеет чат — коротко и с примерами. Некоторые жесты проще
            один раз увидеть.
          </p>

          {/* ===== 1. Общий чат ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">💬</div>
              <h3>Общий чат</h3>
            </div>
            <p>
              Пиши текст, отправляй фото до 10 МБ, ставь реакции. История
              сохраняется — зайдёшь завтра, всё на месте.
            </p>
            <ul className="info-list">
              <li><b>Enter</b> — отправить.</li>
              <li><b>📎</b> — прикрепить фото.</li>
              <li>Пока печатаешь — другие видят «печатает…».</li>
            </ul>

            {/* ДЕМО: склейка */}
            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--merge">
                <div className="info-merge-card">
                  <span className="info-merge-avatar">Я</span>
                  <span className="info-merge-text">Привет</span>
                </div>
                <div className="info-merge-card info-merge-card--mid">
                  <span className="info-merge-text">Как дела</span>
                </div>
                <div className="info-merge-card info-merge-card--last">
                  <span className="info-merge-text">го в дуэль</span>
                </div>
              </div>
              <div className="info-demo-caption">подряд за минуту → одна карточка</div>
            </div>
          </section>

          {/* ===== 2. Реакции ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">🎭</div>
              <h3>Реакции</h3>
            </div>
            <p>
              Тапнул по сообщению — открылся пикер с реакциями:
            </p>

            {/* ДЕМО: пикер + палец */}
            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--reactions">
                <div className="info-reaction-card">
                  <span className="info-reaction-nick">Aня</span>
                  <span className="info-reaction-text">смотри что нашла</span>
                </div>
                <div className="info-reaction-picker">
                  <span className="info-reaction-emoji">👍</span>
                  <span className="info-reaction-emoji">👎</span>
                  <span className="info-reaction-emoji info-reaction-emoji--hit">❤️</span>
                  <span className="info-reaction-emoji">🔥</span>
                  <span className="info-reaction-emoji">😢</span>
                </div>
                <div className="info-reaction-finger">👆</div>
              </div>
              <div className="info-demo-caption">тапнул → пикер → тапнул эмодзи</div>
            </div>

            <p>
              Тапнул второй раз — реакция снята. Свои подсвечиваются синим.
            </p>
          </section>

          {/* ===== 3. Ответы ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">↩️</div>
              <h3>Ответы на сообщение</h3>
            </div>
            <p>
              <b>Свайп влево</b> по сообщению — от левого края расходится
              синяя подсветка. Отпускаешь, и сверху вылезает «кому отвечаешь».
            </p>

            <div className="info-demo">
              <div className="info-demo-stage">
                <div className="info-demo-card info-demo-card--swipe-left">
                  <span className="info-demo-card-avatar">A</span>
                  <span className="info-demo-card-lines"><i></i><i></i></span>
                </div>
                <div className="info-demo-arrow info-demo-arrow--reply">↩</div>
                <div className="info-demo-finger info-demo-finger--swipe-left">👆</div>
              </div>
              <div className="info-demo-caption">свайп влево → ответ</div>
            </div>

            <p>
              Внутри готового сообщения цитата кликабельна — тапнул, и чат
              прыгнул к оригиналу, оригинал мигнёт синим.
            </p>
          </section>

          {/* ===== 4. Своё сообщение ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">✏️</div>
              <h3>Своё сообщение</h3>
            </div>
            <p>
              Свои сообщения можно менять и удалять.
            </p>

            <div className="info-demo">
              <div className="info-demo-stage">
                <div className="info-demo-card info-demo-card--ring">
                  <span className="info-demo-card-avatar">Я</span>
                  <span className="info-demo-card-lines"><i></i><i></i></span>
                  <span className="info-demo-ring" />
                </div>
                <div className="info-demo-finger info-demo-finger--hold">👆</div>
              </div>
              <div className="info-demo-caption">зажми 1.5 сек</div>
            </div>

            <p>
              При удалении карточка едет вправо — так:
            </p>

            {/* ДЕМО: удаление */}
            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--delete">
                <div className="info-delete-glow" />
                <div className="info-delete-card">
                  <span className="info-delete-nick">Я</span>
                  <span className="info-delete-text">ой, не туда</span>
                </div>
                <div className="info-delete-finger">👆</div>
              </div>
              <div className="info-demo-caption">свайп вправо → удалить</div>
            </div>

            <ul className="info-list">
              <li><b>Телефон:</b> зажми — вокруг карточки кольцо, откроется редактор.</li>
              <li><b>Свайп вправо</b> по своему — красная подсветка справа, отпустил — удалить.</li>
              <li><b>ПК:</b> кнопки ✏️ и 🗑️ прямо в карточке.</li>
              <li>Редактор многострочный: <b>Enter</b> — сохранить, <b>Shift+Enter</b> — новая строка.</li>
            </ul>
          </section>

          {/* ===== 5. Профиль ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">👤</div>
              <h3>Профиль</h3>
            </div>
            <p>
              Зажми себя в панели игроков — откроется меню, там пункт
              <b> Профиль</b>. Можно поставить аватарку, написать пару слов о себе
              и оформить: 7 шрифтов, свой цвет, поворот.
            </p>

            {/* ДЕМО: мини-профиль */}
            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--profile">
                <div className="info-profile-card">
                  <div className="info-profile-avatar">A</div>
                  <div className="info-profile-meta">
                    <div className="info-profile-nick">Aня</div>
                    <div className="info-profile-bio" style={{ fontFamily: "'Caveat', cursive", color: '#3BB5E8', transform: 'rotate(-3deg)' }}>
                      люблю котиков и радио
                    </div>
                  </div>
                </div>
              </div>
              <div className="info-demo-caption">аватар · bio · стиль</div>
            </div>

            <ul className="info-list">
              <li><b>📷 Сменить фото</b> — выбери из галереи, до 2 МБ.</li>
              <li><b>Bio</b> — до 200 символов. Видно всем.</li>
              <li>Аватарка появляется в чате рядом с твоими сообщениями и в списке игроков.</li>
            </ul>
          </section>

          {/* ===== 6. Игроки и друзья ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">👥</div>
              <h3>Игроки и друзья</h3>
            </div>
            <p>
              Кнопка 👥 — панель игроков: кто онлайн, кто в друзьях, кто
              прислал запрос. Есть поиск по нику.
            </p>

            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--panel">
                <div className="info-demo-edge" />
                <div className="info-demo-panel-slide">👥</div>
                <div className="info-demo-finger info-demo-finger--swipe-right">👆</div>
              </div>
              <div className="info-demo-caption">свайп от левого края</div>
            </div>

            <ul className="info-list">
              <li><b>✉️</b> — написать личное сообщение.</li>
              <li><b>⚔️</b> — вызвать на дуэль.</li>
              <li><b>🤝</b> — отправить запрос дружбы.</li>
              <li><b>Долгий тап</b> на игроке — меню действий.</li>
            </ul>
          </section>

          {/* ===== 7. Личные сообщения ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">✉️</div>
              <h3>Личные сообщения</h3>
            </div>
            <p>
              Маленький чат только между вами. Открывается из панели игроков
              по ✉️ или из списка диалогов 💬.
            </p>
            <p>
              Внутри работают те же реакции. Видно «печатает…» и статус
              <b> прочитано / не прочитано</b>.
            </p>
          </section>

          {/* ===== 8. Диалоги ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">💬</div>
              <h3>Диалоги</h3>
            </div>
            <p>
              Кнопка 💬 — список всех личных чатов. Секции «Сегодня», «Вчера»,
              «Раньше». У непрочитанного — счётчик и подсветка.
            </p>
            <p>
              Если открыл диалог из этого списка — после закрытия
              автоматически вернёшься обратно в список.
            </p>
          </section>

          {/* ===== 9. Дуэли ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">⚔️</div>
              <h3>Дуэли</h3>
            </div>
            <p>
              Камень — ножницы — бумага. Вызываешь любого игрока из панели.
            </p>
            <ul className="info-list">
              <li>Проиграл — бан в общий чат на минуту.</li>
              <li>Счёт побед и поражений копится в профиле.</li>
              <li>Не ответили за 10 секунд — вызов сгорает.</li>
            </ul>
          </section>

          {/* ===== 10. Фото ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">📷</div>
              <h3>Просмотр фото</h3>
            </div>
            <p>
              Тап по фото — открывается на весь экран. Сверху видны автор
              и дата, счётчик «2 / 5». Снизу по центру — точки: где ты
              в галерее.
            </p>

            {/* ДЕМО: fullscreen */}
            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--fullscreen">
                <div className="info-fs-frame">
                  <div className="info-fs-photo" />
                  <div className="info-fs-counter">2 / 5</div>
                </div>
                <div className="info-fs-dots">
                  <span className="info-fs-dot" />
                  <span className="info-fs-dot info-fs-dot--active" />
                  <span className="info-fs-dot" />
                  <span className="info-fs-dot" />
                  <span className="info-fs-dot" />
                </div>
              </div>
              <div className="info-demo-caption">счётчик + точки</div>
            </div>

            <ul className="info-list">
              <li><b>Свайп влево-вправо</b> — перелистывание между фото чата.</li>
              <li><b>← →</b> на ПК — то же самое мышью.</li>
              <li><b>Двойной тап</b> — реакция ❤️ прямо в точку тапа.</li>
              <li><b>Свайп вниз</b> или <b>✕</b> — закрыть.</li>
            </ul>
          </section>

          {/* ===== 11. Уведомления ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">🔔</div>
              <h3>Уведомления</h3>
            </div>
            <p>
              На телефоне можно разрешить уведомления — тогда новое сообщение
              придёт, даже если чат закрыт или телефон в кармане.
            </p>

            {/* ДЕМО: push */}
            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--push">
                <div className="info-push-app">
                  <div className="info-push-app-icon">🐱</div>
                  <div className="info-push-badge">3</div>
                </div>
                <div className="info-push-notification">
                  <div className="info-push-row">
                    <span className="info-push-icon">🐱</span>
                    <span className="info-push-title">banjoboy's crew</span>
                  </div>
                  <div className="info-push-body">Aня: го в дуэль</div>
                </div>
              </div>
              <div className="info-demo-caption">push + бейдж на иконке</div>
            </div>

            <ul className="info-list">
              <li>На <b>iPhone</b> — сначала установи на домашний экран, потом разреши уведомления.</li>
              <li>На <b>Android</b> — просто разреши в браузере.</li>
              <li>На иконке появится число непрочитанных.</li>
            </ul>
          </section>

          {/* ===== 12. Радио ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">🎵</div>
              <h3>Радио</h3>
            </div>
            <p>
              Маскот в шапке — это радио. Три трека по кругу, играют в фоне.
            </p>

            {/* ДЕМО: радио */}
            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--radio">
                <div className="info-radio-mascot">
                  <span className="info-radio-bar" />
                  <span className="info-radio-bar" />
                  <span className="info-radio-bar" />
                  <span className="info-radio-bar" />
                </div>
                <div className="info-radio-title">♪ трек 2 · название</div>
              </div>
              <div className="info-demo-caption">маскот дрожит · эквалайзер · название</div>
            </div>

            <ul className="info-list">
              <li><b>Первый запуск</b> — зажми маскота, откроется мини-плеер, один раз нажми play.</li>
              <li><b>Короткий тап</b> — пауза или продолжить.</li>
              <li><b>Двойной тап</b> или <b>долгое нажатие</b> — следующий трек.</li>
              <li><b>Свайп вверх/вниз</b> по маскоту — громкость.</li>
            </ul>
          </section>

          {/* ===== 13. Темы ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">🌙</div>
              <h3>Темы</h3>
            </div>
            <p>
              Светлая и тёмная. Кнопка 🌙/☀️ справа вверху. Новая тема
              растекается кругом из точки нажатия, иконка переворачивается.
            </p>

            {/* ДЕМО: темы */}
            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--theme">
                <div className="info-theme-split">
                  <div className="info-theme-half info-theme-half--light">
                    <span className="info-theme-icon">☀️</span>
                  </div>
                  <div className="info-theme-half info-theme-half--dark">
                    <span className="info-theme-icon">🌙</span>
                  </div>
                  <div className="info-theme-reveal" />
                </div>
              </div>
              <div className="info-demo-caption">круг из точки тапа</div>
            </div>
          </section>

          {/* ===== 14. Нижняя капсула ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">📱</div>
              <h3>Нижняя капсула</h3>
            </div>
            <p>
              На телефоне внизу — розовая полоска. Внутри две кнопки:
              игроки и написать.
            </p>

            <div className="info-demo">
              <div className="info-demo-stage info-demo-stage--capsule">
                <div className="info-demo-capsule-closed">
                  <span className="info-demo-capsule-arrow">▲</span>
                </div>
                <div className="info-demo-capsule-open">
                  <span className="info-demo-capsule-btn">👥</span>
                  <span className="info-demo-capsule-btn">✏️</span>
                </div>
              </div>
              <div className="info-demo-caption">свайп вверх → меню</div>
            </div>

            <ul className="info-list">
              <li><b>Тап</b> или <b>свайп вверх</b> — развернуть.</li>
              <li><b>Свайп вверх</b> ещё раз — сразу открыть ввод сообщения.</li>
              <li><b>Свайп вниз</b> по капсуле — свернуть.</li>
              <li>Если есть непрочитанное — на полоске пульсирует красная точка.</li>
            </ul>
          </section>

          {/* ===== 15. PWA ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">📲</div>
              <h3>Установить как приложение</h3>
            </div>
            <p>
              На iPhone открой чат в <b>Safari</b> → нажми <b>Поделиться</b> →
              выбери <b>«На экран "Домой"»</b>. Появится иконка на домашнем
              экране, чат будет открываться без адресной строки, во весь
              экран, с бейджем непрочитанного на иконке.
            </p>
          </section>

          {/* ===== 16. Все жесты ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">✨</div>
              <h3>Все жесты одной картинкой</h3>
            </div>
            <ul className="info-list info-list--gestures">
              <li><span className="info-gesture">👈</span> Свайп от левого края — панель игроков.</li>
              <li><span className="info-gesture">👈</span> Свайп влево по сообщению — ответ.</li>
              <li><span className="info-gesture">👉</span> Свайп вправо по своему — удалить.</li>
              <li><span className="info-gesture">👇</span> Долгий тап по своему — редактировать.</li>
              <li><span className="info-gesture">👇</span> Свайп вниз по полю ввода — скрыть клавиатуру.</li>
              <li><span className="info-gesture">👇</span> Свайп вниз в фото — закрыть.</li>
              <li><span className="info-gesture">👆</span> Свайп вверх по капсуле — открыть.</li>
              <li><span className="info-gesture">👆</span> Свайп вверх/вниз по маскоту — громкость.</li>
            </ul>
          </section>

          <section className="info-section info-section--outro">
            <p>
              Что-то сломалось или есть вопрос — напиши админу.
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
      </aside>
    </>
  );
});

InfoPanel.displayName = 'InfoPanel';

export default InfoPanel;