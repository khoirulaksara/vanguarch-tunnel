import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { Settings as SettingsIcon, LogIn, Search, CheckCircle2, XCircle, Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

let invoke: any = null;
let openDialog: any = null;

(async () => {
  try {
    if ((window as any).__TAURI_INTERNALS__) {
      const core = await import('@tauri-apps/api/core');
      invoke = core.invoke;
      const dialog = await import('@tauri-apps/plugin-dialog');
      openDialog = dialog.open;
    }
  } catch (e) {}
})();

export function SettingsView() {
  const { cloudflaredPath, setCloudflaredPath, projectsDirectories, setProjectsDirectories } = useSettingsStore();
  const [loginStatus, setLoginStatus] = useState<string>('');
  const [toolVersion, setToolVersion] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkVersion();
  }, [cloudflaredPath]);

  const checkVersion = async () => {
    if (invoke) {
      setIsChecking(true);
      try {
        const v = await invoke('check_cloudflared', { cloudflaredPath });
        setToolVersion(v as string);
        const loggedIn = await invoke('check_cloudflared_login');
        setIsLoggedIn(loggedIn as boolean);
      } catch (err) {
        setToolVersion('');
        setIsLoggedIn(false);
      } finally {
        setIsChecking(false);
      }
    }
  };

  const handleLogin = async () => {
    if (invoke) {
      setLoginStatus('Starting login...');
      try {
        const msg = await invoke('cloudflared_login', { cloudflaredPath });
        setLoginStatus(msg as string);
        // Re-check login status after a delay
        setTimeout(async () => {
          const loggedIn = await invoke('check_cloudflared_login');
          setIsLoggedIn(loggedIn as boolean);
        }, 3000);
      } catch (err: any) {
        setLoginStatus(`Error: ${err}`);
      }
    } else {
      setLoginStatus('Action not available in Web Preview. Run in Tauri.');
    }
  };

  const handleBrowseCloudflared = async () => {
    if (openDialog) {
      try {
        const selected = await openDialog({
          multiple: false,
          title: 'Select Cloudflared Executable',
        });
        if (selected && typeof selected === 'string') {
          setCloudflaredPath(selected);
        }
      } catch (e) {
        console.error("Dialog error:", e);
      }
    } else {
      alert("Browse dialog only available in desktop app.");
    }
  };

  const handleBrowseProjects = async () => {
    if (openDialog) {
      try {
        const selected = await openDialog({
          multiple: false,
          directory: true,
          title: 'Select Projects Directory',
        });
        if (selected && typeof selected === 'string') {
          // Avoid duplicates
          if (!projectsDirectories.includes(selected)) {
            setProjectsDirectories([...projectsDirectories, selected]);
          }
        }
      } catch (e) {
        console.error("Dialog error:", e);
      }
    } else {
      alert("Browse dialog only available in desktop app.");
      // Fallback for web preview testing
      const testPath = prompt("Enter directory path:");
      if (testPath && !projectsDirectories.includes(testPath)) {
        setProjectsDirectories([...projectsDirectories, testPath]);
      }
    }
  };

  const removeProjectDirectory = (pathToRemove: string) => {
    setProjectsDirectories(projectsDirectories.filter(path => path !== pathToRemove));
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-6 text-[#e4e4e7] overflow-y-auto">
      <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-lg max-w-3xl w-full space-y-8">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-1">
            <SettingsIcon className="w-4 h-4 text-orange-500" />
            Application Settings
          </h2>
          <p className="text-[#a1a1aa] text-[10px]">Configure global preferences and initial setups.</p>
        </div>

        <div className="space-y-6">
          <div className="pb-6 border-b border-[#27272a]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-bold uppercase text-white flex items-center gap-2">
                <LogIn className="w-3.5 h-3.5" /> 
                Cloudflared Status & Setup
              </h3>
              <div className="flex items-center gap-2 text-[10px]">
                {isChecking ? (
                  <span className="text-[#a1a1aa] uppercase tracking-wider font-bold">Checking...</span>
                ) : toolVersion ? (
                  <div className="flex items-center gap-1.5 text-green-500 font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Detected
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-500 font-bold uppercase tracking-wider">
                    <XCircle className="w-3.5 h-3.5" />
                    Not Found
                  </div>
                )}
              </div>
            </div>
            
            {toolVersion && (
              <div className="mb-4 p-3 bg-[#18181b] border border-[#27272a] rounded flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase text-[#52525b] font-bold mb-1">Version</div>
                  <div className="text-xs font-mono text-[#e4e4e7]">{toolVersion}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[#52525b] font-bold mb-1 text-right">Login Status</div>
                  <div className="flex items-center gap-1.5 justify-end">
                    {isLoggedIn ? (
                      <span className="text-xs font-bold text-green-500 uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Not Authenticated
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <p className="text-[10px] text-[#a1a1aa] mb-4 max-w-lg leading-relaxed">
              If you haven't authenticated Cloudflared on this machine, you need to login before creating named tunnels. This will open a browser window to authenticate with Cloudflare Zero Trust.
            </p>
            <button 
              onClick={handleLogin}
              disabled={!toolVersion}
              className="px-4 py-2 bg-white text-black text-[11px] font-bold uppercase tracking-wider rounded border border-white hover:bg-transparent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggedIn ? 'Re-Login to Cloudflare' : 'Login to Cloudflare'}
            </button>
            {loginStatus && (
              <p className="mt-2 text-[10px] text-orange-500 font-mono">{loginStatus}</p>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Public Root Domain</label>
            <input
              type="text"
              value={useSettingsStore(s => s.publicDomain)}
              onChange={(e) => useSettingsStore.getState().setPublicDomain(e.target.value)}
              placeholder="e.g. serat.us"
              className="w-full bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors font-mono"
            />
            <p className="text-[10px] text-[#52525b] mt-2 leading-relaxed">
              Domain you have access to in Cloudflare (e.g. <code className="bg-black border border-[#27272a] px-1 py-0.5 rounded text-[#a1a1aa] ml-1">serat.us</code>). This will be used when routing Auto Tunnels.
            </p>
          </div>
          <div className="pt-4 border-t border-[#27272a]">
            <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Cloudflared Executable Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cloudflaredPath}
                onChange={(e) => setCloudflaredPath(e.target.value)}
                placeholder="default (uses PATH)"
                className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors font-mono"
              />
              <button 
                onClick={handleBrowseCloudflared}
                className="px-3 bg-[#18181b] border border-[#27272a] rounded hover:border-orange-500 transition-colors flex items-center justify-center text-[#a1a1aa] hover:text-orange-500"
                title="Browse for executable"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-[#52525b] mt-2 leading-relaxed">
              If cloudflared is not in your system PATH, specify the absolute path to the executable here. <br/>
              Example: <code className="bg-black border border-[#27272a] px-1 py-0.5 rounded text-[#a1a1aa] ml-1">C:\Program Files\cloudflared\cloudflared.exe</code>
            </p>
          </div>
          
          <div className="pt-4 border-t border-[#27272a]">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-[10px] uppercase text-[#52525b] font-bold">Local Projects Directories</label>
              <button 
                onClick={handleBrowseProjects}
                className="px-2 py-1 bg-[#18181b] border border-[#27272a] rounded hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center gap-1 text-[10px] uppercase font-bold text-[#a1a1aa]"
              >
                <Plus className="w-3 h-3" /> Add Directory
              </button>
            </div>
            
            <div className="space-y-2">
              {projectsDirectories.map((dir, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-2 text-xs font-mono text-[#e4e4e7] flex items-center overflow-x-auto truncate">
                    {dir}
                  </div>
                  <button 
                    onClick={() => removeProjectDirectory(dir)}
                    className="px-3 bg-[#18181b] border border-[#27272a] rounded hover:border-red-500 hover:text-red-500 transition-colors flex items-center justify-center text-[#a1a1aa]"
                    title="Remove directory"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {projectsDirectories.length === 0 && (
                <div className="p-4 border border-dashed border-[#27272a] rounded text-center text-[10px] text-[#52525b] uppercase tracking-wider">
                  No directories added
                </div>
              )}
            </div>

            <p className="text-[10px] text-[#52525b] mt-2 leading-relaxed">
              Paths to the directories where your local web projects are stored. The app will scan all these locations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
