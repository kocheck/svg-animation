import Card from './Card';

/** Gallery — grid of SVG animation cards */
export default function Gallery({
  svgs,
  gridCols,
  globalSpeed,
  paused,
  onFocus,
  onEdit,
  onRemove,
}) {
  return (
    <div className={`gallery grid-${gridCols}`}>
      {svgs.map((svg, i) => (
        <Card
          key={`${svg.name}-${i}`}
          svg={svg}
          index={i}
          globalSpeed={globalSpeed}
          paused={paused}
          onFocus={onFocus}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
