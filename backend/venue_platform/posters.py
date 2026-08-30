import io
import os
import urllib.request
import qrcode
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader

FONT_DIR = os.path.join(os.path.dirname(__file__), 'fonts')
os.makedirs(FONT_DIR, exist_ok=True)
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/inter/Inter-Bold.ttf"
FONT_PATH = os.path.join(FONT_DIR, 'Inter-Bold.ttf')

def _ensure_font():
    if not os.path.exists(FONT_PATH):
        try:
            urllib.request.urlretrieve(FONT_URL, FONT_PATH)
        except Exception:
            pass

def _generate_qr_image(url: str, size: int = 800) -> Image.Image:
    """Generate a high-quality QR code image."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=20,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#0f172a", back_color="white")
    qr_img = qr_img.resize((size, size), Image.Resampling.LANCZOS)
    return qr_img.convert("RGBA")

def _load_fonts():
    """Load fonts with fallbacks."""
    _ensure_font()
    try:
        font_title = ImageFont.truetype(FONT_PATH, 70)
        font_headline = ImageFont.truetype(FONT_PATH, 180)
        font_subtitle = ImageFont.truetype(FONT_PATH, 55)
        font_loc = ImageFont.truetype(FONT_PATH, 85)
        font_steps = ImageFont.truetype(FONT_PATH, 50)
        font_small = ImageFont.truetype(FONT_PATH, 42)
    except Exception:
        font_title = ImageFont.load_default()
        font_headline = ImageFont.load_default()
        font_subtitle = ImageFont.load_default()
        font_loc = ImageFont.load_default()
        font_steps = ImageFont.load_default()
        font_small = ImageFont.load_default()
    return font_title, font_headline, font_subtitle, font_loc, font_steps, font_small

def _draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=0):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def generate_poster_pdf(property_name: str, location_name: str, url: str) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Premium colors (Gold/Amber and Charcoal)
    amber_500 = (0.96, 0.58, 0.11)
    amber_700 = (0.7, 0.35, 0.05)
    charcoal = (0.1, 0.1, 0.12)
    gray_text = (0.4, 0.4, 0.42)
    off_white = (0.98, 0.98, 0.98)
    white = (1, 1, 1)
    
    # Background
    c.setFillColorRGB(*white)
    c.rect(0, 0, width, height, fill=1)
    
    # Elegant double border
    margin = 40
    c.setStrokeColorRGB(*charcoal)
    c.setLineWidth(2)
    c.rect(margin, margin, width - 2*margin, height - 2*margin)
    c.setLineWidth(0.5)
    c.rect(margin + 6, margin + 6, width - 2*margin - 12, height - 2*margin - 12)
    
    # Decorative top ornament
    c.setStrokeColorRGB(*amber_500)
    c.setLineWidth(1.5)
    c.line(width/2 - 40, height - margin - 30, width/2 + 40, height - margin - 30)
    c.line(width/2 - 20, height - margin - 35, width/2 + 20, height - margin - 35)
    
    # Property name (Elegant Serif-like vibe or clean tracking)
    # Using Helvetica but spaced out would be nice, but reportlab doesn't easily do letter-spacing natively
    c.setFillColorRGB(*charcoal)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 120, property_name.upper())
    
    # Headline
    c.setFont("Helvetica-Bold", 42)
    c.drawCentredString(width/2, height - 180, "ORDER & ENJOY")
    
    # Subtitle
    c.setFillColorRGB(*gray_text)
    c.setFont("Helvetica", 14)
    c.drawCentredString(width/2, height - 215, "Experience seamless table-side service.")
    
    # Generate high-quality QR
    qr = qrcode.QRCode(box_size=20, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    img_qr = qr.make_image(fill_color="black", back_color="white")
    
    qr_buffer = io.BytesIO()
    img_qr.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    
    qr_size = 240
    qr_y = 260 
    
    # Minimalist QR frame
    c.setFillColorRGB(*white)
    c.setStrokeColorRGB(0.9, 0.9, 0.9)
    c.setLineWidth(1)
    frame_padding = 15
    c.roundRect(
        width/2 - qr_size/2 - frame_padding, 
        qr_y - frame_padding, 
        qr_size + 2*frame_padding, 
        qr_size + 2*frame_padding, 
        10, fill=1, stroke=1
    )
    
    # Subtle drop shadow effect for QR box
    c.setFillColorRGB(0, 0, 0, alpha=0.03)
    c.roundRect(
        width/2 - qr_size/2 - frame_padding + 5, 
        qr_y - frame_padding - 5, 
        qr_size + 2*frame_padding, 
        qr_size + 2*frame_padding, 
        10, fill=1, stroke=0
    )
    
    # Re-draw actual frame to cover shadow overlap
    c.setFillColorRGB(*white)
    c.roundRect(
        width/2 - qr_size/2 - frame_padding, 
        qr_y - frame_padding, 
        qr_size + 2*frame_padding, 
        qr_size + 2*frame_padding, 
        10, fill=1, stroke=1
    )
    
    c.drawImage(ImageReader(qr_buffer), width/2 - qr_size/2, qr_y, width=qr_size, height=qr_size)
    
    # Location badge (e.g. TABLE 1)
    badge_w = 200
    badge_h = 45
    # Place badge elegantly overlapping the top of the QR frame
    badge_y = qr_y + qr_size + frame_padding - badge_h/2 + 20
    c.setFillColorRGB(*charcoal)
    c.roundRect(width/2 - badge_w/2, badge_y, badge_w, badge_h, badge_h/2, fill=1, stroke=0)
    c.setFillColorRGB(*white)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width/2, badge_y + 14, location_name.upper())
    
    # Elegant Steps section
    step_y = 130
    step_margin = 60
    
    # Step 1
    c.setFillColorRGB(*amber_500)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width/4 + 10, step_y + 20, "1")
    c.setFillColorRGB(*charcoal)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width/4 + 10, step_y, "Open Camera")
    
    # Step 2
    c.setFillColorRGB(*amber_500)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width/2, step_y + 20, "2")
    c.setFillColorRGB(*charcoal)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width/2, step_y, "Scan Code")
    
    # Step 3
    c.setFillColorRGB(*amber_500)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width*3/4 - 10, step_y + 20, "3")
    c.setFillColorRGB(*charcoal)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width*3/4 - 10, step_y, "Order & Enjoy")
    
    # Divider above footer
    c.setStrokeColorRGB(0.9, 0.9, 0.9)
    c.setLineWidth(1)
    c.line(width/2 - 100, 80, width/2 + 100, 80)
    
    # Footer
    c.setFillColorRGB(*gray_text)
    c.setFont("Helvetica", 10)
    c.drawCentredString(width/2, 60, "Powered by Tableline")
    
    c.save()
    buffer.seek(0)
    return buffer.read()


def generate_poster_image(property_name: str, location_name: str, url: str) -> bytes:
    _ensure_font()
    
    width, height = 2550, 3300  # 300 DPI 8.5x11
    img = Image.new("RGB", (width, height), "#fafafa")
    draw = ImageDraw.Draw(img)
    
    font_title, font_headline, font_subtitle, font_loc, font_steps, font_small = _load_fonts()
    
    # Colors
    EMERALD_500 = "#10b981"
    EMERALD_600 = "#059669"
    EMERALD_700 = "#047857"
    EMERALD_50 = "#ecfdf5"
    ZINC_900 = "#09090b"
    ZINC_800 = "#18181b"
    ZINC_700 = "#3f3f46"
    ZINC_500 = "#71717a"
    ZINC_300 = "#d4d4d8"
    ZINC_200 = "#e4e4e7"
    ZINC_100 = "#f4f4f5"
    ZINC_50 = "#fafafa"
    WHITE = "#ffffff"
    
    # Border
    border_margin = 120
    draw.rounded_rectangle(
        [border_margin, border_margin, width-border_margin, height-border_margin],
        radius=40, outline=ZINC_300, width=15
    )
    
    # Inner border
    draw.rounded_rectangle(
        [border_margin+8, border_margin+8, width-border_margin-8, height-border_margin-8],
        radius=32, outline=EMERALD_500, width=4
    )
    
    # Corner ornaments
    accent_len = 120
    accent_w = 8
    inset = border_margin + 20
    # TL
    draw.line([inset, height-inset, inset+accent_len, height-inset], fill=EMERALD_500, width=accent_w)
    draw.line([inset, height-inset, inset, height-inset-accent_len], fill=EMERALD_500, width=accent_w)
    # TR
    draw.line([width-inset, height-inset, width-inset-accent_len, height-inset], fill=EMERALD_500, width=accent_w)
    draw.line([width-inset, height-inset, width-inset, height-inset-accent_len], fill=EMERALD_500, width=accent_w)
    # BL
    draw.line([inset, inset, inset+accent_len, inset], fill=EMERALD_500, width=accent_w)
    draw.line([inset, inset, inset, inset+accent_len], fill=EMERALD_500, width=accent_w)
    # BR
    draw.line([width-inset, inset, width-inset-accent_len, inset], fill=EMERALD_500, width=accent_w)
    draw.line([width-inset, inset, width-inset, inset+accent_len], fill=EMERALD_500, width=accent_w)
    
    # Property name
    draw.text((width/2, 320), property_name.upper(), font=font_title, fill=EMERALD_700, anchor="ms")
    
    # Decorative divider
    divider_w = 200
    draw.line([width/2 - divider_w/2, 380, width/2 + divider_w/2, 380], fill=EMERALD_500, width=4)
    
    # Headline
    draw.text((width/2, 520), "SCAN & ORDER", font=font_headline, fill=ZINC_900, anchor="ms")
    
    # Subtitle
    draw.text((width/2, 670), "Seamless table-side service, straight from your phone.", font=font_subtitle, fill=ZINC_500, anchor="ms")
    
    # Generate QR Code
    qr_img = _generate_qr_image(url, size=1100)
    
    qr_y = 850
    qr_x = int(width/2 - 550)
    frame_padding = 80
    
    # QR frame background with subtle shadow
    shadow_offset = 10
    draw.rounded_rectangle(
        [qr_x - frame_padding + shadow_offset, qr_y - frame_padding + shadow_offset, 
         qr_x + 1100 + frame_padding + shadow_offset, qr_y + 1100 + frame_padding + shadow_offset],
        radius=40, fill=ZINC_300
    )
    draw.rounded_rectangle(
        [qr_x - frame_padding, qr_y - frame_padding, qr_x + 1100 + frame_padding, qr_y + 1100 + frame_padding],
        radius=40, fill=WHITE, outline=ZINC_200 if hasattr(draw, 'rounded_rectangle') else ZINC_300, width=5
    )
    
    # Paste QR code
    img.paste(qr_img, (qr_x, qr_y), qr_img)
    
    # Location badge
    badge_y = qr_y + 1100 + 60
    badge_h = 95
    badge_w = 1000
    badge_x = width/2 - badge_w/2
    draw.rounded_rectangle(
        [badge_x, badge_y, badge_x + badge_w, badge_y + badge_h],
        radius=20, fill=ZINC_900
    )
    draw.text((width/2, badge_y + badge_h/2), location_name.upper(), font=font_loc, fill=WHITE, anchor="mm")
    
    # Steps section
    step_y = height - 550
    step_h = 200
    step_margin = 200
    
    draw.rounded_rectangle(
        [step_margin, step_y - 80, width - step_margin, step_y + step_h - 80],
        radius=30, fill=ZINC_100, outline=ZINC_300, width=3
    )
    
    # Step circles and text
    step_positions = [
        (width/4 + 100, "1", "Open Camera", "Point camera at QR code"),
        (width/2, "2", "Scan Code", "Tap the notification"),
        (width*3/4 - 100, "3", "Order & Enjoy", "Browse menu & order"),
    ]
    
    for x_pos, num, title, desc in step_positions:
        # Circle
        circle_r = 40
        cx = x_pos
        cy = step_y + 30
        draw.ellipse([cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r], 
                     fill=EMERALD_500 if num == "3" else ZINC_900)
        draw.text((cx, cy), num, font=font_steps, fill=WHITE, anchor="mm")
        
        # Title
        draw.text((cx, cy + 80), title, font=font_steps, fill=ZINC_900, anchor="mm")
        # Description
        draw.text((cx, cy + 140), desc, font=font_small, fill=ZINC_500, anchor="mm")
    
    # Footer
    draw.text((width/2, height - 100), f"Powered by Tableline", font=font_small, fill=ZINC_500, anchor="ms")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", quality=95, dpi=(300, 300))
    buffer.seek(0)
    return buffer.read()