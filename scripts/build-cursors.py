"""Build the console's 32px SVG cursors from small pixel masks (no packages)."""

from pathlib import Path


OUTPUT = Path(__file__).resolve().parent.parent / "asset" / "cursors"
LIME = "#A9EE3E"
OUTLINE = "#4f3b28"


def rectangle(pixels, x, y, width, height):
    pixels.update((a, b) for a in range(x, x + width) for b in range(y, y + height))


def mask(rows):
    lime, dark, metal = set(), set(), set()
    for y, row in enumerate(rows):
        assert len(row) == 16
        for x, pixel in enumerate(row):
            if pixel in "#xs":
                palette = {"#": lime, "x": dark, "s": metal}
                rectangle(palette[pixel], x * 2, y * 2, 2, 2)
    return lime, dark, metal


def runs(pixels):
    pieces = []
    for y in range(32):
        x = 0
        while x < 32:
            if (x, y) not in pixels:
                x += 1
                continue
            start = x
            while (x, y) in pixels:
                x += 1
            width = x - start
            pieces.append(f"M{start} {y}h{width}v1h-{width}z")
    return "".join(pieces)


def write(name, lime, details=None, metal=None):
    details = details or set()
    metal = metal or set()
    silhouette = lime | details | metal
    outline = {
        (x + dx, y + dy)
        for x, y in silhouette
        for dx in (-1, 0, 1)
        for dy in (-1, 0, 1)
        if 0 <= x + dx < 32 and 0 <= y + dy < 32
    } - lime - metal
    metal_path = f'  <path fill="#e7e5de" d="{runs(metal)}"/>\n' if metal else ""
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" '
        'viewBox="0 0 32 32" shape-rendering="crispEdges">\n'
        f'  <path fill="{OUTLINE}" d="{runs(outline)}"/>\n'
        f'  <path fill="{LIME}" d="{runs(lime)}"/>\n'
        + metal_path
        + '</svg>\n'
    )
    (OUTPUT / f"{name}.svg").write_text(svg, encoding="utf-8", newline="\n")


def main():
    OUTPUT.mkdir(exist_ok=True)
    drawings = {
        "arrow": [
            "................", "..#.............", "..##............", "..###...........",
            "..####..........", "..#####.........", "..######........", "..#######.......",
            "..########......", "..#########.....", "..#####.........", "..##.###........",
            "..#..###........", "......###.......", "......###.......", "................",
        ],
        "pencil": [
            "................", "...........##...", "..........####..", ".........##x##..",
            "........##x##...", ".......##x##....", "......##x##.....", ".....##x##......",
            "....##x##.......", "...##x##........", "..##x##.........", "..####..........",
            "..###...........", "..##............", "................", "................",
        ],
        "eraser": [
            "................", "................", ".......####.....", "......######....",
            ".....########...", "....####x####...", "...####x####....", "..####x####.....",
            "..###x####......", "...#x####.......", "....####........", ".....##.........",
            "................", "................", "................", "................",
        ],
        "plug": [
            "................", ".......ss.......", ".......ss.......", ".......xx.......",
            ".......ss.......", ".......ss.......", ".......xx.......", ".......ss.......",
            ".......ss.......", "......####......", ".....######.....", ".....######.....",
            "......####......", ".......##.......", ".......####.....", "................",
        ],
        "pointer": [
            "................", ".....##.........", ".....##.........", ".....##.........",
            ".....##.........", ".....##.........", ".....####.......", ".....##x###.....",
            "..##.##x#x###...", "..#####x#x#x#...", "...####x#x#x#...", "....#########...",
            ".....#######....", "......######....", "......######....", "................",
        ],
        "grab": [
            "................", ".......##.......", ".......####.....", ".....######.....",
            ".....##x#x###...", ".....##x#x#x#...", ".....##x#x#x#...", "..##.##x#x#x#...",
            "..#####x#x#x#...", "...##########...", "....#########...", ".....########...",
            ".....#######....", "......######....", "......######....", "................",
        ],
        "grabbing": [
            "................", "................", "................", "................",
            "......####......", "....########....", "....##x#x#x##...", "...###x#x#x##...",
            "..###########...", "..##xxxxx####...", "...##########...", "....#########...",
            ".....#######....", "......######....", "......######....", "................",
        ],
    }
    for name, drawing in drawings.items():
        write(name, *mask(drawing))
    crosshair = set()
    for box in [(15, 3, 2, 9), (15, 20, 2, 9), (3, 15, 9, 2), (20, 15, 9, 2), (15, 15, 2, 2)]:
        rectangle(crosshair, *box)
    write("crosshair", crosshair)
    print("Built 8 matching pixel cursors.")


if __name__ == "__main__":
    main()
