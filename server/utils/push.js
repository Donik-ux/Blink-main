// Web Push utility
let webpush = null;
let isConfigured = false;

const init = async () => {
  if (webpush !== null) return webpush;
  try {
    const mod = await import('web-push');
    webpush = mod.default || mod;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@blink.app';
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      isConfigured = true;
    } else {
      console.warn('⚠ VAPID keys not set — web push disabled');
    }
  } catch (err) {
    console.warn('⚠ web-push не установлен:', err.message);
  }
  return webpush;
};

export const getPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';

export const sendPush = async (subscription, payload) => {
  await init();
  if (!isConfigured || !webpush || !subscription) return false;
  try {
    await webpush.sendNotification(
      subscription,
      typeof payload === 'string' ? payload : JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    // 410 = expired subscription
    if (err.statusCode === 410 || err.statusCode === 404) return 'expired';
    console.warn('Push error:', err.message);
    return false;
  }
};

// Шлёт пуши всем подпискам пользователя; чистит протухшие
export const sendPushToUser = async (User, userId, payload) => {
  try {
    const user = await User.findById(userId);
    if (!user || !Array.isArray(user.pushSubscriptions) || user.pushSubscriptions.length === 0) return;
    const survivors = [];
    for (const sub of user.pushSubscriptions) {
      const result = await sendPush(sub, payload);
      if (result !== 'expired') survivors.push(sub);
    }
    if (survivors.length !== user.pushSubscriptions.length) {
      user.pushSubscriptions = survivors;
      await user.save();
    }
  } catch (err) {
    console.warn('sendPushToUser err:', err.message);
  }
};
