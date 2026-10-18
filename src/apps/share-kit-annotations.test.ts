import { describe, expect, it } from 'vitest';
import { annotationPalette, changeAnnotations, createAnnotationHistory, paintAnnotations, redoAnnotations, translateAnnotation, undoAnnotations, type Annotation } from '../../examples/packages/first-party-replacements/tweetPng/src/annotations';
const drawing: Annotation = { tool: 'pen', points: [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.6 }], width: 4, color: '#112233' };
function painter() {
  const calls: unknown[][] = [];
  const methods = ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'strokeRect', 'ellipse', 'fillRect', 'fillText'];
  const context = Object.fromEntries(methods.map(name => [name, (...args: unknown[]) => calls.push([name, ...args])])) as unknown as CanvasRenderingContext2D;
  return { context, calls };
}
describe('Share Kit annotations', () => {
  it('undoes, redoes, clears, and invalidates the redo branch without mutating old drawings', () => {
    const empty = createAnnotationHistory(); const added = changeAnnotations(empty, [drawing]);
    const undone = undoAnnotations(added); expect(undone.items).toEqual([]);
    expect(redoAnnotations(undone).items).toEqual([drawing]);
    expect(changeAnnotations(undone, [{ ...drawing, tool: 'arrow' }]).redo).toEqual([]);
    expect(undoAnnotations(changeAnnotations(added, [])).items).toEqual([drawing]);
    expect(empty.items).toEqual([]);
  });
  it('derives an inspectable local palette and ignores transparent pixels', () => {
    expect(annotationPalette()[0]).toBe('#8855cc');
    expect(annotationPalette([255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 0])[0]).toBe('#800080');
    expect(annotationPalette([0, 255, 0, 0])).toEqual(annotationPalette());
  });
  it('moves shapes within canvas bounds without changing their size', () => {
    expect(translateAnnotation(drawing, -1, 1).points).toEqual([{ x: 0, y: 0.6000000000000001 }, { x: 0.4, y: 1 }]);
    expect(drawing.points[0]).toEqual({ x: 0.1, y: 0.2 });
  });
  it.each(['pen', 'line', 'rectangle', 'ellipse', 'arrow', 'highlight', 'text'] as const)('uses identical painting for reviewed and exported %s pixels', tool => {
    const item = { ...drawing, tool, text: 'Local note', bold: true };
    const preview = painter(), output = painter();
    paintAnnotations(preview.context, [item], 2400, 1600); paintAnnotations(output.context, [item], 2400, 1600);
    expect(output.calls).toEqual(preview.calls); expect(output.calls.length).toBeGreaterThan(2);
    expect(output.context.lineWidth).toBe(8);
    if (tool === 'highlight') expect(output.context.globalAlpha).toBe(0.3);
    if (tool === 'text') expect(output.context.font).toBe('700 48px Arial, sans-serif');
  });
  it('scales normalized coordinates when the preview changes size', () => {
    const canvas = painter(); paintAnnotations(canvas.context, [drawing], 1200, 800);
    expect(canvas.calls).toContainEqual(['moveTo', 120, 160]);
    const scaled = painter(); paintAnnotations(scaled.context, [drawing], 2400, 1600);
    expect(scaled.calls).toContainEqual(['moveTo', 240, 320]);
  });
});
