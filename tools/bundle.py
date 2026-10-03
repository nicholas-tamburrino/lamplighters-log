"""Build one self-contained HTML file (no other files needed): python tools/bundle.py > lamplighters-log.html"""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
tags = "".join(f'<script src="src/{n}.js"></script>\n' for n in ("world", "engine", "narrator"))
if tags not in html:
    sys.exit("index.html script tags changed; update tools/bundle.py")
code = "".join((root / "src" / f"{n}.js").read_text(encoding="utf-8") + "\n" for n in ("world", "engine", "narrator"))
sys.stdout.write(html.replace(tags, "<script>\n" + code + "</script>\n"))
