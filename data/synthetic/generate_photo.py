"""Generate the synthetic P-204 equipment photo (clearly labelled demo data).

Draws a simple "pump base plate" scene: pump body, a visible oil leak at the
seal gland, a missing coupling shim gap, and surface corrosion patches — the
observable features the vision model should report. Deterministic output.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent / "P204_photo.jpg"


def generate(output: Path = OUT) -> Path:
    width, height = 640, 420
    image = Image.new("RGB", (width, height), (196, 198, 200))
    draw = ImageDraw.Draw(image)

    # concrete base plate
    draw.rectangle([40, 260, 600, 380], fill=(150, 148, 142), outline=(90, 88, 84), width=3)
    # pump body
    draw.rectangle([180, 90, 460, 270], fill=(60, 90, 140), outline=(30, 45, 75), width=4)
    draw.rectangle([200, 110, 300, 160], fill=(80, 110, 160))
    # motor
    draw.rectangle([470, 140, 580, 270], fill=(90, 90, 96), outline=(50, 50, 55), width=3)
    # coupling area between pump and motor
    draw.rectangle([455, 180, 475, 250], fill=(120, 100, 60), outline=(80, 65, 35), width=2)
    # missing shim GAP marker (dark slot)
    draw.rectangle([458, 230, 472, 246], fill=(25, 25, 25))

    # visible oil LEAK at the seal gland (bottom of pump body)
    draw.ellipse([280, 262, 380, 300], fill=(52, 44, 20), outline=(30, 26, 10), width=2)
    draw.ellipse([300, 272, 355, 294], fill=(70, 60, 26))

    # corrosion patches on base plate
    draw.ellipse([90, 300, 160, 340], fill=(122, 84, 48), outline=(90, 60, 30), width=2)
    draw.ellipse([500, 310, 560, 348], fill=(122, 84, 48), outline=(90, 60, 30), width=2)

    # labels
    draw.text((196, 66), "P-204", fill=(20, 20, 20))
    draw.text((300, 306), "seal gland leak", fill=(30, 26, 10))
    draw.text((452, 252), "coupling gap", fill=(20, 20, 20))
    draw.text((60, 388), "DEMO DATA - SYNTHETIC PHOTO (NIRVA internal hackathon)", fill=(60, 60, 60))

    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, quality=90)
    return output


if __name__ == "__main__":
    print(f"wrote {generate()}")
