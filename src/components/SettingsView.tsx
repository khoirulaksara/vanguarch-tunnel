import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/useSettingsStore';
import { Settings as SettingsIcon, LogIn, Search, CheckCircle2, XCircle, Plus, Trash2 } from 'lucide-react';
import { PromptModal } from './ui/PromptModal';
import { cn } from '../lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

export function SettingsView() {
  const { 
    cloudflaredPath, 
    setCloudflaredPath, 
    workspaceDirectories, 
    setWorkspaceDirectories,
    singleProjectDirectories,
    setSingleProjectDirectories
  } = useSettingsStore();
  const [loginStatus, setLoginStatus] = useState<string>('');
  const [toolVersion, setToolVersion] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptType, setPromptType] = useState<'workspace' | 'single'>('workspace');

  useEffect(() => {
    checkVersion();
  }, [cloudflaredPath]);

  useEffect(() => {
    if (isLoggedIn && invoke) {
      console.log("Fetching cloudflared domain...");
      invoke('get_cloudflared_domain').then((domain: any) => {
        console.log("Fetched domain:", domain);
        if (domain && typeof domain === 'string') {
          useSettingsStore.getState().setPublicDomain(domain);
        }
      }).catch(err => {
        console.error("Failed to get domain:", err);
      });
    }
  }, [isLoggedIn]);

  const checkVersion = async () => {
    if (invoke) {
      setIsChecking(true);
      try {
        const v = await invoke('check_cloudflared', { cloudflaredPath });
        setToolVersion(v as string);
        const loggedIn = await invoke('check_cloudflared_login');
        setIsLoggedIn(loggedIn as boolean);
        
        checkUpdate(v as string);
      } catch (err) {
        setToolVersion('');
        setIsLoggedIn(false);
      } finally {
        setIsChecking(false);
      }
    }
  };

  const checkUpdate = async (currentVersionStr: string) => {
    setIsCheckingUpdate(true);
    try {
      const match = currentVersionStr.match(/version (\d+\.\d+\.\d+)/);
      if (match) {
        const currentVersion = match[1];
        const res = await fetch('https://api.github.com/repos/cloudflare/cloudflared/releases/latest');
        const data = await res.json();
        const latest = data.tag_name;
        const latestNormalized = latest.startsWith('v') ? latest.substring(1) : latest;
        
        if (latestNormalized !== currentVersion) {
          setLatestVersion(latestNormalized);
        } else {
          setLatestVersion('latest');
        }
      } else {
        setLatestVersion(null);
      }
    } catch (e) {
      console.error("Failed to check for updates", e);
      setLatestVersion(null);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleUpdate = async () => {
    if (!invoke) return;
    setIsUpdating(true);
    try {
      await invoke('update_cloudflared', { cloudflaredPath });
      toast.success("Cloudflared updated successfully!");
      checkVersion();
    } catch (e: any) {
      toast.error("Update failed", { description: String(e) });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogin = async () => {
    if (invoke) {
      setLoginStatus('Opening browser for login...');
      try {
        const msg = await invoke('cloudflared_login', { cloudflaredPath });
        toast.success("Login successful!", { description: typeof msg === 'string' ? msg : undefined });
        setLoginStatus('');
        setTimeout(async () => {
          const loggedIn = await invoke('check_cloudflared_login');
          setIsLoggedIn(loggedIn as boolean);
        }, 1000);
      } catch (err: any) {
        toast.error("Login Error", { description: String(err) });
        setLoginStatus('');
      }
    } else {
      setLoginStatus('Action not available in Web Preview. Run in Tauri.');
    }
  };

  const handleLogout = async () => {
    if (invoke) {
      try {
        const msg = await invoke('logout_cloudflared', { cloudflaredPath });
        toast.success("Logged out successfully", { description: typeof msg === 'string' ? msg : undefined });
        setIsLoggedIn(false);
      } catch (err: any) {
        toast.error("Logout Error", { description: String(err) });
      }
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
      toast.warning("Browse dialog only available in desktop app.");
    }
  };

  const handleBrowseProjects = async (type: 'workspace' | 'single') => {
    if (openDialog) {
      try {
        const selected = await openDialog({
          multiple: false,
          directory: true,
          title: type === 'workspace' ? 'Select Workspace Directory' : 'Select Project Directory',
        });
        if (selected && typeof selected === 'string') {
          if (type === 'workspace') {
            if (!workspaceDirectories.includes(selected)) {
              setWorkspaceDirectories([...workspaceDirectories, selected]);
            }
          } else {
            if (!singleProjectDirectories.includes(selected)) {
              setSingleProjectDirectories([...singleProjectDirectories, selected]);
            }
          }
        }
      } catch (e) {
        console.error("Dialog error:", e);
      }
    } else {
      toast.warning("Browse dialog only available in desktop app.");
      setPromptType(type);
      setPromptOpen(true);
    }
  };

  const handlePromptSubmit = (testPath: string) => {
    if (promptType === 'workspace') {
      if (!workspaceDirectories.includes(testPath)) {
        setWorkspaceDirectories([...workspaceDirectories, testPath]);
      }
    } else {
      if (!singleProjectDirectories.includes(testPath)) {
        setSingleProjectDirectories([...singleProjectDirectories, testPath]);
      }
    }
  };

  const removeDirectory = (pathToRemove: string, type: 'workspace' | 'single') => {
    if (type === 'workspace') {
      setWorkspaceDirectories(workspaceDirectories.filter(path => path !== pathToRemove));
    } else {
      setSingleProjectDirectories(singleProjectDirectories.filter(path => path !== pathToRemove));
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-y-auto relative">
      <div className="flex flex-col max-w-3xl w-full mx-auto">
        <div className="sticky top-0 z-10 bg-[#09090b] h-16 px-6 border-b border-[#27272a] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-1">
              <SettingsIcon className="w-4 h-4 text-orange-500" />
              Application Settings
            </h2>
            <p className="text-[#a1a1aa] text-[10px]">Configure global preferences and initial setups.</p>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex flex-col gap-6">
          <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-xl space-y-8">
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
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-mono text-[#e4e4e7]">{toolVersion.split(' (')[0]}</div>
                    {isCheckingUpdate ? (
                      <span className="text-[9px] text-[#a1a1aa] uppercase tracking-wider font-bold animate-pulse">Checking update...</span>
                    ) : latestVersion === 'latest' ? (
                      <span className="text-[9px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Latest Version</span>
                    ) : latestVersion ? (
                      <button 
                        onClick={handleUpdate}
                        disabled={isUpdating}
                        className="text-[9px] bg-orange-500 text-black hover:bg-orange-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        {isUpdating ? 'Updating...' : `Update to ${latestVersion}`}
                      </button>
                    ) : null}
                  </div>
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
            <div className="flex gap-2">
              <button 
                onClick={handleLogin}
                disabled={!toolVersion}
                className="px-4 py-2 bg-white text-black text-[11px] font-bold uppercase tracking-wider rounded border border-white hover:bg-transparent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggedIn ? 'Re-Login to Cloudflare' : 'Login to Cloudflare'}
              </button>
              {isLoggedIn && (
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2 bg-transparent text-white text-[11px] font-bold uppercase tracking-wider rounded border border-[#3f3f46] hover:bg-[#3f3f46] transition-colors"
                >
                  Logout
                </button>
              )}
              {isLoggedIn && (
                <button 
                  onClick={() => {
                    toast.info("Fetching domain...");
                    invoke?.('get_cloudflared_domain').then((domain: any) => {
                      if (domain) {
                        useSettingsStore.getState().setPublicDomain(domain);
                        toast.success("Domain fetched: " + domain);
                      }
                    }).catch(err => {
                      toast.error("Fetch Domain Error", { description: String(err) });
                    });
                  }}
                  className="px-4 py-2 bg-[#27272a] text-white text-[11px] font-bold uppercase tracking-wider rounded border border-[#3f3f46] hover:bg-[#3f3f46] transition-colors"
                >
                  Fetch Domain
                </button>
              )}
            </div>
            {loginStatus && (
              <p className="mt-2 text-[10px] text-orange-500 font-mono">{loginStatus}</p>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Public Root Domain</label>
            <input
              type="text"
              value={useSettingsStore(s => s.publicDomain) || ''}
              readOnly
              placeholder="Auto-detected on login..."
              className="w-full bg-[#18181b] border border-[#27272a] rounded p-2 text-xs text-[#a1a1aa] focus:outline-none transition-colors font-mono cursor-not-allowed"
            />
            <p className="text-[10px] text-[#52525b] mt-2 leading-relaxed">
              Domain you have access to in Cloudflare (e.g. <code className="bg-black border border-[#27272a] px-1 py-0.5 rounded text-[#a1a1aa] ml-1">serat.us</code>). This is auto-detected from your Cloudflared certificate when you login.
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
                disabled={!!toolVersion}
                className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button 
                onClick={!!toolVersion ? () => setCloudflaredPath('') : handleBrowseCloudflared}
                className="px-3 bg-[#18181b] border border-[#27272a] rounded hover:border-orange-500 transition-colors flex items-center justify-center text-[#a1a1aa] hover:text-orange-500"
                title={!!toolVersion ? "Clear Executable Path" : "Browse for executable"}
              >
                {!!toolVersion ? <Trash2 className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-[#52525b] mt-2 leading-relaxed">
              If cloudflared is not in your system PATH, specify the absolute path to the executable here. <br/>
              Example: <code className="bg-black border border-[#27272a] px-1 py-0.5 rounded text-[#a1a1aa] ml-1">C:\Program Files\cloudflared\cloudflared.exe</code>
            </p>
          </div>
          
          <div className="pt-4 border-t border-[#27272a]">
            {/* Workspace Directories */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-[10px] uppercase text-[#52525b] font-bold">Workspace Directories (Multiple Projects)</label>
                <button 
                  onClick={() => handleBrowseProjects('workspace')}
                  className="px-2 py-1 bg-[#18181b] border border-[#27272a] rounded hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center gap-1 text-[10px] uppercase font-bold text-[#a1a1aa]"
                >
                  <Plus className="w-3 h-3" /> Add Directory
                </button>
              </div>
              
              <div className="space-y-2">
                {workspaceDirectories.map((dir, index) => (
                  <div key={`ws-${index}`} className="flex gap-2">
                    <div className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-2 text-xs font-mono text-[#e4e4e7] flex items-center overflow-x-auto truncate">
                      {dir}
                    </div>
                    <button 
                      onClick={() => removeDirectory(dir, 'workspace')}
                      className="px-3 bg-[#18181b] border border-[#27272a] rounded hover:border-red-500 hover:text-red-500 transition-colors flex items-center justify-center text-[#a1a1aa]"
                      title="Remove directory"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {workspaceDirectories.length === 0 && (
                  <div className="p-4 border border-dashed border-[#27272a] rounded text-center text-[10px] text-[#52525b] uppercase tracking-wider">
                    No workspace directories added
                  </div>
                )}
              </div>
              <p className="text-[10px] text-[#52525b] mt-2 leading-relaxed">
                Directories that contain multiple web projects (e.g., Laragon's www folder). The app will scan subdirectories within these locations.
              </p>
            </div>

            {/* Single Project Directories */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-[10px] uppercase text-[#52525b] font-bold">Single Project Directories</label>
                <button 
                  onClick={() => handleBrowseProjects('single')}
                  className="px-2 py-1 bg-[#18181b] border border-[#27272a] rounded hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center gap-1 text-[10px] uppercase font-bold text-[#a1a1aa]"
                >
                  <Plus className="w-3 h-3" /> Add Directory
                </button>
              </div>
              
              <div className="space-y-2">
                {singleProjectDirectories.map((dir, index) => (
                  <div key={`sp-${index}`} className="flex gap-2">
                    <div className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-2 text-xs font-mono text-[#e4e4e7] flex items-center overflow-x-auto truncate">
                      {dir}
                    </div>
                    <button 
                      onClick={() => removeDirectory(dir, 'single')}
                      className="px-3 bg-[#18181b] border border-[#27272a] rounded hover:border-red-500 hover:text-red-500 transition-colors flex items-center justify-center text-[#a1a1aa]"
                      title="Remove directory"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {singleProjectDirectories.length === 0 && (
                  <div className="p-4 border border-dashed border-[#27272a] rounded text-center text-[10px] text-[#52525b] uppercase tracking-wider">
                    No single project directories added
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>
      <PromptModal
        isOpen={promptOpen}
        onClose={() => setPromptOpen(false)}
        onSubmit={handlePromptSubmit}
        title={promptType === 'workspace' ? 'Add Workspace Directory' : 'Add Project Directory'}
        message="Enter the absolute path to the directory:"
        placeholder="/var/www/html or C:\laragon\www"
        submitText="Add Directory"
      />
    </div>
  );
}
