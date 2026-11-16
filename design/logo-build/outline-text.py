"""Extracts glyph outlines for the tgOS lettering from Franklin Gothic Medium Italic.

Glyph x-positions come from the browser (so kerning matches what the site renders today);
this script only supplies the outlines, scaled to each size and placed on a baseline at y=0.

Usage: python outline-text.py <out.json>
"""
import json
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONT_PATH = "C:/Windows/Fonts/framdit.ttf"

# Measured in Chromium with font-style:italic, font-weight:700, text-anchor:start (kerning included).
RUNS = {
    "tg46": {"text": "tg", "size": 46, "xs": [0, 14.75], "width": 38.094},
    "tgOS60": {"text": "tgOS", "size": 60, "xs": [0, 19.234, 49.688, 88.469], "width": 121.641},
}

font = TTFont(FONT_PATH)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font["head"].unitsPerEm


def fmt(v):
    return ("%.2f" % v).rstrip("0").rstrip(".")


out = {"font": font["name"].getDebugName(4), "unitsPerEm": upm, "runs": {}}
for key, run in RUNS.items():
    scale = run["size"] / upm
    items = []
    for ch, x in zip(run["text"], run["xs"]):
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs, ntos=fmt)
        # Flip y (font units are y-up) and scale; the baseline sits at y=0, the glyph origin at x=0.
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, 0, 0)))
        advance = glyphs[name].width * scale
        items.append({"char": ch, "x": x, "advance": round(advance, 3), "d": pen.getCommands()})
    out["runs"][key] = {"size": run["size"], "width": run["width"], "glyphs": items}

with open(sys.argv[1], "w") as fh:
    json.dump(out, fh, indent=1)

print(out["font"], "| upm", upm)
for key, run in out["runs"].items():
    pairs = [(g["char"], g["x"], g["advance"]) for g in run["glyphs"]]
    print(key, pairs)
