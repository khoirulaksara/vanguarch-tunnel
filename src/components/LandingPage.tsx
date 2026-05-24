import React, { useState, useEffect } from 'react';
import { Shield, Download, Github, Monitor, TerminalSquare, Globe, Loader2 } from 'lucide-react';

export function LandingPage() {
  const fallbackUrl = "https://github.com/choiroel/vanguarch/releases/latest";
  const [downloads, setDownloads] = useState({
    win: fallbackUrl,
    mac: fallbackUrl,
    lin: fallbackUrl,
    loading: true
  });
  const [imageStatus, setImageStatus] = useState<Record<number, 'loading' | 'loaded' | 'error'>>({
    1: 'loading', 2: 'loading', 3: 'loading', 4: 'loading', 5: 'loading', 6: 'loading'
  });
  const [activeIdx, setActiveIdx] = useState(0);

  const validImages = [1, 2, 3, 4, 5, 6].filter(num => imageStatus[num] === 'loaded');
  const allErrors = [1, 2, 3, 4, 5, 6].every(num => imageStatus[num] === 'error');
  const safeActiveIdx = validImages.length > 0 ? activeIdx % validImages.length : 0;

  useEffect(() => {
    if (validImages.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx(prev => prev + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, [validImages.length]);

  useEffect(() => {
    fetch('https://api.github.com/repos/choiroel/vanguarch/releases/latest')
      .then(res => res.json())
      .then(data => {
        let win = fallbackUrl;
        let mac = fallbackUrl;
        let lin = fallbackUrl;

        if (data && data.assets) {
           const winAsset = data.assets.find((a: any) => a.name.endsWith('.exe') || a.name.endsWith('.msi'));
           const macAsset = data.assets.find((a: any) => a.name.endsWith('.dmg') || a.name.endsWith('.app.tar.gz'));
           const linAsset = data.assets.find((a: any) => a.name.endsWith('.AppImage') || a.name.endsWith('.deb'));

           if (winAsset) win = winAsset.browser_download_url;
           if (macAsset) mac = macAsset.browser_download_url;
           if (linAsset) lin = linAsset.browser_download_url;
        }
        setDownloads({ win, mac, lin, loading: false });
      })
      .catch((e) => {
        console.error("Failed to fetch latest release:", e);
        setDownloads({ win: fallbackUrl, mac: fallbackUrl, lin: fallbackUrl, loading: false });
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans selection:bg-orange-500/30 overflow-y-auto">
      {/* Navbar */}
      <nav className="border-b border-[#27272a] bg-[#0c0c0e]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center shadow-lg">
               <img src="/icon.png" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-bold text-md uppercase tracking-tight text-white">Vanguarch</span>
          </div>
          <a href="https://github.com/choiroel/vanguarch" target="_blank" rel="noreferrer" className="text-[#a1a1aa] hover:text-white transition-colors">
            <Github className="w-5 h-5" />
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 flex flex-col items-center text-center">
        <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center shadow-2xl mb-8 relative">
          <div className="absolute inset-0 bg-white/10 rounded-3xl backdrop-blur-sm"></div>
          <img src="/icon.png" alt="Vanguarch" className="w-20 h-20 relative z-10" />
        </div>
        
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter text-white mb-6">
          Expose Local Services <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">to the World</span>
        </h1>
        <p className="text-lg sm:text-xl text-[#a1a1aa] max-w-2xl mb-12 leading-relaxed">
          The ultimate desktop client for Cloudflare Tunnels (cloudflared). 
          Manage active tunnels, inspect logs, and publish local projects with a single click. 
          Available for Windows, macOS, and Linux.
        </p>
        
        {/* Downloads */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl mb-24">
          <div className="flex flex-col items-center gap-3 bg-[#18181b] border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity blur-xl -z-10"></div>
            <Monitor className="w-10 h-10 text-white mb-2" />
            <span className="font-bold text-lg text-white">Windows</span>
            <span className="text-xs text-[#a1a1aa]">Windows 10 & 11 (.exe)</span>
            <a href={downloads.win} className="mt-4 w-full py-2 rounded-lg bg-[#27272a] hover:bg-blue-600 hover:border-blue-500 border border-transparent text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
              {downloads.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
            </a>
          </div>

          <div className="flex flex-col items-center gap-3 bg-[#18181b] border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -inset-2 bg-gradient-to-r from-gray-300/20 to-gray-500/0 opacity-0 group-hover:opacity-100 transition-opacity blur-xl -z-10"></div>
            <Monitor className="w-10 h-10 text-white mb-2" />
            <span className="font-bold text-lg text-white">macOS</span>
            <span className="text-xs text-[#a1a1aa]">Apple Silicon & Intel (.dmg)</span>
            <a href={downloads.mac} className="mt-4 w-full py-2 rounded-lg bg-[#27272a] hover:bg-gray-100 hover:text-black hover:border-white border border-transparent text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
              {downloads.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
            </a>
          </div>

          <div className="flex flex-col items-center gap-3 bg-[#18181b] border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/20 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity blur-xl -z-10"></div>
            <TerminalSquare className="w-10 h-10 text-white mb-2" />
            <span className="font-bold text-lg text-white">Linux</span>
            <span className="text-xs text-[#a1a1aa]">Debian / AppImage</span>
            <a href={downloads.lin} className="mt-4 w-full py-2 rounded-lg bg-[#27272a] hover:bg-orange-600 hover:border-orange-500 border border-transparent text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
              {downloads.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
            </a>
          </div>
        </div>
        
        {/* Features Preview */}
        <div className="w-full max-w-5xl rounded-2xl border border-[#27272a] bg-[#0c0c0e] p-2 sm:p-4 shadow-2xl relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent"></div>
           <div className="aspect-video bg-[#09090b] rounded-xl border border-[#27272a] relative overflow-hidden flex items-center justify-center">
              {/* Hidden container to eagerly load images */}
              <div className="hidden">
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <img 
                    key={num} 
                    src={`/preview${num}.png`} 
                    alt={`Preload ${num}`}
                    onLoad={() => setImageStatus(prev => ({...prev, [num]: 'loaded'}))}
                    onError={() => setImageStatus(prev => ({...prev, [num]: 'error'}))}
                  />
                ))}
              </div>
              
              {validImages.length > 0 ? (
                <>
                  {validImages.map((num, i) => (
                    <img 
                      key={num}
                      src={`/preview${num}.png`}
                      alt={`Vanguarch Interface ${num}`}
                      className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 ${i === safeActiveIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                    />
                  ))}
                  {validImages.length > 1 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20 bg-black/50 px-3 py-2 rounded-full backdrop-blur-md">
                      {validImages.map((num, i) => (
                        <button 
                          key={num} 
                          onClick={() => setActiveIdx(i)}
                          className={`h-2 rounded-full transition-all duration-300 ${i === safeActiveIdx ? 'bg-orange-500 w-6' : 'bg-white/40 hover:bg-white/70 w-2'}`} 
                          aria-label={`Go to slide ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : allErrors ? (
                <div className="text-center p-6 z-10">
                  <Globe className="w-12 h-12 text-[#52525b] mx-auto mb-4 opacity-50" />
                  <p className="font-mono text-sm text-[#52525b]">Waiting for screenshots...</p>
                  <p className="text-xs text-[#52525b] mt-2">Upload files as <b>public/preview1.png</b>, <b>preview2.png</b>, etc.</p>
                </div>
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-[#52525b] opacity-50 z-10" />
              )}
           </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="border-t border-[#27272a] py-8 text-center text-[#52525b] text-sm">
        <p>&copy; {new Date().getFullYear()} Vanguarch. Built for developers.</p>
      </footer>
    </div>
  );
}
