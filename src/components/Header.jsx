/** Header — title and animation count display */
export default function Header({ count }) {
  return (
    <header>
      <h1>SVG Animation Viewer</h1>
      <span className="count">
        {count} animation{count !== 1 ? 's' : ''}
      </span>
    </header>
  );
}
