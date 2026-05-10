import nodemailer from 'nodemailer';

// SMTP конфиг через .env. Если SMTP_HOST не задан — режим dev: пишем письма в консоль.
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM = process.env.MAIL_FROM || 'Blink <noreply@blink.app>';

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  console.log('✓ SMTP готов:', SMTP_HOST);
} else {
  console.warn('ℹ SMTP не настроен — письма выводятся в консоль (dev режим)');
}

export const sendMail = async ({ to, subject, html, text }) => {
  if (!transporter) {
    console.log('\n📧 [DEV MAIL]');
    console.log('   To:     ', to);
    console.log('   Subject:', subject);
    console.log('   Text:   ', text || html?.replace(/<[^>]+>/g, ' ').slice(0, 300));
    console.log('');
    return { dev: true };
  }
  return transporter.sendMail({ from: FROM, to, subject, html, text });
};

export const passwordResetEmail = (name, link) => ({
  subject: 'Blink — сброс пароля',
  text: `Здравствуйте, ${name}!\n\nВы запросили сброс пароля. Перейдите по ссылке (действительна 1 час):\n${link}\n\nЕсли это были не вы — просто проигнорируйте.`,
  html: `<p>Здравствуйте, <b>${name}</b>!</p>
<p>Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы задать новый пароль (ссылка работает 1 час):</p>
<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#00d9ff;color:#000;border-radius:8px;text-decoration:none;font-weight:bold">Сбросить пароль</a></p>
<p>Если это были не вы — просто проигнорируйте это письмо.</p>`,
});

export const emailVerifyEmail = (name, link) => ({
  subject: 'Blink — подтверждение email',
  text: `Здравствуйте, ${name}!\n\nПодтвердите ваш email перейдя по ссылке (действительна 24 часа):\n${link}`,
  html: `<p>Здравствуйте, <b>${name}</b>!</p>
<p>Подтвердите ваш email — нажмите кнопку ниже (ссылка работает 24 часа):</p>
<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#00d9ff;color:#000;border-radius:8px;text-decoration:none;font-weight:bold">Подтвердить email</a></p>`,
});
