import { BODY_COMPLETION_CATALOG, colorForId } from './custom-pet-contract.js';

export async function renderCompletedAvatar(image, selection, canvas) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Canvas rendering is unavailable.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawLowerBody(context, selection);
  drawMakerUpperBody(context, image, selection.templateFamily);
  const blob = await canvasBlob(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}

function drawMakerUpperBody(context, image, family) {
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  const sourceHeight = Math.max(1, Math.floor(height * 0.76));
  const familyScale = family === "bonkler" ? 0.94 : family === "remilio" ? 0.88 : 1;
  const destinationWidth = Math.round(820 * familyScale);
  const destinationHeight = Math.round(700 * familyScale);
  const x = Math.round((1024 - destinationWidth) / 2);
  const y = family === "remilio" ? 54 : 16;
  context.drawImage(image, 0, 0, width, sourceHeight, x, y, destinationWidth, destinationHeight);
}

function drawLowerBody(context, selection) {
  const family = {
    milady: { center: 512, hipWidth: 230, legWidth: 80, spread: 62, top: 600 },
    remilio: { center: 512, hipWidth: 250, legWidth: 92, spread: 66, top: 616 },
    bonkler: { center: 512, hipWidth: 310, legWidth: 110, spread: 82, top: 590 },
    kagami: { center: 512, hipWidth: 220, legWidth: 76, spread: 58, top: 590 },
  }[selection.templateFamily];
  const legColor = BODY_COMPLETION_CATALOG.legColors.find((item) => item.id === selection.bodyCompletion.legColorVariant);
  const bottomColor = colorForId(selection.bodyCompletion.bottom.colorVariant);
  const shoeColor = colorForId(selection.bodyCompletion.footwear.colorVariant);
  if (!legColor || !bottomColor || !shoeColor) throw new Error("Choose supported leg, bottom, and footwear colors.");
  const leftX = family.center - family.spread - family.legWidth / 2;
  const rightX = family.center + family.spread - family.legWidth / 2;
  context.fillStyle = legColor.hex;
  roundedRect(context, leftX, family.top + 90, family.legWidth, 300, 36);
  roundedRect(context, rightX, family.top + 90, family.legWidth, 300, 36);
  drawBottom(context, family, selection.bodyCompletion.bottom.category, selection.bodyCompletion.legCoverage, bottomColor.hex, leftX, rightX);
  drawFootwear(context, selection.bodyCompletion.footwear.category, shoeColor.hex, leftX, rightX, family.legWidth);
}

function drawBottom(context, family, category, coverage, color, leftX, rightX) {
  context.fillStyle = color;
  const shortsBottom = coverage === "exposed" ? family.top + 188 : family.top + 236;
  if (coverage === "covered") {
    roundedRect(context, leftX - 12, family.top + 72, family.legWidth + 24, 302, 30);
    roundedRect(context, rightX - 12, family.top + 72, family.legWidth + 24, 302, 30);
  } else {
    roundedRect(context, family.center - family.hipWidth / 2, family.top + 52, family.hipWidth, shortsBottom - family.top - 52, 34);
  }
  if (category === "cargo-shorts") {
    context.fillStyle = shade(color, -24);
    roundedRect(context, family.center - family.hipWidth / 2 - 18, family.top + 105, 54, 58, 8);
    roundedRect(context, family.center + family.hipWidth / 2 - 36, family.top + 105, 54, 58, 8);
  } else if (category === "jeans") {
    context.strokeStyle = shade(color, 38);
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(family.center, family.top + 82);
    context.lineTo(family.center, family.top + 345);
    context.stroke();
  } else if (category === "dress-pants") {
    context.strokeStyle = shade(color, 24);
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(leftX + family.legWidth / 2, family.top + 115);
    context.lineTo(leftX + family.legWidth / 2, family.top + 360);
    context.moveTo(rightX + family.legWidth / 2, family.top + 115);
    context.lineTo(rightX + family.legWidth / 2, family.top + 360);
    context.stroke();
  } else if (category === "chinos") {
    context.fillStyle = shade(color, -18);
    context.fillRect(leftX - 12, family.top + 340, family.legWidth + 24, 22);
    context.fillRect(rightX - 12, family.top + 340, family.legWidth + 24, 22);
  }
}

function drawFootwear(context, category, color, leftX, rightX, legWidth) {
  const y = 918;
  context.fillStyle = color;
  if (category === "boots") {
    roundedRect(context, leftX - 22, y - 94, legWidth + 50, 116, 22);
    roundedRect(context, rightX - 22, y - 94, legWidth + 50, 116, 22);
  } else if (category === "sandals") {
    roundedRect(context, leftX - 26, y, legWidth + 58, 32, 16);
    roundedRect(context, rightX - 26, y, legWidth + 58, 32, 16);
    context.fillRect(leftX + 4, y - 40, 20, 48);
    context.fillRect(rightX + 4, y - 40, 20, 48);
  } else {
    const height = category === "loafers" ? 56 : 70;
    roundedRect(context, leftX - 30, y - height + 20, legWidth + 64, height, 25);
    roundedRect(context, rightX - 30, y - height + 20, legWidth + 64, height, 25);
    if (category === "sneakers") {
      context.fillStyle = shade(color, 42);
      context.fillRect(leftX - 24, y + 4, legWidth + 52, 12);
      context.fillRect(rightX - 24, y + 4, legWidth + 52, 12);
    }
  }
}


function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")), "image/png");
  });
}


function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
  context.fill();
}

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = clamp((value >> 16) + amount);
  const green = clamp(((value >> 8) & 0xff) + amount);
  const blue = clamp((value & 0xff) + amount);
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

