import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, FileSearch, LoaderCircle, Maximize2, X } from 'lucide-react';
import { renderPage } from './pdf-preview.js';

function PageCanvas({ file, page, expanded }) {
  const canvas = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    renderPage(file.preview, page, canvas.current, {
      width: expanded ? 900 : 385,
      height: expanded ? 1000 : 320,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      signal: controller.signal,
    }).then(() => {
      if (!controller.signal.aborted) setStatus('ready');
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('error');
    });

    return () => controller.abort();
  }, [file, page, expanded]);

  return (
    <>
      <canvas ref={canvas} hidden={status !== 'ready'} role="img" aria-label={`Page ${page} of ${file.name}`} />
      {status === 'loading' && <div className="preview-status" role="status"><LoaderCircle className="spinner" size={21} /> Rendering page…</div>}
      {status === 'error' && <p className="preview-status" role="status">This page couldn’t be previewed.</p>}
    </>
  );
}

function PageControls({ file, page, onPage }) {
  return (
    <div className="page-controls" aria-label="Page navigation">
      <button className="icon-button page-button" type="button" disabled={!file || page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button>
      <span className="page-count" aria-live="polite">{file ? `Page ${page} of ${file.pages}` : 'Page – of –'}</span>
      <button className="icon-button page-button" type="button" disabled={!file || page >= file.pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={18} /></button>
    </div>
  );
}

export default function PreviewPanel({ file, page, onPage }) {
  const dialog = useRef(null);
  const [expanded, setExpanded] = useState(false);

  function openDialog() {
    dialog.current.showModal();
    setExpanded(true);
  }

  function navigateWithKeys(event) {
    if (!file || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    onPage(Math.min(file.pages, Math.max(1, page + (event.key === 'ArrowLeft' ? -1 : 1))));
  }

  return (
    <section className="panel preview-panel" aria-labelledby="preview-title">
      <div className="panel-heading">
        <span className="heading-icon"><Eye size={19} /></span>
        <h2 id="preview-title">Preview</h2>
        <button className="icon-button expand-button" type="button" disabled={!file} onClick={openDialog} aria-label="Expand PDF preview" title="Expand preview"><Maximize2 size={17} /></button>
      </div>
      {file && <p className="preview-filename" title={file.name}>{file.name}</p>}
      <div className={`preview-stage${file ? ' has-page' : ''}`}>
        {file ? (
          <PageCanvas key={`${file.id}-${page}`} file={file} page={page} />
        ) : (
          <div className="preview-empty">
            <span className="preview-illustration"><FileSearch size={25} strokeWidth={1.55} /></span>
            <p>No PDF selected</p>
            <span>Select an imported PDF to preview it.</span>
          </div>
        )}
      </div>
      <PageControls file={file} page={page} onPage={onPage} />

      <dialog ref={dialog} className="preview-dialog" aria-labelledby="dialog-filename" onClose={() => setExpanded(false)} onKeyDown={navigateWithKeys}>
        <div className="dialog-heading">
          <span className="heading-icon"><Eye size={19} /></span>
          <h2 id="dialog-filename">{file?.name}</h2>
          <button className="icon-button" type="button" onClick={() => dialog.current.close()} aria-label="Close preview" autoFocus><X size={21} /></button>
        </div>
        {expanded && file && (
          <>
            <div className="dialog-stage"><PageCanvas key={`${file.id}-${page}`} file={file} page={page} expanded /></div>
            <PageControls file={file} page={page} onPage={onPage} />
          </>
        )}
      </dialog>
    </section>
  );
}
