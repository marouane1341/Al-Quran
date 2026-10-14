#!/usr/bin/env python3
"""Assemble web/data.json à partir des fichiers Tanzil (texte, traduction facultative, métadonnées pages/juz).
Usage : build_data.py <quran-uthmani.txt> <quran-translation.txt|-> <quran-data.xml|-> <sortie.json>"""
import json, os, re, sys

txt, trans, xml, out = sys.argv[1:5]

def read_lines(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            p = line.rstrip("\n").split("|", 2)
            if len(p) == 3 and p[0].isdigit() and p[1].isdigit():
                yield int(p[0]), int(p[1]), p[2].strip()

verses = [[s, a, t] for s, a, t in read_lines(txt)]
assert len(verses) == 6236, len(verses)
key = {(s, a): i for i, (s, a, _) in enumerate(verses)}
data = {"v": verses}

if trans != "-" and os.path.exists(trans):
    tr = {(s, a): t for s, a, t in read_lines(trans)}
    if len(tr) == 6236:
        data["t"] = [tr.get((s, a), "") for s, a, _ in verses]

if xml != "-" and os.path.exists(xml):
    x = open(xml, encoding="utf-8").read()
    for tag, name in (("page", "p"), ("juz", "j")):
        arr = []
        for m in re.finditer(r"<" + tag + r'\s+index="(\d+)"\s+sura="(\d+)"\s+aya="(\d+)"', x):
            i = key.get((int(m.group(2)), int(m.group(3))))
            if i is not None:
                arr.append(i)
        data[name] = arr

with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print("versets", len(verses), "traduction", "t" in data, "pages", len(data.get("p", [])), "juz", len(data.get("j", [])))
