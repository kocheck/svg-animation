import { useDocumentContext } from '../context/EditorContext.jsx';
import { useUIContext } from '../context/EditorContext.jsx';
import Card from './Card';

export default function Gallery() {
  const { state: docState } = useDocumentContext();
  const { state: ui } = useUIContext();

  return (
    <div className={`gallery grid-${ui.gridCols}`}>
      {docState.documents.map((doc) => (
        <Card key={doc.id} document={doc} />
      ))}
    </div>
  );
}
