import { forwardRef } from 'react';

/*
  [2.32.0] Полная переработка: «О приложении».
           Секции с иконками, мини-анимации жестов,
           крестик 44×44 с safe-area сверху.
  [2.19.1] Кнопка «Написать админу».
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
              <div className="info-brand-subtitle">banjoboy's crew · v2.32.0</div>
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
          </section>

          {/* ===== 2. Реакции ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">🎭</div>
              <h3>Реакции</h3>
            </div>
            <p>
              Тапнул по сообщению — открылись пять реакций:
            </p>
            <div className="info-emoji-row">
              <span>👍</span><span>👎</span><span>❤️</span><span>🔥</span><span>😢</span>
            </div>
            <p>
              Тапнул второй раз — реакция снята. Свои подсвечиваются
              синим, счётчик появляется, когда голосов больше одного.
            </p>
          </section>

          {/* ===== 3. Ответы ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">↩️</div>
              <h3>Ответы на сообщение</h3>
            </div>
            <p>
              <b>Свайп влево</b> по сообщению — появится стрелка, отпускаешь,
              и сверху вылезает «кому отвечаешь».
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

            <ul className="info-list">
              <li><b>Телефон:</b> зажми сообщение — вокруг карточки нарисуется кольцо, откроется редактор.</li>
              <li><b>Свайп вправо</b> по своему — удалить.</li>
              <li><b>ПК:</b> кнопки ✏️ и 🗑️ прямо в карточке.</li>
            </ul>
          </section>

          {/* ===== 5. Игроки и друзья ===== */}
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

          {/* ===== 6. Личные сообщения ===== */}
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

          {/* ===== 7. Диалоги ===== */}
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

          {/* ===== 8. Дуэли ===== */}
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

          {/* ===== 9. Фото ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">📷</div>
              <h3>Просмотр фото</h3>
            </div>
            <p>
              Тап по фото — открывается на весь экран. Сверху видны автор и
              дата.
            </p>
            <ul className="info-list">
              <li><b>Свайп влево-вправо</b> — перелистывание между фото чата.</li>
              <li><b>Двойной тап</b> — реакция ❤️ прямо в точку тапа.</li>
              <li><b>Свайп вниз</b> — закрыть.</li>
              <li><b>✕</b> в углу — закрыть.</li>
            </ul>
          </section>

          {/* ===== 10. Радио ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">🎵</div>
              <h3>Радио</h3>
            </div>
            <p>
              Маскот в шапке — это радио. Три трека по кругу, играют в фоне.
            </p>
            <ul className="info-list">
              <li><b>Первый запуск</b> — тапнешь маскота, откроется мини-плеер, один раз нажми play.</li>
              <li><b>Короткий тап</b> — пауза или продолжить.</li>
              <li><b>Двойной тап</b> или <b>долгое нажатие</b> — следующий трек.</li>
              <li><b>Свайп вверх/вниз</b> по маскоту — громкость.</li>
            </ul>
            <p>
              Когда играет — маскот дрожит, под ним прыгает эквалайзер,
              в шапке на 5 секунд появляется название трека.
            </p>
          </section>

          {/* ===== 11. Темы ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">🌙</div>
              <h3>Темы</h3>
            </div>
            <p>
              Светлая и тёмная. Кнопка 🌙/☀️ справа вверху. При переключении
              новая тема растекается по экрану кругом из точки нажатия, а
              иконка переворачивается. Настройка запоминается.
            </p>
          </section>

          {/* ===== 12. Мобильные жесты ===== */}
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

          {/* ===== 13. PWA ===== */}
          <section className="info-section">
            <div className="info-section-head">
              <div className="info-section-icon">📲</div>
              <h3>Установить как приложение</h3>
            </div>
            <p>
              На iPhone открой чат в <b>Safari</b> → нажми <b>Поделиться</b> →
              выбери <b>«На экран “Домой”»</b>. Появится иконка на домашнем
              экране, чат будет открываться без адресной строки, во весь
              экран, с бейджем непрочитанного на иконке.
            </p>
          </section>

          {/* ===== 14. Жесты одной таблицей ===== */}
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