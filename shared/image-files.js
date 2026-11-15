export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
// Leave room for the local API envelope inside the server's 32 MB body limit.
export const MAX_IMAGE_REQUEST_BYTES = 31 * 1024 * 1024;

export function imageLayout(width, height) {
  if (!(width > 0 && height > 0)) throw new Error('The image has invalid dimensions.');
  const scale = Math.min(1, 1568 / Math.max(width, height));
  const drawWidth = Math.max(1, Math.round(width * scale));
  const drawHeight = Math.max(1, Math.round(height * scale));
  return { width: Math.max(280, drawWidth), height: Math.max(280, drawHeight), drawWidth, drawHeight };
}

export function attachImages(states, assets, images) {
  const merged = { ...(assets || {}) };
  for (const image of images) {
    if (Object.hasOwn(merged, image.id)) throw new Error('An uploaded image reference conflicts with an advanced asset.');
    merged[image.id] = image.asset;
  }
  return {
    states: images.length ? states.map(context => ({ context, images: images.map(image => image.id) })) : states,
    ...(Object.keys(merged).length ? { assets: merged } : {}),
  };
}

export function checkImageRequestSize(request) {
  if (new TextEncoder().encode(JSON.stringify(request)).byteLength > MAX_IMAGE_REQUEST_BYTES) {
    throw new Error('Request is too large. Remove images or use smaller files (31 MB total request limit).');
  }
}
