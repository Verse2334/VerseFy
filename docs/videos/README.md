# Home video background

Drop one of these into `docs/videos/` and it'll autoplay on the Home page:

- `home-bg.mp4` — primary (required)
- `home-bg.webm` — optional (served to browsers that support it, ~40% smaller)

## Requirements / best practices

- **Muted** — browsers block autoplay with sound
- **Short loop** — 8–20 seconds is ideal; loops seamlessly
- **Small file size** — aim for under 8 MB. Use ffmpeg (below) to compress
- **720p max** — it's background decoration, no one stares at it
- **No hard cuts** — prefer slow pans, gradients, abstract motion
- **Dark or muted colors** — hero text has to stay readable on top

## ffmpeg one-liner to optimize

Run this in a terminal against your source video:

```bash
# MP4 (H.264, good browser support)
ffmpeg -i INPUT.mp4 -vf "scale=1280:-2,fps=24" -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -an -movflags +faststart docs/videos/home-bg.mp4

# Optional smaller WebM (VP9) — served first if browser supports it
ffmpeg -i INPUT.mp4 -vf "scale=1280:-2,fps=24" -c:v libvpx-vp9 -b:v 0 -crf 33 -an docs/videos/home-bg.webm
```

What the flags do:
- `scale=1280:-2` → resize to 1280px wide, keep aspect ratio
- `fps=24` → 24fps is plenty for a background (saves ~20% file size)
- `-an` → strip audio (we force mute anyway)
- `-movflags +faststart` → MP4 can start playing before fully downloaded
- `-crf 28` / `33` → quality knob (higher = smaller + lower quality). 28–32 is the sweet spot for bg video

## Quick video source ideas

- Your own app running with a visualizer on screen (screen-record it)
- Free stock: [Pexels Videos](https://www.pexels.com/videos/), [Pixabay Videos](https://pixabay.com/videos/), [Coverr](https://coverr.co/) — filter for "abstract", "particles", "gradient"
- Generated in After Effects / DaVinci / Blender

## Testing locally

GitHub Pages will serve files from `docs/` once pushed. To preview locally first:

```bash
# From repo root
cd docs
python -m http.server 8000
# open http://localhost:8000
```

If the video doesn't show, check the browser console — most common issue is the wrong path or the file not committed yet.
