import { NotebookDocument } from '../types/document';
import { PAGE_SIZE_DIMENSIONS } from '../engine/penDefaults';
import { createAccountingTable } from '../engine/accountingFormats';

const DB_NAME = 'infinity_notebook_db';
const DB_VERSION = 1;
const STORE_DOCS = 'documents';
const STORE_SNAPSHOTS = 'snapshots';

export class StorageService {
  private db: IDBDatabase | null = null;
  private isInitializing = false;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.isInitializing) {
      await new Promise((r) => setTimeout(r, 50));
      return this.getDB();
    }

    this.isInitializing = true;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_DOCS)) {
          db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          const snapshotStore = db.createObjectStore(STORE_SNAPSHOTS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          snapshotStore.createIndex('docId', 'docId', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitializing = false;
        resolve(this.db);
      };

      request.onerror = () => {
        this.isInitializing = false;
        reject(request.error);
      };
    });
  }

  public async saveDocument(doc: NotebookDocument): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DOCS], 'readwrite');
      const store = tx.objectStore(STORE_DOCS);
      const req = store.put({ ...doc, updatedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async loadDocument(id: string): Promise<NotebookDocument | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DOCS], 'readonly');
      const store = tx.objectStore(STORE_DOCS);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllDocuments(): Promise<NotebookDocument[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DOCS], 'readonly');
      const store = tx.objectStore(STORE_DOCS);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async createSnapshot(doc: NotebookDocument, name?: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SNAPSHOTS], 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const snapshot = {
        docId: doc.id,
        name: name || `Snapshot ${new Date().toLocaleTimeString()}`,
        timestamp: Date.now(),
        docData: JSON.parse(JSON.stringify(doc)),
      };
      const req = store.add(snapshot);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getStorageEstimate(): Promise<{ usedMb: number; quotaMb: number; percent: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usedMb = ((est.usage || 0) / (1024 * 1024));
        const quotaMb = ((est.quota || 0) / (1024 * 1024));
        const percent = quotaMb > 0 ? (usedMb / quotaMb) * 100 : 0;
        return { usedMb, quotaMb, percent };
      } catch {
        // Fallback
      }
    }
    return { usedMb: 1.5, quotaMb: 1000, percent: 0.15 };
  }
}

export function createDefaultNotebook(title = 'Welcome to Infinity Notebook'): NotebookDocument {
  const pageDim = PAGE_SIZE_DIMENSIONS.A4;
  const initialPageId = 'page-1';

  return {
    id: 'doc-default',
    title: title || 'Accounting Ledger & Canvas',
    description: 'Professional financial spreadsheets, accounts, and ledgers.',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deviceId: 'device-' + Math.random().toString(36).substring(2, 9),
    currentMode: 'canvas',
    activePageId: initialPageId,
    autoAppendPages: false,
    tags: ['Accounting', 'Financial'],
    layers: [
      { id: 'layer-bg', name: 'Background & Templates', visible: true, locked: false, opacity: 1.0 },
      { id: 'layer-tables', name: 'Accounting Tables', visible: true, locked: false, opacity: 1.0 },
      { id: 'layer-text', name: 'Text & Notes', visible: true, locked: false, opacity: 1.0 },
      { id: 'layer-shapes', name: 'Shapes & Annotations', visible: true, locked: false, opacity: 1.0 },
    ],
    pages: [
      {
        id: initialPageId,
        title: 'Sheet 1',
        pageNumber: 1,
        x: 0,
        y: 0,
        width: pageDim.width,
        height: pageDim.height,
        sizeFormat: 'A4',
        orientation: 'portrait',
        template: 'spreadsheet',
        templateSpacing: 28,
        tags: ['General Journal'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    objects: [
      createAccountingTable('journal', 40, 40, '$'),
    ],
  };
}
