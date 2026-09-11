export { element, blankSelect, labeledInput, labeledControl, fieldset, requiredValue, friendlyTrait, decodePng, requireTransparentImage, canvasBlob, downloadBytes };

function blankSelect(label, options) {
  const select = element("select", { className: "tweet-composer-kit__pet-select", required: true, ariaLabel: label });
  select.append(element("option", { value: "", textContent: `Choose ${label.toLowerCase()}`, selected: true }));
  for (const option of options) select.append(element("option", { value: option.id, textContent: option.label }));
  return { select, root: labeledControl(label, select) };
}

function labeledInput(label, maxLength) {
  return labeledControl(label, element("input", {
    className: "tweet-composer-kit__pet-input",
    type: "text",
    maxLength,
    autocomplete: "off",
  }));
}

function labeledControl(label, control) {
  return element("label", { className: "tweet-composer-kit__pet-field" },
    element("span", { className: "tweet-composer-kit__pet-label", textContent: label }),
    control,
  );
}

function fieldset(legend, children) {
  return element("fieldset", { className: "tweet-composer-kit__pet-fieldset" },
    element("legend", { textContent: legend }),
    ...children,
  );
}

function requiredValue(control, message) {
  const value = control.value.trim();
  if (!value) {
    control.focus();
    throw new Error(message);
  }
  return value;
}

function friendlyTrait(value) {
  return value.replace(/([A-Z])/gu, " $1").replace(/^./u, (letter) => letter.toUpperCase());
}

async function decodePng(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function requireTransparentImage(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas inspection is unavailable.");
  context.clearRect(0, 0, 96, 96);
  context.drawImage(image, 0, 0, 96, 96);
  const pixels = context.getImageData(0, 0, 96, 96).data;
  let transparent = 0;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 250) transparent += 1;
  if (transparent / (pixels.length / 4) < 0.02) {
    throw new Error("This PNG appears opaque. Export a transparent Maker avatar so background material is not included.");
  }
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")), "image/png");
  });
}

function downloadBytes(bytes, fileName, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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

function element(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}
