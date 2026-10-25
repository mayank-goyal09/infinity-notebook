# Infinity Notebook - Embed Library

A lightweight, zero-dependency JavaScript library to embed an interactive whiteboard notebook into **any website**, or give your visitors a **one-click floating pen** to draw directly over your webpage.

---

## Quick Start (Two Methods)

### Method 1: Embed an Interactive Inking Notebook
Embed a responsive drawing canvas directly inside any `<div>`:

```html
<link rel="stylesheet" href="infinity-notebook-embed.css">

<!-- Container where the notebook lives -->
<div id="notebook-canvas" style="width: 100%; height: 550px;"></div>

<!-- Library script -->
<script src="infinity-notebook-embed.js"></script>
<script>
  const notebook = new InfinityNotebookEmbed({
    container: '#notebook-canvas',
    theme: 'light', // 'light' | 'dark' | 'paper'
    showToolbar: true,
    pressureSensitivity: true,
    initialColor: '#2563eb',
    initialSize: 3,
    onUpdate: (strokes) => {
      console.log('User drew something! Total strokes:', strokes.length);
    }
  });

  // API Methods:
  // notebook.exportPNG('my-notes.png');
  // const json = notebook.toJSON();
  // notebook.loadJSON(json);
  // notebook.undo();
  // notebook.clear();
</script>
```

---

### Method 2: One-Click Screen Inking Widget
Add a 1-click floating pen button to the bottom-right corner of your entire website so users or students can annotate over your content:

```html
<link rel="stylesheet" href="infinity-notebook-embed.css">
<script src="infinity-notebook-embed.js"></script>
<script>
  // Automatically mounts floating 1-click pen button & Alt+P shortcut:
  InfinityNotebookEmbed.initScreenWidget({
    theme: 'light'
  });
</script>
```

---

## Features
- **Pen Tablet Pressure Sensitivity:** Real hardware stylus pressure ($0.35 + 1.65 \times P$) for Wacom, Apple Pencil, Huion, and Surface Pen.
- **Buttery Smooth Catmull-Rom Curves:** $C^1$-continuous Bézier splines guarantee zero jitter.
- **Rich Tools:** Pen, Highlighter, Eraser, Shapes (Arrow, Rectangle, Circle, Line).
- **Zero Dependencies:** Pure vanilla JS and HTML5 Canvas.
- **Exporting:** PNG download, JSON state serialization.

---

## Live Demo
Double-click `demo.html` in your web browser to test both methods immediately!
