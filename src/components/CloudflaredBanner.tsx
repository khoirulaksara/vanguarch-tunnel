import React, { useEffect } from 'react';
import { useCloudflaredStatusStore } from '../store/useCloudflaredStatusStore';

export const CloudflaredBanner: React.FC = () => {
  const { isInstalled, isDownloading, downloadProgress, checkStatus, downloadCloudflared } = useCloudflaredStatusStore();

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (isInstalled === true || isInstalled === null) {
    return null;
  }

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-100 p-4 w-full flex flex-col sm:flex-row items-center justify-between gap-4 z-50">
      <div className="flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h3 className="font-semibold text-yellow-500">Cloudflared is Missing</h3>
          <p className="text-sm opacity-80">Vanguarch requires Cloudflared to run tunnels. It was not found in your system.</p>
        </div>
      </div>
      
      <div className="flex-shrink-0 w-full sm:w-auto">
        {isDownloading ? (
          <div className="flex flex-col gap-1 min-w-[200px]">
            <div className="flex justify-between text-xs text-yellow-300">
              <span>Downloading...</span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="w-full bg-yellow-900/50 rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <button 
            onClick={downloadCloudflared}
            className="w-full sm:w-auto px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-medium rounded-md transition-colors"
          >
            Download Now
          </button>
        )}
      </div>
    </div>
  );
};
