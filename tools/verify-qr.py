#!/usr/bin/env python3
"""Verify js/qrcode.js by decoding everything it produces.

    venv/bin/python tools/verify-qr.py

For each payload, every one of the eight masks is encoded and decoded, not just
the mask the encoder chose — a bug in mask application or in the format bits
shows up in only some masks, and which mask gets picked depends on the data.

zxing-cpp is the authority: it is the engine behind Android's scanner. OpenCV's
detector is reported alongside it, but it is markedly weaker and fails on
conforming symbols, so it does not decide the result.

Mask *selection* is separately checked against an independent implementation of
the ISO/IEC 18004 §8.8.2 penalty rules.

Exits non-zero on any decode failure or penalty mismatch.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import zxingcpp

try:
    import cv2
except ImportError:
    cv2 = None

ROOT = Path(__file__).resolve().parent.parent

CASES = [
    "https://opwiki.app/",
    "https://bryanwoo.github.io/opwiki/",
    "HELLO WORLD",
    "a",
    "https://example.com/a-fairly-long-path/that-pushes-into-a-higher-version?x=1&y=2",
    "x" * 120,
    "x" * 200,
    "油棕百科 OPWiki Wiki Sawit",
]

QUIET, SCALE = 4, 8


def rasterise(bits, size):
    dim = size + QUIET * 2
    img = np.full((dim, dim), 255, dtype=np.uint8)
    for y in range(size):
        for x, c in enumerate(bits[y * size:(y + 1) * size]):
            if c == "1":
                img[y + QUIET, x + QUIET] = 0
    return np.kron(img, np.ones((SCALE, SCALE), dtype=np.uint8))


def reference_penalty(m, n):
    """ISO/IEC 18004 §8.8.2, written independently of the JS implementation."""
    s = 0

    # N1: runs of five or more.
    for i in range(n):
        for line in (m[i], [m[k][i] for k in range(n)]):
            run = 1
            for k in range(1, n):
                if line[k] == line[k - 1]:
                    run += 1
                    if run == 5:
                        s += 3
                    elif run > 5:
                        s += 1
                else:
                    run = 1

    # N2: 2x2 blocks of one colour.
    for y in range(n - 1):
        for x in range(n - 1):
            v = m[y][x]
            if v == m[y][x + 1] == m[y + 1][x] == m[y + 1][x + 1]:
                s += 3

    # N3: the finder-like 1:1:3:1:1 pattern with four light modules beside it.
    a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
    b = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
    for i in range(n):
        for line in (m[i], [m[k][i] for k in range(n)]):
            for k in range(n - 10):
                if line[k:k + 11] in (a, b):
                    s += 40

    # N4: deviation from an even split of dark and light.
    dark = sum(sum(r) for r in m)
    s += int(abs(dark * 100 / (n * n) - 50) // 5) * 10
    return s


def main():
    probe = json.loads(subprocess.run(
        ["node", "tools/verify-qr.mjs"], cwd=ROOT,
        capture_output=True, text=True, check=True,
    ).stdout)

    failures = []
    cv_weak = decode_misses = score_misses = 0

    for case in probe:
        text = case["text"]
        label = (text[:34] + "…") if len(text) > 34 else text
        bad_masks, bad_scores, cv_misses = [], [], []

        for entry in case["masks"]:
            img = rasterise(entry["bits"], case["size"])

            result = zxingcpp.read_barcode(img)
            if not result or result.text != text:
                bad_masks.append(entry["mask"])

            n = case["size"]
            bits = entry["bits"]
            matrix = [[int(bits[y * n + x]) for x in range(n)] for y in range(n)]
            if reference_penalty(matrix, n) != entry["score"]:
                bad_scores.append(entry["mask"])

            if cv2 is not None:
                decoded, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
                if decoded != text:
                    cv_misses.append(entry["mask"])

        ok = not bad_masks and not bad_scores
        cv_weak += len(cv_misses)
        decode_misses += len(bad_masks)
        score_misses += len(bad_scores)
        note = f"chose mask {case['chosen']}"
        if cv_misses:
            note += f", opencv missed {cv_misses}"
        print(f"  {'ok  ' if ok else 'FAIL'}  v{case['version']:<2} "
              f"{case['size']:>2}x{case['size']:<2}  {note:<34} {label}")

        if bad_masks:
            failures.append(f"{label}: masks {bad_masks} did not decode")
        if bad_scores:
            failures.append(f"{label}: masks {bad_scores} scored differently "
                            f"from the reference penalty")

    total = sum(len(c["masks"]) for c in probe)
    print(f"\n  {total} mask variants across {len(probe)} payloads")
    print(f"  zxing-cpp decoded {total - decode_misses}/{total}"
          f" — every mask, not just the chosen one")
    print(f"  penalty scores match the reference: "
          f"{total - score_misses}/{total}")
    if cv2 is not None:
        print(f"  (opencv, a weaker detector, missed {cv_weak}/{total};"
              f" not treated as a failure)")

    for f in failures:
        print(f"  FAIL {f}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
