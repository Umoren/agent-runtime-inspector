from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).parent
W, H = 1600, 900
S = 2

COLORS = {
    "bg": "#F7F8FA",
    "ink": "#111827",
    "muted": "#4B5563",
    "light": "#6B7280",
    "line": "#D5DAE1",
    "card": "#FFFFFF",
    "border": "#CBD5E1",
    "blue": "#2563EB",
    "blue_bg": "#EFF6FF",
    "green": "#16A34A",
    "green_dark": "#166534",
    "green_bg": "#DCFCE7",
    "red": "#DC2626",
    "red_dark": "#991B1B",
    "red_bg": "#FEE2E2",
    "amber": "#D97706",
    "amber_dark": "#92400E",
    "amber_bg": "#FEF3C7",
    "slate": "#475569",
}


def font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}", size * S)


def xy(v):
    return tuple(int(n * S) for n in v)


def draw_text(d, pos, text, size, color="ink", bold=False):
    d.text(xy(pos), text, fill=COLORS[color], font=font(size, bold))


def center_text(d, box, text, size, color="ink", bold=False):
    f = font(size, bold)
    scaled_box = xy(box)
    bbox = d.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = scaled_box[0] + ((scaled_box[2] - scaled_box[0]) - tw) / 2
    y = scaled_box[1] + ((scaled_box[3] - scaled_box[1]) - th) / 2 - bbox[1]
    d.text((int(x), int(y)), text, fill=COLORS[color], font=f)


def line(d, coords, color="line", width=1.5):
    d.line(xy(coords), fill=COLORS[color], width=max(1, int(width * S)))


def rect(d, box, fill="card", outline="border", width=1.5, radius=8):
    d.rounded_rectangle(xy(box), radius=int(radius * S), fill=COLORS[fill], outline=COLORS[outline], width=max(1, int(width * S)))


def pill(d, box, text, fill, color, size=18):
    rect(d, box, fill=fill, outline=fill, radius=(box[3] - box[1]) / 2)
    draw_text(d, (box[0] + 22, box[1] + 9), text, size, color, True)


def arrow(d, x1, y1, x2, y2, color="slate"):
    line(d, (x1, y1, x2, y2), color=color, width=2.2)
    if x2 >= x1:
        pts = [(x2, y2), (x2 - 14, y2 - 9), (x2 - 14, y2 + 9)]
    else:
        pts = [(x2, y2), (x2 + 14, y2 - 9), (x2 + 14, y2 + 9)]
    d.polygon([xy(p) for p in pts], fill=COLORS[color])


def base(kicker, title, subtitle):
    img = Image.new("RGB", (W * S, H * S), COLORS["bg"])
    d = ImageDraw.Draw(img)
    draw_text(d, (96, 92), kicker, 18, "light", True)
    if "\n" in title:
        first, second = title.split("\n", 1)
        draw_text(d, (96, 142), first, 44, "ink", True)
        draw_text(d, (96, 198), second, 44, "ink", True)
        draw_text(d, (96, 260), subtitle, 24, "muted")
        line_y = 314
    else:
        draw_text(d, (96, 154), title, 54, "ink", True)
        draw_text(d, (96, 224), subtitle, 27, "muted")
        line_y = 294
    line(d, (96, line_y, 1504, line_y), "line", 1.5)
    return img, d


def save(img, name):
    img = img.resize((W, H), Image.Resampling.LANCZOS)
    img.save(OUT / name)


def retrieval_boundary():
    img, d = base(
        "Permission-Aware Retrieval",
        "The retrieval boundary decides\nwhat reaches the answer.",
        "Relevant context still has to pass the current user's source permissions.",
    )

    rect(d, (96, 338, 426, 660))
    draw_text(d, (124, 382), "USER QUESTION", 17, "blue", True)
    draw_text(d, (124, 430), "Why is this", 24, "ink", True)
    draw_text(d, (124, 464), "customer escalation", 24, "ink", True)
    draw_text(d, (124, 498), "blocked?", 24, "ink", True)
    line(d, (124, 554, 398, 554), "line", 1.5)
    draw_text(d, (124, 602), "Needs company context.", 16, "muted", True)
    arrow(d, 448, 483, 536, 483, "line")

    rect(d, (568, 338, 964, 660))
    draw_text(d, (596, 382), "Retrieved context", 24, "ink", True)
    draw_text(d, (596, 418), "The system finds useful sources.", 18, "muted")
    pill(d, (596, 454, 740, 490), "support ticket", "green_bg", "green_dark", 16)
    pill(d, (758, 454, 888, 490), "Linear issue", "green_bg", "green_dark", 16)
    pill(d, (596, 504, 734, 540), "account note", "green_bg", "green_dark", 16)
    pill(d, (752, 504, 920, 540), "private Slack", "red_bg", "red_dark", 16)
    line(d, (596, 572, 936, 572), "line", 1.5)
    draw_text(d, (596, 604), "Relevance needs permission.", 16, "muted", True)
    arrow(d, 986, 483, 1074, 483, "line")

    rect(d, (1106, 338, 1504, 660))
    draw_text(d, (1134, 382), "Boundary check", 24, "ink", True)
    draw_text(d, (1134, 418), "Access decides what moves forward.", 17, "muted")
    draw_text(d, (1134, 456), "Allowed context", 17, "green_dark", True)
    draw_text(d, (1134, 484), "ticket + issue + note", 18, "ink", True)
    draw_text(d, (1134, 526), "Blocked context", 17, "red_dark", True)
    draw_text(d, (1134, 554), "private Slack", 18, "ink", True)
    line(d, (1134, 588, 1476, 588), "line", 1.5)
    draw_text(d, (1134, 620), "Only allowed context reaches prompt.", 14, "muted", True)

    line(d, (96, 696, 1504, 696), "line", 1.5)
    draw_text(d, (96, 758), "Permission-aware retrieval filters context before the prompt.", 29, "ink", True)
    draw_text(d, (96, 824), "Samuel Umoren / Permission-Aware Retrieval Notes", 18, "light", True)
    save(img, "retrieval-boundary.png")


def derived_knowledge():
    img, d = base(
        "Source Permission",
        "Derived knowledge carries source risk.",
        "When source content changes shape, its permission boundary has to travel with it.",
    )
    cards = [
        (96, "01 SOURCE", "Private Slack", "message", "private channel", "amber_bg", "amber_dark"),
        (442, "02 EXTRACTED", "Decision", "Rollout delayed", "boundary carried", "amber_bg", "amber_dark"),
        (788, "03 SURFACE", "Project", "timeline", "boundary carried", "amber_bg", "amber_dark"),
        (1134, "04 ANSWER", "Answer", "drafted", "access checked first", "green_bg", "green_dark"),
    ]
    for x, label, t1, t2, chip, chip_bg, chip_fg in cards:
        draw_text(d, (x, 344), label, 16, "blue", True)
        rect(d, (x, 370, x + 300, 554))
        draw_text(d, (x + 26, 418), t1, 29, "ink", True)
        draw_text(d, (x + 26, 456), t2, 24, "muted", False)
        pill(d, (x + 26, 486, x + 268, 524), chip, chip_bg, chip_fg)
    arrow(d, 410, 464, 428, 464, "line")
    arrow(d, 756, 464, 774, 464, "line")
    arrow(d, 1102, 464, 1120, 464, "line")

    line(d, (126, 594, 1404, 594), "amber", 3)
    for x in [246, 592, 938, 1284]:
        d.ellipse(xy((x - 8, 586, x + 8, 602)), fill=COLORS["amber"])
    draw_text(d, (520, 624), "source permission travels with each transformation", 22, "amber_dark", True)

    line(d, (96, 674, 1504, 674), "line", 1.5)
    draw_text(d, (96, 736), "The same permission boundary follows the knowledge into every surface.", 31, "ink", True)
    draw_text(d, (96, 824), "Samuel Umoren / Permission-Aware Retrieval Notes", 18, "light", True)
    save(img, "derived-knowledge-source-risk.png")


def relationship_path():
    img, d = base(
        "Relationship-Based Access",
        "Authorization is answered through paths.",
        "Access is granted when the user is connected to the source channel.",
    )
    nodes = [
        (288, 462, 86, "Person", "current user", "blue_bg", "blue"),
        (800, 462, 112, "Channel", "source boundary", "green_bg", "green"),
        (1312, 462, 86, "Decision", "derived", "amber_bg", "amber"),
    ]
    for cx, cy, r, title, sub, fill, outline in nodes:
        d.ellipse(xy((cx - r, cy - r, cx + r, cy + r)), fill=COLORS[fill], outline=COLORS[outline], width=4)
        center_text(d, (cx - r, cy - 44, cx + r, cy - 4), title, 30, "ink", True)
        center_text(d, (cx - r, cy + 2, cx + r, cy + 36), sub, 20, "muted", True)
    pill(d, (726, 520, 876, 556), "private Slack", "green_bg", "green_dark", 17)

    arrow(d, 374, 462, 668, 462, "slate")
    center_text(d, (464, 396, 620, 432), "belongs to", 22, "ink", True)
    rect(d, (464, 436, 620, 476), fill="card", outline="border", radius=20)
    center_text(d, (464, 436, 620, 476), "MEMBER_OF", 17, "light", True)

    arrow(d, 1226, 462, 932, 462, "slate")
    center_text(d, (984, 396, 1166, 432), "came from", 22, "ink", True)
    rect(d, (984, 436, 1166, 476), fill="card", outline="border", radius=20)
    center_text(d, (984, 436, 1166, 476), "SOURCED_FROM", 17, "light", True)

    rect(d, (472, 610, 1128, 758))
    draw_text(d, (510, 646), "PERMISSION QUESTION", 16, "blue", True)
    draw_text(d, (510, 682), "Does the user have a path to", 24, "ink", True)
    draw_text(d, (510, 714), "the source channel?", 24, "ink", True)

    rect(d, (1190, 634, 1402, 728), fill="green_bg", outline="green", radius=8)
    center_text(d, (1190, 658, 1402, 696), "Allowed", 28, "green_dark", True)
    center_text(d, (1190, 696, 1402, 722), "path exists", 19, "green_dark", True)
    line(d, (96, 784, 1504, 784), "line", 1.5)
    draw_text(d, (96, 824), "Samuel Umoren / Permission-Aware Retrieval Notes", 18, "light", True)
    save(img, "relationship-path-permission-check.png")


if __name__ == "__main__":
    retrieval_boundary()
    derived_knowledge()
    relationship_path()
