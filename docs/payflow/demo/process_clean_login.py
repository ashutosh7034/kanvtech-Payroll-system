from PIL import Image, ImageDraw, ImageFont
import os

feedback_dir = r'C:\Users\Ashutosh Pandey\.gemini\antigravity-ide\brain\bb9452e2-de4d-4e6e-95e2-8bc06aa3adc0\.system_generated\click_feedback'
out_dir = r'docs\payflow\demo'

try:
    font = ImageFont.truetype('arialbd.ttf', 11)
except:
    font = ImageFont.load_default()

def clean_login_image(src_name, out_name):
    src_path = os.path.join(feedback_dir, src_name)
    im = Image.open(src_path).copy()
    draw = ImageDraw.Draw(im)
    bg = im.getpixel((650, 475))
    draw.rectangle([600, 480, 935, 502], fill=bg)
    draw.text((700, 485), 'ROLE PROFILE ACCESS', fill=(100, 116, 139), font=font)
    dst_path = os.path.join(out_dir, out_name)
    im.save(dst_path)
    print(f'[OK] Processed {out_name}')

clean_login_image('click_feedback_1792570074965.png', 'clean_login_1.png')
clean_login_image('click_feedback_1792570084018.png', 'clean_login_2.png')
clean_login_image('click_feedback_1792570092565.png', 'clean_login_invalid.png')
clean_login_image('click_feedback_1792570148502.png', 'clean_login_submit.png')
