import { onContextualPostAction, disable } from '../../examples/packages/first-party-replacements/tweetPng/src/content';
import { layoutTweetPngPlainText, layoutTweetPngRichInlineRuns } from '../../examples/packages/first-party-replacements/tweetPng/src/text-layout';
import type { MilxdyContextualPostActionContext } from '../../sdk/types';
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const stack = 'TwitterChirp, Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const corpus = [
 ['Latin and whitespace', 'Latin   words\r\n\r\nSecond\tline'],
 ['URL and handles', 'https://example.com/' + 'longpath'.repeat(35) + ' #Unicode @example'],
 ['graphemes', 'Cafe\u0301 👩‍👩‍👧‍👦 👩🏽‍🚀 🇺🇸 1️⃣ '.repeat(8)],
 ['CJK', '「国際化された文章」は、句読点を行頭や行末に不自然に残しません。'.repeat(5)],
 ['no-space', 'ภาษาไทยไม่มีช่องว่างระหว่างคำខ្មែរមិនមានចន្លោះរវាងពាក្យ'.repeat(5)],
 ['Arabic', 'بدأت الرحلة إلى القمر مع أصدقاء جدد في المساء '.repeat(8)],
 ['long main with media', 'Main العربية 漢字 👩🏽‍🚀 '.repeat(450)],
 ['long quoted media', 'Quoted العربية 漢字 👩🏽‍🚀 '.repeat(450)],
 ['mixed bidi', 'English العربية 123 עברית emoji 🌸 '.repeat(8)],
] as const;
async function wait(ready: () => boolean) { for (let i = 0; i < 500; i++) { if (ready()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Timed out'); }
async function available(font: string) { try { await new FontFace('FontAvailabilityProbe', `local("${font}")`).load(); return true; } catch { return false; } }
async function verify() {
 const fonts = { TwitterChirp: await available('TwitterChirp'), Arial: await available('Arial'), Helvetica: await available('Helvetica') };
 const ctx = document.createElement('canvas').getContext('2d')!;
 let layouts = 0;
 for (const family of [stack, 'Arial, sans-serif', 'Helvetica, sans-serif']) for (const [label, text] of corpus) {
  for (const rich of [false, true]) {
   const options = { fontFamily: family, fontSize: 34, maxWidth: 320, maxLines: 5000, safetyPx: 16 };
   const result = rich ? layoutTweetPngRichInlineRuns(ctx, [{ text }], options) : layoutTweetPngPlainText(ctx, text, options);
   assert(result.lines.every(line => line.width <= result.safeWidth + 0.1), `${label}: overflow ${family}`);
   const materialized = result.lines.flatMap(line => line.fragments).map(f => f.text).join('').replace(/\s/gu, '');
   assert(materialized === text.replace(/\s/gu, ''), `${label}: content loss ${family}`);
   const originalGraphemes = new Set(Array.from(new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(text), part => part.segment));
   for (const fragment of result.lines.flatMap(line => line.fragments)) for (const part of new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(fragment.text)) assert(originalGraphemes.has(part.segment), `${label}: split grapheme ${part.segment}`);
   const limited = rich ? layoutTweetPngRichInlineRuns(ctx, [{text}], {...options, maxLines:2}) : layoutTweetPngPlainText(ctx,text,{...options,maxLines:2});
   assert(limited.lines.length <= 2 && limited.lines.every(line=>line.width <= limited.safeWidth + 0.1), `${label}: cap/ellipsis overflow`);
   if (result.lines.length > 2) assert(limited.truncated && limited.lines.at(-1)!.fragments.at(-1)!.text.endsWith('...'), `${label}: missing ellipsis`);
   layouts++;
  }
 }
 let copied: Blob | null = null, downloaded: Blob | null = null;
 Object.defineProperty(navigator, 'clipboard', {value:{write: async (items: ClipboardItem[])=>{copied=await items[0].getType('image/png');}}});
 const nativeClick=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){void fetch(this.href).then(r=>r.blob()).then(blob=>{downloaded=blob;});};
 const nativeFill=CanvasRenderingContext2D.prototype.fillText;
 type Draw={text:string;x:number;y:number;size:number;right:number;bottom:number;canvas:HTMLCanvasElement}; let draws:Draw[]=[];
 CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){const m=this.measureText(text);draws.push({text,x,y,size:Number(this.font.match(/([\d.]+)px/)?.[1]),right:x+m.actualBoundingBoxRight,bottom:y+m.actualBoundingBoxDescent,canvas:this.canvas});nativeFill.call(this,text,x,y,...(maxWidth===undefined?[]:[maxWidth]));};
 const pixel=(color:string)=>{const c=document.createElement('canvas');c.width=400;c.height=200;const cx=c.getContext('2d')!;cx.fillStyle=color;cx.fillRect(0,0,400,200);return c.toDataURL();};
 const postImage=pixel('#14884b'), quoteImage=pixel('#263baa');
 const results=[];
 for (const [label,text] of corpus) {
  const article=document.createElement('article');article.dataset.testid='tweet';
  article.innerHTML='<div data-testid="User-Name"><a href="/example"><span>Example</span></a><span>@example</span></div><div data-testid="tweetText"></div><div data-testid="tweetPhoto"><img></div><div data-testid="card.wrapper"><span></span><span>example.com</span></div><div data-testid="quoteTweet"><div data-testid="User-Name"><a href="/quoted"><span>Quoted</span></a><span>@quoted</span></div><div data-testid="tweetText"></div><div data-testid="tweetPhoto"><img></div></div><time datetime="2026-01-01T00:00:00Z"></time>';
  article.querySelector('[data-testid="tweetText"]')!.textContent=label==='long quoted media' ? 'Main post remains visible with quoted media.' : text;
  article.querySelector('[data-testid="quoteTweet"] [data-testid="tweetText"]')!.textContent=label==='long main with media' ? 'Quoted text remains visible with quoted media.' : text;
  article.querySelector('[data-testid="card.wrapper"] span')!.textContent=text.replace(/\s+/g,' ');
  const images=article.querySelectorAll('img');images[0].src=postImage;images[1].src=quoteImage;await Promise.all(Array.from(images,img=>img.decode()));document.body.append(article);draws=[];
  const context={actionId:'reviewPng',post:article,statusUrl:'https://x.com/example/status/123',signal:new AbortController().signal,storage:{local:{get:async(defaults:object)=>defaults,set:async()=>{}}},resolveAssetUrl:()=>''} as unknown as MilxdyContextualPostActionContext;
  const start=performance.now();await onContextualPostAction(context);await wait(()=>!document.querySelector<HTMLButtonElement>('[data-action=copy]')!.disabled);
  const preview=document.querySelector<HTMLImageElement>('.milxdy-tweet-png-preview')!;await preview.decode();
  const rendered=draws.filter(d=>d.canvas.width===2400 && [34,26,24].includes(d.size));
  assert(rendered.some(d=>d.size===34 && d.y>=182) && rendered.some(d=>d.size===26) && rendered.some(d=>d.size===24), `${label}: body/quote/card missing`);
  assert(rendered.every(d=>d.x>=176 && d.right<=1144.1 && d.bottom<=preview.naturalHeight/2-56), `${label}: glyph clipped at content boundary`);
  document.querySelector<HTMLButtonElement>('[data-action=copy]')!.click();await wait(()=>copied!==null);
  if (label.startsWith('long ')) assert(rendered.some(d=>d.text.endsWith('...')), `${label}: missing visible truncation`);
  const before=await copied!.arrayBuffer();
  const previewBlob=await(await fetch(preview.src)).blob();const expected=await previewBlob.arrayBuffer();
  const bitmap=await createImageBitmap(copied!);const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const cx=c.getContext('2d')!;cx.drawImage(bitmap,0,0);const actualPixels=cx.getImageData(0,0,c.width,c.height).data;cx.clearRect(0,0,c.width,c.height);cx.drawImage(preview,0,0);const previewPixels=cx.getImageData(0,0,c.width,c.height).data;
  assert(actualPixels.every((byte,index)=>byte===previewPixels[index]),`${label}: copy pixel mismatch`);
  document.querySelector<HTMLButtonElement>('[data-action=download]')!.click();await wait(()=>downloaded!==null);const bytes=new Uint8Array(await downloaded!.arrayBuffer());assert(bytes.length===before.byteLength&&bytes.every((b,i)=>b===new Uint8Array(before)[i]),`${label}: download byte mismatch`);
  const colorPresent=(r:number,g:number,b:number)=>actualPixels.some((byte,index)=>index%4===0&&byte===r&&actualPixels[index+1]===g&&actualPixels[index+2]===b);
  assert(colorPresent(20,136,75)&&colorPresent(38,59,170), `${label}: post or quote media reservation disappeared`);
  const firstColorRow=(r:number,g:number,b:number)=>Math.floor(actualPixels.findIndex((byte,index)=>index%4===0&&byte===r&&actualPixels[index+1]===g&&actualPixels[index+2]===b)/4/c.width)/2;
  const bodyBottom=Math.max(...rendered.filter(d=>d.size===34&&d.y>=182).map(d=>d.bottom));
  const quoteBottom=Math.max(...rendered.filter(d=>d.size===26).map(d=>d.bottom));
  assert(bodyBottom < firstColorRow(20,136,75) && quoteBottom < firstColorRow(38,59,170), `${label}: text overlaps reserved media`);
  results.push({label,renderMs:Math.round(performance.now()-start),draws:rendered.length,bodyLines:rendered.filter(d=>d.size===34&&d.y>=182).length,quoteLines:rendered.filter(d=>d.size===26).length,bothMediaVisible:true,previewBytes:expected.byteLength});
  copied=null;downloaded=null;disable();article.remove();
  // Keep a full-raster gallery for visual QA without shrinking the PNG itself.
  const heading=document.createElement('h2');heading.textContent=label;const img=document.createElement('img');img.src=URL.createObjectURL(previewBlob);img.style.cssText='display:block;width:600px;max-width:100%;height:auto';document.body.append(heading,img);
 }
 HTMLAnchorElement.prototype.click=nativeClick;CanvasRenderingContext2D.prototype.fillText=nativeFill;
 return {passed:true,fonts,layouts,productionCases:results,browser:navigator.userAgent};
}
verify().then(result=>{(globalThis as any).__annotationResult=result;}).catch(error=>{(globalThis as any).__annotationResult={passed:false,error:String(error)};});
