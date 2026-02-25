import { useEffect } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import Gallery from './components/Gallery';
import DropZone from './components/DropZone';
import CodeEditor from './components/CodeEditor';
import FocusOverlay from './components/FocusOverlay';
import InspectorPanel from './components/Inspector/InspectorPanel';
import { useSelectionContext } from './context/EditorContext.jsx';

export default function App() {
  const { state: selection, dispatch: selectionDispatch } = useSelectionContext();
  const hasSelection = selection.elementId !== null;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && hasSelection) {
        selectionDispatch({ type: 'CLEAR_SELECTION' });
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasSelection, selectionDispatch]);

  return (
    <>
      <Header />
      <Toolbar />
      <div className={`main-content${hasSelection ? ' with-inspector' : ''}`}>
        <Gallery />
        {hasSelection && <InspectorPanel />}
      </div>
      <CodeEditor />
      <DropZone />
      <FocusOverlay />
    </>
  );
}
