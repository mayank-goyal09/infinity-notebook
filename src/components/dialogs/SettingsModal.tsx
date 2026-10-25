import React, { useState } from 'react';
import {
  X,
  MousePointerClick,
  Sliders,
  SunMoon,
  HardDrive,
  Keyboard,
  ShieldCheck,
  FolderSync,
  Save,
  RotateCcw,
  Check,
} from 'lucide-react';
import { ClickToInkSettings, InputSettings, AppTheme } from '../../types/document';
import { SyncStatus } from '../../services/syncEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clickToInkSettings: ClickToInkSettings;
  onUpdateClickToInkSettings: (updates: Partial<ClickToInkSettings>) => void;
  inputSettings: InputSettings;
  onUpdateInputSettings: (updates: Partial<InputSettings>) => void;
  theme: AppTheme;
  onChangeTheme: (theme: AppTheme) => void;
  syncStatus: SyncStatus;
  onConnectLocalFolder: () => void;
  onSetEncryptionPassphrase: (pass: string) => void;
  onCreateSnapshot: (name?: string) => void;
  storageEstimate: { usedMb: number; quotaMb: number; percent: number };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  clickToInkSettings,
  onUpdateClickToInkSettings,
  inputSettings,
  onUpdateInputSettings,
  theme,
  onChangeTheme,
  syncStatus,
  onConnectLocalFolder,
  onSetEncryptionPassphrase,
  onCreateSnapshot,
  storageEstimate,
}) => {
  const [activeTab, setActiveTab] = useState<'clickToInk' | 'input' | 'appearance' | 'storage' | 'shortcuts'>('clickToInk');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-14 px-6 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            Settings & Preferences
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 px-6 gap-2 bg-stone-50/50 dark:bg-stone-950/40">
          <button
            onClick={() => setActiveTab('clickToInk')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'clickToInk'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>Click-to-Ink</span>
          </button>
          <button
            onClick={() => setActiveTab('input')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'input'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Touchpad & Mouse</span>
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'appearance'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <SunMoon className="w-3.5 h-3.5" />
            <span>Theme</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'storage'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Storage & Sync</span>
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'shortcuts'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Shortcuts</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-stone-700 dark:text-stone-300">
          {/* TAB 1: Click-to-Ink */}
          {activeTab === 'clickToInk' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div>
                  <div className="font-medium text-stone-900 dark:text-stone-100">
                    Enable Click-to-Ink Hands-Free Drawing
                  </div>
                  <div className="text-xs text-stone-500">
                    Click once to start drawing without holding the mouse button, click again to end (Ctrl+Shift+L).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={clickToInkSettings.enabled}
                  onChange={(e) => onUpdateClickToInkSettings({ enabled: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  End Stroke Trigger
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'click', label: 'Second Click' },
                    { id: 'double_click', label: 'Double Click' },
                    { id: 'hold_release', label: 'Hold & Release' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() =>
                        onUpdateClickToInkSettings({ endTrigger: t.id as 'click' | 'double_click' | 'hold_release' })
                      }
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        clickToInkSettings.endTrigger === t.id
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                          : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                      Viewport Edge Auto-Pan
                    </div>
                    <div className="text-[11px] text-stone-500">
                      Pans camera automatically when cursor approaches screen edges during inking.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={clickToInkSettings.edgeAutoPan}
                    onChange={(e) => onUpdateClickToInkSettings({ edgeAutoPan: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                      Dot on Deliberate Tap
                    </div>
                    <div className="text-[11px] text-stone-500">
                      Create an ink dot if two clicks happen in the same place quickly.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={clickToInkSettings.dotOnTap}
                    onChange={(e) => onUpdateClickToInkSettings({ dotOnTap: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                      Soft Audio Feedback Tick
                    </div>
                    <div className="text-[11px] text-stone-500">
                      Subtle tactile audio tone when pen starts or ends stroke.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={clickToInkSettings.audioTick}
                    onChange={(e) => onUpdateClickToInkSettings({ audioTick: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Input & Touchpad */}
          {activeTab === 'input' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  <span>Input Smoothing (One-Euro Filter)</span>
                  <span className="font-mono">{Math.round(inputSettings.smoothing * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={inputSettings.smoothing}
                  onChange={(e) => onUpdateInputSettings({ smoothing: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
                  <span>Raw (zero latency)</span>
                  <span>Balanced</span>
                  <span>Smooth (calligraphy)</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div>
                  <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                    Simulate Pressure from Mouse Speed
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Slow movement creates thicker strokes, rapid movement creates crisp thin flourishes.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={inputSettings.velocityPressure}
                  onChange={(e) => onUpdateInputSettings({ velocityPressure: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div>
                  <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                    Inertial Kinetic Panning
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Smooth deceleration when releasing mouse drag or trackpad swipe.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={inputSettings.inertialPan}
                  onChange={(e) => onUpdateInputSettings({ inertialPan: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Mouse Wheel Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'auto', label: 'Auto (Pinch zooms, wheel pans)' },
                    { id: 'zoom', label: 'Wheel Always Zooms' },
                    { id: 'pan', label: 'Wheel Always Pans' },
                  ].map((w) => (
                    <button
                      key={w.id}
                      onClick={() => onUpdateInputSettings({ wheelMode: w.id as 'auto' | 'zoom' | 'pan' })}
                      className={`p-2 rounded-xl border text-xs font-medium ${
                        inputSettings.wheelMode === w.id
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                          : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Appearance */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block">
                Notebook Theme & Canvas Lighting
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'light', name: 'Clean Light', desc: 'Crisp white paper & light slate' },
                  { id: 'dark', name: 'Midnight Dark', desc: 'True dark mode for night work' },
                  { id: 'paper', name: 'Warm Paper', desc: 'Calm cream & Moleskine tones' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onChangeTheme(t.id as AppTheme)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      theme === t.id
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/30'
                        : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60'
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-900 dark:text-stone-100">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Storage & Sync */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              {/* Storage Quota */}
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex justify-between items-center text-xs font-medium text-stone-800 dark:text-stone-200 mb-2">
                  <span>Device Storage Usage (IndexedDB)</span>
                  <span className="font-mono">
                    {storageEstimate.usedMb.toFixed(2)} MB of {storageEstimate.quotaMb.toFixed(0)} MB
                  </span>
                </div>
                <div className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(2, storageEstimate.percent))}%` }}
                  />
                </div>
              </div>

              {/* Local Folder Sync */}
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                      Local / Network Folder Sync (Account-free)
                    </div>
                    <div className="text-[11px] text-stone-500">
                      Mirror notes to any folder on your PC, OneDrive, Dropbox, or Nextcloud drive.
                    </div>
                  </div>
                  <button
                    onClick={onConnectLocalFolder}
                    className="px-3 py-1.5 text-xs font-medium bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Select Folder
                  </button>
                </div>
              </div>

              {/* End-to-End Encryption */}
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                  Optional End-to-End Passphrase Encryption
                </div>
                <div className="text-[11px] text-stone-500">
                  Encrypt document contents with AES-256-GCM before saving or syncing.
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="password"
                    placeholder="Enter encryption passphrase..."
                    value={passphraseInput}
                    onChange={(e) => setPassphraseInput(e.target.value)}
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900"
                  />
                  <button
                    onClick={() => {
                      onSetEncryptionPassphrase(passphraseInput);
                      setPassphraseInput('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Apply Key
                  </button>
                </div>
              </div>

              {/* Version Snapshot */}
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                  Create Named Version Snapshot
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Before reorganization..."
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900"
                  />
                  <button
                    onClick={() => {
                      onCreateSnapshot(snapshotName || undefined);
                      setSnapshotName('');
                      setSnapshotSuccess(true);
                      setTimeout(() => setSnapshotSuccess(false), 2000);
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg hover:opacity-90 flex items-center gap-1"
                  >
                    {snapshotSuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{snapshotSuccess ? 'Saved!' : 'Save Snapshot'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: 'Ctrl + Shift + L', desc: 'Toggle Click-to-Ink hands-free mode' },
                { key: 'Space (hold)', desc: 'Temporary pen lift during Click-to-Ink / Hand pan' },
                { key: 'Alt (hold)', desc: 'Override Click-to-Ink with press-and-hold' },
                { key: 'Esc / Right-Click', desc: 'Cancel in-progress stroke' },
                { key: 'Enter', desc: 'End stroke and commit' },
                { key: 'Shift (hold)', desc: 'Snap inking to straight line or 45° angle' },
                { key: 'Ctrl + Z', desc: 'Undo' },
                { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Redo' },
                { key: 'Ctrl + K', desc: 'Open Command Palette' },
                { key: '1 to 9', desc: 'Switch quickly between favorite pens' },
                { key: 'Ctrl + 1', desc: 'Zoom 100%' },
                { key: 'Ctrl + 2', desc: 'Fit Page Width' },
                { key: 'Ctrl + 3', desc: 'Fit All Pages in Viewport' },
                { key: 'Ctrl + Wheel', desc: 'Cursor-anchored Zoom' },
              ].map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between p-2 rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800"
                >
                  <span className="text-stone-600 dark:text-stone-400">{s.desc}</span>
                  <kbd className="font-mono text-[11px] bg-white dark:bg-stone-900 px-1.5 py-0.5 rounded border border-stone-300 dark:border-stone-700 font-semibold text-stone-800 dark:text-stone-200">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
