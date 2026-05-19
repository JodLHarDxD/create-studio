# CREATstudio brand pack

Cinematic obsidian-sphere identity. All assets are SVG so they scale
infinitely and stay tiny on the wire.

## Files

| File | Use |
|------|-----|
| `mark.svg` | Obsidian sphere mark on dark surfaces (128×128 base) |
| `mark-light.svg` | Same mark tuned for cream/light backgrounds |
| `wordmark.svg` | Italic Playfair "creat" + mono "/studio" (360×120) |
| `wordmark-light.svg` | Wordmark on light surfaces |
| `lockup-horizontal.svg` | Mark + wordmark side-by-side (520×128) |
| `lockup-stacked.svg` | Mark above wordmark (360×260), uppercase mono caption |
| `og-image.svg` | Social card 1200×630 with sphere + tagline + masthead |

App-level icons (served from `/`):

| File | Use |
|------|-----|
| `../favicon.svg` | Tab icon (32×32, simplified mark) |
| `../apple-touch-icon.svg` | iOS home-screen icon (180×180) |

## Palette

```
zinc-950 base    #09090b
zinc-900 surface #18181b
zinc-800 raised  #27272a
emerald accent   #34d399   (rim glow, primary signal)
violet accent    #8b5cf6   (lower-right underbloom)
zinc-100 text    #f4f4f5
zinc-400 muted   #a1a1aa
```

## Typography

```
display  Playfair Display, italic, weight 400
sans     Inter
mono     JetBrains Mono
```

Wordmark always sets "creat" in lowercase italic Playfair with
`letter-spacing: -0.03em`. The "/studio" supplement sits in JetBrains
Mono at ~0.32em of the "creat" cap-height, vertical-align: top,
margin-left 0.15em, letter-spacing 0.05em.

## Usage rules

- **Do** lock the mark to its emerald rim. The glow is the brand signal.
- **Do** keep at least one mark-diameter of clear space around the lockup.
- **Don't** recolor the obsidian core. The sphere is always dark.
- **Don't** stretch or rotate the mark. Use the stacked lockup if vertical
  space is tight.
- **Don't** add a drop shadow under the mark — the rim glow already lifts
  it from the surface.

## Rasterization

SVG covers 100% of in-app and web use. If you need PNGs (legacy email
clients, some Slack unfurls, App Store screenshots), rasterize via:

```bash
# requires `sharp` or `resvg` installed
npx svg-to-png public/brand/og-image.svg --width 1200 --height 630 \
  --output public/brand/og-image.png
```

OG image specifically: most modern crawlers (Twitter/X, LinkedIn,
Facebook) accept SVG via `og:image`, but some legacy ones don't —
generate a PNG alongside the SVG if you're seeing fallback grey
previews.
