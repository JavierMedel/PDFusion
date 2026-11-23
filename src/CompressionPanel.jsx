import { useEffect, useRef } from 'react';
import { Check, Combine, Download, Info, LoaderCircle, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { formatSize, plural } from './format.js';

export function Progress({ progress, className = '' }) {
  return (
    <div className={`progress ${className}`}>
      <div className="progress-label" role="status"><LoaderCircle size={15} className="spinner" /> {progress.label}</div>
      {progress.value === undefined ? <progress aria-label={progress.label} /> : <progress aria-label={progress.label} value={progress.value} max="100" />}
    </div>
  );
}

function DownloadResult({ result, filename, onFilename, downloading, onDownload, onClear, disabled }) {
  const filenameInput = useRef(null);
  const sizeDifference = result.originalSize - result.blob.size;
  const percent = Math.round(Math.abs(sizeDifference) / result.originalSize * 100);
  const sizeLabel = percent < 1 ? 'Similar size to the originals' : `${percent}% ${sizeDifference > 0 ? 'smaller' : 'larger'} than the originals`;

  useEffect(() => {
    filenameInput.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="download-result">
      <div className="result-heading" role="status">
        <span className="success-icon"><Check size={17} /></span>
        <div><strong>PDF ready to download</strong><p>{plural(result.pages, 'page')} · {formatSize(result.blob.size)}</p></div>
      </div>
      <p className="result-savings">{sizeLabel}</p>
      <label className="filename-label" htmlFor="output-filename">Output filename</label>
      <div className="filename-field">
        <input ref={filenameInput} id="output-filename" type="text" value={filename} onChange={event => onFilename(event.target.value)} placeholder="merged-document" spellCheck="false" maxLength={180} disabled={downloading} />
        <span aria-hidden="true">.pdf</span>
      </div>
      <button type="button" className="button primary full-width" disabled={disabled || downloading} onClick={onDownload}>
        {downloading ? <LoaderCircle className="spinner" size={18} /> : <Download size={18} />}
        {downloading ? 'Preparing download…' : 'Download PDF'}
      </button>
      <button type="button" className="text-button start-over" onClick={onClear} disabled={disabled || downloading}><RotateCcw size={15} /> Start over</button>
    </div>
  );
}

export default function CompressionPanel({ files, target, onTarget, estimate, progress, result, filename, setFilename, onMerge, onDownload, onClear }) {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const estimatedPercent = totalSize ? Math.round((estimate?.bytes || 0) / totalSize * 100) : 0;
  const merging = progress?.scope === 'merge';
  let estimateText = 'Import PDFs to estimate savings.';
  if (totalSize && !estimate) estimateText = 'Estimating image savings…';
  if (estimate?.eligible && estimatedPercent > 0) estimateText = `Estimated image savings: ~${formatSize(estimate.bytes)} (${estimatedPercent}%)`;
  if (estimate?.eligible && estimatedPercent === 0) estimateText = 'Little or no image savings at this target.';
  if (estimate && !estimate.eligible) estimateText = 'Document optimization only for these PDFs.';

  return (
    <section className="panel compression-panel" aria-labelledby="compression-title">
      <div className="panel-heading">
        <span className="heading-icon"><SlidersHorizontal size={18} /></span>
        <h2 id="compression-title">Compression</h2>
      </div>
      <div className="slider-heading">
        <label htmlFor="compression-target">Compression target</label>
        <output htmlFor="compression-target" className="target-value">{target}%</output>
      </div>
      <input
        type="range"
        id="compression-target"
        min="10"
        max="90"
        step="10"
        value={target}
        style={{ '--range-fill': `${(target - 10) / 80 * 100}%` }}
        aria-valuetext={`${target}% target`}
        aria-describedby="compression-description"
        disabled={Boolean(progress)}
        onChange={event => onTarget(Number(event.target.value))}
      />
      <div className="range-labels" aria-hidden="true"><span>10%</span><span>50%</span><span>90%</span></div>
      <p className="compression-description" id="compression-description">Higher targets trade quality for size on compatible JPEGs. Actual savings vary by PDF.</p>
      <p className="estimate" role="status"><Info size={15} /> {estimateText}</p>
      <div className="compression-action">
        {merging && <Progress progress={progress} />}
        {result && !merging ? (
          <DownloadResult result={result} filename={filename} onFilename={setFilename} downloading={progress?.scope === 'download'} onDownload={onDownload} onClear={onClear} disabled={Boolean(progress)} />
        ) : (
          <button type="button" className="button primary full-width" disabled={!files.length || Boolean(progress)} onClick={onMerge}>
            {merging ? <LoaderCircle size={19} className="spinner" /> : <Combine size={19} />}
            {merging ? 'Merging PDFs…' : 'Merge PDFs'}
          </button>
        )}
      </div>
    </section>
  );
}
