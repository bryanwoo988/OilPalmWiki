#!/usr/bin/env python3
"""Generate app icons and splash screens for OPWiki from palm-oil-2.png.

Run:  venv/bin/python tools/make-icons.py
Idempotent: safe to re-run after replacing the source logo.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "palm-oil-2.png"
ICONS = ROOT / "icons"
SPLASH = ICONS / "splash"

# Palette (see docs/superpowers/specs/2026-09-30-opwiki-design.md §3)
ICON_BG = (255, 253, 245, 255)   # warm white, for maskable + iOS
LIGHT_BG = (252, 251, 247, 255)  # app light background
DARK_BG = (16, 21, 18, 255)      # app dark background


def load_logo() -> Image.Image:
    logo = Image.open(SRC).convert("RGBA")
    # Trim transparent margin so scaling is predictable.
    bbox = logo.getbbox()
    return logo.crop(bbox) if bbox else logo


def fit(logo: Image.Image, box: int) -> Image.Image:
    """Scale logo to fit inside a box x box square, preserving aspect."""
    w, h = logo.size
    scale = box / max(w, h)
    return logo.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                       Image.LANCZOS)


def compose(logo: Image.Image, size: tuple[int, int], bg, coverage: float):
    """Centre the logo on a background, occupying `coverage` of the short side."""
    canvas = Image.new("RGBA", size, bg)
    art = fit(logo, round(min(size) * coverage))
    canvas.alpha_composite(art, ((size[0] - art.width) // 2,
                                 (size[1] - art.height) // 2))
    return canvas


def save(img: Image.Image, path: Path, opaque=True, quantize=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    if quantize:
        # Splash screens are a flat background plus flat-shaded art, so a
        # 128-colour palette is visually identical at a quarter of the bytes —
        # which matters because they all sit in the offline precache.
        img = img.convert("RGB").quantize(colors=128, method=Image.MEDIANCUT,
                                          dither=Image.NONE)
    elif opaque:
        img = img.convert("RGB")
    img.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)}  {path.stat().st_size // 1024} KB")


def main():
    logo = load_logo()
    print(f"source logo {SRC.name} trimmed to {logo.size}")

    print("\nmanifest icons (transparent, purpose=any)")
    for s in (192, 512):
        save(compose(logo, (s, s), (0, 0, 0, 0), 1.0),
             ICONS / f"icon-{s}.png", opaque=False)

    # Android masks adaptive icons to a circle/squircle and can clip ~10% on
    # each edge, so the artwork sits at 66% with a solid safe area behind it.
    print("\nmaskable icons (safe area inset)")
    for s in (192, 512):
        save(compose(logo, (s, s), ICON_BG, 0.66),
             ICONS / f"icon-maskable-{s}.png")

    # iOS does not composite transparency behind home-screen icons.
    print("\niOS / favicon")
    save(compose(logo, (180, 180), ICON_BG, 0.80),
         ICONS / "apple-touch-icon-180.png")
    save(compose(logo, (32, 32), (0, 0, 0, 0), 1.0),
         ICONS / "favicon-32.png", opaque=False)
    ico = compose(logo, (64, 64), (0, 0, 0, 0), 1.0)
    ico.save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  favicon.ico")

    # apple-touch-startup-image needs an exact pixel match per device, so the
    # common iPhone/iPad raster sizes are all generated, in both themes.
    sizes = [
        (1290, 2796), (1179, 2556), (1284, 2778), (1170, 2532),
        (1125, 2436), (1242, 2688), (828, 1792), (750, 1334),
        (1536, 2048), (1668, 2388), (2048, 2732),
    ]
    print("\nsplash screens")
    for theme, bg in (("light", LIGHT_BG), ("dark", DARK_BG)):
        for w, h in sizes:
            save(compose(logo, (w, h), bg, 0.38),
                 SPLASH / f"{w}x{h}-{theme}.png", quantize=True)

    print("\ndone")


if __name__ == "__main__":
    main()
