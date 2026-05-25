import React, { useState } from 'react';
import { Modal } from './Modal';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message: string;
  placeholder?: string;
  submitText?: string;
  cancelText?: string;
}

export function PromptModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title, 
  message, 
  placeholder,
  submitText = "Submit", 
  cancelText = "Cancel" 
}: PromptModalProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
      onClose();
    }
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-[#a1a1aa] leading-relaxed">{message}</p>
        
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#0c0c0e] border border-[#27272a] rounded p-2 text-sm text-[#e4e4e7] focus:outline-none focus:border-orange-500 transition-colors font-mono"
          autoFocus
        />

        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#a1a1aa] hover:text-[#e4e4e7] bg-transparent hover:bg-[#27272a] rounded transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitText}
          </button>
        </div>
      </form>
    </Modal>
  );
}
