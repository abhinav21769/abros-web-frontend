// The logo is stored inline on the company document as a data URI, so it is
// resized in the browser before it ever reaches the API. The cap matches the
// backend's (300KB of encoded data).
export const MAX_LOGO_BYTES = 300 * 1024;
export const MAX_LOGO_DIMENSION = 512;

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function isAcceptedLogoType(type) {
  return ACCEPTED_TYPES.includes(String(type || "").toLowerCase());
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file is not a readable image."));
    image.src = dataUrl;
  });
}

// Data URIs are ~4/3 the size of the bytes they carry, which is what the
// server-side length check measures.
export function dataUrlByteLength(dataUrl) {
  return String(dataUrl || "").length;
}

/**
 * Turns a picked file into a data URI small enough to store. The image is
 * scaled down to fit MAX_LOGO_DIMENSION, then re-encoded at falling quality
 * until it fits the cap. A file that cannot be made to fit is rejected here
 * rather than by the API.
 */
export async function prepareLogoFile(file) {
  if (!file) {
    throw new Error("Please choose an image file.");
  }

  if (!isAcceptedLogoType(file.type)) {
    throw new Error("Logo must be a PNG, JPG or WebP image.");
  }

  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);

  const scale = Math.min(
    1,
    MAX_LOGO_DIMENSION / Math.max(image.width, image.height),
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  // PNG first so a logo with transparency keeps it; JPEG at falling quality is
  // the fallback for photographs that would otherwise be far too large.
  const png = canvas.toDataURL("image/png");
  if (dataUrlByteLength(png) <= MAX_LOGO_BYTES) {
    return png;
  }

  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    const jpeg = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlByteLength(jpeg) <= MAX_LOGO_BYTES) {
      return jpeg;
    }
  }

  throw new Error("That image is too detailed to store. Please use a simpler logo.");
}
