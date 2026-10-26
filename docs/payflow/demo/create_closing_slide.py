from PIL import Image, ImageDraw, ImageFont
import os

width = 1920
height = 1080

# Dark sleek gradient / solid dark background
img = Image.new('RGB', (width, height), color=(15, 23, 42)) # #0f172a
draw = ImageDraw.Draw(img)

# Subtle background gradient/accents
for y in range(height):
    r = int(15 + (y / height) * 10)
    g = int(23 + (y / height) * 15)
    b = int(42 + (y / height) * 20)
    draw.line([(0, y), (width, y)], fill=(r, g, b))

# Try standard Windows fonts
try:
    font_title = ImageFont.truetype("arialbd.ttf", 46)
    font_subtitle = ImageFont.truetype("arial.ttf", 22)
    font_tag = ImageFont.truetype("arialbd.ttf", 18)
    font_section = ImageFont.truetype("arialbd.ttf", 26)
    font_heading = ImageFont.truetype("arialbd.ttf", 21)
    font_body = ImageFont.truetype("arial.ttf", 17)
    font_badge = ImageFont.truetype("arialbd.ttf", 15)
    font_kpi_num = ImageFont.truetype("arialbd.ttf", 52)
    font_kpi_sub = ImageFont.truetype("arial.ttf", 18)
    font_footer = ImageFont.truetype("arial.ttf", 16)
except:
    font_title = ImageFont.load_default()
    font_subtitle = font_title
    font_tag = font_title
    font_section = font_title
    font_heading = font_title
    font_body = font_title
    font_badge = font_title
    font_kpi_num = font_title
    font_kpi_sub = font_title
    font_footer = font_title

# Top Brand Logo & Header
# Blue brand icon
draw.rounded_rectangle([80, 50, 140, 110], radius=14, fill=(37, 99, 235))
draw.text((95, 60), "PF", font=font_title, fill=(255, 255, 255))

draw.text((160, 50), "PayFlow — HRMS & Payroll Management", font=font_title, fill=(255, 255, 255))
draw.text((160, 105), "Enterprise HRMS & Statutory Payroll ERP — End-to-End System Evaluation", font=font_subtitle, fill=(148, 163, 184))

# Evaluation Pill Tag (Right)
draw.rounded_rectangle([1420, 60, 1840, 105], radius=22, fill=(30, 58, 138), outline=(59, 130, 246), width=2)
draw.text((1445, 72), "PROJECT EVALUATION & UAT SIGN-OFF", font=font_tag, fill=(147, 197, 253))

# Divider Line
draw.line([(80, 135), (1840, 135)], fill=(51, 65, 85), width=2)

# Left Column: 5 Verified Feature Modules
draw.rounded_rectangle([80, 165, 1150, 960], radius=18, fill=(30, 41, 59, 200), outline=(51, 65, 85), width=1)
draw.text((115, 195), "DEMONSTRATED CORE MODULES", font=font_section, fill=(56, 189, 248))

modules = [
    ("1. Employee Master Management", "Unified workforce directory, multi-branch tracking, reporting hierarchy & instant search filter."),
    ("2. Compensation & Mathematical CTC Engine", "16 statutory components, horizontal templates & deterministic reconciliation down to the rupee."),
    ("3. 7-Stage Corporate Payroll Engine", "Calculated → Verified → Finalized → Approved governance cycle with immutable calculation snapshots."),
    ("4. Shifts, Attendance & Leave Management", "General shifts, automated web check-in timestamps, approved leaves & pro-rata LOP impact."),
    ("5. Compliance Reports & Access Control", "Head-wise salary summaries, immutable audit logging & single active session database security.")
]

y_pos = 250
for title, desc in modules:
    # Card box
    draw.rounded_rectangle([115, y_pos, 1115, y_pos + 115], radius=10, fill=(15, 23, 42), outline=(51, 65, 85), width=1)
    # Green check icon indicator
    draw.rounded_rectangle([135, y_pos + 22, 175, y_pos + 62], radius=8, fill=(6, 78, 59))
    draw.text((147, y_pos + 28), "✓", font=font_heading, fill=(52, 211, 153))
    draw.text((195, y_pos + 20), title, font=font_heading, fill=(241, 245, 249))
    draw.text((195, y_pos + 58), desc, font=font_body, fill=(148, 163, 184))
    # Verified badge
    draw.rounded_rectangle([1005, y_pos + 20, 1095, y_pos + 48], radius=6, fill=(16, 185, 129))
    draw.text((1017, y_pos + 25), "VERIFIED", font=font_badge, fill=(255, 255, 255))
    y_pos += 135

# Right Column: Verified Test Evidence & Metrics
draw.rounded_rectangle([1190, 165, 1840, 960], radius=18, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
draw.text((1225, 195), "QUALITY ASSURANCE EVIDENCE", font=font_section, fill=(56, 189, 248))

# KPI Box: 100% Automated Tests
draw.rounded_rectangle([1225, 245, 1805, 385], radius=14, fill=(15, 23, 42), outline=(51, 65, 85), width=1)
draw.text((1250, 265), "BACKEND AUTOMATED TEST SUITE", font=font_tag, fill=(148, 163, 184))
draw.text((1250, 295), "166 / 166 PASSED", font=font_kpi_num, fill=(52, 211, 153))
draw.text((1250, 355), "100% Pass Rate across all 9 Vitest suites (0 Failures)", font=font_kpi_sub, fill=(148, 163, 184))

# Integrity Checklist Box
draw.rounded_rectangle([1225, 410, 1805, 925], radius=14, fill=(15, 23, 42), outline=(51, 65, 85), width=1)
draw.text((1250, 435), "SYSTEM INTEGRITY VERIFICATION", font=font_tag, fill=(148, 163, 184))

checks = [
    ("Mathematical CTC Reconciliation", "₹0.00 Variance (15 LPA)", (52, 211, 153)),
    ("Invalid Credentials Rejection", "HTTP 401 Alert", (52, 211, 153)),
    ("Protected Route Guard Barrier", "Enforced Redirect", (52, 211, 153)),
    ("Single-Session Enforcement", "SESSION_REVOKED", (52, 211, 153)),
    ("TypeScript Typecheck (tsc --noEmit)", "0 Errors Clean", (52, 211, 153)),
    ("Frontend Production Build (vite)", "Zero Warnings", (52, 211, 153)),
    ("Real Bank Disbursement State", "Safely Isolated in Dev", (251, 191, 36))
]

cy = 475
for label, status, color in checks:
    draw.rounded_rectangle([1250, cy, 1780, cy + 50], radius=8, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
    draw.text((1268, cy + 15), label, font=font_body, fill=(241, 245, 249))
    draw.text((1580, cy + 15), status, font=font_heading, fill=color)
    cy += 63

# Footer
draw.line([(80, 985), (1840, 985)], fill=(51, 65, 85), width=1)
draw.text((80, 1010), "Apex Global Technologies Pvt. Ltd. • Mumbai HQ • Bengaluru Tech Center", font=font_footer, fill=(100, 116, 139))
draw.text((1420, 1010), "PayFlow ERP Architecture • Presentation Edition V2", font=font_footer, fill=(100, 116, 139))

output_path = os.path.join(os.path.dirname(__file__), "closing_slide.png")
img.save(output_path, "PNG")
print(f"[OK] Saved high-definition closing slide to {output_path}")
