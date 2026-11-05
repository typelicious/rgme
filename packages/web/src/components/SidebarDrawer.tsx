import type { ReactNode } from "react";

export interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  col1: ReactNode;
  col2: ReactNode;
}

export function SidebarDrawer({ open, onClose, col1, col2 }: SidebarDrawerProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="System and Drives Control Center"
      className={open ? "fixed inset-0 z-50 flex" : "hidden"}
      data-testid="sidebar-drawer-container"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        data-testid="sidebar-drawer-backdrop"
      />

      {/* Slide-Over Drawer Pane */}
      <div
        data-testid="sidebar-drawer-pane"
        className="relative z-10 w-full max-w-3xl bg-[#0f1017]/95 border-r border-[#232734] backdrop-blur-xl shadow-[24px_0_48px_rgba(0,0,0,0.8)] flex flex-col p-6 text-sm text-[#cbd5e1] overflow-y-auto animate-in slide-in-from-left duration-300"
      >
        <div className="flex items-center justify-between border-b border-[#232734] pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎛️</span>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Control Center & Drives</h2>
              <p className="text-xs text-[#94a3b8]">Floppy drive controller, image dropzone, and system inspector</p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close-sidebar-btn"
            className="text-[#94a3b8] hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#1e293b] border border-transparent hover:border-[#38bdf8]/40 transition-colors cursor-pointer"
            title="Close drawer (Esc)"
          >
            ✕ Close
          </button>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-4">{col1}</div>
          <div className="flex flex-col gap-4">{col2}</div>
        </div>
      </div>
    </div>
  );
}
