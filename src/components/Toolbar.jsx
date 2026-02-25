import { useUIContext } from '../context/EditorContext.jsx';

const BG_CYCLE = ['dark', 'light', 'checker'];
const BG_LABELS = { dark: 'Dark', light: 'Light', checker: 'Checker' };

export default function Toolbar() {
  const { state: ui, dispatch } = useUIContext();

  const cycleBg = () => {
    const idx = BG_CYCLE.indexOf(ui.previewBackground);
    dispatch({ type: 'SET_PREVIEW_BG', mode: BG_CYCLE[(idx + 1) % BG_CYCLE.length] });
  };

  return (
    <div className="toolbar">
      <label>Grid</label>
      {[1, 2, 3].map((n) => (
        <button key={n} className={ui.gridCols === n ? 'active' : ''} onClick={() => dispatch({ type: 'SET_GRID_COLS', cols: n })}>{n}</button>
      ))}
      <div className="sep" />
      <label>Global Speed</label>
      <input type="range" min="0.1" max="5" step="0.1" value={ui.globalSpeed} onChange={(e) => dispatch({ type: 'SET_SPEED', speed: parseFloat(e.target.value) })} />
      <span className="speed-val">{ui.globalSpeed.toFixed(1)}x</span>
      <div className="sep" />
      <button onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}>{ui.paused ? 'Play All' : 'Pause All'}</button>
      <button onClick={() => dispatch({ type: 'RESET_SPEED' })}>Reset Speed</button>
      <div className="sep" />
      <button data-testid="bg-toggle" onClick={cycleBg}>BG: {BG_LABELS[ui.previewBackground]}</button>
    </div>
  );
}
