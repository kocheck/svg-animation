/** Toolbar — grid layout, global speed, pause/reset controls */
export default function Toolbar({
  gridCols,
  onGridChange,
  globalSpeed,
  onSpeedChange,
  paused,
  onTogglePause,
  onResetSpeed,
}) {
  return (
    <div className="toolbar">
      <label>Grid</label>
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          className={gridCols === n ? 'active' : ''}
          onClick={() => onGridChange(n)}
        >
          {n}
        </button>
      ))}
      <div className="sep" />

      <label>Global Speed</label>
      <input
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        value={globalSpeed}
        onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
      />
      <span className="speed-val">{globalSpeed.toFixed(1)}x</span>
      <div className="sep" />

      <button onClick={onTogglePause}>
        {paused ? 'Play All' : 'Pause All'}
      </button>
      <button onClick={onResetSpeed}>Reset Speed</button>
    </div>
  );
}
