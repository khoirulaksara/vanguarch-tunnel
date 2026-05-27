import React, { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { Shield, Code2, Github, Mail, User, Rocket, Zap, Link, Globe2, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

export function AboutView() {
  const [appVersion, setAppVersion] = useState<string>('...');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    let currentVer = '2.3.0';
    if ((window as any).__TAURI_INTERNALS__) {
      getVersion().then(v => {
        setAppVersion(v);
        currentVer = v;
        checkUpdate(currentVer);
      }).catch(() => {
        setAppVersion('2.3.0');
        checkUpdate(currentVer);
      });
    } else {
      setAppVersion('2.3.0 (Web)');
      checkUpdate(currentVer);
    }
  }, []);

  const checkUpdate = async (currentVer: string) => {
    try {
      const res = await fetch('https://api.github.com/repos/khoirulaksara/vanguarch-tunnel/releases/latest');
      if (!res.ok) return;
      const data = await res.json();
      const latest = data.tag_name;
      if (latest) {
        const cleanLatest = latest.startsWith('v') ? latest.substring(1) : latest;
        if (cleanLatest !== currentVer) {
          setLatestVersion(cleanLatest);
        }
      }
    } catch (e) {
      console.error("Failed to check for updates", e);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] text-[#e4e4e7] overflow-y-auto overflow-x-hidden relative selection:bg-orange-500/30">
      
      {/* Decorative Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="flex flex-col max-w-4xl w-full mx-auto relative z-10">
        
        {/* Header */}
        <div className="sticky top-0 z-20 bg-[#050505]/80 backdrop-blur-xl h-16 px-8 border-b border-[#27272a]/50 flex items-center justify-between gap-4 transition-all">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-orange-500" />
              About Vanguarch
            </h2>
          </div>
          <div className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold font-mono tracking-widest">
            STABLE RELEASE
          </div>
        </div>
        
        {latestVersion && (
          <div className="mx-8 mt-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                <Rocket className="w-6 h-6 text-orange-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-0.5">Update Available: v{latestVersion}</h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">A newer version of Vanguarch is ready to be downloaded.</p>
              </div>
            </div>
            <button onClick={() => invoke('open_url', { url: 'https://github.com/khoirulaksara/vanguarch-tunnel/releases/latest' })} className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 shrink-0 relative z-10 cursor-pointer">
              Download Update
            </button>
          </div>
        )}

        <div className="px-8 pb-12 pt-6 flex flex-col gap-10">
          
          {/* Hero Section */}
          <div className="flex flex-col items-center justify-center gap-6 mt-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-600 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
              <div className="w-24 h-24 rounded-3xl bg-[#0a0a0a] ring-1 ring-orange-500/50 flex items-center justify-center overflow-hidden relative shadow-[inset_0_0_20px_rgba(249,115,22,0.2)]">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent" />
                <img src="/icon.png" alt="Vanguarch" className="w-14 h-14 relative z-10 group-hover:scale-110 transition-transform duration-500 drop-shadow-2xl" />
              </div>
            </div>
            
            <div className="text-center space-y-3">
              <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 drop-shadow-sm">
                Vanguarch
              </h1>
              <p className="text-[#a1a1aa] text-sm font-medium max-w-md mx-auto leading-relaxed">
                The ultimate GUI for Cloudflared. Securely expose your local environments to the world with unparalleled elegance and speed.
              </p>
            </div>
          </div>

          {/* Core Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="group bg-[#0c0c0e]/80 backdrop-blur-sm border border-[#27272a]/50 hover:border-orange-500/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.1)] hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Globe2 className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="font-bold text-[#e4e4e7] mb-2 text-sm">Project Auto-Discovery</h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Automatically detects Next.js, Vite, Laravel, and WordPress projects, intelligently binding to their respective localhost ports.
                </p>
              </div>

              <div className="group bg-[#0c0c0e]/80 backdrop-blur-sm border border-[#27272a]/50 hover:border-blue-500/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.1)] hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Link className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="font-bold text-[#e4e4e7] mb-2 text-sm">Smart Host Headers</h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Configures HTTP Host and Origin Server Name headers automatically to prevent redirection loops in Laragon & XAMPP.
                </p>
              </div>

              <div className="group bg-[#0c0c0e]/80 backdrop-blur-sm border border-[#27272a]/50 hover:border-green-500/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.1)] hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Activity className="w-5 h-5 text-green-500" />
                </div>
                <h3 className="font-bold text-[#e4e4e7] mb-2 text-sm">Web Inspector</h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Intercept, inspect, and replay HTTP traffic in real-time. Built-in traffic analytics dashboard for your local tunnels.
                </p>
              </div>

              <div className="group bg-[#0c0c0e]/80 backdrop-blur-sm border border-[#27272a]/50 hover:border-purple-500/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.1)] hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="w-5 h-5 text-purple-500" />
                </div>
                <h3 className="font-bold text-[#e4e4e7] mb-2 text-sm">Cloud Management</h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  List, manage, and toggle your Cloudflare orchestrated tunnels directly from the UI by reading local credentials.
                </p>
              </div>
          </div>

          {/* Developer Card (Horizontal Banner) */}
          <div className="group bg-[#0c0c0e]/80 backdrop-blur-sm border border-[#27272a]/50 hover:border-orange-500/30 rounded-2xl p-8 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.1)] flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
             
             {/* Left side: Photo */}
             <div className="relative shrink-0 group-hover:scale-105 transition-transform duration-500">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-red-500 rounded-full blur-md opacity-40 group-hover:opacity-100 transition-opacity" />
                <img src="https://github.com/khoirulaksara.png" alt="Khoirul Aksara" className="w-24 h-24 rounded-full border-[3px] border-[#09090b] relative z-10 object-cover" />
             </div>
             
             {/* Middle: Info */}
             <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-orange-400 group-hover:to-red-500 transition-colors">Khoirul Aksara</h3>
                <p className="text-xs text-[#a1a1aa] uppercase tracking-widest font-bold mb-3">Lead Developer</p>
                <p className="text-sm text-[#a1a1aa] leading-relaxed max-w-xl mx-auto md:mx-0">
                  Passionate about crafting elegant developer tools and optimizing modern web workflows. Reach out for collaborations or feedback!
                </p>
             </div>

             {/* Right: Buttons */}
             <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto shrink-0 z-10">
                <button onClick={() => invoke('open_url', { url: 'https://github.com/khoirulaksara' })} className="flex items-center justify-center gap-2 bg-[#18181b] hover:bg-[#27272a] hover:text-white text-sm text-[#e4e4e7] px-6 py-2.5 rounded-xl transition-all border border-[#27272a] hover:border-orange-500/50 cursor-pointer shadow-sm group/btn">
                  <Github className="w-4 h-4 text-[#a1a1aa] group-hover/btn:text-white" /> GitHub Profile
                </button>
                <button onClick={() => invoke('open_url', { url: 'mailto:me@serat.us' })} className="flex items-center justify-center gap-2 bg-[#18181b] hover:bg-[#27272a] hover:text-white text-sm text-[#e4e4e7] px-6 py-2.5 rounded-xl transition-all border border-[#27272a] hover:border-orange-500/50 cursor-pointer shadow-sm group/btn">
                  <Mail className="w-4 h-4 text-[#a1a1aa] group-hover/btn:text-white" /> Contact Me
                </button>
             </div>
          </div>
          
          {/* Footer */}
          <div className="mt-4 pt-6 border-t border-[#27272a]/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs font-mono text-[#52525b] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[#e4e4e7]">v{appVersion}</span> • Build 2026.05
              </p>
              <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold">
                Made with <span className="text-red-500">❤</span> in Indonesia
              </p>
          </div>

        </div>
      </div>
    </div>
  );
}
