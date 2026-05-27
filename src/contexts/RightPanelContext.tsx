import { createContext, useContext, useState, ReactNode } from 'react';

interface RightPanelContextType {
  openPanel: (content: ReactNode, title?: string) => void;
  closePanel: () => void;
  isOpen: boolean;
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
    <RightPanelContext.Provider value={{ openPanel, closePanel, isOpen }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closePanel} />
          <div className="relative w-[480px] max-w-full h-full bg-background border-l border-border shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="font-semibold text-sm">{title ?? ''}</span>
              <button
                onClick={closePanel}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
                aria-label="Cerrar panel"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{content}</div>
          </div>
        </div>
      )}
    </RightPanelContext.Provider>
  );
}

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) throw new Error('useRightPanel must be used within RightPanelProvider');
  return ctx;
}
