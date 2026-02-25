import { render } from '@testing-library/react';
import { DocumentProvider, SelectionProvider, UIProvider } from './EditorContext.jsx';

export function renderWithProviders(ui, { initialDocState, initialSelectionState, ...options } = {}) {
  function Wrapper({ children }) {
    return (
      <DocumentProvider initialState={initialDocState}>
        <SelectionProvider initialState={initialSelectionState}>
          <UIProvider>{children}</UIProvider>
        </SelectionProvider>
      </DocumentProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
