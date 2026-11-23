import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUp, FileText, Layers2, Plus, ShieldCheck, X } from 'lucide-react';
import CompressionPanel, { Progress } from './CompressionPanel.jsx';
import FileQueue from './FileQueue.jsx';
import PreviewPanel from './PreviewPanel.jsx';
import { downloadName } from './format.js';

const loadProcessing = () => import('./pdf-processing.js');
const defaultFilename = 'merged-document';

function UploadArea({ progress, onImport }) {
  const picker = useRef(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const importing = progress?.scope === 'import';

  function isFileDrag(event) {
    return event.dataTransfer.types.includes('Files');
  }

  function enter(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    depth.current++;
    if (!progress) setOver(true);
  }

  function leave(event) {
    if (!isFileDrag(event)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }

  function dragOver(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = progress ? 'none' : 'copy';
  }

  function drop(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    depth.current = 0;
    setOver(false);
    onImport(Array.from(event.dataTransfer.files));
  }

  return (
    <section className={`upload-area${over ? ' file-over' : ''}`} aria-labelledby="upload-title" onDragEnter={enter} onDragLeave={leave} onDragOver={dragOver} onDrop={drop}>
      <div className="upload-illustration" aria-hidden="true">
        <span className="illustration-sheet back-left" />
        <span className="illustration-sheet back-right" />
        <span className="illustration-sheet front"><FileText size={26} strokeWidth={1.6} /></span>
        <span className="upload-arrow"><ArrowUp size={18} strokeWidth={2.4} /></span>
      </div>
      <h2 id="upload-title">{over ? 'Drop your PDFs here' : 'Drag & drop your PDFs'}</h2>
      <p>or browse files from your device</p>
      <input ref={picker} type="file" accept="application/pdf,.pdf" multiple hidden onChange={event => {
        onImport(Array.from(event.target.files));
        event.target.value = '';
      }} />
      {importing ? (
        <Progress progress={progress} className="upload-progress" />
      ) : (
        <button id="import-pdfs" type="button" className="button primary import-button" onClick={() => picker.current.click()} disabled={Boolean(progress)}><Plus size={19} /> Import PDFs</button>
      )}
    </section>
  );
}

function AppHeader() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-icon"><Layers2 size={23} strokeWidth={1.9} /></span>
          <div className="brand-text"><span className="brand-name">PDFusion</span><span className="tagline">Merge PDFs, beautifully.</span></div>
        </div>
        <span className="privacy"><ShieldCheck size={17} /> Files stay on your device</span>
      </div>
    </header>
  );
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [selection, setSelection] = useState({ id: null, page: 1 });
  const [target, setTarget] = useState(30);
  const [estimate, setEstimate] = useState(null);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [filename, setFilename] = useState(defaultFilename);
  const [messages, setMessages] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const operation = useRef(false);
  const selected = files.find(file => file.id === selection.id);
  const estimatingPaused = Boolean(progress || result);

  useEffect(() => {
    if (!files.length || estimatingPaused) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const { estimateImageSavings } = await import('./compression.js');
        const value = await estimateImageSavings(files, target, controller.signal);
        if (!controller.signal.aborted) setEstimate(value);
      } catch {
        if (!controller.signal.aborted) setEstimate({ eligible: false, bytes: 0 });
      }
    }, 160);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [files, target, estimatingPaused]);

  useEffect(() => {
    function keepFileDropsInApp(event) {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    }

    window.addEventListener('dragover', keepFileDropsInApp);
    window.addEventListener('drop', keepFileDropsInApp);
    return () => {
      window.removeEventListener('dragover', keepFileDropsInApp);
      window.removeEventListener('drop', keepFileDropsInApp);
    };
  }, []);

  function finishOperation() {
    operation.current = false;
    setProgress(null);
  }

  async function importFiles(incoming) {
    if (!incoming.length || operation.current) return;
    operation.current = true;
    setMessages([]);
    setProgress({ scope: 'import', label: 'Opening PDFs', value: 0 });
    const imported = [];
    const failures = [];

    try {
      const { importPdf } = await loadProcessing();
      for (const [index, file] of incoming.entries()) {
        const position = `${index + 1} of ${incoming.length}`;
        setProgress({ scope: 'import', label: `Opening file ${position}`, value: 100 * index / incoming.length });
        try {
          const loaded = await importPdf(file, label => {
            setProgress({ scope: 'import', label: `${label} ${position}`, value: 100 * (index + 0.5) / incoming.length });
          });
          imported.push(loaded);
        } catch (error) {
          failures.push({ file: file.name, message: error.message || 'This PDF could not be imported.' });
        }
      }
    } catch {
      failures.push({ message: 'The PDF tools could not load. Refresh the app and try again.' });
    } finally {
      if (imported.length) {
        setFiles(previous => [...previous, ...imported]);
        setSelection(previous => previous.id ? previous : { id: imported[0].id, page: 1 });
        setEstimate(null);
        setResult(null);
        setAnnouncement(`${imported.length} ${imported.length === 1 ? 'PDF' : 'PDFs'} imported.`);
      }
      setMessages(failures);
      finishOperation();
    }
  }

  function selectFile(id) {
    setSelection(previous => previous.id === id ? previous : { id, page: 1 });
  }

  function moveFile(id, to) {
    if (operation.current || to < 0 || to >= files.length) return;
    const from = files.findIndex(file => file.id === id);
    if (from < 0 || from === to) return;

    const next = [...files];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setFiles(next);
    setResult(null);
    setAnnouncement(`${moved.name} moved to position ${to + 1} of ${files.length}.`);
  }

  function removeFile(id) {
    if (operation.current) return;
    const index = files.findIndex(file => file.id === id);
    if (index < 0) return;

    const removed = files[index];
    const next = files.filter(file => file.id !== id);
    setFiles(next);
    if (selection.id === id) setSelection({ id: (next[index] || next[index - 1])?.id ?? null, page: 1 });
    setResult(null);
    setEstimate(null);
    setAnnouncement(`${removed.name} removed.`);
    removed.preview.destroy().catch(() => {});
  }

  function clearFiles() {
    if (operation.current) return;
    for (const file of files) file.preview.destroy().catch(() => {});
    setFiles([]);
    setSelection({ id: null, page: 1 });
    setTarget(30);
    setEstimate(null);
    setResult(null);
    setFilename(defaultFilename);
    setMessages([]);
    setAnnouncement('All PDFs cleared.');
    requestAnimationFrame(() => document.getElementById('import-pdfs')?.focus());
  }

  async function mergeFiles() {
    if (!files.length || operation.current) return;
    operation.current = true;
    setMessages([]);
    setProgress({ scope: 'merge', label: 'Starting merge', value: 0 });

    try {
      const { mergePdfs } = await loadProcessing();
      const merged = await mergePdfs(files, target, (label, value) => setProgress({ scope: 'merge', label, value }));
      setResult(merged);
    } catch {
      setMessages([{ message: 'These PDFs could not be merged. Try importing fresh copies or merging fewer files at a time.' }]);
    } finally {
      finishOperation();
    }
  }

  async function saveResult() {
    if (!result || operation.current) return;
    operation.current = true;
    setProgress({ scope: 'download', label: 'Preparing download' });
    try {
      const { yieldToBrowser } = await loadProcessing();
      await yieldToBrowser();
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName(filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setAnnouncement(`Download started for ${link.download}.`);
    } catch {
      setMessages([{ message: 'The download could not be started. Try downloading again.' }]);
    } finally {
      finishOperation();
    }
  }

  return (
    <>
      <AppHeader />
      <main className="main-content">
        <div className="intro">
          <h1>Merge your <span>PDFs.</span></h1>
          <p>Arrange, preview, and combine your documents into one PDF.</p>
        </div>

        <div className="workspace">
          <div className="workspace-main">
            <UploadArea progress={progress} onImport={importFiles} />
            {messages.length > 0 && (
              <div className="notice" role="alert">
                <AlertCircle size={19} />
                <div className="notice-messages">{messages.map(({ file, message }, index) => <p key={index}>{file && <strong>{file}. </strong>}{message}</p>)}</div>
                <button className="icon-button" type="button" onClick={() => setMessages([])} aria-label="Dismiss errors"><X size={17} /></button>
              </div>
            )}
            <FileQueue files={files} selectedId={selection.id} disabled={Boolean(progress)} onSelect={selectFile} onMove={moveFile} onRemove={removeFile} onClear={clearFiles} />
          </div>

          <div className="workspace-side">
            <PreviewPanel file={selected} page={selection.page} onPage={page => setSelection(previous => ({ ...previous, page }))} />
            <CompressionPanel
              files={files}
              target={target}
              onTarget={value => { setTarget(value); setEstimate(null); setResult(null); }}
              estimate={estimate}
              progress={progress}
              result={result}
              filename={filename}
              setFilename={setFilename}
              onMerge={mergeFiles}
              onDownload={saveResult}
              onClear={clearFiles}
            />
          </div>
        </div>
        <span className="sr-only" role="status">{announcement}</span>
      </main>
    </>
  );
}
