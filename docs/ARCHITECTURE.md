# Infinity Notebook: System Architecture & Technical Specifications

Infinity Notebook is a high-performance, local-first note-taking application designed for seamless operation both as an installable Progressive Web App (PWA) and as a native Windows desktop application via Tauri 2.

---

## 1. High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                                     USER INTERFACE                                    |
|  +--------------------+  +----------------------+  +-------------------------------+  |
|  | Notebook Navigation|  | Floating Pen Toolbar |  | Minimap / Zoom HUD / Rulers   |  |
|  | & Thumbnail Strip  |  | & Brush Studio       |  | & Click-to-Ink Status Banner  |  |
|  +--------------------+  +----------------------+  +-------------------------------+  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                  INTERACTION & INPUT                                  |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
|  | Pointer Events Pipeline |  | Click-to-Ink FSM        |  | Trackpad & Mouse      |  |
|  | (Coalesced / Pressure)  |  | (Idle-Armed-Inking-Lift)|  | (Pinch, Wheel, Middle)|  |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                RENDERING & SCENE GRAPH                                |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
|  | Live Inking Overlay     |  | Main Vector Canvas      |  | Background Grid/Page  |  |
|  | (<16ms, Catmull-Rom)    |  | (Spatial Culling / LOD) |  | Templates (10+ types) |  |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                               DOCUMENT MODEL & HISTORY                                |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
|  | Document Model (UUIDs)  |  | CRDT / OpLog Engine     |  | Undo/Redo Branching   |  |
|  | Pages / Frames / Objects|  | (Vector Clocks, Merge)  |  | History Stack         |  |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                           STORAGE, SYNC & RUNTIME TARGETS                             |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
|  | Local Storage           |  | Open Format (.inb)      |  | Tauri 2 Windows Native|  |
|  | IndexedDB / OPFS        |  | ZIP + Manifest + Assets |  | File Assoc / Native   |  |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
|  | Cloud Sync Engine       |  | E2E Encryption          |  | Multi-format Export   |  |
|  | (Google Drive / OAuth)  |  | (AES-256-GCM WebCrypto) |  | (PDF, SVG, PNG, MD)   |  |
|  +-------------------------+  +-------------------------+  +-----------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 2. Key Technical Decisions & Trade-Offs

### A. Rendering Strategy: Canvas 2D Dual-Layer vs. WebGL / WebGPU
- **Decision**: Dual-layer HTML5 Canvas 2D with spatial culling (R-Tree/Grid) and sub-pixel Level of Detail (LOD) simplification.
- **Rationale**:
  - WebGL/WebGPU introduces high shader maintenance, text-rasterization complexity, context-loss recovery issues, and high memory overhead for mixed text/shape/ink workloads.
  - Dual-layer Canvas 2D (dedicated transient overlay layer for live stroke + persistent document scene layer) achieves **< 16ms input-to-ink latency** on standard Intel/AMD integrated laptop GPUs.
  - Spatial culling ensures that with 10,000+ strokes, only the ~50-200 visible in the current camera frustum are stroked, effortlessly maintaining 60 FPS.

### B. State & Conflict Resolution: Operation Log CRDT vs. Heavyweight Yjs/Automerge
- **Decision**: Light-weight, zero-dependency Operation Log CRDT with Lamport/Vector timestamps, device UUIDs, and immutable state trees.
- **Rationale**:
  - Provides instant undo/redo, crash recovery snapshots, and deterministic multi-device merging without 300KB bundle bloat.
  - Completely self-contained and serializable to both IndexedDB and the `.inb` archive file format.

### C. Desktop Target: Tauri 2 vs. Electron
- **Decision**: Tauri 2 with WebView2 for Windows.
- **Rationale**:
  - Installer size < 5 MB compared to Electron's 90+ MB.
  - Native Windows Precision Touchpad and Pen API integration.
  - File associations for `.inb` registered directly in the Windows Registry via NSIS/WiX.
