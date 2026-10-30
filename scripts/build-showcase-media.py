"""Encode a captioned walkthrough from real, already captured browser frames.

Run from any directory: python scripts/build-showcase-media.py
Requires Pillow. This script does not open a browser or create demo records.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs/portfolio/node-production"
STEPS = [
    ("home-desktop.jpg", "01 / Discover the storefront", 1500),
    ("catalog-desktop.jpg", "02 / Browse the live catalog", 1800),
    ("search-desktop.jpg", "03 / Search for Clean Code", 1800),
    ("book-detail-desktop.jpg", "04 / Read book details", 1800),
    ("cart-desktop.jpg", "05 / Add the book to the cart", 1800),
    ("checkout-desktop.jpg", "06 / Checkout - synthetic shipping details", 1800),
    ("order-success-desktop.jpg", "07 / Order saved successfully", 1800),
    ("orders-desktop.jpg", "08 / Read the persisted order", 2200),
]


def main():
    frames, durations = [], []
    font = ImageFont.load_default(size=19)
    small = ImageFont.load_default(size=13)
    for filename, caption, duration in STEPS:
        with Image.open(ASSETS / filename) as source:
            image = source.convert("RGB")
            image.thumbnail((1080, 750), Image.Resampling.LANCZOS)
            frame = Image.new("RGB", (1080, 810), "#f8f7f4")
            frame.paste(image, ((1080 - image.width) // 2, 60))
            draw = ImageDraw.Draw(frame)
            draw.rectangle((0, 0, 1080, 59), fill="#151515")
            draw.text((20, 10), caption, font=font, fill="white")
            draw.text((20, 35), "BookStore Node.js | Production walkthrough | Captured keyframes, edited pacing", font=small, fill="#d8d4cd")
            frames.append(frame.quantize(colors=128))
            durations.append(duration)
    gif = ASSETS / "shopping-walkthrough.gif"
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, optimize=True, disposal=2)
    with Image.open(gif) as check:
        assert check.n_frames == len(STEPS)
        assert check.size == (1080, 810)
        for index in range(check.n_frames):
            check.seek(index)
            check.load()
    assert gif.stat().st_size < 5 * 1024 * 1024
    print(json.dumps({"gif": str(gif.relative_to(ROOT)), "frames": len(STEPS),
                      "duration_ms": sum(durations), "bytes": gif.stat().st_size}))


if __name__ == "__main__":
    main()
