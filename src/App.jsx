import { useState, useCallback } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import Gallery from './components/Gallery';
import DropZone from './components/DropZone';
import CodeEditor from './components/CodeEditor';
import FocusOverlay from './components/FocusOverlay';

/** App — root component managing global SVG animation state */
export default function App() {
  const [svgs, setSvgs] = useState([]);
  const [gridCols, setGridCols] = useState(2);
  const [globalSpeed, setGlobalSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [editTarget, setEditTarget] = useState(null);

  const handleRemove = useCallback((index) => {
    setSvgs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleEdit = useCallback(
    (index) => {
      setEditTarget({ ...svgs[index], _ts: Date.now() });
      setFocusIndex(-1);
    },
    [svgs],
  );

  const handleAddToGallery = useCallback((svg) => {
    setSvgs((prev) => [...prev, svg]);
  }, []);

  const handleFileAdded = useCallback((svg) => {
    setSvgs((prev) => [...prev, svg]);
  }, []);

  const handleTogglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const handleResetSpeed = useCallback(() => {
    setGlobalSpeed(1);
  }, []);

  return (
    <>
      <Header count={svgs.length} />
      <Toolbar
        gridCols={gridCols}
        onGridChange={setGridCols}
        globalSpeed={globalSpeed}
        onSpeedChange={setGlobalSpeed}
        paused={paused}
        onTogglePause={handleTogglePause}
        onResetSpeed={handleResetSpeed}
      />
      <Gallery
        svgs={svgs}
        gridCols={gridCols}
        globalSpeed={globalSpeed}
        paused={paused}
        onFocus={setFocusIndex}
        onEdit={handleEdit}
        onRemove={handleRemove}
      />
      <DropZone onFilesAdded={handleFileAdded} />
      <CodeEditor onAddToGallery={handleAddToGallery} editTarget={editTarget} />
      <FocusOverlay
        svgs={svgs}
        focusIndex={focusIndex}
        globalSpeed={globalSpeed}
        globalPaused={paused}
        onClose={() => setFocusIndex(-1)}
        onEdit={handleEdit}
        onNavigate={setFocusIndex}
      />
    </>
  );
}
