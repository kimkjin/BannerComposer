import io
import logging
from PIL import Image, ImageDraw
import numpy as np
from ultralytics import YOLO
import cv2

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Funções analyze e analyze_logo_placement_area permanecem as mesmas ---
try:
    MODEL_PATH = "app/static/models/yolo11n.pt" 
    model = YOLO(MODEL_PATH)
    logger.info(f"Modelo YOLO carregado com sucesso de: {MODEL_PATH}")
except Exception as e:
    logger.error(f"ERRO CRÍTICO ao carregar o modelo YOLO de '{MODEL_PATH}': {e}")
    model = None

def analyze(image_bytes: bytes) -> dict:
    if not model: raise RuntimeError("Modelo YOLO não foi carregado. A análise não pode continuar.")
    image = Image.open(io.BytesIO(image_bytes)); results = model(image)
    person_detections = []; face_detections = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0]; label_id = int(box.cls[0]); label_name = model.names[label_id]; confidence = float(box.conf[0])
            if label_name == 'person' and confidence > 0.6: person_detections.append({"box": [int(x1), int(y1), int(x2), int(y2)]})
            if label_name == 'face' and confidence > 0.5: face_detections.append({"box": [int(x1), int(y1), int(x2), int(y2)]})
    focus_point = (image.width // 2, image.height // 2); subject_top_y = 0; main_box = None
    if face_detections:
        main_box = max(face_detections, key=lambda d: (d['box'][2] - d['box'][0]) * (d['box'][3] - d['box'][1]))['box']
        fp_x = main_box[0] + (main_box[2] - main_box[0]) / 2; fp_y = main_box[1] + (main_box[3] - main_box[1]) / 2.5; focus_point = (int(fp_x), int(fp_y))
    elif person_detections:
        main_box = max(person_detections, key=lambda d: (d['box'][2] - d['box'][0]) * (d['box'][3] - d['box'][1]))['box']
        fp_x = main_box[0] + (main_box[2] - main_box[0]) / 2; fp_y = main_box[1] + (main_box[3] - main_box[1]) / 3; focus_point = (int(fp_x), int(fp_y))
    if main_box: subject_top_y = main_box[1]
    return {"focus_point": focus_point, "subject_top_y": subject_top_y, "main_box": main_box, "image_width": image.width, "image_height": image.height, "person_boxes": [d['box'] for d in person_detections], "face_boxes": [d['box'] for d in face_detections]}

def analyze_logo_placement_area(image: Image.Image, fmt_config: dict) -> str:
    rules = fmt_config.get('rules', {});
    if 'margin' not in rules or 'logo_area' not in rules: return 'dark'
    margin = rules['margin']; logo_area_dims = rules['logo_area']
    crop_box = (margin['x'], margin['y'], margin['x'] + logo_area_dims['width'], margin['y'] + logo_area_dims['height'])
    crop_box = (min(crop_box[0], image.width), min(crop_box[1], image.height), min(crop_box[2], image.width), min(crop_box[3], image.height))
    logo_placement_area = image.crop(crop_box).convert('L')
    if logo_placement_area.width == 0 or logo_placement_area.height == 0: return 'dark'
    average_brightness = np.mean(np.array(logo_placement_area))
    if average_brightness < 115: return 'light'
    else: return 'dark'

def draw_detections_on_image(image_bytes: bytes, fmt_config: dict) -> bytes:
    """Simula a composição final com a nova lógica de escala vertical baseada no sujeito."""
    if not fmt_config:
        raise ValueError("A configuração do formato (fmt_config) é necessária para desenhar o layout.")

    analysis = analyze(image_bytes)
    original_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    
    focus_point_x, _ = analysis['focus_point']
    main_box = analysis.get('main_box', None)
    
    canvas_w, canvas_h = fmt_config['width'], fmt_config['height']
    rules = fmt_config.get('rules', {})
    final_canvas = Image.new('RGB', (canvas_w, canvas_h), (200, 200, 200))
    
    img_w, img_h = original_image.size
    
    # --- NOVA LÓGICA DE ESCALA ---
    if rules.get('type') == 'standard' and 'logo_area' in rules:
        margin = rules.get('margin', {'x': 0, 'y': 20})
        logo_area = rules['logo_area']
        target_x_on_canvas = (margin['x'] + logo_area['width'] + margin.get('y') + (canvas_w - margin.get('y'))) / 2
    else:
        target_x_on_canvas = canvas_w / 2
        
    scale_x_left = target_x_on_canvas / focus_point_x if focus_point_x > 0 else 1.0
    scale_x_right = (canvas_w - target_x_on_canvas) / (img_w - focus_point_x) if (img_w - focus_point_x) > 0 else 1.0
    scale_x = max(scale_x_left, scale_x_right)

    scale_y = canvas_h / img_h 
    if main_box and rules.get('type') == 'standard':
        margin = rules.get('margin', {'x': 0, 'y': 20})
        person_box_h = main_box[3] - main_box[1]
        comp_area_h = canvas_h - (margin.get('y') * 2)
        if person_box_h > 0 and comp_area_h > 0:
            scale_y = comp_area_h / person_box_h
            
    scale = max(scale_x, scale_y)
    
    new_w, new_h = int(img_w * scale), int(img_h * scale)
    resized_image = original_image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    focus_x_scaled = int(focus_point_x * scale)
    
    # --- LÓGICA DE POSICIONAMENTO FINAL ---
    paste_x = int(target_x_on_canvas - focus_x_scaled)
    
    if main_box and rules.get('type') == 'standard':
        margin = rules.get('margin', {'x': 0, 'y': 20})
        box_top_y_scaled = main_box[1] * scale
        paste_y = int(margin.get('y') - box_top_y_scaled)
    else:
        subject_top_y_scaled = analysis['subject_top_y'] * scale
        paste_y = int(rules.get('margin', {}).get('y', 20) - subject_top_y_scaled)
    
    left_bound = canvas_w - new_w; right_bound = 0
    top_bound = canvas_h - new_h; bottom_bound = 0
    paste_x = max(left_bound, min(paste_x, right_bound))
    paste_y = max(top_bound, min(paste_y, bottom_bound))
    
    final_canvas.paste(resized_image, (paste_x, paste_y))

    # --- DESENHO DAS INFORMAÇÕES DE DEPURAÇÃO ---
    draw = ImageDraw.Draw(final_canvas, 'RGBA')
    COLOR_LOGO_AREA = (0, 170, 255, 100); COLOR_COMP_AREA = (126, 0, 230, 80)
    if 'logo_area' in rules and 'margin' in rules:
        logo_area = rules['logo_area']; margin = rules['margin']
        lx1, ly1 = margin['x'], margin['y']; lx2, ly2 = lx1 + logo_area['width'], ly1 + logo_area['height']
        draw.rectangle([lx1, ly1, lx2, ly2], fill=COLOR_LOGO_AREA, outline=(0,0,0, 150), width=2)
    if rules.get('type') == 'standard' and 'composition_area' in rules:
        margin = rules.get('margin', {'x':0, 'y':20}); logo_area = rules['logo_area']
        cx1 = margin['x'] + logo_area['width'] + margin.get('y'); cy1 = margin.get('y')
        cx2 = canvas_w - margin.get('y'); cy2 = canvas_h - margin.get('y')
        draw.rectangle([cx1, cy1, cx2, cy2], fill=COLOR_COMP_AREA, outline=(0,0,0, 150), width=2)
    def convert_coords(box):
        x1 = int(box[0] * scale + paste_x); y1 = int(box[1] * scale + paste_y)
        x2 = int(box[2] * scale + paste_x); y2 = int(box[3] * scale + paste_y)
        return (x1, y1, x2, y2)
    COLOR_PERSON_BOX = (0, 0, 255); COLOR_FACE_BOX = (0, 255, 0)
    COLOR_FOCUS_POINT = (255, 0, 0); COLOR_TARGET_POINT = (255, 255, 0)
    for box in analysis.get("person_boxes", []):
        draw.rectangle(convert_coords(box), outline=COLOR_PERSON_BOX, width=3)
    for box in analysis.get("face_boxes", []):
        draw.rectangle(convert_coords(box), outline=COLOR_FACE_BOX, width=3)
    fp_x_canvas = int(analysis['focus_point'][0] * scale + paste_x)
    fp_y_canvas = int(analysis['focus_point'][1] * scale + paste_y)
    radius = 8
    draw.ellipse([fp_x_canvas-radius, fp_y_canvas-radius, fp_x_canvas+radius, fp_y_canvas+radius], fill=COLOR_FOCUS_POINT)
    target_radius = 12; target_y_pos = canvas_h / 2
    draw.ellipse([target_x_on_canvas - target_radius, target_y_pos - target_radius, target_x_on_canvas + target_radius, target_y_pos + target_radius], fill=COLOR_TARGET_POINT, outline="black", width=2)
    
    buffer = io.BytesIO()
    final_canvas.save(buffer, format='JPEG', quality=90)
    return buffer.getvalue()