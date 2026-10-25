import { NotebookDocument } from '../types/document';

export type SyncProvider = 'local_folder' | 'google_drive' | 'webdav' | 'none';

export interface SyncStatus {
  provider: SyncProvider;
  state: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastSyncedAt: number | null;
  pendingItems: number;
  message: string;
  isEncrypted: boolean;
}

export class SyncEngine {
  private status: SyncStatus = {
    provider: 'none',
    state: 'idle',
    lastSyncedAt: null,
    pendingItems: 0,
    message: 'Local only (account-free)',
    isEncrypted: false,
  };
  private onStatusChange?: (status: SyncStatus) => void;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private encryptionKey: CryptoKey | null = null;

  constructor(onStatusChange?: (status: SyncStatus) => void) {
    this.onStatusChange = onStatusChange;
  }

  public getStatus(): SyncStatus {
    return { ...this.status };
  }

  public setOnStatusChange(fn: (status: SyncStatus) => void) {
    this.onStatusChange = fn;
  }

  /**
   * Connect to a local or network folder using browser File System Access API
   */
  public async connectLocalFolder(): Promise<boolean> {
    if (!('showDirectoryPicker' in window)) {
      this.updateStatus({
        state: 'error',
        message: 'File System Access API not supported in this browser.',
      });
      return false;
    }

    try {
      this.directoryHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
      this.updateStatus({
        provider: 'local_folder',
        state: 'synced',
        lastSyncedAt: Date.now(),
        message: 'Connected to local sync folder',
      });
      return true;
    } catch {
      // User cancelled picker
      return false;
    }
  }

  /**
   * Set user passphrase for End-to-End Encryption (AES-256-GCM)
   */
  public async setEncryptionPassphrase(passphrase: string): Promise<void> {
    if (!passphrase) {
      this.encryptionKey = null;
      this.updateStatus({ isEncrypted: false, message: 'Encryption disabled' });
      return;
    }

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const salt = enc.encode('infinity-notebook-salt-v1');
    this.encryptionKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    this.updateStatus({ isEncrypted: true, message: 'End-to-end encryption active' });
  }

  /**
   * Encrypt payload with AES-256-GCM if encryption is enabled
   */
  public async encryptData(data: string): Promise<string> {
    if (!this.encryptionKey) return data;

    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      enc.encode(data)
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return as base64 string
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt payload with AES-256-GCM
   */
  public async decryptData(ciphertextBase64: string): Promise<string> {
    if (!this.encryptionKey) return ciphertextBase64;

    const binaryString = atob(ciphertextBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      data
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Trigger background sync of document
   */
  public async syncDocument(doc: NotebookDocument): Promise<boolean> {
    if (this.status.provider === 'none') {
      return false;
    }

    this.updateStatus({ state: 'syncing', message: 'Syncing changes...' });

    try {
      const serialized = JSON.stringify(doc);
      const dataToSave = this.encryptionKey ? await this.encryptData(serialized) : serialized;

      if (this.status.provider === 'local_folder' && this.directoryHandle) {
        const fileHandle = await this.directoryHandle.getFileHandle(`${doc.id}.inb.json`, {
          create: true,
        });
        const writable = await (fileHandle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
        await writable.write(dataToSave);
        await writable.close();
      }

      this.updateStatus({
        state: 'synced',
        lastSyncedAt: Date.now(),
        pendingItems: 0,
        message: `Synced ${new Date().toLocaleTimeString()}`,
      });
      return true;
    } catch (err) {
      this.updateStatus({
        state: 'error',
        message: `Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
      return false;
    }
  }

  public disconnect() {
    this.directoryHandle = null;
    this.updateStatus({
      provider: 'none',
      state: 'idle',
      message: 'Local only (account-free)',
    });
  }

  private updateStatus(newStatus: Partial<SyncStatus>) {
    this.status = { ...this.status, ...newStatus };
    if (this.onStatusChange) {
      this.onStatusChange({ ...this.status });
    }
  }
}
