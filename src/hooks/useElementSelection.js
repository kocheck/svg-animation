import { useEffect } from 'react';

export function useElementSelection(containerRef, { onSelect, onHover }) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function findSvgDocId(target) {
      let el = target;
      while (el && el !== container) {
        if (
          el.hasAttribute?.('data-svgdoc-id') &&
          el.tagName !== 'svg' &&
          el.localName !== 'svg'
        ) {
          return el.getAttribute('data-svgdoc-id');
        }
        el = el.parentElement;
      }
      return null;
    }

    function handleClick(e) {
      const id = findSvgDocId(e.target);
      onSelect(id);
    }

    function handleMouseMove(e) {
      const id = findSvgDocId(e.target);
      onHover(id);
    }

    container.addEventListener('click', handleClick);
    container.addEventListener('mousemove', handleMouseMove);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, [containerRef, onSelect, onHover]);
}
