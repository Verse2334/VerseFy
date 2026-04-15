// Generate a simple 256x256 PNG icon using raw pixel manipulation + pngjs
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const data = Buffer.alloc(SIZE * SIZE * 4); // RGBA

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  // Alpha blend
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

function fillRect(x1, y1, w, h, r, g, b, a = 255) {
  for (let y = y1; y < y1 + h; y++)
    for (let x = x1; x < x1 + w; x++)
      setPixel(x, y, r, g, b, a);
}

// Background - dark
fillRect(0, 0, SIZE, SIZE, 10, 10, 22);

// Round corners (fill corners with transparent... skip for simplicity, just add glow)

// Purple glow center
fillCircle(128, 128, 100, 139, 92, 246, 50);
fillCircle(128, 128, 70, 236, 72, 153, 30);

// Draw a V shape
function drawThickLine(x1, y1, x2, y2, thickness, r, g, b, a) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    fillCircle(cx, cy, thickness / 2, r, g, b, a);
  }
}

// V with gradient - left stroke (purple) right stroke (pink)
drawThickLine(65, 55, 128, 200, 28, 139, 92, 246, 230); // left stroke purple
drawThickLine(128, 200, 191, 55, 28, 236, 72, 153, 230); // right stroke pink

// Outer glow on the V
drawThickLine(65, 55, 128, 200, 36, 139, 92, 246, 40);
drawThickLine(128, 200, 191, 55, 36, 236, 72, 153, 40);

// Write as raw RGBA, then we'll convert to PNG using a minimal approach
// Actually let's use Node's zlib to create a valid PNG

const zlib = require('zlib');

function createPNG(width, height, rgbaData) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type);
    const crc = crc32(Buffer.concat([typeBuffer, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeBuffer, data, crcBuf]);
  }

  // CRC32
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return ~crc;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  // IDAT - filter each row with filter type 0 (none)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter none
    rgbaData.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend),
  ]);
}

const png = createPNG(SIZE, SIZE, data);
const outPath = path.join(__dirname, '..', 'build', 'icon.png');
fs.writeFileSync(outPath, png);
console.log('Icon created:', outPath, `(${png.length} bytes)`);
