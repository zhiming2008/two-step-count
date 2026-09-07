# -*- coding: utf-8 -*-
"""生成两步记账的应用图标源图 (1024x1024, 带透明圆角)"""
from PIL import Image, ImageDraw, ImageFont

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 圆角底色（记账主题绿）
R = 200
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=R, fill=(52, 168, 120, 255))

# 中间大字「账」
font = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 560)
text = "账"
bbox = d.textbbox((0, 0), text, font=font)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((S - w) / 2 - bbox[0], (S - h) / 2 - bbox[1] - 20), text,
       font=font, fill=(255, 255, 255, 255))

# 底部小装饰：一道白色弧线，寓意"两步"
d.arc([212, 700, 812, 1150], start=200, end=340, fill=(255, 255, 255, 200), width=36)

img.save("src-tauri/icons/icon-source.png")
print("icon-source.png saved")
