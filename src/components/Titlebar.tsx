import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { toast } from 'sonner';

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  
  useEffect(() => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then(setIsMaximized).catch(() => {});

    let unlisten: () => void;
    appWindow.onResized(async () => {
      try {
        const max = await appWindow.isMaximized();
        setIsMaximized(max);
      } catch (e) {}
    }).then((unlistenFn) => {
      unlisten = unlistenFn;
    }).catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async () => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    try {
      await getCurrentWindow().minimize();
    } catch (e: any) {
      toast.error(`Minimize error: ${e.toString()}`);
    }
  };

  const handleMaximize = async () => {
    // Disabled in UI anyway, but kept for completeness
  };

  const handleClose = async () => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    try {
      await getCurrentWindow().hide();
    } catch (e: any) {
      toast.error(`Close error: ${e.toString()}`);
    }
  };

  return (
    <div 
      data-tauri-drag-region="true"
      style={{ WebkitAppRegion: 'drag' } as any}
      className="h-10 flex items-center justify-between px-4 bg-[#0c0c0e] border-b border-[#27272a] shrink-0 select-none z-50 w-full relative"
    >
      {/* Left: Logo */}
      <div data-tauri-drag-region="true" className="flex items-center w-[60px] pointer-events-none">
        <img data-tauri-drag-region="true" src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
      </div>
      
      {/* Center: Title */}
      <div data-tauri-drag-region="true" className="flex-1 flex items-center justify-center text-xs text-[#a1a1aa] font-medium pointer-events-none">
        Vanguarch Tunnel
      </div>
      
      {/* Right: Buttons */}
      <div 
        className="flex items-center justify-end gap-2 w-[60px]"
        style={{ WebkitAppRegion: 'no-drag' } as any}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {/* Minimize - Yellow */}
        <button 
          onClick={handleMinimize}
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className="w-[13px] h-[13px] rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 flex items-center justify-center group outline-none"
          title="Minimize"
        >
          <div className="hidden group-hover:block w-2 h-0.5 bg-black/40" />
        </button>
        {/* Maximize - Disabled */}
        <button 
          disabled
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className="w-[13px] h-[13px] rounded-full bg-[#27c93f]/30 flex items-center justify-center outline-none cursor-default"
        >
        </button>
        {/* Close - Red */}
        <button 
          onClick={handleClose}
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className="w-[13px] h-[13px] rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 flex items-center justify-center group outline-none"
          title="Close"
        >
          <div className="hidden group-hover:block w-1.5 h-1.5 rounded-full bg-black/40" />
        </button>
      </div>
    </div>
  );
}
