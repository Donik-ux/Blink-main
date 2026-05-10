import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const Terms = () => (
  <div className="min-h-screen bg-bg text-white/90 px-4 py-6">
    <div className="max-w-2xl mx-auto">
      <Link to="/profile" className="press inline-flex items-center gap-2 text-white/60 hover:text-white mb-6">
        <ArrowLeft size={18} /> Назад
      </Link>
      <h1 className="text-3xl font-bold mb-2">Условия использования</h1>
      <p className="text-white/50 text-sm mb-8">Последнее обновление: 10 мая 2026</p>

      <div className="space-y-6 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold mb-2">1. Принятие условий</h2>
          <p className="text-white/80">
            Используя Blink, вы соглашаетесь с этими условиями. Если не согласны — не используйте сервис.
            Минимальный возраст: 13 лет (или больше согласно законам вашей страны).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">2. Ваш аккаунт</h2>
          <ul className="list-disc pl-6 space-y-1 text-white/80">
            <li>Указывайте настоящие данные (имя, email).</li>
            <li>Не передавайте логин/пароль третьим лицам.</li>
            <li>Один человек = один аккаунт. Боты, фейки, продажа аккаунтов запрещены.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">3. Запрещённый контент</h2>
          <ul className="list-disc pl-6 space-y-1 text-white/80">
            <li>Спам, мошенничество, фишинг.</li>
            <li>Угрозы, оскорбления, дискриминация, hate speech.</li>
            <li>Откровенный контент (NSFW), материалы, нарушающие права детей.</li>
            <li>Сталкинг — слежка за людьми без их согласия. Делитесь локацией только с теми, кто согласен.</li>
            <li>Любая незаконная активность согласно законам Узбекистана / страны пребывания.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">4. Безопасность локации</h2>
          <p className="text-white/80">
            Помните: ваша локация видна только добавленным друзьям. Не добавляйте незнакомцев.
            Используйте режим призрака и приватные зоны для дополнительной защиты.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">5. Жалобы и блокировка</h2>
          <p className="text-white/80">
            Каждый пользователь может пожаловаться на другого через FriendPopup → меню → «Пожаловаться».
            Мы рассматриваем жалобы в течение 72 часов. Нарушители блокируются.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">6. Прекращение</h2>
          <p className="text-white/80">
            Вы можете удалить аккаунт в любое время (Профиль → Опасная зона). Мы можем приостановить
            или удалить ваш аккаунт за нарушение этих условий, без возврата средств (если применимо).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">7. Ответственность</h2>
          <p className="text-white/80">
            Сервис предоставляется «как есть». Мы не гарантируем 100% доступность и не несём
            ответственности за решения, принятые на основе данных в приложении (например, точность
            локации друга в момент времени).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">8. Изменения</h2>
          <p className="text-white/80">
            Условия могут обновляться. Существенные изменения мы анонсируем через push-уведомление.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-2">9. Контакты</h2>
          <p className="text-white/80">
            <a className="text-accent" href="mailto:support@blink.app">support@blink.app</a>
          </p>
        </section>
      </div>
    </div>
  </div>
);
