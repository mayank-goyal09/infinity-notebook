import JSZip from 'jszip';
import { NotebookDocument, CanvasObject, StrokeObject, ShapeObject, TextObject, StickyNoteObject } from '../types/document';
import { CanvasRenderer } from '../engine/renderer';

export class InbFormatService {
  /**
   * Export document to .inb (ZIP format)
   */
  public static async exportToInb(doc: NotebookDocument): Promise<Blob> {
    const zip = new JSZip();

    // 1. Manifest
    const manifest = {
      app: 'Infinity Notebook',
      version: 1,
      formatVersion: '1.0.0',
      documentId: doc.id,
      title: doc.title,
      created: doc.createdAt,
      updated: doc.updatedAt,
      pageCount: doc.pages.length,
      objectCount: doc.objects.length,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // 2. Document Data
    zip.file('document.json', JSON.stringify(doc, null, 2));

    // 3. Assets directory (images)
    const assetsFolder = zip.folder('assets');
    for (const obj of doc.objects) {
      if (obj.type === 'image' && obj.src.startsWith('data:image/')) {
        const [meta, base64Data] = obj.src.split(',');
        const mimeMatch = meta.match(/data:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const ext = mime.split('/')[1] || 'png';
        assetsFolder?.file(`${obj.id}.${ext}`, base64Data, { base64: true });
      }
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Import document from .inb (ZIP format)
   */
  public static async importFromInb(file: File): Promise<NotebookDocument> {
    const zip = await JSZip.loadAsync(file);

    const docFile = zip.file('document.json');
    if (!docFile) {
      throw new Error('Invalid .inb file: document.json missing');
    }

    const docContent = await docFile.async('string');
    const doc = JSON.parse(docContent) as NotebookDocument;

    // Validate essential fields
    if (!doc.id || !Array.isArray(doc.pages) || !Array.isArray(doc.objects)) {
      throw new Error('Corrupt .inb file structure');
    }

    return doc;
  }

  /**
   * Trigger download of a Blob file in the browser
   */
  public static downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export to PNG Image
   */
  public static exportToPng(
    doc: NotebookDocument,
    renderer: CanvasRenderer,
    theme: 'light' | 'dark' | 'paper' = 'light',
    scale = 2
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Find bounding box of all pages and objects
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const p of doc.pages) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + p.width);
        maxY = Math.max(maxY, p.y + p.height);
      }

      if (minX === Infinity) {
        minX = 0;
        minY = 0;
        maxX = 800;
        maxY = 1100;
      }

      const padding = 40;
      const width = (maxX - minX + padding * 2);
      const height = (maxY - minY + padding * 2);

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Cannot create 2d context'));
      }

      ctx.scale(scale, scale);
      ctx.translate(-minX + padding, -minY + padding);

      // Render document
      renderer.renderDocument(
        ctx,
        width,
        height,
        { x: -minX + padding, y: -minY + padding, zoom: 1.0 },
        doc.pages,
        doc.objects,
        doc.currentMode,
        theme
      );

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/png');
    });
  }

  /**
   * Export document to SVG Vector Markup
   */
  public static exportToSvg(doc: NotebookDocument): string {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of doc.pages) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.width);
      maxY = Math.max(maxY, p.y + p.height);
    }

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 800;
      maxY = 1100;
    }

    const padding = 20;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    let svgElements = '';

    // Draw Pages
    for (const p of doc.pages) {
      svgElements += `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" rx="4" />\n`;
    }

    // Draw Objects
    for (const obj of doc.objects) {
      if (obj.type === 'stroke') {
        const stroke = obj as StrokeObject;
        if (stroke.points.length > 1) {
          let pathD = `M ${stroke.points[0].x} ${stroke.points[0].y}`;
          for (let i = 1; i < stroke.points.length; i++) {
            pathD += ` L ${stroke.points[i].x} ${stroke.points[i].y}`;
          }
          svgElements += `<path d="${pathD}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.size}" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.opacity}" />\n`;
        }
      } else if (obj.type === 'shape') {
        const shape = obj as ShapeObject;
        if (shape.shapeType === 'rectangle') {
          svgElements += `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${shape.fillColor || 'none'}" stroke="${shape.strokeColor}" stroke-width="${shape.strokeWidth}" />\n`;
        } else if (shape.shapeType === 'ellipse') {
          svgElements += `<ellipse cx="${shape.x + shape.width / 2}" cy="${shape.y + shape.height / 2}" rx="${shape.width / 2}" ry="${shape.height / 2}" fill="${shape.fillColor || 'none'}" stroke="${shape.strokeColor}" stroke-width="${shape.strokeWidth}" />\n`;
        } else if (shape.shapeType === 'line' || shape.shapeType === 'arrow') {
          svgElements += `<line x1="${shape.x}" y1="${shape.y}" x2="${shape.x + shape.width}" y2="${shape.y + shape.height}" stroke="${shape.strokeColor}" stroke-width="${shape.strokeWidth}" stroke-linecap="round" />\n`;
        }
      } else if (obj.type === 'text') {
        const text = obj as TextObject;
        svgElements += `<text x="${text.x}" y="${text.y + text.fontSize}" fill="${text.color}" font-family="${text.fontFamily}" font-size="${text.fontSize}px">${escapeXml(text.text)}</text>\n`;
      } else if (obj.type === 'sticky') {
        const sticky = obj as StickyNoteObject;
        svgElements += `<rect x="${sticky.x}" y="${sticky.y}" width="${sticky.width}" height="${sticky.height}" fill="${sticky.color}" rx="4" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))" />\n`;
        svgElements += `<text x="${sticky.x + 12}" y="${sticky.y + 24}" fill="#1c1917" font-family="cursive" font-size="${sticky.fontSize}px">${escapeXml(sticky.text)}</text>\n`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${minY - padding} ${width} ${height}" width="${width}" height="${height}">
  ${svgElements}
</svg>`;
  }

  /**
   * Export to Markdown text document
   */
  public static exportToMarkdown(doc: NotebookDocument): string {
    let md = `# ${doc.title}\n\n`;
    if (doc.description) {
      md += `*${doc.description}*\n\n---\n\n`;
    }

    doc.pages.forEach((page) => {
      md += `## ${page.title || `Page ${page.pageNumber}`}\n\n`;

      const pageObjects = doc.objects.filter((o) => o.pageId === page.id);
      const textObjects = pageObjects.filter((o) => o.type === 'text') as TextObject[];
      const stickies = pageObjects.filter((o) => o.type === 'sticky') as StickyNoteObject[];

      textObjects.forEach((t) => {
        md += `${t.text}\n\n`;
      });

      if (stickies.length > 0) {
        md += `### Sticky Notes:\n\n`;
        stickies.forEach((s) => {
          md += `> 📌 **Note**: ${s.text.replace(/\n/g, ' ')}\n\n`;
        });
      }

      md += `\n---\n\n`;
    });

    return md;
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
