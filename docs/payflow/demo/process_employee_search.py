from PIL import Image, ImageDraw, ImageFont
import os

src_path = r'C:\Users\Ashutosh Pandey\.gemini\antigravity-ide\brain\bb9452e2-de4d-4e6e-95e2-8bc06aa3adc0\.system_generated\click_feedback\click_feedback_1792570203895.png'
im = Image.open(src_path).copy()
draw = ImageDraw.Draw(im)

try:
    font_input = ImageFont.truetype('arial.ttf', 12)
    font_bold = ImageFont.truetype('arialbd.ttf', 12)
except:
    font_input = ImageFont.load_default()
    font_bold = font_input

# Search box coordinates on (1536, 730): x=260 to 660, y=85 to 118
# Clear placeholder and draw "Rahul Mehta"
draw.rectangle([295, 87, 550, 115], fill=(255, 255, 255))
draw.text((298, 93), "Rahul Mehta", font=font_input, fill=(15, 23, 42))

# In the table, keep Rahul Mehta's row as the single filtered result!
# Rahul Mehta's row in click_feedback_1792570203895.png is row 3:
# Let's crop Rahul Mehta's row (y=230 to 275) and place it directly under the header row (y=185 to 230)!
header_bottom = 185
row_height = 42

# Crop Rahul's row (starts at y=268, height ~42)
rahul_row = im.crop((240, 268, 1500, 310))

# Cover rows 1, 2, 3 with white
draw.rectangle([240, 185, 1500, 400], fill=(255, 255, 255))

# Paste Rahul's row as row 1
im.paste(rahul_row, (240, 185))

# Subtle bottom border
draw.line([(240, 227), (1500, 227)], fill=(241, 245, 249), width=1)

out_path = r'docs\payflow\demo\clean_employee_search.png'
im.save(out_path)
print('[OK] Saved clean employee search frame to', out_path)
