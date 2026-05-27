import { createContext, useContext, useState, ReactNode } from 'react';
import { X } from 'lucide-react';

interface RightPanelContextType {
  openPanel: (content: ReactNode, title?: string) => void;
  closePanel: () => void;
  isOpen: boolean;
  content: ReactNode;
  title: string | undefined;
}

const RightPanelContext = createContext<RightPanelContextType | null>(null);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);
  const [title, setTitle] = useState<string | undefined>();

  const openPanel = (content: ReactNode, title?: string) => {
    setContent(content);
    setTitle(title);
    setIsOpen(true);
  };

  const closePanel = () => setIsOpen(false);

  return (
    <RightPanelContext.Provider value={{ openPanel, closePanel, isOpen, content, title }}>
      {children}
    </RightPanelContext.Provider>
  );
}

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) throw new Error('useRightPanel must be used within RightPanelProvider');
  return ctx;
}

/**
 * Third-column panel rendered inside AppLayout.
 * Width animates from 0 → 380px so the main content compresses smoothly.
 * No overlay, no backdrop.
 */
export function RightPanel() {
  const { isOpen, content, title, closePanel } = useRightPanel();

  return (
    <aside
      className={`shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-out border-l border-border bg-background ${
        isOpen ? 'w-[380px]' : 'w-0'
      }`}
      aria-hidden={!isOpen}
    >
      {/* Inner fixed-width wrapper so children don't reflow during the width animation */}
      <div className="w-[380px] h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-sm truncate">{title ?? ''}</span>
          <button
            onClick={closePanel}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{content}</div>
      </div>
    </aside>
  );
}
