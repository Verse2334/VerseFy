// Create a valid .ico file from raw RGBA pixel data
// ICO format: header + directory entries + BMP data for each size
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;
const data = Buffer.alloc(SIZE * SIZE * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  const sa = a / 255;
  data[i]     = Math.round(data[i] * (1 - sa) + r * sa);
  data[i + 1] = Math.round(data[i + 1] * (1 - sa) + g * sa);
  data[i + 2] = Math.round(data[i + 2] * (1 - sa) + b * sa);
  data[i + 3] = Math.min(255, data[i + 3] + a);
}

function fillCircle(cx, cy, radius, r, g, b, a) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 <= r2) {
        const edge = Math.max(0, 1 - (Math.sqrt(d2) - radius + 1));
        setPixel(x, y, r, g, b, Math.round(a * edge));
      }
    }
  }
}

function drawThickLine(x1, y1, x2, y2, thickness, r, g, b, a) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(x1 + dx * t, y1 + dy * t, thickness / 2, r, g, b, a);
  }
}

// Draw icon
// Background
for (let y = 0; y < SIZE; y++)
  for (let x = 0; x < SIZE; x++)
    setPixel(x, y, 14, 14, 24);

// Glow
fillCircle(128, 128, 100, 139, 92, 246, 50);
fillCircle(128, 128, 70, 236, 72, 153, 30);

// V shape
drawThickLine(65, 55, 128, 200, 28, 139, 92, 246, 230);
drawThickLine(128, 200, 191, 55, 28, 236, 72, 153, 230);
drawThickLine(65, 55, 128, 200, 36, 139, 92, 246, 40);
drawThickLine(128, 200, 191, 55, 36, 236, 72, 153, 40);

// Create PNG (ICO can embed PNG for 256x256)
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (~crc) >>> 0;
}

function pngChunk(type, cdata) {
  const len = Buffer.alloc(4); len.writeUInt32BE(cdata.length);
  const typeB = Buffer.from(type);
  const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(Buffer.concat([typeB, cdata])));
  return Buffer.concat([len, typeB, cdata, crcB]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0; // filter none
  data.copy(raw, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const compressed = zlib.deflateSync(raw, { level: 9 });
const pngData = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', compressed),
  pngChunk('IEND', Buffer.alloc(0)),
]);

// ICO: single 256x256 entry with embedded PNG
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);     // reserved
icoHeader.writeUInt16LE(1, 2);     // type: icon
icoHeader.writeUInt16LE(1, 4);     // count: 1

const entry = Buffer.alloc(16);
entry[0] = 0;   // width (0 = 256)
entry[1] = 0;   // height (0 = 256)
entry[2] = 0;   // color count
entry[3] = 0;   // reserved
entry.writeUInt16LE(1, 4);  // planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(pngData.length, 8); // size of PNG data
entry.writeUInt32LE(22, 12); // offset (6 header + 16 entry = 22)

const ico = Buffer.concat([icoHeader, entry, pngData]);

const outPath = path.join(__dirname, '..', 'build', 'icon.ico');
fs.writeFileSync(outPath, ico);
console.log('ICO created:', outPath, `(${ico.length} bytes)`);

// Also keep the PNG
const pngPath = path.join(__dirname, '..', 'build', 'icon.png');
fs.writeFileSync(pngPath, pngData);
console.log('PNG created:', pngPath);
