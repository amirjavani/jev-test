import { imageLayout, MAX_IMAGE_BYTES } from '../shared/image-files.js';

export async function readImage(file) {
  if (!/\.(png|jpe?g)$/i.test(file.name)) throw new Error(`${file.name}: choose a PNG or JPEG image.`);
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: choose an image no larger than 16 MB.`);
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`${file.name}: the image could not be opened. Try re-exporting it as PNG or JPEG.`); }
  try {
    const layout = imageLayout(bitmap.width, bitmap.height);
    // Re-encode upright, without EXIF metadata, and pad narrow/small images to the API minimum.
    const canvas = document.createElement('canvas');
    canvas.width = layout.width; canvas.height = layout.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, (canvas.width - layout.drawWidth) / 2, (canvas.height - layout.drawHeight) / 2, layout.drawWidth, layout.drawHeight);
    const format = /\.png$/i.test(file.name) ? 'png' : 'jpeg';
    const preview = canvas.toDataURL(`image/${format}`, 0.9);
    if (!preview.startsWith(`data:image/${format};base64,`)) throw new Error('Could not prepare this image.');
    return { id: crypto.randomUUID(), name: file.name, width: canvas.width, height: canvas.height,
      resized: canvas.width !== bitmap.width || canvas.height !== bitmap.height, preview,
      asset: { type: 'image', format, data_base64: preview.split(',')[1] } };
  } finally { bitmap.close(); }
}
