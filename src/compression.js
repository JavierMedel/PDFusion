import { PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';

const name = value => PDFName.of(value);
const customImageSettings = ['Decode', 'DecodeParms', 'ImageMask', 'Mask', 'SMask', 'SMaskInData', 'Alternates'];

function isPlainColorJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;

  let components = 0;
  for (let offset = 2; offset + 3 < bytes.length;) {
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda) return components === 3;

    // Leave JPEGs with EXIF, ICC profiles, or Adobe color transforms alone.
    if (marker === 0xe1 || marker === 0xe2 || marker === 0xee) return false;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return false;
    if (marker >= 0xc0 && marker <= 0xc2 && length >= 8) components = bytes[offset + 7];
    offset += length;
  }

  return false;
}

export function findCompressibleImages(context) {
  const images = [];

  for (const [ref, stream] of context.enumerateIndirectObjects()) {
    if (!(stream instanceof PDFRawStream)) continue;
    const { dict } = stream;
    if (
      dict.lookup(name('Subtype')) !== name('Image') ||
      dict.lookup(name('Filter')) !== name('DCTDecode') ||
      dict.lookup(name('ColorSpace')) !== name('DeviceRGB') ||
      customImageSettings.some(setting => dict.has(name(setting)))
    ) continue;

    const width = dict.lookup(name('Width'));
    const height = dict.lookup(name('Height'));
    const depth = dict.lookup(name('BitsPerComponent'));
    if (!(width instanceof PDFNumber && height instanceof PDFNumber && depth instanceof PDFNumber)) continue;

    const w = width.asNumber();
    const h = height.asNumber();
    const bytes = stream.getContents();
    if (
      depth.asNumber() !== 8 || w < 1 || h < 1 || w > 8192 || h > 8192 ||
      w * h > 12_000_000 || bytes.length < 24 * 1024 || !isPlainColorJpeg(bytes)
    ) continue;

    images.push({ ref, stream, bytes, width: w, height: h });
  }

  return images;
}

async function recompressImage({ bytes, width, height }, target) {
  let bitmap;
  let canvas;

  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    if (bitmap.width !== width || bitmap.height !== height) return null;

    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0);

    const quality = 1 - target / 125;
    const encoded = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    return encoded?.type === 'image/jpeg' && encoded.size + 128 < bytes.length ? encoded : null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
    if (canvas) canvas.width = canvas.height = 0;
  }
}

export async function estimateImageSavings(files, target, signal) {
  const eligible = files.flatMap(file => file.images);
  if (!eligible.length) return { eligible: false, bytes: 0 };

  const sizes = eligible.reduce((total, image) => total + image.bytes.length, 0);
  const sample = eligible.sort((a, b) => b.bytes.length - a.bytes.length).slice(0, 3);
  let sampleSize = 0;
  let savings = 0;

  for (const image of sample) {
    signal.throwIfAborted();
    const encoded = await recompressImage(image, target);
    sampleSize += image.bytes.length;
    if (encoded) savings += image.bytes.length - encoded.size;
  }

  return { eligible: true, bytes: Math.round(sizes * savings / sampleSize) };
}

export async function optimizeImages(context, target, onProgress) {
  const images = findCompressibleImages(context);

  for (const [index, image] of images.entries()) {
    onProgress(index + 1, images.length);
    const encoded = await recompressImage(image, target);
    if (!encoded) continue;

    const bytes = new Uint8Array(await encoded.arrayBuffer());
    context.assign(image.ref, PDFRawStream.of(image.stream.dict, bytes));
  }
}
