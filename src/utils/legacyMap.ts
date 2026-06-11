export type LegacyMapData = {
  width: number;
  height: number;
  tiles: number[][];
};

export function parseLegacyMap(buffer: ArrayBuffer): LegacyMapData {
  const view = new DataView(buffer);
  const width = view.getInt32(0, true);
  const height = view.getInt32(4, true);
  const bytes = new Uint8Array(buffer, 8);

  const tiles: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      row.push(bytes[y * width + x] ?? 0);
    }
    tiles.push(row);
  }

  return { width, height, tiles };
}

export function collisionIndexes(maxIndex = 31): number[] {
  const indexes: number[] = [];
  for (let i = 5; i <= maxIndex; i++) {
    indexes.push(i);
  }
  return indexes;
}
