import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, X } from 'lucide-react';

interface QRCodeDisplayProps {
  url: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ url }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!url) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 bg-[#27272a] hover:bg-orange-500 hover:text-black text-[#a1a1aa] rounded-md transition-colors"
        title="Show QR Code"
      >
        <QrCode className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
            <div className="w-full flex justify-between items-center mb-6">
              <h3 className="font-bold uppercase tracking-wider text-sm text-[#e4e4e7]">Scan to Connect</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#a1a1aa] hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-inner mb-6">
              <QRCodeSVG
                value={url}
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"L"}
                includeMargin={false}
              />
            </div>
            
            <div className="w-full bg-[#0c0c0e] border border-[#27272a] p-3 rounded-lg text-center break-all">
              <a 
                href={url} 
                target="_blank" 
                rel="noreferrer"
                className="text-orange-500 hover:text-orange-400 font-mono text-xs hover:underline"
              >
                {url}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
