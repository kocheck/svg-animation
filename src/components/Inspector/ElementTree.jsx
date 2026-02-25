import { useState, useCallback, useEffect } from 'react';
import { useSelectionContext } from '../../context/EditorContext.jsx';

export default function ElementTree({ svgDoc }) {
  const root = svgDoc.getRoot();

  return (
    <div className="inspector-section">
      <div className="inspector-section-title">Element Tree</div>
      <div className="element-tree" data-testid="element-tree">
        <TreeNode element={root} depth={0} svgDoc={svgDoc} />
      </div>
    </div>
  );
}

function TreeNode({ element, depth, svgDoc }) {
  const { state: { elementId }, dispatch } = useSelectionContext();
  const nodeId = element.getAttribute('data-svgdoc-id');
  const isSelected = elementId === nodeId;

  const children = Array.from(element.childNodes || []).filter(
    (child) => child.nodeType === 1
  );
  const hasChildren = children.length > 0;

  const [expanded, setExpanded] = useState(depth < 2);

  useEffect(() => {
    if (isSelected) setExpanded(true);
  }, [isSelected]);

  const tagName = element.tagName?.toLowerCase() || element.localName;
  const id = element.getAttribute('id');
  const cls = element.getAttribute('class');

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    dispatch({ type: 'SELECT_ELEMENT', elementId: nodeId });
  }, [dispatch, nodeId]);

  const handleHover = useCallback(() => {
    dispatch({ type: 'HOVER_ELEMENT', elementId: nodeId });
  }, [dispatch, nodeId]);

  const handleHoverEnd = useCallback(() => {
    dispatch({ type: 'HOVER_ELEMENT', elementId: null });
  }, [dispatch]);

  const toggleExpand = useCallback((e) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div className="tree-node-container">
      <div
        className={`tree-node${isSelected ? ' tree-node-selected' : ''}`}
        data-testid="tree-node"
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={handleClick}
        onMouseEnter={handleHover}
        onMouseLeave={handleHoverEnd}
      >
        {hasChildren ? (
          <span
            className="tree-toggle"
            data-testid="tree-toggle"
            onClick={toggleExpand}
          >
            {expanded ? '\u25BE' : '\u25B8'}
          </span>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <span className="tree-tag">{tagName}</span>
        {id && <span className="tree-id">#{id}</span>}
        {cls && (
          <span className="tree-class">
            .{cls.split(/\s+/)[0]}
          </span>
        )}
      </div>
      {hasChildren && expanded && children.map((child, i) => (
        <TreeNode
          key={child.getAttribute('data-svgdoc-id') || i}
          element={child}
          depth={depth + 1}
          svgDoc={svgDoc}
        />
      ))}
    </div>
  );
}
