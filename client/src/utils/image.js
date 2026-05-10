// Сжатие картинки на клиенте.
// Опции:
//   maxSize   — максимальная сторона
//   quality   — стартовое качество JPEG
//   maxBytes  — максимум base64-длины (сжимаем агрессивнее если превышаем)
//   square    — true для квадратного crop (аватары/сторис), false — сохраняет пропорции
export const compressImage = (file, {
  maxSize = 256,
  quality = 0.82,
  maxBytes = 90_000,
  square = true,
} = {}) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Не картинка'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не смогли прочитать файл'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не смогли декодировать картинку'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';

        if (square) {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          canvas.width = maxSize;
          canvas.height = maxSize;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        } else {
          // Сохраняем пропорции: вписываем в квадрат maxSize x maxSize
          const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }

        let q = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', q);
        while (dataUrl.length > maxBytes && q > 0.4) {
          q -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', q);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
