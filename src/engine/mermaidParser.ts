import { CanvasObject, ShapeObject, TextObject, ShapeType } from '../types/document';
import { measureTextBounds } from './textMeasurement';

interface MermaidNode {
  id: string;
  label: string;
  shapeType: ShapeType;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dashed';
}

/**
 * Deterministically parse Mermaid code into canvas objects
 */
export function parseMermaidToCanvasObjects(
  mermaidCode: string,
  centerX: number = 400,
  centerY: number = 300,
  theme: 'light' | 'dark' | 'paper' = 'light'
): CanvasObject[] {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#f4f4f5' : '#1e1e1e';
  const nodeBg = isDark ? '#27272a' : '#f8fafc';
  const nodeStroke = isDark ? '#52525b' : '#3b82f6';
  const arrowColor = isDark ? '#94a3b8' : '#2563eb';

  const lines = mermaidCode
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  if (lines.length === 0) return [];

  const firstLine = lines[0].toLowerCase();
  const isSequence = firstLine.includes('sequencediagram');
  const isLeftToRight = firstLine.includes('lr') || firstLine.includes('right');

  if (isSequence) {
    return parseSequenceDiagram(lines, centerX, centerY, theme);
  }

  // Parse Flowchart / Graph
  const nodesMap = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];

  const addNode = (id: string, label: string, shapeType: ShapeType) => {
    if (!nodesMap.has(id)) {
      const cleanLabel = label.trim() || id;
      const dims = measureTextBounds(cleanLabel, 14, 'sans-serif');
      const w = Math.max(120, Math.round(dims.width + 36));
      const h = Math.max(48, Math.round(dims.height + 24));
      nodesMap.set(id, {
        id,
        label: cleanLabel,
        shapeType,
        width: w,
        height: h,
      });
    }
  };

  const parseNodeDef = (str: string): { id: string; label: string; shape: ShapeType } => {
    // 1. Diamond {Decision}
    const diamondMatch = str.match(/^([a-zA-Z0-9_\-]+)\s*\{([^}]+)\}$/);
    if (diamondMatch) {
      return { id: diamondMatch[1], label: diamondMatch[2], shape: 'polygon' };
    }
    // 2. Ellipse/Circle ((Text))
    const circleMatch = str.match(/^([a-zA-Z0-9_\-]+)\s*\(\(([^)]+)\)\)$/);
    if (circleMatch) {
      return { id: circleMatch[1], label: circleMatch[2], shape: 'ellipse' };
    }
    // 3. Rounded Rect (Text)
    const roundedMatch = str.match(/^([a-zA-Z0-9_\-]+)\s*\(([^)]+)\)$/);
    if (roundedMatch) {
      return { id: roundedMatch[1], label: roundedMatch[2], shape: 'rounded_rect' };
    }
    // 4. Square Rect [Text]
    const squareMatch = str.match(/^([a-zA-Z0-9_\-]+)\s*\[([^\]]+)\]$/);
    if (squareMatch) {
      return { id: squareMatch[1], label: squareMatch[2], shape: 'rectangle' };
    }
    // 5. Plain identifier
    const plain = str.trim();
    return { id: plain, label: plain, shape: 'rectangle' };
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Edge line matching e.g. A --> B, A -->|Label| B, A -- Label --> B
    const edgeRegex =
      /([a-zA-Z0-9_\-\[\]\(\)\{\}]+)\s*(-->|--\s*.*?\s*-->|-.->|==>|---|-->\|.*?\|)\s*([a-zA-Z0-9_\-\[\]\(\)\{\}]+)/;
    const match = line.match(edgeRegex);

    if (match) {
      const leftRaw = match[1].trim();
      const op = match[2].trim();
      const rightRaw = match[3].trim();

      const fromNode = parseNodeDef(leftRaw);
      const toNode = parseNodeDef(rightRaw);

      addNode(fromNode.id, fromNode.label, fromNode.shape);
      addNode(toNode.id, toNode.label, toNode.shape);

      let edgeLabel = '';
      if (op.includes('|')) {
        edgeLabel = op.replace(/[->\|=]/g, '').trim();
      } else if (op.startsWith('--') && op.endsWith('-->')) {
        edgeLabel = op.substring(2, op.length - 3).trim();
      }

      edges.push({
        from: fromNode.id,
        to: toNode.id,
        label: edgeLabel,
        style: op.includes('.-') ? 'dashed' : 'solid',
      });
    } else {
      // Standalone node definition: e.g. A[Start Process]
      const single = parseNodeDef(line);
      if (single.id) {
        addNode(single.id, single.label, single.shape);
      }
    }
  }

  const nodes = Array.from(nodesMap.values());
  if (nodes.length === 0) return [];

  // Graph Layout Algorithm: Assign Layers (Ranks)
  const incoming = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => {
    incoming.set(n.id, 0);
    adj.set(n.id, []);
  });
  edges.forEach((e) => {
    incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
    adj.get(e.from)?.push(e.to);
  });

  const layers: MermaidNode[][] = [];
  const assigned = new Set<string>();

  // Roots have 0 incoming edges
  let currentLayer = nodes.filter((n) => (incoming.get(n.id) || 0) === 0);
  if (currentLayer.length === 0) currentLayer = [nodes[0]];

  while (currentLayer.length > 0 && assigned.size < nodes.length) {
    layers.push(currentLayer);
    currentLayer.forEach((n) => assigned.add(n.id));

    const nextCandidates = new Set<string>();
    currentLayer.forEach((n) => {
      const children = adj.get(n.id) || [];
      children.forEach((c) => {
        if (!assigned.has(c)) {
          nextCandidates.add(c);
        }
      });
    });

    currentLayer = Array.from(nextCandidates)
      .map((id) => nodesMap.get(id)!)
      .filter(Boolean);
  }

  // Any unassigned disconnected nodes
  const unassigned = nodes.filter((n) => !assigned.has(n.id));
  if (unassigned.length > 0) {
    layers.push(unassigned);
  }

  // Position Nodes in Layers
  const gapX = isLeftToRight ? 180 : 160;
  const gapY = isLeftToRight ? 110 : 130;

  // Compute total dimensions to center diagram
  let maxCross = 0;
  layers.forEach((layer) => {
    maxCross = Math.max(maxCross, layer.length);
  });

  const totalLayers = layers.length;
  const originX = isLeftToRight
    ? centerX - (totalLayers * gapX) / 2
    : centerX - (maxCross * gapX) / 2;
  const originY = isLeftToRight
    ? centerY - (maxCross * gapY) / 2
    : centerY - (totalLayers * gapY) / 2;

  layers.forEach((layer, layerIdx) => {
    layer.forEach((node, nodeIdx) => {
      const w = node.width || 120;
      const h = node.height || 48;

      if (isLeftToRight) {
        node.x = originX + layerIdx * gapX;
        const totalHeightInLayer = layer.length * gapY;
        node.y = centerY - totalHeightInLayer / 2 + nodeIdx * gapY;
      } else {
        const totalWidthInLayer = layer.length * gapX;
        node.x = centerX - totalWidthInLayer / 2 + nodeIdx * gapX;
        node.y = originY + layerIdx * gapY;
      }
    });
  });

  const result: CanvasObject[] = [];

  // Generate Node Shapes & Texts
  for (const node of nodes) {
    const nx = node.x || centerX;
    const ny = node.y || centerY;
    const nw = node.width || 120;
    const nh = node.height || 48;

    const shapeObj: ShapeObject = {
      id: `m-node-${node.id}-${Math.random().toString(36).substring(2, 7)}`,
      pageId: null,
      type: 'shape',
      layerId: 'layer-shapes',
      x: nx,
      y: ny,
      width: nw,
      height: nh,
      shapeType: node.shapeType,
      strokeColor: nodeStroke,
      fillColor: nodeBg,
      strokeWidth: 2,
      strokeStyle: 'solid',
      fillStyle: 'solid',
      roughness: 0,
      opacity: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'mermaid',
    };
    result.push(shapeObj);

    // Text label inside node
    const textDims = measureTextBounds(node.label, 14, 'sans-serif');
    const textObj: TextObject = {
      id: `m-txt-${node.id}-${Math.random().toString(36).substring(2, 7)}`,
      pageId: null,
      type: 'text',
      layerId: 'layer-text',
      x: nx + nw / 2 - textDims.width / 2,
      y: ny + nh / 2 - textDims.height / 2,
      width: textDims.width,
      height: textDims.height,
      text: node.label,
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      color: textColor,
      align: 'center',
      bold: true,
      opacity: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'mermaid',
    };
    result.push(textObj);
  }

  // Generate Connecting Arrows
  for (const edge of edges) {
    const fromNode = nodesMap.get(edge.from);
    const toNode = nodesMap.get(edge.to);
    if (!fromNode || !toNode || fromNode.x === undefined || toNode.x === undefined) continue;

    const fromCenter = {
      x: fromNode.x + (fromNode.width || 120) / 2,
      y: fromNode.y! + (fromNode.height || 48) / 2,
    };
    const toCenter = {
      x: toNode.x + (toNode.width || 120) / 2,
      y: toNode.y! + (toNode.height || 48) / 2,
    };

    // Calculate edge attachment points along node borders
    let startPt = { ...fromCenter };
    let endPt = { ...toCenter };

    if (isLeftToRight) {
      startPt = { x: fromNode.x + (fromNode.width || 120), y: fromCenter.y };
      endPt = { x: toNode.x, y: toCenter.y };
    } else {
      startPt = { x: fromCenter.x, y: fromNode.y! + (fromNode.height || 48) };
      endPt = { x: toCenter.x, y: toNode.y! };
    }

    const arrowObj: ShapeObject = {
      id: `m-edge-${edge.from}-${edge.to}-${Math.random().toString(36).substring(2, 7)}`,
      pageId: null,
      type: 'shape',
      layerId: 'layer-shapes',
      x: Math.min(startPt.x, endPt.x),
      y: Math.min(startPt.y, endPt.y),
      width: Math.max(1, Math.abs(endPt.x - startPt.x)),
      height: Math.max(1, Math.abs(endPt.y - startPt.y)),
      shapeType: 'arrow',
      strokeColor: arrowColor,
      fillColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: edge.style,
      startPoint: startPt,
      endPoint: endPt,
      arrowEnd: true,
      opacity: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'mermaid',
    };
    result.push(arrowObj);

    // Optional label on arrow
    if (edge.label) {
      const midX = (startPt.x + endPt.x) / 2;
      const midY = (startPt.y + endPt.y) / 2 - 12;
      const lDims = measureTextBounds(edge.label, 12, 'sans-serif');
      const edgeLabelObj: TextObject = {
        id: `m-edgetxt-${edge.from}-${edge.to}-${Math.random().toString(36).substring(2, 7)}`,
        pageId: null,
        type: 'text',
        layerId: 'layer-text',
        x: midX - lDims.width / 2,
        y: midY,
        width: lDims.width,
        height: lDims.height,
        text: edge.label,
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
        color: arrowColor,
        align: 'center',
        opacity: 0.9,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deviceId: 'mermaid',
      };
      result.push(edgeLabelObj);
    }
  }

  return result;
}

/**
 * Parse sequenceDiagram lines
 */
function parseSequenceDiagram(
  lines: string[],
  centerX: number,
  centerY: number,
  theme: 'light' | 'dark' | 'paper'
): CanvasObject[] {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#f4f4f5' : '#1e1e1e';
  const nodeBg = isDark ? '#27272a' : '#f8fafc';
  const nodeStroke = isDark ? '#52525b' : '#3b82f6';
  const arrowColor = isDark ? '#94a3b8' : '#2563eb';

  const participants = new Set<string>();
  const messages: { from: string; to: string; text: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const pMatch = line.match(/^participant\s+([a-zA-Z0-9_\-]+)(?:\s+as\s+(.+))?$/i);
    if (pMatch) {
      participants.add(pMatch[1]);
      continue;
    }

    const msgMatch = line.match(/([a-zA-Z0-9_\-]+)\s*(?:->>|-->>|->|-->)\s*([a-zA-Z0-9_\-]+)\s*:\s*(.+)/);
    if (msgMatch) {
      participants.add(msgMatch[1]);
      participants.add(msgMatch[2]);
      messages.push({
        from: msgMatch[1],
        to: msgMatch[2],
        text: msgMatch[3].trim(),
      });
    }
  }

  const pList = Array.from(participants);
  if (pList.length === 0) return [];

  const partWidth = 110;
  const partHeight = 44;
  const colGap = 160;
  const totalW = pList.length * colGap;
  const startX = centerX - totalW / 2;
  const startY = centerY - (messages.length * 50) / 2 - 60;
  const result: CanvasObject[] = [];

  const partPositions = new Map<string, number>();

  pList.forEach((p, idx) => {
    const px = startX + idx * colGap;
    partPositions.set(p, px + partWidth / 2);

    // Box
    result.push({
      id: `seq-p-${p}`,
      pageId: null,
      type: 'shape',
      layerId: 'layer-shapes',
      x: px,
      y: startY,
      width: partWidth,
      height: partHeight,
      shapeType: 'rounded_rect',
      strokeColor: nodeStroke,
      fillColor: nodeBg,
      strokeWidth: 2,
      strokeStyle: 'solid',
      fillStyle: 'solid',
      roughness: 0,
      opacity: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'mermaid',
    } as ShapeObject);

    // Text
    const dims = measureTextBounds(p, 13, 'sans-serif');
    result.push({
      id: `seq-ptxt-${p}`,
      pageId: null,
      type: 'text',
      layerId: 'layer-text',
      x: px + partWidth / 2 - dims.width / 2,
      y: startY + partHeight / 2 - dims.height / 2,
      width: dims.width,
      height: dims.height,
      text: p,
      fontSize: 13,
      fontFamily: 'Inter, sans-serif',
      color: textColor,
      align: 'center',
      bold: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'mermaid',
    } as TextObject);

    // Vertical Lifeline
    const lineBottom = startY + partHeight + messages.length * 50 + 40;
    result.push({
      id: `seq-life-${p}`,
      pageId: null,
      type: 'shape',
      layerId: 'layer-shapes',
      x: px + partWidth / 2,
      y: startY + partHeight,
      width: 0,
      height: lineBottom - (startY + partHeight),
      shapeType: 'line',
      strokeColor: isDark ? '#3f3f46' : '#cbd5e1',
      fillColor: 'transparent',
      strokeWidth: 1.5,
      strokeStyle: 'dashed',
      startPoint: { x: px + partWidth / 2, y: startY + partHeight },
      endPoint: { x: px + partWidth / 2, y: lineBottom },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'mermaid',
    } as ShapeObject);
  });

  // Message arrows
  messages.forEach((msg, idx) => {
    const x1 = partPositions.get(msg.from) || startX;
    const x2 = partPositions.get(msg.to) || startX + colGap;
    const y = startY + partHeight + 40 + idx * 50;

    result.push({
      id: `seq-msg-${idx}`,
      pageId: null,
      type: 'shape',
      layerId: 'layer-shapes',
      x: Math.min(x1, x2),
      y,
      width: Math.abs(x2 - x1),
      height: 0,
      shapeType: 'arrow',
      strokeColor: arrowColor,
      fillColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid',
      startPoint: { x: x1, y },
      endPoint: { x: x2, y },
      arrowEnd: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'mermaid',
    } as ShapeObject);

    const textDims = measureTextBounds(msg.text, 12, 'sans-serif');
    result.push({
      id: `seq-msgtxt-${idx}`,
      pageId: null,
      type: 'text',
      layerId: 'layer-text',
      x: (x1 + x2) / 2 - textDims.width / 2,
      y: y - 16,
      width: textDims.width,
      height: textDims.height,
      text: msg.text,
      fontSize: 12,
      fontFamily: 'Inter, sans-serif',
      color: textColor,
      align: 'center',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'mermaid',
    } as TextObject);
  });

  return result;
}
