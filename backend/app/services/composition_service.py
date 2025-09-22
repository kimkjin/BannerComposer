from PIL import Image, ImageDraw, ImageFont, ImageOps
import io
import json
import logging
import os
import re
import numpy as np
from . import ia_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LOGOS_BASE_PATH = "app/static/logos"
FONTS_BASE_PATH = "app/static/fonts"
COMPOSER_LOGO_PATH = "app/static/logo-composer/logo.png"

def load_format_config():
    try:
        with open("app/static/formats.json", "r", encoding="utf-8") as f:
            config = json.load(f)
        
        formats_map = {fmt['name']: fmt for fmt in config['formats']}
        for fmt in config['formats']:
            if 'rules' in fmt and fmt['rules'].get('type') == 'copy':
                source_name = fmt['rules'].get('source')
                if source_name in formats_map:
                    fmt['rules'] = formats_map[source_name]['rules']
        
        logger.info("Configuração de formatos carregada e processada com sucesso.")
        return config['formats']
    except Exception as e:
        logger.error(f"ERRO CRÍTICO ao carregar ou processar formats.json: {e}")
        return []

FORMAT_CONFIG = load_format_config()

def _parse_rgba_color(color_string: str) -> tuple:
    """Extrai valores (R, G, B, A) de uma string de cor CSS (rgba ou hex)."""
    color_string = color_string.strip()
    try:
        match = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)', color_string)
        if match:
            r, g, b, a_str = match.groups()
            a = float(a_str) * 255 if a_str is not None else 255
            return int(r), int(g), int(b), int(a)
        
        if color_string.startswith('#'):
            hex_color = color_string.lstrip('#')
            if len(hex_color) == 6: return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4)) + (255,)
            if len(hex_color) == 8: return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4, 6))
    except Exception as e:
        logger.error(f"Não foi possível parsear a cor '{color_string}': {e}")
    return 255, 255, 255, 255

def _create_gradient_image(color_string: str, width: int, height: int) -> Image.Image:
    """Cria uma imagem de gradiente a partir de uma string CSS."""
    try:
        angle_match = re.search(r'(\d+)deg', color_string)
        angle = int(angle_match.group(1)) if angle_match else 90
        colors_rgba = [_parse_rgba_color(c) for c in re.findall(r'rgba?\([^)]+\)|#\w+', color_string)]
        
        if len(colors_rgba) < 2: return Image.new('RGBA', (width, height), colors_rgba[0])

        angle_rad = np.deg2rad(90 - angle)
        x, y = np.linspace(-1, 1, width), np.linspace(-1, 1, height)
        xv, yv = np.meshgrid(x, y)
        c, s = np.cos(angle_rad), np.sin(angle_rad)
        t = (c * xv + s * yv - (c * x.min() + s * y.min())) / ((c * x.max() + s * y.max()) - (c * x.min() + s * y.min()))
        
        color_start, color_end = np.array(colors_rgba[0]), np.array(colors_rgba[-1])
        gradient_array = color_start[None, None, :] * (1 - t)[:, :, None] + color_end[None, None, :] * t[:, :, None]
        
        return Image.fromarray(gradient_array.astype(np.uint8), 'RGBA')
    except Exception as e:
        logger.error(f"Falha ao criar gradiente, usando cor sólida. Erro: {e}")
        fallback_color = _parse_rgba_color(re.findall(r'rgba?\([^)]+\)|#\w+', color_string)[0])
        return Image.new('RGBA', (width, height), fallback_color)

def _apply_logo_color_filter(image: Image.Image, filter_name: str) -> Image.Image:
    """Aplica um filtro de cor (preto ou branco) a um logo."""
    if filter_name not in ['white', 'black']: return image
    
    image = image.convert('RGBA')
    alpha = image.split()[3]
    color = (255, 255, 255) if filter_name == 'white' else (0, 0, 0)
    colorized_img = Image.new('RGB', image.size, color)
    colorized_img.putalpha(alpha)
    return colorized_img

def _apply_manual_image_override(canvas: Image.Image, original_image: Image.Image, overrides: dict):
    """Aplica um recorte e redimensionamento manual na imagem."""
    canvas_w, canvas_h = canvas.size
    crop_x, crop_y = int(overrides.get('x', 0)), int(overrides.get('y', 0))
    crop_w, crop_h = int(overrides.get('width', original_image.width)), int(overrides.get('height', original_image.height))
    
    cropped_img = original_image.crop((crop_x, crop_y, crop_x + crop_w, crop_y + crop_h))
    resized_for_canvas = cropped_img.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
    canvas.paste(resized_for_canvas, (0, 0))

def _apply_automatic_composition(canvas: Image.Image, original_image: Image.Image, analysis: dict, fmt_config: dict) -> dict:
    """Calcula e aplica o melhor enquadramento da imagem no canvas."""
    rules = fmt_config.get('rules', {})
    canvas_w, canvas_h = canvas.size
    image_w, image_h = original_image.size
    focus_x, focus_y = analysis['focus_point']
    main_box = analysis.get('main_box')

    if 'composition_area' in rules and rules.get('type') != 'centered_logo':
        margin = rules.get('margin', {'x': 20, 'y': 20})
        logo_area_w = rules.get('logo_area', {}).get('width', 0)
        target_x = (margin.get('x', 0) + logo_area_w + margin.get('y', 0) + (canvas_w - margin.get('y', 0))) / 2
        
        scale_x = max(target_x / focus_x if focus_x > 0 else 1, (canvas_w - target_x) / (image_w - focus_x) if (image_w - focus_x) > 0 else 1)
        scale_y = 1.0
        if main_box:
            person_h = main_box[3] - main_box[1]
            comp_area_h = canvas_h - (margin.get('y', 0) * 2)
            if person_h > 0 and comp_area_h > 0: scale_y = comp_area_h / person_h
        
        scale = max(scale_x, scale_y, max(canvas_w / image_w, canvas_h / image_h))
        
        new_w, new_h = int(image_w * scale), int(image_h * scale)
        paste_x = int(target_x - (focus_x * scale))
        paste_y = int(margin.get('y', 0) - (main_box[1] * scale)) if main_box else int(margin.get('y', 20) - (analysis['subject_top_y'] * scale))
    else:
        scale = max(canvas_w / image_w, canvas_h / image_h)
        new_w, new_h = int(image_w * scale), int(image_h * scale)
        paste_x = int((canvas_w / 2) - (focus_x * scale))
        paste_y = int((canvas_h / 2) - (focus_y * scale))

    paste_x = max(canvas_w - new_w, min(paste_x, 0))
    paste_y = max(canvas_h - new_h, min(paste_y, 0))
    
    resized_image = original_image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas.paste(resized_image, (paste_x, paste_y))
    
    return {"scale": scale, "paste_x": paste_x, "paste_y": paste_y, "crop": {"x":0, "y":0}, "zoom": scale}


def _compose_logo_only(fmt_config: dict, logos_data: list, overrides: dict) -> Image.Image:
    canvas = Image.new('RGBA', (fmt_config['width'], fmt_config['height']), (255, 255, 255, 255))
    logo_overrides = overrides.get('logo', [])
    
    processed_logos = []
    total_width, spacing = 0, 10
    for i, logo_data in enumerate(logos_data):
        override = logo_overrides[i] if i < len(logo_overrides) else {}
        logo_img = Image.open(io.BytesIO(logo_data['bytes'])).convert("RGBA")
        if override.get('color_filter'): logo_img = _apply_logo_color_filter(logo_img, override['color_filter'])
        if logo_img.getbbox(): logo_img = logo_img.crop(logo_img.getbbox())
        
        target_w = override.get('width', fmt_config.get('rules', {}).get('logo_area', {}).get('width', 150))
        logo_img = logo_img.resize((target_w, int(target_w * logo_img.height / logo_img.width)), Image.Resampling.LANCZOS)
        
        processed_logos.append(logo_img)
        total_width += logo_img.width
    
    if len(processed_logos) > 1: total_width += spacing * (len(processed_logos) - 1)
    
    current_x = (fmt_config['width'] - total_width) / 2
    for logo_img in processed_logos:
        paste_y = (fmt_config['height'] - logo_img.height) / 2
        canvas.paste(logo_img, (int(current_x), int(paste_y)), mask=logo_img)
        current_x += logo_img.width + spacing
        
    return canvas.convert('RGB')

def _compose_split_layout(original_image: Image.Image, analysis: dict, fmt_config: dict, logos_data: list, overrides: dict) -> tuple:
    rules = fmt_config.get('rules', {})
    canvas_w, canvas_h = fmt_config['width'], fmt_config['height']
    split_width = rules.get('split_width', 300)
    
    canvas = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 255))
    image_canvas = Image.new('RGBA', (canvas_w - split_width, canvas_h))
    
    image_overrides = overrides.get('image')
    if image_overrides:
        _apply_manual_image_override(image_canvas, original_image, image_overrides)
        composition_data = {'scale': image_overrides.get('zoom'), 'crop': image_overrides.get('crop')}
    else:
        temp_config = {'width': canvas_w - split_width, 'height': canvas_h, 'rules': {'type': 'full_bleed'}}
        composition_data = _apply_automatic_composition(image_canvas, original_image, analysis, temp_config)
        
    canvas.paste(image_canvas, (split_width, 0))
    
    if logos_data:
        logo_overrides = overrides.get('logo', [])
        current_y = rules.get('margin', {}).get('y', 40)
        for i, logo_data in enumerate(logos_data):
            override = logo_overrides[i] if i < len(logo_overrides) else {}
            logo_img = Image.open(io.BytesIO(logo_data['bytes'])).convert("RGBA")
            if override.get('color_filter'): logo_img = _apply_logo_color_filter(logo_img, override['color_filter'])
            if logo_img.getbbox(): logo_img = logo_img.crop(logo_img.getbbox())
            
            target_w = override.get('width', rules.get('logo_area', {}).get('width', 260))
            logo_img = logo_img.resize((target_w, int(target_w * logo_img.height / logo_img.width)), Image.Resampling.LANCZOS)
            
            paste_x = int(override.get('x', rules.get('margin', {}).get('x', 20)))
            paste_y = int(override.get('y', current_y))
            
            canvas.paste(logo_img, (paste_x, paste_y), mask=logo_img)
            current_y = paste_y + logo_img.height + 15
            
    return canvas.convert('RGB'), composition_data

def _compose_standard_format(original_image: Image.Image, analysis: dict, fmt_config: dict, logos_data: list, overrides: dict) -> tuple:
    """Compõe formatos padrão com imagem de fundo, logos e tagline."""
    rules = fmt_config.get('rules', {})
    canvas_w, canvas_h = fmt_config['width'], fmt_config['height']
    canvas = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 255))
    
    background_override = overrides.get('background')
    if background_override:
        bg_type, bg_color = background_override.get('type'), background_override.get('color')
        if bg_type == 'solid': canvas = Image.new('RGBA', (canvas_w, canvas_h), _parse_rgba_color(bg_color))
        elif bg_type == 'gradient': canvas = _create_gradient_image(bg_color, canvas_w, canvas_h)
    
    composition_data = None
    if 'logo_only' not in rules.get('type', '') and not background_override:
        image_overrides = overrides.get('image')
        if image_overrides: _apply_manual_image_override(canvas, original_image, image_overrides)
        else: composition_data = _apply_automatic_composition(canvas, original_image, analysis, fmt_config)

    if fmt_config['name'] in ['SLOT1_NEXT_WEB', 'SLOT1_NEXT_WEB_PRE']:
        overlay = Image.new('RGBA', canvas.size, (0,0,0,191))
        canvas.paste(overlay, (0,0), mask=overlay)

    final_logo_pos, final_logo_size = None, None
    if logos_data and rules.get('type') != 'full_bleed':
        logo_overrides = overrides.get('logo', [])
        current_y = rules.get('margin', {}).get('y', 20)
        for i, logo_data in enumerate(logos_data):
            override = logo_overrides[i] if i < len(logo_overrides) else {}
            logo_img = Image.open(io.BytesIO(logo_data['bytes'])).convert("RGBA")
            if override.get('color_filter'): logo_img = _apply_logo_color_filter(logo_img, override['color_filter'])
            if logo_img.getbbox(): logo_img = logo_img.crop(logo_img.getbbox())
            
            logo_w = int(override.get('width', 150))
            logo_h = int(logo_w * logo_img.height / logo_img.width) if logo_img.width > 0 else 0
            logo_img.thumbnail((logo_w, logo_h), Image.Resampling.LANCZOS)
            
            paste_x = int(override.get('x', rules.get('margin', {}).get('x', 20)))
            paste_y = int(override.get('y', current_y))
            canvas.paste(logo_img, (paste_x, paste_y), mask=logo_img)
            
            if i == 0: final_logo_pos, final_logo_size = (paste_x, paste_y), logo_img.size
            current_y = paste_y + logo_img.height + 15

    tagline_overrides = overrides.get('tagline')
    if tagline_overrides and tagline_overrides.get('text'):
        try:
            font = ImageFont.truetype(os.path.join(FONTS_BASE_PATH, tagline_overrides.get('font_filename')), tagline_overrides.get('font_size'))
            color = tuple(_parse_rgba_color(tagline_overrides.get('color')))
            pos_x = tagline_overrides.get('x', final_logo_pos[0] if final_logo_pos else 20)
            pos_y = tagline_overrides.get('y', final_logo_pos[1] + final_logo_size[1] + 5 if final_logo_pos else canvas_h - 40)
            ImageDraw.Draw(canvas).text((pos_x, pos_y), tagline_overrides['text'], font=font, fill=color)
        except Exception as e: logger.error(f"Erro ao renderizar tagline: {e}")

    return canvas.convert('RGB'), composition_data


def compose_single_format(original_image: Image.Image, analysis: dict, fmt_config: dict, 
                          logos_data: list, overrides: dict = None) -> tuple:
    rule_type = fmt_config.get('rules', {}).get('type', 'full_bleed')
    
    if rule_type == 'logo_only_centered_white_bg':
        img, data = _compose_logo_only(fmt_config, logos_data, overrides or {}), None
    elif fmt_config['name'] in ['HOME_PRIVATE', 'HOME_PRIVATE_PUBLIC']:
        img, data = _compose_split_layout(original_image, analysis, fmt_config, logos_data, overrides or {})
    else:
        img, data = _compose_standard_format(original_image, analysis, fmt_config, logos_data, overrides or {})
        
    return img, data

def compose_all_formats_assigned(files_bytes: dict, assignments: dict, selected_logos: list, overrides: dict = None) -> dict:
    analyses = {k: ia_service.analyze(v) for k, v in files_bytes.items()}
    images = {k: Image.open(io.BytesIO(v)) for k, v in files_bytes.items()}
    
    logos_to_process = []
    for logo in selected_logos:
        try:
            with open(os.path.join(LOGOS_BASE_PATH, logo['folder'], logo['filename']), "rb") as f:
                logos_to_process.append({'bytes': f.read()})
        except Exception as e:
            logger.warning(f"Não foi possível ler o logo {logo['filename']}: {e}")

    output_data = {}
    for fmt_config in FORMAT_CONFIG:
        fmt_name = f"{fmt_config['name']}.jpg"
        if fmt_config['name'] == 'ENTREGA': continue

        assigned_key = assignments.get(fmt_name)
        if not assigned_key: continue
            
        composed_img, comp_data = compose_single_format(
            images[assigned_key], analyses[assigned_key], fmt_config, 
            logos_to_process, overrides.get(fmt_name, {})
        )
        
        buffer = io.BytesIO()
        composed_img.save(buffer, format='JPEG', quality=90)
        output_data[fmt_name] = {"image_bytes": buffer.getvalue(), "composition_data": comp_data}

    required_for_entrega = ['SLOT1_WEB.jpg', 'SHOWROOM_MOBILE.jpg', 'HOME_PRIVATE.jpg']
    if all(comp in output_data for comp in required_for_entrega):
        try:
            entrega_bytes = _create_entrega_format(output_data, {f['name']: f for f in FORMAT_CONFIG})
            output_data['ENTREGA.jpg'] = {"image_bytes": entrega_bytes, "composition_data": None}
        except Exception as e:
            logger.error(f"Falha ao criar o formato ENTREGA: {e}", exc_info=True)
    
    return output_data

def _create_entrega_format(generated_images: dict, formats_config: dict) -> bytes:
    CANVAS_WIDTH, CANVAS_HEIGHT = 980, 1002
    MARGIN, GAP = 20, 20
    TEXT_COLOR, LINE_COLOR = (120, 120, 120), (230, 230, 230)
    TARGET_SLOT1_SIZE, TARGET_SHOWROOM_SIZE = (331, 242), (588, 242)

    try:
        font_label = ImageFont.truetype(os.path.join(FONTS_BASE_PATH, "Poppins-Bold.ttf"), 12)
        font_menu = ImageFont.truetype(os.path.join(FONTS_BASE_PATH, "Poppins-Regular.ttf"), 12)
        font_heart = ImageFont.truetype(os.path.join(FONTS_BASE_PATH, "cambria.ttc"), 12)
    except IOError:
        font_label = font_menu = font_heart = ImageFont.load_default()

    canvas = Image.new('RGB', (CANVAS_WIDTH, CANVAS_HEIGHT), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)

    def load_and_resize(key, target_size):
        img_bytes = generated_images.get(key, {}).get('image_bytes')
        if img_bytes:
            return Image.open(io.BytesIO(img_bytes)).resize(target_size, Image.Resampling.LANCZOS)
        return Image.new('RGB', target_size, (240, 240, 240))

    img_slot1 = load_and_resize('SLOT1_WEB.jpg', TARGET_SLOT1_SIZE)
    img_showroom = load_and_resize('SHOWROOM_MOBILE.jpg', TARGET_SHOWROOM_SIZE)
    img_home_bytes = generated_images.get('HOME_PRIVATE.jpg', {}).get('image_bytes')
    img_home = Image.open(io.BytesIO(img_home_bytes)) if img_home_bytes else Image.new('RGB', (940, 530), (240, 240, 240))

    home_rules = formats_config.get('HOME_PRIVATE', {}).get('rules', {})
    draw_home = ImageDraw.Draw(img_home)
    menu_start_y = home_rules.get('margin', {}).get('y', 40) + home_rules.get('logo_area', {}).get('height', 100) + 40
    for item in ["Mais desejados ♡", "Categoria 1", "Categoria 2", "Categoria 3"]:
        text_part = item.replace(" ♡", "")
        draw_home.text((20, menu_start_y), text_part, fill=(80, 80, 80), font=font_menu)
        bbox = draw_home.textbbox((20, menu_start_y), text_part, font=font_menu)
        if "♡" in item: draw_home.text((bbox[2] + 5, menu_start_y), "♡", fill=(220, 53, 69), font=font_heart)
        
        line_y = bbox[3] + 12
        draw_home.line([(20, line_y), (home_rules.get('split_width', 300) - MARGIN, line_y)], fill=LINE_COLOR, width=1)
        menu_start_y = line_y + 12

    current_y = MARGIN
    try:
        logo_composer = Image.open(COMPOSER_LOGO_PATH).convert("RGBA")
        logo_composer.thumbnail((200, 60), Image.Resampling.LANCZOS)
        canvas.paste(logo_composer, ((CANVAS_WIDTH - logo_composer.width) // 2, current_y), logo_composer)
        current_y += logo_composer.height + GAP
    except FileNotFoundError:
        current_y += 60 + GAP

    draw.text((MARGIN, current_y), "Slot 1", fill=TEXT_COLOR, font=font_label)
    draw.text((MARGIN + TARGET_SLOT1_SIZE[0] + GAP, current_y), "Showroom Mobile", fill=TEXT_COLOR, font=font_label)
    current_y += draw.textbbox((MARGIN, current_y), "Slot 1", font=font_label)[3] - current_y + 8
    draw.line([(MARGIN, current_y), (CANVAS_WIDTH - MARGIN, current_y)], fill=LINE_COLOR, width=1)
    current_y += GAP

    canvas.paste(img_slot1, (MARGIN, current_y))
    canvas.paste(img_showroom, (MARGIN + TARGET_SLOT1_SIZE[0] + GAP, current_y))
    current_y += TARGET_SHOWROOM_SIZE[1] + GAP

    draw.text((MARGIN, current_y), "Home", fill=TEXT_COLOR, font=font_label)
    current_y += draw.textbbox((MARGIN, current_y), "Home", font=font_label)[3] - current_y + 8
    draw.line([(MARGIN, current_y), (CANVAS_WIDTH - MARGIN, current_y)], fill=LINE_COLOR, width=1)
    current_y += GAP
    
    canvas.paste(img_home, (MARGIN, current_y))

    buffer = io.BytesIO()
    canvas.save(buffer, format='JPEG', quality=95)
    return buffer.getvalue()
