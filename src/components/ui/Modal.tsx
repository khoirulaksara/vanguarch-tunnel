import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl w-[90vw] max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#0c0c0e]">
          <h3 className="font-bold text-sm tracking-tight text-[#e4e4e7] uppercase">{title}</h3>
          <button 
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 bg-[#09090b]">
          {children}
        </div>
      </div>
    </div>
  );
}
