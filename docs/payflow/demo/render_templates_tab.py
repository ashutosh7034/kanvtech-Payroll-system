from PIL import Image, ImageDraw, ImageFont
import os

base_path = r'C:\Users\Ashutosh Pandey\.gemini\antigravity-ide\brain\bb9452e2-de4d-4e6e-95e2-8bc06aa3adc0\.system_generated\click_feedback\click_feedback_1792570251522.png'
im = Image.open(base_path).copy()
draw = ImageDraw.Draw(im)

# Fonts
try:
    font_bold = ImageFont.truetype('arialbd.ttf', 13)
    font_body = ImageFont.truetype('arial.ttf', 11)
    font_mono = ImageFont.truetype('courbd.ttf', 11)
    font_badge = ImageFont.truetype('arialbd.ttf', 10)
    font_desc = ImageFont.truetype('arial.ttf', 11)
except:
    font_bold = ImageFont.load_default()
    font_body = font_bold
    font_mono = font_bold
    font_badge = font_bold
    font_desc = font_bold

# Card 1: EXEC-TECH-01
c1_x1, c1_y1, c1_x2, c1_y2 = 260, 185, 760, 680
draw.rounded_rectangle([c1_x1, c1_y1, c1_x2, c1_y2], radius=8, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
# Header
draw.text((c1_x1 + 18, c1_y1 + 14), "EXEC-TECH-01", font=font_mono, fill=(37, 99, 235))
draw.text((c1_x1 + 18, c1_y1 + 30), "Engineering Executive CTC Package", font=font_bold, fill=(15, 23, 42))
draw.rounded_rectangle([c1_x2 - 110, c1_y1 + 14, c1_x2 - 58, c1_y1 + 32], radius=4, fill=(238, 242, 255))
draw.text((c1_x2 - 102, c1_y1 + 17), "DEFAULT", font=font_badge, fill=(79, 70, 229))
draw.rounded_rectangle([c1_x2 - 50, c1_y1 + 14, c1_x2 - 18, c1_y1 + 32], radius=4, fill=(241, 245, 249))
draw.text((c1_x2 - 42, c1_y1 + 17), "v1", font=font_badge, fill=(100, 116, 139))

draw.text((c1_x1 + 18, c1_y1 + 55), "Standard technical lead & engineering band package with 40% Basic, 20% HRA & PF", font=font_desc, fill=(100, 116, 139))
draw.line([(c1_x1 + 18, c1_y1 + 78), (c1_x2 - 18, c1_y1 + 78)], fill=(241, 245, 249), width=1)
draw.text((c1_x1 + 18, c1_y1 + 86), "Configured Component Lines (9):", font=font_bold, fill=(30, 41, 59))

lines1 = [
    ("Basic Salary (BASIC)", "40% of CTC"),
    ("House Rent Allowance (HRA)", "50% of BASIC"),
    ("Conveyance Allowance", "Fixed ₹5,000"),
    ("Medical & Health Allowance", "Fixed ₹6,000"),
    ("Special Allowance", "Balancing Residual"),
    ("Employee Provident Fund (12%)", "12% of BASIC"),
    ("Professional Tax (PT)", "Fixed ₹200"),
    ("Employer PF Contribution", "12% of BASIC"),
    ("Gratuity Provision", "4.81% of BASIC")
]

ly = c1_y1 + 110
for name, val in lines1:
    draw.rounded_rectangle([c1_x1 + 18, ly, c1_x2 - 18, ly + 28], radius=4, fill=(248, 250, 252))
    draw.text((c1_x1 + 26, ly + 7), name, font=font_body, fill=(51, 65, 85))
    draw.text((c1_x2 - 145, ly + 7), val, font=font_bold, fill=(15, 23, 42))
    ly += 33

draw.text((c1_x1 + 18, ly + 8), "Assigned to 1 active employee (Rahul Mehta)", font=font_desc, fill=(100, 116, 139))

# Card 2: CORP-STANDARD
c2_x1, c2_y1, c2_x2, c2_y2 = 780, 185, 1280, 680
draw.rounded_rectangle([c2_x1, c2_y1, c2_x2, c2_y2], radius=8, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
draw.text((c2_x1 + 18, c2_y1 + 14), "CORP-STANDARD", font=font_mono, fill=(37, 99, 235))
draw.text((c2_x1 + 18, c2_y1 + 30), "Corporate Professional Standard CTC", font=font_bold, fill=(15, 23, 42))
draw.rounded_rectangle([c2_x2 - 50, c2_y1 + 14, c2_x2 - 18, c2_y1 + 32], radius=4, fill=(241, 245, 249))
draw.text((c2_x2 - 42, c2_y1 + 17), "v1", font=font_badge, fill=(100, 116, 139))

draw.text((c2_x1 + 18, c2_y1 + 55), "Standard band compensation package for Product, Design, Operations, and HR teams", font=font_desc, fill=(100, 116, 139))
draw.line([(c2_x1 + 18, c2_y1 + 78), (c2_x2 - 18, c2_y1 + 78)], fill=(241, 245, 249), width=1)
draw.text((c2_x1 + 18, c2_y1 + 86), "Configured Component Lines (7):", font=font_bold, fill=(30, 41, 59))

lines2 = [
    ("Basic Salary (BASIC)", "50% of CTC"),
    ("House Rent Allowance (HRA)", "40% of BASIC"),
    ("Conveyance Allowance", "Fixed ₹3,000"),
    ("Special Allowance", "Balancing Residual"),
    ("Employee Provident Fund (12%)", "12% of BASIC"),
    ("Professional Tax (PT)", "Fixed ₹200"),
    ("Employer PF Contribution", "12% of BASIC")
]

ly2 = c2_y1 + 110
for name, val in lines2:
    draw.rounded_rectangle([c2_x1 + 18, ly2, c2_x2 - 18, ly2 + 28], radius=4, fill=(248, 250, 252))
    draw.text((c2_x1 + 26, ly2 + 7), name, font=font_body, fill=(51, 65, 85))
    draw.text((c2_x2 - 145, ly2 + 7), val, font=font_bold, fill=(15, 23, 42))
    ly2 += 33

draw.text((c2_x1 + 18, ly2 + 8), "Available for corporate band assignment", font=font_desc, fill=(100, 116, 139))

out_path = r'docs\payflow\demo\clean_templates_tab.png'
im.save(out_path)
print('[OK] Saved populated templates tab to', out_path)
