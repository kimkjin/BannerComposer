import io
import logging
from PIL import Image, ImageDraw
import numpy as np
from ultralytics import YOLO
import cv2

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    MODEL_PATH = "app/static/models/yolo11n.pt" 
    model = YOLO(MODEL_PATH)
    logger.info(f"Modelo YOLO carregado com sucesso de: {MODEL_PATH}")
except Exception as e:
    logger.error(f"ERRO ao carregar o modelo YOLO de '{MODEL_PATH}': {e}")
    model = None

def analyze(image_bytes: bytes) -> dict:
    """
    Analisa uma imagem para detectar pessoas e rostos, determinando um ponto de foco.
    """
    if not model:
        raise RuntimeError("Modelo YOLO não foi carregado. A análise não pode continuar.")

    image = Image.open(io.BytesIO(image_bytes))
    results = model(image)

    person_detections = []
    face_detections = []

    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            label_id = int(box.cls[0])
            label_name = model.names[label_id]
            confidence = float(box.conf[0])
            
            if label_name == 'person' and confidence > 0.6:
                person_detections.append({"box": [int(x1), int(y1), int(x2), int(y2)]})
            if label_name == 'face' and confidence > 0.5:
                face_detections.append({"box": [int(x1), int(y1), int(x2), int(y2)]})

    focus_point = (image.width // 2, image.height // 2)
    subject_top_y = 0
    main_box = None

    if face_detections:
        main_box = max(face_detections, key=lambda d: (d['box'][2] - d['box'][0]) * (d['box'][3] - d['box'][1]))['box']
        fp_x = main_box[0] + (main_box[2] - main_box[0]) / 2
        fp_y = main_box[1] + (main_box[3] - main_box[1]) / 2.5
        focus_point = (int(fp_x), int(fp_y))
    elif person_detections:
        main_box = max(person_detections, key=lambda d: (d['box'][2] - d['box'][0]) * (d['box'][3] - d['box'][1]))['box']
        fp_x = main_box[0] + (main_box[2] - main_box[0]) / 2
        fp_y = main_box[1] + (main_box[3] - main_box[1]) / 3
        focus_point = (int(fp_x), int(fp_y))

    if main_box:
        subject_top_y = main_box[1]

    return {
        "focus_point": focus_point,
        "subject_top_y": subject_top_y,
        "main_box": main_box,
        "image_width": image.width,
        "image_height": image.height,
        "person_boxes": [d['box'] for d in person_detections],
        "face_boxes": [d['box'] for d in face_detections]
    }

def analyze_logo_placement_area(image: Image.Image, fmt_config: dict) -> str:
    """
    Analisa a luminosidade da área onde o logo será aplicado para decidir
    se a versão clara ou escura do logo deve ser usada.
    """
    rules = fmt_config.get('rules', {})
    if 'margin' not in rules or 'logo_area' not in rules:
        return 'dark' 

    margin = rules['margin']
    logo_area_dims = rules['logo_area']
    
    crop_box = (
        margin['x'], margin['y'],
        margin['x'] + logo_area_dims['width'],
        margin['y'] + logo_area_dims['height']
    )
    crop_box = (
        min(crop_box[0], image.width), min(crop_box[1], image.height),
        min(crop_box[2], image.width), min(crop_box[3], image.height)
    )

    logo_placement_area = image.crop(crop_box).convert('L')
    if logo_placement_area.width == 0 or logo_placement_area.height == 0:
        return 'dark'

    average_brightness = np.mean(np.array(logo_placement_area))

    return 'light' if average_brightness < 115 else 'dark'

def draw_detections_on_image(image_bytes: bytes, fmt_config: dict) -> bytes:
    """
    Desenha as detecções da IA para debug visual.
    """
    if not fmt_config:
        raise ValueError("A configuração do formato (fmt_config) é necessária.")

    analysis = analyze(image_bytes)
    original_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    
    canvas_w, canvas_h = fmt_config['width'], fmt_config['height']
    final_canvas = Image.new('RGB', (canvas_w, canvas_h), (200, 200, 200))
    
    composition_data = ia_service._apply_automatic_composition(final_canvas, original_image, analysis, fmt_config)
    scale = composition_data['scale']
    paste_x, paste_y = composition_data['paste_x'], composition_data['paste_y']

    draw = ImageDraw.Draw(final_canvas, 'RGBA')

    rules = fmt_config.get('rules', {})
    if 'logo_area' in rules:
        lx1, ly1 = rules['margin']['x'], rules['margin']['y']
        lx2, ly2 = lx1 + rules['logo_area']['width'], ly1 + rules['logo_area']['height']
        draw.rectangle([lx1, ly1, lx2, ly2], fill=(0, 170, 255, 100), outline="blue", width=2)

    if 'composition_area' in rules:
        cx1 = rules['margin']['x'] + rules['logo_area']['width'] + rules['margin']['y']
        cy1 = rules['margin']['y']
        cx2, cy2 = canvas_w - rules['margin']['y'], canvas_h - rules['margin']['y']
        draw.rectangle([cx1, cy1, cx2, cy2], fill=(126, 0, 230, 80), outline="purple", width=2)

    def convert_coords(box):
        return (
            int(box[0] * scale + paste_x), int(box[1] * scale + paste_y),
            int(box[2] * scale + paste_x), int(box[3] * scale + paste_y)
        )

    for box in analysis.get("person_boxes", []):
        draw.rectangle(convert_coords(box), outline="blue", width=3)
    for box in analysis.get("face_boxes", []):
        draw.rectangle(convert_coords(box), outline="green", width=3)
    
    fp_x, fp_y = analysis['focus_point']
    fp_x_canvas, fp_y_canvas = int(fp_x * scale + paste_x), int(fp_y * scale + paste_y)
    draw.ellipse([fp_x_canvas-8, fp_y_canvas-8, fp_x_canvas+8, fp_y_canvas+8], fill="red")

    buffer = io.BytesIO()
    final_canvas.save(buffer, format='JPEG', quality=90)
    return buffer.getvalue()
