import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export async function openPreview(bytes) {
  const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  GlobalWorkerOptions.workerSrc = pdfWorker;

  const assets = `${import.meta.env.BASE_URL}pdfjs/`;
  const loadingTask = getDocument({
    data: bytes.slice(),
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    iccUrl: `${assets}iccs/`,
    isEvalSupported: false,
    enableXfa: false,
  });

  try {
    return await loadingTask.promise;
  } catch (error) {
    await loadingTask.destroy().catch(() => {});
    throw error;
  }
}

export async function renderPage(pdf, pageNumber, canvas, { width, height, pixelRatio = 1, signal }) {
  const page = await pdf.getPage(pageNumber);
  signal?.throwIfAborted();

  const naturalSize = page.getViewport({ scale: 1 });
  const scale = Math.min(width / naturalSize.width, height / naturalSize.height);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.max(1, Math.ceil(viewport.width * pixelRatio));
  canvas.height = Math.max(1, Math.ceil(viewport.height * pixelRatio));
  canvas.style.width = `${viewport.width}px`;

  const task = page.render({
    canvas,
    viewport,
    transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
  });
  const cancel = () => task.cancel();
  signal?.addEventListener('abort', cancel, { once: true });

  try {
    await task.promise;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}
