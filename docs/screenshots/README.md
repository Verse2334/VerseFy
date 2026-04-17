# Screenshots

Drop your app screenshots here. They'll auto-appear on the landing page at the matching `<img>` tag. If a file is missing, a labeled placeholder shows instead — no broken images.

## Filenames (exact, case-sensitive)

| File | Shown as | Recommended size |
| --- | --- | --- |
| `home.png` | Home (big tile) | 1600×900 |
| `dj.png` | DJ Mode | 1280×720 |
| `visualizer.png` | Visualizer | 1280×720 |
| `equalizer.png` | Equalizer | 1280×720 |
| `wrapped.png` | Wrapped | 1280×720 |
| `library.png` | Library (big tile) | 1600×900 |

Keep them as `.png` or `.jpg`. Webp works too if you rename the `src=` in `index.html`.

## Adding more tiles

Open `docs/index.html`, find the `<div class="gallery-grid">` block, copy any `.shot` div, change the image `src`, tag text, and placeholder label. Use `class="shot big"` to make a tile span two columns.
