import { useDocumentContext } from '../context/EditorContext.jsx';

export default function Header() {
  const { state } = useDocumentContext();
  const count = state.documents.length;
  return (
    <header>
      <h1>SVG Animation Viewer</h1>
      <span className="count">{count} animation{count !== 1 ? 's' : ''}</span>
    </header>
  );
}
