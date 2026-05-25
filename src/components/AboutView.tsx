import React, { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { Shield, Code2, Github, Mail, User } from 'lucide-react';

export function AboutView() {
  const [appVersion, setAppVersion] = useState<string>('...');

  useEffect(() => {
    if ((window as any).__TAURI_INTERNALS__) {
      getVersion().then(v => setAppVersion(v)).catch(() => setAppVersion('2.2.0'));
    } else {
      setAppVersion('2.2.0 (Web)');
    }
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-y-auto relative">
      <div className="flex flex-col max-w-3xl w-full mx-auto">
        <div className="sticky top-0 z-10 bg-[#09090b] h-16 px-6 border-b border-[#27272a] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-orange-500" />
              About Vanguarch
            </h2>
            <p className="text-[#a1a1aa] text-[10px]">Application info and developer details.</p>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex flex-col gap-6">
        <div className="flex flex-col items-center justify-center gap-4 mb-10 mt-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center shadow-xl">
            <img src="/icon.png" alt="Vanguarch" className="w-12 h-12 " />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Vanguarch</h1>
            <p className="text-[#a1a1aa] text-sm font-medium">Secure Cloudflared GUI & Manager</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">About This App</h2>
            <p className="text-[#a1a1aa] text-sm leading-relaxed">
              Vanguarch is a tailored desktop application designed to streamline the management and execution of Cloudflare Tunnels (cloudflared). Built to simplify the workflow of exposing local development environments securely to the internet, without the hassle of terminal commands.
            </p>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Core Capabilities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#09090b] rounded-lg border border-[#27272a]">
                <div className="font-bold text-sm text-[#e4e4e7] mb-1.5 flex items-center gap-2">Project Auto-Discovery</div>
                <div className="text-xs text-[#a1a1aa] leading-relaxed">Automatically detects Next.js, Vite, Laravel, and WordPress projects, intelligently binding to their respective localhost ports or local virtual domains.</div>
              </div>
              <div className="p-4 bg-[#09090b] rounded-lg border border-[#27272a]">
                <div className="font-bold text-sm text-[#e4e4e7] mb-1.5 flex items-center gap-2">Smart Host Headers</div>
                <div className="text-xs text-[#a1a1aa] leading-relaxed">Configures HTTP Host and Origin Server Name headers automatically to prevent redirection loops, optimized for environments like Laragon.</div>
              </div>
              <div className="p-4 bg-[#09090b] rounded-lg border border-[#27272a]">
                <div className="font-bold text-sm text-[#e4e4e7] mb-1.5 flex items-center gap-2">Tunnel Presets</div>
                <div className="text-xs text-[#a1a1aa] leading-relaxed">Save frequently used target domains into easily accessible presets for instant one-click startup and management.</div>
              </div>
              <div className="p-4 bg-[#09090b] rounded-lg border border-[#27272a]">
                <div className="font-bold text-sm text-[#e4e4e7] mb-1.5 flex items-center gap-2">Visual Cloud Management</div>
                <div className="text-xs text-[#a1a1aa] leading-relaxed">List, manage, and toggle your Cloudflare orchestrated tunnels directly from the UI by reading authenticated local credential files.</div>
              </div>
            </div>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Tech Stack</h2>
              <p className="text-[#a1a1aa] text-xs">Tauri • React • Zustand • Tailwind CSS • Rust</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#27272a]/50 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-[#a1a1aa]" />
            </div>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Developer</h2>
            <div className="flex items-center gap-4">
              <img src="https://github.com/khoirulaksara.png" alt="Khoirul Aksara" className="w-12 h-12 rounded-full ring-2 ring-[#27272a]" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">Khoirul Aksara</h3>
                <div className="flex items-center gap-4 mt-1.5">
                  <a href="https://github.com/khoirulaksara" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#a1a1aa] hover:text-white transition-colors">
                    <Github className="w-3.5 h-3.5" /> GitHub
                  </a>
                  <a href="mailto:me@serat.us" className="flex items-center gap-1.5 text-xs text-[#a1a1aa] hover:text-white transition-colors">
                    <Mail className="w-3.5 h-3.5" /> me@serat.us
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
            <p className="text-xs font-mono text-[#52525b]">
              <span className="font-bold text-[#e4e4e7]">v{appVersion}</span> • Build 2026.05
            </p>
        </div>
        </div>
      </div>
    </div>
  );
}
