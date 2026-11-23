import { PDFDocument } from 'pdf-lib';
import { findCompressibleImages, optimizeImages } from './compression.js';
import { openPreview, renderPage } from './pdf-preview.js';

export const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

function normalizePdf(file) {
  const worker = new Worker(new URL('./pdf-normalize.worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const rejectWorker = () => reject(new Error('Could not prepare a compatible PDF.'));
    worker.onmessage = ({ data }) => data instanceof Uint8Array ? resolve(data) : rejectWorker();
    worker.onerror = rejectWorker;
    worker.onmessageerror = rejectWorker;
    worker.postMessage(file);
  }).finally(() => worker.terminate());
}

async function loadMergeSource(bytes, pageCount) {
  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  if (source.getPageCount() !== pageCount) throw new Error('PDF page counts do not match.');
  return source;
}

async function prepareMergeSource(file, bytes, pageCount, onStage) {
  try {
    return await loadMergeSource(bytes, pageCount);
  } catch {
    onStage('Preparing compatible copy');
    try {
      return await loadMergeSource(await normalizePdf(file), pageCount);
    } catch {
      throw new Error('This PDF can be viewed but could not be prepared for merging. Export a new PDF and try again.');
    }
  }
}

export async function importPdf(file, onStage) {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    throw new Error('Choose a PDF file.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) {
    throw new Error('This file does not contain a valid PDF.');
  }

  let preview;
  try {
    preview = await openPreview(bytes);
  } catch (error) {
    if (error.name === 'PasswordException') {
      throw new Error('This PDF requires a password to open. Save an unlocked copy before importing.');
    }
    throw new Error('This PDF could not be loaded for preview. Try a fresh copy or refresh the app.');
  }

  try {
    if (preview.numPages < 1) throw new Error('This PDF contains no pages.');
    const source = await prepareMergeSource(file, bytes, preview.numPages, onStage);

    onStage('Generating thumbnail');
    const canvas = document.createElement('canvas');
    let thumbnail = null;
    try {
      await renderPage(preview, 1, canvas, { width: 160, height: 112, pixelRatio: 2 });
      thumbnail = canvas.toDataURL('image/png');
    } catch {
      // A failed thumbnail does not prevent the document from merging.
    } finally {
      canvas.width = canvas.height = 0;
    }

    return {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      pages: preview.numPages,
      source,
      preview,
      thumbnail,
      images: findCompressibleImages(source.context),
    };
  } catch (error) {
    await preview.destroy().catch(() => {});
    throw error;
  }
}

export async function mergePdfs(files, target, onProgress) {
  const output = await PDFDocument.create({ updateMetadata: false });
  output.setTitle('Merged PDF');
  output.setCreator('PDFusion');

  for (const [index, file] of files.entries()) {
    onProgress(`Copying PDF ${index + 1} of ${files.length}`, 5 + 50 * index / files.length);
    await yieldToBrowser();
    const pages = await output.copyPages(file.source, file.source.getPageIndices());
    for (const page of pages) output.addPage(page);
  }

  onProgress('Optimizing document', 55);
  await yieldToBrowser();
  await optimizeImages(output.context, target, (index, count) => {
    onProgress(`Optimizing image ${index} of ${count}`, 55 + 30 * (index - 1) / count);
  });

  onProgress('Writing merged PDF', 88);
  await yieldToBrowser();
  const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 35 });

  onProgress('Preparing download', 96);
  await yieldToBrowser();
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    pages: output.getPageCount(),
    originalSize: files.reduce((total, file) => total + file.size, 0),
  };
}
