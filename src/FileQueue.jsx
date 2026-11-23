import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, GripVertical, Layers2, X } from 'lucide-react';
import { formatSize, plural } from './format.js';

export default function FileQueue({ files, selectedId, disabled, onSelect, onMove, onRemove, onClear }) {
  const [drag, setDrag] = useState(null);

  function startDrag(event, id) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.setDragImage(event.currentTarget.closest('li'), 22, 22);
    setDrag({ id, over: null });
  }

  function dragOver(event, id) {
    if (!drag || disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (drag.over !== id) setDrag({ ...drag, over: id });
  }

  function drop(event, index) {
    if (!drag || disabled) return;
    event.preventDefault();
    onMove(drag.id, index);
    setDrag(null);
  }

  function moveWithKeyboard(event, id, index) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const grip = event.currentTarget;
    onMove(id, index + (event.key === 'ArrowLeft' ? -1 : 1));
    requestAnimationFrame(() => grip.focus());
  }

  return (
    <section className="panel queue-panel" aria-labelledby="queue-title">
      <div className="panel-heading queue-heading">
        <span className="heading-icon"><Layers2 size={19} /></span>
        <h2 id="queue-title">Your PDFs</h2>
        <span className="file-count">{plural(files.length, 'file')}</span>
        {files.length > 0 && (
          <button type="button" className="text-button clear-button" onClick={onClear} disabled={disabled}>
            Clear all
          </button>
        )}
      </div>

      {files.length === 0 ? (
        <div className="queue-empty">
          <span className="empty-file-icon"><FileText size={20} /></span>
          <div>
            <p>No files added yet</p>
            <span>Your PDFs will appear here in merge order.</span>
          </div>
        </div>
      ) : (
        <>
          {files.length > 1 && (
            <p id="reorder-hint" className="queue-hint">Drag cards or use the move buttons to set the merge order.</p>
          )}
          <ol className="file-list" aria-label="PDFs in merge order">
            {files.map((file, index) => (
              <li
                key={file.id}
                className={`pdf-card${selectedId === file.id ? ' selected' : ''}${drag?.id === file.id ? ' dragging' : ''}${drag?.over === file.id && drag.id !== file.id ? ' drop-target' : ''}`}
                onDragOver={event => dragOver(event, file.id)}
                onDrop={event => drop(event, index)}
              >
                <div className="card-actions">
                  <button
                    type="button"
                    className="icon-button drag-grip"
                    aria-label={`Reorder ${file.name}`}
                    aria-describedby={files.length > 1 ? 'reorder-hint' : undefined}
                    title="Drag, or use the left and right arrow keys"
                    draggable={!disabled && files.length > 1}
                    disabled={disabled || files.length < 2}
                    onDragStart={event => startDrag(event, file.id)}
                    onDragEnd={() => setDrag(null)}
                    onKeyDown={event => moveWithKeyboard(event, file.id, index)}
                  ><GripVertical size={16} /></button>
                  <span className="order-number" aria-label={`Position ${index + 1}`}>{index + 1}</span>
                  <button
                    type="button"
                    className="icon-button remove-button"
                    aria-label={`Remove ${file.name}`}
                    title="Remove PDF"
                    disabled={disabled}
                    onClick={() => onRemove(file.id)}
                  ><X size={16} /></button>
                </div>
                <button
                  type="button"
                  className="file-select"
                  aria-pressed={selectedId === file.id}
                  aria-label={`Preview ${file.name}`}
                  aria-describedby={`details-${file.id}`}
                  onClick={() => onSelect(file.id)}
                >
                  <span className="thumbnail">
                    {file.thumbnail ? <img src={file.thumbnail} alt="" draggable="false" /> : <FileText size={28} />}
                  </span>
                  <span className="file-name" title={file.name}>{file.name}</span>
                  <span className="file-detail" id={`details-${file.id}`}>{plural(file.pages, 'page')} <span aria-hidden="true">·</span> {formatSize(file.size)}</span>
                </button>
                {files.length > 1 && (
                  <div className="move-actions">
                    <button className="icon-button" type="button" disabled={disabled || index === 0} onClick={() => onMove(file.id, index - 1)} aria-label={`Move ${file.name} earlier`} title="Move earlier"><ChevronLeft size={16} /></button>
                    <button className="icon-button" type="button" disabled={disabled || index === files.length - 1} onClick={() => onMove(file.id, index + 1)} aria-label={`Move ${file.name} later`} title="Move later"><ChevronRight size={16} /></button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
