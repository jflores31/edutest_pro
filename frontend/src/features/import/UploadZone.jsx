import { useRef, useState } from 'react';
import { Icon, Badge } from '../../design-system';

export default function UploadZone({ onFile, error }) {
  const inputRef = useRef(null);
  const dragCountRef = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  function handleDragEnter(e) {
    e.preventDefault();
    dragCountRef.current++;
    e.currentTarget.classList.add('border-accent', 'bg-accent/5');
    e.currentTarget.classList.remove('border-line');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      e.currentTarget.classList.remove('border-accent', 'bg-accent/5');
      e.currentTarget.classList.add('border-line');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCountRef.current = 0;
    e.currentTarget.classList.remove('border-accent', 'bg-accent/5');
    e.currentTarget.classList.add('border-line');
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl">
          {error}
        </div>
      )}
      <div
        className="border-2 border-dashed border-line rounded-xl p-12 text-center transition-colors cursor-pointer hover:border-fg-3"
        onDragEnter={handleDragEnter}
        onDragOver={e => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }}
        />
        <div className="grid h-14 w-14 place-items-center rounded-full bg-accent/10 mx-auto mb-4">
          <Icon name="upload" size={22} className="text-accent" />
        </div>
        <h3 className="text-base font-medium text-fg-0 mb-1">Arrastra el archivo aquí</h3>
        <p className="text-sm text-fg-2 mb-4">o haz clic para seleccionar</p>
        <Badge variant="neutral">CSV · XLSX · Máx 10 MB · 2,000 filas</Badge>
      </div>
    </div>
  );
}
