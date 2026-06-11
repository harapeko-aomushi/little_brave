# Map Tool

Legacy map files in `public/assets/maps/*.txt` are binary, not plain text.

Use the conversion tool to edit them as text.

## Export binary map to text / csv

```bash
npm run map:export -- public/assets/maps/Map1.txt editable/Map1.map.csv
```

## Import text map back to binary

```bash
npm run map:import -- editable/Map1.map.csv public/assets/maps/Map1.txt
```

## Text format

First line:

```text
<width>,<height>
```

Following lines:

- one row per line
- tile values separated by commas

Example:

```text
3,2
0,0,5
1,2,6
```

## Notes

- Tile values must be integers from `0` to `255`.
- Row count must match `height`.
- Column count must match `width`.
- Lines starting with `#` are ignored, so you can leave comments in editable files.
- Space-separated format is also accepted on import.
