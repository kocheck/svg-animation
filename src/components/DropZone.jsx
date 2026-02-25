import { useRef, useState } from 'react';
import { useDocumentContext } from '../context/EditorContext.jsx';

export default function DropZone() {
  const { dispatch } = useDocumentContext();
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files) => {
    Array.from(files).forEach((file) => {
      if (!file.name.endsWith('.svg')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const name = file.name.replace('.svg', '');
        dispatch({ type: 'ADD_DOCUMENT', name, src: e.target.result });
      };
      reader.readAsText(file);
    });
  };

  return (
    <div
      className={`drop-zone${dragOver ? ' drag-over' : ''}`}
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      <strong>Drop SVG files here to add them</strong>
      <p>Or click to browse</p>
      <input ref={fileRef} type="file" accept=".svg" multiple onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}
