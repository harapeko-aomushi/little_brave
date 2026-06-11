import fs from 'node:fs';
import path from 'node:path';

function printUsage() {
  console.log(`Usage:
  node scripts/map-tool.mjs export <input-binary-map> <output-text-map>
  node scripts/map-tool.mjs import <input-text-map> <output-binary-map>

Text map format:
  - First line: "<width>,<height>" or "<width> <height>"
  - Following lines: width tile values separated by commas or spaces

Example:
  node scripts/map-tool.mjs export public/assets/maps/Map1.txt editable/Map1.map.csv
  node scripts/map-tool.mjs import editable/Map1.map.csv public/assets/maps/Map1.txt
`);
}

function resolvePath(target) {
  return path.resolve(process.cwd(), target);
}

function exportMap(inputPath, outputPath) {
  const buffer = fs.readFileSync(inputPath);
  const width = buffer.readInt32LE(0);
  const height = buffer.readInt32LE(4);
  const body = buffer.subarray(8);
  const delimiter = path.extname(outputPath).toLowerCase() === '.csv' ? ',' : ' ';

  if (body.length < width * height) {
    throw new Error(`Map body is too short. expected=${width * height} actual=${body.length}`);
  }

  const lines = [`${width}${delimiter}${height}`];
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      row.push(String(body[y * width + x]));
    }
    lines.push(row.join(delimiter));
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Exported: ${outputPath}`);
}

function importMap(inputPath, outputPath) {
  const text = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (lines.length < 2) {
    throw new Error('Text map must contain a header and at least one row.');
  }

  const headerParts = lines[0].includes(',')
    ? lines[0].split(',').map((part) => part.trim())
    : lines[0].split(/\s+/);
  const [widthText, heightText] = headerParts;
  const width = Number(widthText);
  const height = Number(heightText);

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid header: "${lines[0]}"`);
  }

  const rowLines = lines.slice(1);
  if (rowLines.length !== height) {
    throw new Error(`Height mismatch. header=${height} rows=${rowLines.length}`);
  }

  const body = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    const values = rowLines[y].includes(',')
      ? rowLines[y].split(',').map((part) => Number(part.trim()))
      : rowLines[y].split(/\s+/).map(Number);
    if (values.length !== width) {
      throw new Error(`Width mismatch at row ${y + 1}. expected=${width} actual=${values.length}`);
    }

    for (let x = 0; x < width; x += 1) {
      const value = values[x];
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error(`Invalid tile value at row ${y + 1}, col ${x + 1}: ${values[x]}`);
      }
      body[y * width + x] = value;
    }
  }

  const output = Buffer.alloc(8 + body.length);
  output.writeInt32LE(width, 0);
  output.writeInt32LE(height, 4);
  body.copy(output, 8);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
  console.log(`Imported: ${outputPath}`);
}

const [, , mode, inputArg, outputArg] = process.argv;

if (!mode || !inputArg || !outputArg) {
  printUsage();
  process.exit(1);
}

const inputPath = resolvePath(inputArg);
const outputPath = resolvePath(outputArg);

if (mode === 'export') {
  exportMap(inputPath, outputPath);
} else if (mode === 'import') {
  importMap(inputPath, outputPath);
} else {
  printUsage();
  process.exit(1);
}
