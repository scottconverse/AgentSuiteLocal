#!/usr/bin/env python3
"""
Generate agentsuitelocal/assets/icon.icns from brand PNG assets.

Run on macOS only (requires Pillow + system iconutil):
    pip install Pillow
    python scripts/generate_icns.py

Output: agentsuitelocal/assets/icon.icns
"""
import subprocess
import sys
from pathlib import Path

if sys.platform != "darwin":
    print("ERROR: iconutil is macOS-only. Run this script on a Mac.", file=sys.stderr)
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is required. Run: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).parent.parent
# Use the highest-resolution brand PNG available
candidates = [
    ROOT / "brand" / "png" / "icon-1024.png",
    ROOT / "brand" / "png" / "app-icon-1024.png",
    ROOT / "brand" / "png" / "logo-1024.png",
]
src = next((p for p in candidates if p.exists()), None)
if src is None:
    print("ERROR: No 1024px source PNG found in brand/png/. "
          "Expected one of: icon-1024.png, app-icon-1024.png, logo-1024.png", file=sys.stderr)
    sys.exit(1)

iconset = ROOT / "agentsuitelocal" / "assets" / "icon.iconset"
iconset.mkdir(parents=True, exist_ok=True)

SIZES = [16, 32, 64, 128, 256, 512, 1024]
for s in SIZES:
    img = Image.open(src).resize((s, s), Image.LANCZOS).convert("RGBA")
    img.save(iconset / f"icon_{s}x{s}.png")
    if s <= 512:
        img2x = Image.open(src).resize((s * 2, s * 2), Image.LANCZOS).convert("RGBA")
        img2x.save(iconset / f"icon_{s}x{s}@2x.png")

out = ROOT / "agentsuitelocal" / "assets" / "icon.icns"
result = subprocess.run(
    ["iconutil", "-c", "icns", str(iconset), "-o", str(out)],
    capture_output=True, text=True,
)
if result.returncode != 0:
    print(f"ERROR: iconutil failed:\n{result.stderr}", file=sys.stderr)
    sys.exit(1)

print(f"Generated: {out}")
