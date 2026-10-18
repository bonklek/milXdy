export type AnnotationTool = 'pen' | 'line' | 'rectangle' | 'ellipse' | 'arrow' | 'highlight' | 'text';
export type AnnotationPoint = { x: number; y: number };
export type Annotation = { tool: AnnotationTool; points: AnnotationPoint[]; color: string; width: number; text?: string; bold?: boolean };
export type AnnotationHistory = { items: Annotation[]; undo: Annotation[][]; redo: Annotation[][] };
export const createAnnotationHistory = (): AnnotationHistory => ({ items: [], undo: [], redo: [] });
export function changeAnnotations(state: AnnotationHistory, items: Annotation[]): AnnotationHistory {
  return { items, undo: [...state.undo, state.items].slice(-100), redo: [] };
}
export function undoAnnotations(state: AnnotationHistory): AnnotationHistory {
  if (!state.undo.length) return state;
  return { items: state.undo[state.undo.length - 1], undo: state.undo.slice(0, -1), redo: [...state.redo, state.items] };
}
export function redoAnnotations(state: AnnotationHistory): AnnotationHistory {
  if (!state.redo.length) return state;
  return { items: state.redo[state.redo.length - 1], undo: [...state.undo, state.items], redo: state.redo.slice(0, -1) };
}
export function annotationPalette(pixels?: ArrayLike<number>): string[] {
  let red = 0, green = 0, blue = 0, count = 0;
  if (pixels) for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    red += pixels[index]; green += pixels[index + 1]; blue += pixels[index + 2]; count++;
  }
  const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  const accent = count ? `#${hex(red / count)}${hex(green / count)}${hex(blue / count)}` : '#8855cc';
  return [...new Set([accent, '#ffcc33', '#ef4444', '#ffffff', '#111111'])];
}
export function translateAnnotation(value: Annotation, dx: number, dy: number): Annotation {
  const minX = Math.min(...value.points.map(point => point.x)), maxX = Math.max(...value.points.map(point => point.x));
  const minY = Math.min(...value.points.map(point => point.y)), maxY = Math.max(...value.points.map(point => point.y));
  dx = Math.max(-minX, Math.min(1 - maxX, dx)); dy = Math.max(-minY, Math.min(1 - maxY, dy));
  return { ...value, points: value.points.map(point => ({ x: point.x + dx, y: point.y + dy })) };
}
/** Same painter is used for the reviewed overlay and the exported PNG. Coordinates survive preview resizing. */
export function paintAnnotations(context: CanvasRenderingContext2D, items: readonly Annotation[], width: number, height: number): void {
  const unit = width / 1200;
  for (const item of items) {
    if (!item.points.length) continue;
    context.save();
    context.strokeStyle = item.color; context.fillStyle = item.color;
    context.lineWidth = item.width * unit; context.lineCap = 'round'; context.lineJoin = 'round';
    const first = item.points[0], last = item.points[item.points.length - 1];
    const x = first.x * width, y = first.y * height, endX = last.x * width, endY = last.y * height;
    const left = Math.min(x, endX), top = Math.min(y, endY), w = Math.abs(endX - x), h = Math.abs(endY - y);
    context.beginPath();
    if (item.tool === 'text') {
      context.font = `${item.bold ? '700' : '400'} ${Math.max(20, item.width * 6) * unit}px Arial, sans-serif`;
      context.textBaseline = 'top'; context.fillText(item.text || '', x, y, Math.max(1, width - x));
    } else if (item.tool === 'highlight') {
      context.globalAlpha = 0.3; context.fillRect(left, top, w || item.width * unit, h || item.width * unit);
    } else if (item.tool === 'rectangle') context.strokeRect(left, top, w, h);
    else if (item.tool === 'ellipse') { context.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); context.stroke(); }
    else {
      context.moveTo(x, y);
      for (const point of item.points.slice(1)) context.lineTo(point.x * width, point.y * height);
      if (item.points.length === 1) context.lineTo(x + 0.01, y);
      context.stroke();
      if (item.tool === 'arrow') {
        const angle = Math.atan2(endY - y, endX - x), size = Math.max(16, item.width * 3) * unit;
        context.beginPath(); context.moveTo(endX, endY);
        context.lineTo(endX - size * Math.cos(angle - Math.PI / 6), endY - size * Math.sin(angle - Math.PI / 6));
        context.moveTo(endX, endY); context.lineTo(endX - size * Math.cos(angle + Math.PI / 6), endY - size * Math.sin(angle + Math.PI / 6)); context.stroke();
      }
    }
    context.restore();
  }
}
