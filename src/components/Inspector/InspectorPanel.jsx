import { useSelectionContext, useDocumentContext } from '../../context/EditorContext.jsx';

export default function InspectorPanel() {
  const { state: { elementId } } = useSelectionContext();
  const { state: { documents, activeDocumentId } } = useDocumentContext();

  // Find active document
  const activeDoc = documents.find(d => d.id === activeDocumentId);

  // Find selected element in the SvgDoc
  let element = null;
  if (activeDoc && elementId) {
    const matches = activeDoc.doc.querySelectorAll(`[data-svgdoc-id="${elementId}"]`);
    element = matches[0] || null;
  }

  if (!element) {
    return (
      <div className="inspector-panel" data-testid="inspector-panel">
        <div className="inspector-empty">Select an element to inspect</div>
      </div>
    );
  }

  const tagName = element.tagName || element.localName;
  const attrs = activeDoc.doc.getAttributes(element);
  const parentChain = buildParentChain(element);

  return (
    <div className="inspector-panel" data-testid="inspector-panel">
      <div className="inspector-header">
        <span className="inspector-tag" data-testid="inspector-tag">&lt;{tagName}&gt;</span>
        {attrs.id && <span className="inspector-id">#{attrs.id}</span>}
        {attrs.class && (
          <span className="inspector-classes">
            {attrs.class.split(/\s+/).map(cls => (
              <span key={cls} className="class-pill">.{cls}</span>
            ))}
          </span>
        )}
      </div>

      <div className="inspector-section">
        <div className="inspector-section-title">Attributes</div>
        <table className="inspector-attrs" data-testid="inspector-attrs">
          <tbody>
            {Object.entries(attrs).map(([key, value]) => (
              <tr key={key}>
                <td className="attr-key">{key}</td>
                <td className="attr-value">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="inspector-section">
        <div className="inspector-section-title">Parent Chain</div>
        <div className="inspector-breadcrumb" data-testid="inspector-breadcrumb">
          {parentChain.map((tag, i) => (
            <span key={i}>
              {i > 0 && <span className="breadcrumb-sep"> &rsaquo; </span>}
              <span className="breadcrumb-tag">{tag}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildParentChain(element) {
  const chain = [];
  let el = element;
  while (el && el.parentElement) {
    el = el.parentElement;
    const tag = el.tagName || el.localName;
    if (tag && tag !== '#document') {
      chain.unshift(tag);
    }
  }
  return chain;
}
