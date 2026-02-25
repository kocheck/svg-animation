import Header from './components/Header';
import Toolbar from './components/Toolbar';
import Gallery from './components/Gallery';
import DropZone from './components/DropZone';
import CodeEditor from './components/CodeEditor';
import FocusOverlay from './components/FocusOverlay';

export default function App() {
  return (
    <>
      <Header />
      <Toolbar />
      <Gallery />
      <CodeEditor />
      <DropZone />
      <FocusOverlay />
    </>
  );
}
