import { useEffect, useRef } from 'react';
import { setSpeedOnSvg } from '../hooks/useAnimation';

/** Card — individual SVG animation card in the gallery grid */
export default function Card({
  svg,
  index,
  globalSpeed,
  paused,
  onFocus,
  onEdit,
  onRemove,
}) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const svgEl = wrapRef.current?.querySelector('svg');
    if (svgEl) {
      svgEl.style.animationPlayState = paused ? 'paused' : 'running';
      setSpeedOnSvg(svgEl, globalSpeed, paused);
    }
  }, [globalSpeed, paused, svg.src]);

  const handleClick = (e) => {
    if (e.target.closest('.remove-btn')) {
      onRemove(index);
      return;
    }
    if (e.target.closest('.edit-btn')) {
      onEdit(index);
      return;
    }
    onFocus(index);
  };

  return (
    <div className="card" onClick={handleClick}>
      <div className="svg-wrap">
        <div
          className="inline-svg"
          ref={wrapRef}
          dangerouslySetInnerHTML={{ __html: svg.src }}
        />
      </div>
      <div className="card-label">
        <span>{svg.name}</span>
        <span>
          <button className="edit-btn" data-idx={index}>
            Edit
          </button>
          <button className="remove-btn" data-idx={index}>
            Remove
          </button>
        </span>
      </div>
    </div>
  );
}
