import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const Privacy = () => (
  <div className="min-h-screen bg-bg text-white/90 px-4 py-6">
    <div className="max-w-2xl mx-auto">
      <Link to="/profile" className="press inline-flex items-center gap-2 text-white/60 hover:text-white mb-6">
        <ArrowLeft size={18} /> Назад
      </Link>
      <h1 className="text-3xl font-bold mb-2">Политика конфиденциальности</h1>
      <p className="text-white/50 text-sm mb-8">Последнее обновление: 10 мая 2026</p>

      <div className="space-y-6 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold mb-2">1. Какие данные мы собираем</h2>
          <ul className="list-disc pl-6 space-y-1 text-white/80">
            <li><b>Аккаунт:</b> имя, email, аватар (опционально), пароль (хешированный).</li>
            <li><b>Локация:</b> текущие координаты, история перемещений (хранится 7 дней), скорость, направление.</li>
            <li><b>Социальные:</b> список друзей, сообщения, чек-ины, истории, бейджи.</li>
            <li><b>Техническая:</b> IP, тип устройства, версия браузера (для безопасности и аналитики).</li>
            <li><b>Push-подписки:</b> для отправки уведомлений на ваше устройство.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">2. Как мы используем данные</h2>
          <ul className="list-disc pl-6 space-y-1 text-white/80">
            <li>Показываем вашу локацию только друзьям, которых вы добавили.</li>
            <li>Отправляем push-уведомления (когда друг рядом, новое сообщение, гео-зона).</li>
            <li>Не передаём ваши данные третьим лицам в маркетинговых целях.</li>
            <li>Используем безопасное хранение (bcrypt для паролей, JWT для сессий, HTTPS для передачи).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">3. Контроль и приватность</h2>
          <ul className="list-disc pl-6 space-y-1 text-white/80">
            <li><b>Режим призрака:</b> моментально скрывает вашу локацию от всех.</li>
            <li><b>Приватные зоны:</b> укажите радиус вокруг дома — точная координата скрывается.</li>
            <li><b>Удаление аккаунта:</b> в Профиле → Опасная зона → удаляются все данные навсегда (GDPR Art. 17).</li>
            <li><b>Блокировка/жалобы:</b> любого пользователя можно заблокировать или пожаловаться.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">4. Хранение</h2>
          <p className="text-white/80">
            Данные хранятся в защищённой БД. История локаций автоматически удаляется через 7 дней,
            истории — через 24 часа. При удалении аккаунта все связанные данные стираются немедленно.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">5. Cookies и аналитика</h2>
          <p className="text-white/80">
            Мы используем localStorage для сохранения сессии. Сторонние трекеры не используем.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">6. Дети</h2>
          <p className="text-white/80">
            Сервис не предназначен для детей младше 13 лет. Если вы родитель и обнаружили,
            что ваш ребёнок зарегистрировался — напишите на support@blink.app, мы удалим аккаунт.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">7. Контакты</h2>
          <p className="text-white/80">
            По любым вопросам конфиденциальности: <a className="text-accent" href="mailto:support@blink.app">support@blink.app</a>
          </p>
        </section>
      </div>
    </div>
  </div>
);
