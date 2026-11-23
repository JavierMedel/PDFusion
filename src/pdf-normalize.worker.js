import createQpdf from '@neslinesli93/qpdf-wasm';
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';

self.onmessage = async ({ data: file }) => {
  try {
    const qpdf = await createQpdf({ locateFile: () => wasmUrl });
    qpdf.FS.mkdir('/input');
    qpdf.FS.mount(qpdf.WORKERFS, { blobs: [{ name: 'source.pdf', data: file }] }, '/input');

    const status = qpdf.callMain(['/input/source.pdf', '--decrypt', '--no-warn', '/output.pdf']);
    if (status !== 0 && status !== 3) throw new Error('QPDF could not read the document.');

    const bytes = qpdf.FS.readFile('/output.pdf');
    self.postMessage(bytes, [bytes.buffer]);
  } catch {
    self.postMessage(null);
  }
};
