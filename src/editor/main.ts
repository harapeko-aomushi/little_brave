import './styles.css';
import { TILE_SIZE } from '../data/constants';

type LegacyMapData = {
  height: number;
  tiles: number[][];
  width: number;
};

type StageId = 0 | 1 | 2;
type Tool = 'draw' | 'erase' | 'picker' | 'fill';

const MAP_SOURCES: Array<{ id: StageId; label: string; path: string }> = [
  { id: 0, label: 'Stage 1', path: '/assets/maps/Map1.txt' },
  { id: 1, label: 'Stage 2', path: '/assets/maps/map2.txt' },
  { id: 2, label: 'Stage 3', path: '/assets/maps/map3.txt' }
];

const MAX_TILE = 31;
const GRID_COLOR = 'rgba(255, 255, 255, 0.18)';
const SELECT_COLOR = '#ffd166';
const PALETTE_TILE_SIZE = 40;
const PALETTE_COLUMNS = 6;

function parseLegacyMap(buffer: ArrayBuffer): LegacyMapData {
  const view = new DataView(buffer);
  const width = view.getInt32(0, true);
  const height = view.getInt32(4, true);
  const bytes = new Uint8Array(buffer, 8);
  const tiles: number[][] = [];

  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < width; x += 1) {
      row.push(bytes[y * width + x] ?? 0);
    }
    tiles.push(row);
  }

  return { width, height, tiles };
}

function toBinaryMap(map: LegacyMapData): Blob {
  const buffer = new ArrayBuffer(8 + map.width * map.height);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer, 8);
  view.setInt32(0, map.width, true);
  view.setInt32(4, map.height, true);

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      bytes[y * map.width + x] = map.tiles[y]?.[x] ?? 0;
    }
  }

  return new Blob([buffer], { type: 'application/octet-stream' });
}

function parseCsvMap(text: string): LegacyMapData {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const header = splitMapLine(lines[0]);
  const width = Number(header[0]);
  const height = Number(header[1]);

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid map header.');
  }

  const rows = lines.slice(1);
  if (rows.length !== height) {
    throw new Error(`Height mismatch. expected=${height} actual=${rows.length}`);
  }

  const tiles = rows.map((row, rowIndex) => {
    const values = splitMapLine(row).map(Number);
    if (values.length !== width) {
      throw new Error(`Width mismatch at row ${rowIndex + 1}. expected=${width} actual=${values.length}`);
    }
    return values.map((value) => clampTile(value));
  });

  return { width, height, tiles };
}

function splitMapLine(line: string): string[] {
  return line.includes(',')
    ? line.split(',').map((part) => part.trim())
    : line.split(/\s+/);
}

function toCsvMap(map: LegacyMapData): Blob {
  const lines = [`${map.width},${map.height}`];
  for (const row of map.tiles) {
    lines.push(row.map((tile) => String(clampTile(tile))).join(','));
  }
  return new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
}

function clampTile(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampColumnCount(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(max, Math.floor(value)));
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

class MapEditor {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly paletteCanvas: HTMLCanvasElement;
  private readonly paletteContext: CanvasRenderingContext2D;
  private readonly stageSelect: HTMLSelectElement;
  private readonly tileInput: HTMLInputElement;
  private readonly extendRightInput: HTMLInputElement;
  private readonly zoomInput: HTMLInputElement;
  private readonly gridInput: HTMLInputElement;
  private readonly status: HTMLElement;
  private readonly positionStatus: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private readonly csvInput: HTMLInputElement;
  private readonly canvasScroll: HTMLElement;
  private readonly toolButtons: HTMLButtonElement[];
  private chipImage = new Image();
  private chipCanvas = document.createElement('canvas');
  private currentStage: StageId = 0;
  private map: LegacyMapData = { width: 1, height: 1, tiles: [[0]] };
  private selectedTile = 5;
  private tool: Tool = 'draw';
  private zoom = 1;
  private showGrid = true;
  private isPointerDown = false;

  constructor(root: HTMLElement) {
    root.innerHTML = this.renderShell();
    this.canvas = this.getElement('map-canvas', HTMLCanvasElement);
    this.paletteCanvas = this.getElement('palette-canvas', HTMLCanvasElement);
    this.context = this.requireContext(this.canvas);
    this.paletteContext = this.requireContext(this.paletteCanvas);
    this.stageSelect = this.getElement('stage-select', HTMLSelectElement);
    this.tileInput = this.getElement('tile-input', HTMLInputElement);
    this.extendRightInput = this.getElement('extend-right-input', HTMLInputElement);
    this.zoomInput = this.getElement('zoom-input', HTMLInputElement);
    this.gridInput = this.getElement('grid-input', HTMLInputElement);
    this.status = this.getElement('status', HTMLElement);
    this.positionStatus = this.getElement('position-status', HTMLElement);
    this.fileInput = this.getElement('file-input', HTMLInputElement);
    this.csvInput = this.getElement('csv-input', HTMLInputElement);
    this.canvasScroll = this.getElement('canvas-scroll', HTMLElement);
    this.toolButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tool]'));
    this.attachEvents();
  }

  async start(): Promise<void> {
    await this.loadChipImage();
    this.drawPalette();
    await this.loadStage(0);
  }

  private renderShell(): string {
    return `
      <main class="editor-shell">
        <aside class="sidebar">
          <div class="brand">Little Brave Map Editor</div>
          <label class="field">
            <span>Stage</span>
            <select id="stage-select">
              ${MAP_SOURCES.map((stage) => `<option value="${stage.id}">${stage.label}</option>`).join('')}
            </select>
          </label>
          <div class="toolbar" aria-label="Tools">
            <button type="button" data-tool="draw" title="Draw" class="active">✎</button>
            <button type="button" data-tool="erase" title="Erase">⌫</button>
            <button type="button" data-tool="picker" title="Pick">⌖</button>
            <button type="button" data-tool="fill" title="Fill">▣</button>
          </div>
          <label class="field">
            <span>Tile</span>
            <input id="tile-input" type="number" min="0" max="255" value="5" />
          </label>
          <label class="field">
            <span>Add Columns Right</span>
            <input id="extend-right-input" type="number" min="1" max="512" value="16" />
          </label>
          <div class="resize-buttons">
            <button type="button" id="extend-right" class="wide-button">Add Right</button>
            <button type="button" id="delete-right" class="wide-button">Delete Right</button>
          </div>
          <label class="field">
            <span>Zoom</span>
            <input id="zoom-input" type="range" min="0.5" max="3" step="0.25" value="1" />
          </label>
          <label class="check">
            <input id="grid-input" type="checkbox" checked />
            <span>Grid</span>
          </label>
          <div class="palette-wrap">
            <canvas id="palette-canvas" width="256" height="128"></canvas>
          </div>
          <section class="actions">
            <button type="button" id="load-binary">Load .txt</button>
            <button type="button" id="load-csv">Load .csv</button>
            <button type="button" id="save-csv">Save CSV</button>
            <button type="button" id="save-binary">Save Binary</button>
          </section>
          <input id="file-input" type="file" accept=".txt,.bin,.map" hidden />
          <input id="csv-input" type="file" accept=".csv,.txt" hidden />
          <div id="status" class="status">Ready</div>
        </aside>
        <section class="workspace">
          <div class="canvas-bar">
            <div id="position-status">x: -, y: -, tile: -</div>
          </div>
          <div id="canvas-scroll" class="canvas-scroll">
            <canvas id="map-canvas" width="640" height="480"></canvas>
          </div>
        </section>
      </main>
    `;
  }

  private attachEvents(): void {
    this.stageSelect.addEventListener('change', () => {
      void this.loadStage(Number(this.stageSelect.value) as StageId);
    });
    this.tileInput.addEventListener('change', () => {
      this.selectedTile = clampTile(Number(this.tileInput.value));
      this.tileInput.value = String(this.selectedTile);
      this.drawPalette();
    });
    this.zoomInput.addEventListener('input', () => {
      this.zoom = Number(this.zoomInput.value);
      this.renderMap();
    });
    this.gridInput.addEventListener('change', () => {
      this.showGrid = this.gridInput.checked;
      this.renderMap();
    });
    this.getElement('extend-right', HTMLButtonElement).addEventListener('click', () => {
      this.extendMapRight(Number(this.extendRightInput.value));
    });
    this.getElement('delete-right', HTMLButtonElement).addEventListener('click', () => {
      this.deleteMapRight(Number(this.extendRightInput.value));
    });

    for (const button of this.toolButtons) {
      button.addEventListener('click', () => this.setTool(button.dataset.tool as Tool));
    }

    this.paletteCanvas.addEventListener('pointerdown', (event) => {
      const point = this.getCanvasPoint(this.paletteCanvas, event);
      const tileX = Math.floor(point.x / PALETTE_TILE_SIZE);
      const tileY = Math.floor(point.y / PALETTE_TILE_SIZE);
      const columns = Math.floor(this.paletteCanvas.width / PALETTE_TILE_SIZE);
      const tile = tileY * columns + tileX;
      if (tile >= 0 && tile <= MAX_TILE) {
        this.selectTile(tile);
      }
    });

    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 2) {
        event.preventDefault();
        this.copyTileFromPointer(event);
        return;
      }
      this.isPointerDown = true;
      this.applyPointer(event);
    });
    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    this.canvas.addEventListener('pointermove', (event) => {
      this.updatePointerStatus(event);
      if (this.isPointerDown && this.tool !== 'fill') {
        this.applyPointer(event);
      }
    });
    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
    });

    this.getElement('load-binary', HTMLButtonElement).addEventListener('click', () => this.fileInput.click());
    this.getElement('load-csv', HTMLButtonElement).addEventListener('click', () => this.csvInput.click());
    this.getElement('save-csv', HTMLButtonElement).addEventListener('click', () => {
      downloadBlob(toCsvMap(this.map), this.getOutputBaseName('map.csv'));
    });
    this.getElement('save-binary', HTMLButtonElement).addEventListener('click', () => {
      downloadBlob(toBinaryMap(this.map), this.getOutputBaseName('txt'));
    });

    this.fileInput.addEventListener('change', () => void this.loadBinaryFromInput());
    this.csvInput.addEventListener('change', () => void this.loadCsvFromInput());
    window.addEventListener('keydown', (event) => this.handleCameraKey(event));
  }

  private handleCameraKey(event: KeyboardEvent): void {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLSelectElement) {
      return;
    }

    const step = event.shiftKey ? 256 : 96;
    if (event.key === 'a' || event.key === 'A') {
      this.canvasScroll.scrollLeft -= step;
    } else if (event.key === 'd' || event.key === 'D') {
      this.canvasScroll.scrollLeft += step;
    } else if (event.key === 'w' || event.key === 'W') {
      this.canvasScroll.scrollTop -= step;
    } else if (event.key === 's' || event.key === 'S') {
      this.canvasScroll.scrollTop += step;
    } else {
      return;
    }

    event.preventDefault();
  }

  private async loadStage(stageId: StageId): Promise<void> {
    this.currentStage = stageId;
    this.stageSelect.value = String(stageId);
    const source = MAP_SOURCES.find((stage) => stage.id === stageId) ?? MAP_SOURCES[0];
    this.setStatus(`Loading ${source.label}`);
    const response = await fetch(source.path);
    const buffer = await response.arrayBuffer();
    this.map = parseLegacyMap(buffer);
    this.drawPalette();
    this.renderMap();
    this.setStatus(`${source.label}: ${this.map.width} x ${this.map.height}`);
  }

  private async loadBinaryFromInput(): Promise<void> {
    const file = this.fileInput.files?.[0];
    if (!file) {
      return;
    }
    this.map = parseLegacyMap(await file.arrayBuffer());
    this.renderMap();
    this.setStatus(`Loaded ${file.name}: ${this.map.width} x ${this.map.height}`);
    this.fileInput.value = '';
  }

  private async loadCsvFromInput(): Promise<void> {
    const file = this.csvInput.files?.[0];
    if (!file) {
      return;
    }
    this.map = parseCsvMap(await file.text());
    this.renderMap();
    this.setStatus(`Loaded ${file.name}: ${this.map.width} x ${this.map.height}`);
    this.csvInput.value = '';
  }

  private async loadChipImage(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.chipImage.onload = () => resolve();
      this.chipImage.onerror = () => reject(new Error('Could not load chip.png'));
      this.chipImage.src = '/assets/images/chip.png';
    });

    this.chipCanvas.width = this.chipImage.width;
    this.chipCanvas.height = this.chipImage.height;
    const context = this.requireContext(this.chipCanvas);
    context.drawImage(this.chipImage, 0, 0);
    const image = context.getImageData(0, 0, this.chipCanvas.width, this.chipCanvas.height);
    const pixels = image.data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] <= 4 && pixels[index + 1] <= 4 && pixels[index + 2] <= 4) {
        pixels[index + 3] = 0;
      }
    }
    context.putImageData(image, 0, 0);
  }

  private renderMap(): void {
    const scaledTile = TILE_SIZE * this.zoom;
    this.canvas.width = Math.max(1, Math.floor(this.map.width * scaledTile));
    this.canvas.height = Math.max(1, Math.floor(this.map.height * scaledTile));
    this.context.imageSmoothingEnabled = false;
    this.context.fillStyle = '#101820';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.map.height; y += 1) {
      for (let x = 0; x < this.map.width; x += 1) {
        this.drawTile(this.context, this.map.tiles[y]?.[x] ?? 0, x * scaledTile, y * scaledTile, scaledTile);
      }
    }

    if (this.showGrid) {
      this.drawGrid(scaledTile);
    }
  }

  private extendMapRight(columns: number): void {
    const count = clampColumnCount(columns, 512);
    this.extendRightInput.value = String(count);
    for (const row of this.map.tiles) {
      for (let index = 0; index < count; index += 1) {
        row.push(0);
      }
    }
    this.map.width += count;
    this.renderMap();
    this.canvasScroll.scrollLeft = this.canvasScroll.scrollWidth;
    this.setStatus(`Extended right by ${count}. ${this.map.width} x ${this.map.height}`);
  }

  private deleteMapRight(columns: number): void {
    const maxRemovable = this.map.width - 1;
    if (maxRemovable <= 0) {
      this.setStatus('Cannot delete right columns. Minimum width is 1.');
      return;
    }

    const count = clampColumnCount(columns, Math.min(512, maxRemovable));
    const nextWidth = this.map.width - count;
    this.extendRightInput.value = String(count);
    for (const row of this.map.tiles) {
      row.length = nextWidth;
    }
    this.map.width = nextWidth;
    this.renderMap();
    this.canvasScroll.scrollLeft = Math.min(this.canvasScroll.scrollLeft, this.canvasScroll.scrollWidth);
    this.setStatus(`Deleted right by ${count}. ${this.map.width} x ${this.map.height}`);
  }

  private drawTile(context: CanvasRenderingContext2D, tile: number, x: number, y: number, size: number): void {
    const tileIndex = clampTile(tile);
    if (tileIndex === 0) {
      context.fillStyle = '#0c1118';
      context.fillRect(x, y, size, size);
      return;
    }

    const sourceX = (tileIndex % Math.floor(this.chipCanvas.width / TILE_SIZE)) * TILE_SIZE;
    const sourceY = this.currentStage * TILE_SIZE;
    context.drawImage(this.chipCanvas, sourceX, sourceY, TILE_SIZE, TILE_SIZE, x, y, size, size);
  }

  private drawGrid(tileSize: number): void {
    this.context.strokeStyle = GRID_COLOR;
    this.context.lineWidth = 1;
    this.context.beginPath();
    for (let x = 0; x <= this.canvas.width; x += tileSize) {
      this.context.moveTo(Math.round(x) + 0.5, 0);
      this.context.lineTo(Math.round(x) + 0.5, this.canvas.height);
    }
    for (let y = 0; y <= this.canvas.height; y += tileSize) {
      this.context.moveTo(0, Math.round(y) + 0.5);
      this.context.lineTo(this.canvas.width, Math.round(y) + 0.5);
    }
    this.context.stroke();
  }

  private drawPalette(): void {
    const columns = PALETTE_COLUMNS;
    this.paletteCanvas.width = columns * PALETTE_TILE_SIZE;
    this.paletteCanvas.height = Math.ceil((MAX_TILE + 1) / columns) * PALETTE_TILE_SIZE;
    this.paletteContext.imageSmoothingEnabled = false;
    this.paletteContext.fillStyle = '#111820';
    this.paletteContext.fillRect(0, 0, this.paletteCanvas.width, this.paletteCanvas.height);

    for (let tile = 0; tile <= MAX_TILE; tile += 1) {
      const x = (tile % columns) * PALETTE_TILE_SIZE;
      const y = Math.floor(tile / columns) * PALETTE_TILE_SIZE;
      this.drawTile(this.paletteContext, tile, x, y, PALETTE_TILE_SIZE);
      this.paletteContext.fillStyle = 'rgba(0, 0, 0, 0.42)';
      this.paletteContext.fillRect(x, y + PALETTE_TILE_SIZE - 14, 20, 12);
      this.paletteContext.fillStyle = '#f2f6ff';
      this.paletteContext.font = '10px Consolas, monospace';
      this.paletteContext.fillText(String(tile), x + 3, y + PALETTE_TILE_SIZE - 4);
      if (tile === this.selectedTile) {
        this.paletteContext.strokeStyle = SELECT_COLOR;
        this.paletteContext.lineWidth = 2;
        this.paletteContext.strokeRect(x + 1, y + 1, PALETTE_TILE_SIZE - 2, PALETTE_TILE_SIZE - 2);
      }
    }
  }

  private applyPointer(event: PointerEvent): void {
    const tile = this.getMapTileFromPointer(event);
    if (!tile) {
      return;
    }

    if (this.tool === 'picker') {
      this.selectTile(this.map.tiles[tile.y]?.[tile.x] ?? 0);
      return;
    }

    if (this.tool === 'fill') {
      this.floodFill(tile.x, tile.y, this.selectedTile);
      this.renderMap();
      return;
    }

    this.map.tiles[tile.y][tile.x] = this.tool === 'erase' ? 0 : this.selectedTile;
    this.renderMap();
  }

  private updatePointerStatus(event: PointerEvent): void {
    const tile = this.getMapTileFromPointer(event);
    if (!tile) {
      this.positionStatus.textContent = 'x: -, y: -, tile: -';
      return;
    }
    const value = this.map.tiles[tile.y]?.[tile.x] ?? 0;
    this.positionStatus.textContent = `x: ${tile.x}, y: ${tile.y}, tile: ${value}`;
  }

  private copyTileFromPointer(event: PointerEvent): void {
    const tile = this.getMapTileFromPointer(event);
    if (!tile) {
      return;
    }

    this.selectTile(this.map.tiles[tile.y]?.[tile.x] ?? 0);
    this.updatePointerStatus(event);
    this.setStatus(`Copied tile ${this.selectedTile} at x:${tile.x}, y:${tile.y}`);
  }

  private getMapTileFromPointer(event: PointerEvent): { x: number; y: number } | undefined {
    const point = this.getCanvasPoint(this.canvas, event);
    const x = Math.floor(point.x / (TILE_SIZE * this.zoom));
    const y = Math.floor(point.y / (TILE_SIZE * this.zoom));
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) {
      return undefined;
    }
    return { x, y };
  }

  private floodFill(startX: number, startY: number, nextTile: number): void {
    const targetTile = this.map.tiles[startY]?.[startX];
    if (targetTile === undefined || targetTile === nextTile) {
      return;
    }

    const stack = [{ x: startX, y: startY }];
    while (stack.length > 0) {
      const point = stack.pop();
      if (!point) {
        continue;
      }
      if (point.x < 0 || point.y < 0 || point.x >= this.map.width || point.y >= this.map.height) {
        continue;
      }
      if (this.map.tiles[point.y][point.x] !== targetTile) {
        continue;
      }

      this.map.tiles[point.y][point.x] = nextTile;
      stack.push(
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 }
      );
    }
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    for (const button of this.toolButtons) {
      button.classList.toggle('active', button.dataset.tool === tool);
    }
  }

  private selectTile(tile: number): void {
    this.selectedTile = clampTile(tile);
    this.tileInput.value = String(this.selectedTile);
    this.drawPalette();
  }

  private getOutputBaseName(ext: string): string {
    const source = MAP_SOURCES.find((stage) => stage.id === this.currentStage) ?? MAP_SOURCES[0];
    const base = source.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'map';
    return `${base}.${ext}`;
  }

  private getCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
  }

  private getElement<T extends Element>(id: string, ctor: { new (...args: never[]): T }): T {
    const element = document.getElementById(id);
    if (!(element instanceof ctor)) {
      throw new Error(`Missing element: ${id}`);
    }
    return element;
  }

  private requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Canvas context is not available.');
    }
    return context;
  }
}

const root = document.getElementById('editor');
if (!root) {
  throw new Error('Editor root is missing.');
}

const editor = new MapEditor(root);
void editor.start().catch((error: unknown) => {
  console.error(error);
});
