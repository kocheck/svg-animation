import { useState, useCallback } from 'react';
import { useDocumentMutation } from '../../hooks/useDocumentMutation.js';
import { EASING_PRESETS, EASING_NAMES, getPresetName } from '../../model/easingPresets.js';

function parseDuration(str) {
  if (!str) return 0;
  const num = parseFloat(str);
  if (str.includes('ms')) return num / 1000;
  return num;
}

export default function TimingControls({ element, animations }) {
  const { mutate } = useDocumentMutation();
  const elementId = element.getAttribute('data-svgdoc-id');

  if (!animations || animations.length === 0) return null;

  return (
    <div className="inspector-section">
      <div className="inspector-section-title">Timing</div>
      <div className="timing-controls">
        {animations.map((anim, i) => (
          <AnimationSection
            key={`${anim.name}-${i}`}
            anim={anim}
            index={i}
            elementId={elementId}
            mutate={mutate}
          />
        ))}
      </div>
    </div>
  );
}

function AnimationSection({ anim, index, elementId, mutate }) {
  const props = anim.properties;
  const [duration, setDuration] = useState(parseDuration(props.duration));
  const [delay, setDelay] = useState(parseDuration(props.delay));
  const [isInfinite, setIsInfinite] = useState(
    props.iterationCount === 'infinite' || props.iterationCount === 'indefinite'
  );
  const [iterationCount, setIterationCount] = useState(
    isInfinite ? 1 : (parseInt(props.iterationCount) || 1)
  );

  const presetName = getPresetName(props.easing);
  const [easingMode, setEasingMode] = useState(presetName ? presetName : 'custom');
  const [customEasing, setCustomEasing] = useState(
    presetName ? '' : (props.easing || '')
  );

  const commitTiming = useCallback(() => {
    if (anim.type === 'smil') return;

    const easingValue = easingMode === 'custom'
      ? customEasing
      : EASING_PRESETS[easingMode] || 'ease';

    mutate((doc) => {
      const el = doc.querySelector(`[data-svgdoc-id="${elementId}"]`);
      if (!el) return;
      doc.setStyle(el, 'animationDuration', `${duration}s`);
      doc.setStyle(el, 'animationDelay', `${delay}s`);
      doc.setStyle(el, 'animationIterationCount', isInfinite ? 'infinite' : String(iterationCount));
      doc.setStyle(el, 'animationTimingFunction', easingValue);
    });
  }, [anim.type, duration, delay, isInfinite, iterationCount, easingMode, customEasing, elementId, mutate]);

  if (anim.type === 'smil') {
    return (
      <div className="timing-animation-section">
        <div className="timing-anim-name">{anim.name}</div>
        <div className="timing-smil-notice">
          SMIL timing is read-only. Edit via the attribute editor (<code>dur</code>, <code>begin</code>, <code>repeatCount</code>).
        </div>
      </div>
    );
  }

  const currentEasingValue = easingMode === 'custom'
    ? customEasing
    : (EASING_PRESETS[easingMode] || 'ease');

  return (
    <div className="timing-animation-section">
      <div className="timing-anim-name">{anim.name}</div>

      <div className="timing-row">
        <label>Duration</label>
        <input
          data-testid={`timing-duration-${index}`}
          type="number"
          min="0.1"
          max="30"
          step="0.1"
          value={duration}
          onChange={(e) => setDuration(parseFloat(e.target.value) || 0)}
          onBlur={commitTiming}
        />
        <span className="timing-unit">s</span>
      </div>

      <div className="timing-row">
        <label>Delay</label>
        <input
          data-testid={`timing-delay-${index}`}
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={delay}
          onChange={(e) => setDelay(parseFloat(e.target.value) || 0)}
          onBlur={commitTiming}
        />
        <span className="timing-unit">s</span>
      </div>

      <div className="timing-row">
        <label>Iterations</label>
        {!isInfinite && (
          <input
            data-testid={`timing-iterations-${index}`}
            type="number"
            min="1"
            max="100"
            step="1"
            value={iterationCount}
            onChange={(e) => setIterationCount(parseInt(e.target.value) || 1)}
            onBlur={commitTiming}
          />
        )}
        <label className="timing-infinite-label">
          <input
            data-testid={`timing-infinite-${index}`}
            type="checkbox"
            checked={isInfinite}
            onChange={(e) => {
              setIsInfinite(e.target.checked);
              setTimeout(commitTiming, 0);
            }}
          />
          Infinite
        </label>
      </div>

      <div className="timing-row">
        <label>Easing</label>
        <select
          data-testid={`timing-easing-${index}`}
          value={easingMode}
          onChange={(e) => {
            setEasingMode(e.target.value);
            if (e.target.value !== 'custom') {
              setTimeout(commitTiming, 0);
            }
          }}
        >
          {EASING_NAMES.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
          <option value="custom">Custom...</option>
        </select>
      </div>

      {easingMode === 'custom' && (
        <div className="timing-row">
          <input
            data-testid={`timing-easing-custom-${index}`}
            type="text"
            placeholder="cubic-bezier(x1, y1, x2, y2)"
            value={customEasing}
            onChange={(e) => setCustomEasing(e.target.value)}
            onBlur={commitTiming}
          />
        </div>
      )}

      <div className="easing-preview" data-testid={`easing-preview-${index}`}>
        <div
          className="easing-preview-dot"
          style={{ animationTimingFunction: currentEasingValue }}
        />
      </div>
    </div>
  );
}
