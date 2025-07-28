from PIL import Image, ImageDraw, ImageOps
import io
import json
import logging
import os
import re
import numpy as np
from . import ia_service
from PIL import Image, ImageDraw, ImageFont, ImageOps

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    with open("app/static/formats.json", "r", encoding="utf-8") as f:
        config = json.load(f)
        formats_map = {fmt['name']: fmt for fmt in config['formats']}
        for fmt in config['formats']:
            if 'rules' in fmt and fmt['rules'].get('type') == 'copy':
                source_format_name = fmt['rules'].get('source')
                source_rules = formats_map.get(source_format_name)
                if source_rules:
                    fmt['rules'] = source_rules['rules']
        FORMAT_CONFIG = config['formats']
    logger.info("Configuração de formatos carregada e processada com sucesso.")
except Exception as e:
    logger.error(f"ERRO CRÍTICO ao carregar ou processar formats.json: {e}")
    FORMAT_CONFIG = []

LOGOS_BASE_PATH = "app/static/logos"
FONTS_BASE_PATH = "app/static/fonts"
PRIVALIA_LOGO_PATH = "app/static/logo-privalia/logo.png"


def _parse_rgba_color(color_string):
    """Extrai valores (R, G, B, A) de uma string de cor CSS."""
    color_string = color_string.strip()
    try:
        # Tenta extrair 'rgba(r,g,b,a)'
        match = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)', color_string)
        if match:
            r, g, b, a_str = match.groups()
            a = float(a_str) * 255 if a_str is not None else 255
            return int(r), int(g), int(b), int(a)
        
        # Tenta extrair cor Hex '#RRGGBB'
        if color_string.startswith('#'):
            hex_color = color_string.lstrip('#')
            if len(hex_color) == 6:
                return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4)) + (255,)
            if len(hex_color) == 8: # Com alpha
                return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4, 6))

    except Exception as e:
        logger.error(f"Não foi possível parsear a cor '{color_string}': {e}")
    
    return 255, 255, 255, 255 # Retorna branco como fallback

def _create_gradient_image(color_string, width, height):
    """Cria uma imagem de gradiente com base na string CSS 'linear-gradient'."""
    try:
        angle_match = re.search(r'(\d+)deg', color_string)
        angle = int(angle_match.group(1)) if angle_match else 90

        colors_rgba = [_parse_rgba_color(c) for c in re.findall(r'rgba?\([^)]+\)|#\w+', color_string)]
        if len(colors_rgba) < 2:
            return Image.new('RGBA', (width, height), colors_rgba[0])

        angle_rad = np.deg2rad(90 - angle)
        x, y = np.linspace(-1, 1, width), np.linspace(-1, 1, height)
        xv, yv = np.meshgrid(x, y)
        c, s = np.cos(angle_rad), np.sin(angle_rad)
        t = c*xv + s*yv
        t = (t - t.min()) / (t.max() - t.min())
        
        color_start, color_end = np.array(colors_rgba[0]), np.array(colors_rgba[-1])
        gradient_array = color_start[None, None, :] * (1 - t)[:, :, None] + color_end[None, None, :] * t[:, :, None]
        
        return Image.fromarray(gradient_array.astype(np.uint8), 'RGBA')

    except Exception as e:
        logger.error(f"Falha ao criar gradiente, usando cor sólida. Erro: {e}")
        fallback_color = _parse_rgba_color(re.findall(r'rgba?\([^)]+\)|#\w+', color_string)[0])
        return Image.new('RGBA', (width, height), fallback_color)

def _apply_logo_color_filter(image: Image.Image, filter_name: str) -> Image.Image:
    """Aplica um filtro de cor (preto ou branco) a uma imagem, preservando a transparência."""
    if filter_name not in ['white', 'black']:
        return image
    
    image = image.convert('RGBA')
    alpha = image.split()[3]
    
    if filter_name == 'white':
        colorized_img = Image.new('RGB', image.size, (255, 255, 255))
    else: # black
        colorized_img = Image.new('RGB', image.size, (0, 0, 0))
    
    colorized_img.putalpha(alpha)
    logger.info(f"Filtro de cor '{filter_name}' aplicado ao logo.")
    return colorized_img

def _apply_manual_image_override(canvas: Image.Image, original_image: Image.Image, overrides: dict):
    canvas_w, canvas_h = canvas.size
    crop_x, crop_y = int(overrides.get('x', 0)), int(overrides.get('y', 0))
    crop_w, crop_h = int(overrides.get('width', original_image.width)), int(overrides.get('height', original_image.height))
    crop_box = (crop_x, crop_y, crop_x + crop_w, crop_y + crop_h)
    
    cropped_img = original_image.crop(crop_box)
    resized_for_canvas = cropped_img.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
    canvas.paste(resized_for_canvas, (0, 0))
    logger.info(f"Aplicado override de imagem 1:1. Recortado da original em {crop_box} e redimensionado para o canvas.")

def _apply_automatic_composition(canvas: Image.Image, original_image: Image.Image, analysis: dict, fmt_config: dict):
    rules = fmt_config.get('rules',{})
    rule_type = rules.get('type', 'full_bleed')
    canvas_w, canvas_h = canvas.size
    image_w, image_h = original_image.size
    focus_point_x, focus_point_y = analysis['focus_point']
    main_box = analysis.get('main_box', None)
    
    if 'composition_area' in rules and rule_type not in ['centered_logo']:
        margin = rules.get('margin', {'x': 20, 'y': 20})
        logo_area_width = rules.get('logo_area', {}).get('width', 0)
        target_x_on_canvas = (margin.get('x', 0) + logo_area_width + margin.get('y', 0) + (canvas_w - margin.get('y', 0))) / 2
        scale_x_centering = max(target_x_on_canvas / focus_point_x if focus_point_x > 0 else 1.0, (canvas_w - target_x_on_canvas) / (image_w - focus_point_x) if (image_w - focus_point_x) > 0 else 1.0)
        scale_y_framing = 1.0
        if main_box:
            person_box_h = main_box[3] - main_box[1]
            comp_area_h = canvas_h - (margin.get('y', 0) * 2)
            if person_box_h > 0 and comp_area_h > 0: scale_y_framing = comp_area_h / person_box_h
        scale_fill_canvas = max(canvas_w / image_w, canvas_h / image_h)
        scale = max(scale_x_centering, scale_y_framing, scale_fill_canvas)
        new_w, new_h = int(image_w * scale), int(image_h * scale)
        focus_x_scaled = int(focus_point_x * scale)
        paste_x = int(target_x_on_canvas - focus_x_scaled)
        if main_box:
            box_top_y_scaled = main_box[1] * scale
            paste_y = int(margin.get('y', 0) - box_top_y_scaled)
        else:
            subject_top_y_scaled = analysis['subject_top_y'] * scale
            paste_y = int(margin.get('y', 20) - subject_top_y_scaled)
    else:
        scale = max(canvas_w / image_w, canvas_h / image_h)
        new_w, new_h = int(image_w * scale), int(image_h * scale)
        focus_x_scaled, focus_y_scaled = int(focus_point_x * scale), int(focus_point_y * scale)
        paste_x, paste_y = int((canvas_w / 2) - focus_x_scaled), int((canvas_h / 2) - focus_y_scaled)
        
    resized_image = original_image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    composition_data = {"scale": scale, "paste_x": paste_x, "paste_y": paste_y, "crop": {"x":0, "y":0}, "zoom": scale} 
    left_bound, right_bound = canvas_w - new_w, 0
    top_bound, bottom_bound = canvas_h - new_h, 0
    paste_x = max(left_bound, min(paste_x, right_bound))
    paste_y = max(top_bound, min(paste_y, bottom_bound))
    canvas.paste(resized_image, (paste_x, paste_y))
    return composition_data

def _create_entrega_format(generated_images: dict, formats_config: dict) -> bytes:
    CANVAS_WIDTH = 980
    CANVAS_HEIGHT = 1002
    MARGIN = 20
    GAP = 20
    TEXT_COLOR = (120, 120, 120)
    LINE_COLOR = (230, 230, 230)
    
    TARGET_SLOT1_SIZE = (331, 242)
    TARGET_SHOWROOM_SIZE = (588, 242)

    try:
        font_path = os.path.join(FONTS_BASE_PATH, "Poppins-Bold.ttf")
        font_path_menu = os.path.join(FONTS_BASE_PATH, "Poppins-Regular.ttf")
        font_symbol_path = os.path.join(FONTS_BASE_PATH, "cambria.ttc")
        font_heart = ImageFont.truetype(font_symbol_path, 12)
        font_label = ImageFont.truetype(font_path, 12)
        font_section = ImageFont.truetype(font_path, 12)

        font_menu = ImageFont.truetype(font_path_menu, 12) 
    except IOError:
        font_label = ImageFont.load_default()
        font_section = ImageFont.load_default()
        font_menu = ImageFont.load_default()
        font_heart = ImageFont.load_default()

    entrega_canvas = Image.new('RGB', (CANVAS_WIDTH, CANVAS_HEIGHT), (255, 255, 255))
    draw = ImageDraw.Draw(entrega_canvas)

    def get_placeholder(width, height, text="Não gerado"):
        
        return Image.new('RGB', (width, height), (240, 240, 240))

    slot1_bytes = generated_images.get('SLOT1_WEB.jpg', {}).get('image_bytes')
    showroom_bytes = generated_images.get('SHOWROOM_MOBILE.jpg', {}).get('image_bytes')
    home_bytes = generated_images.get('HOME_PRIVATE.jpg', {}).get('image_bytes')
    
    img_slot1_original = Image.open(io.BytesIO(slot1_bytes)) if slot1_bytes else None
    img_showroom_original = Image.open(io.BytesIO(showroom_bytes)) if showroom_bytes else None
    img_home = Image.open(io.BytesIO(home_bytes)) if home_bytes else None

    img_slot1 = img_slot1_original.resize(TARGET_SLOT1_SIZE, Image.Resampling.LANCZOS) if img_slot1_original else get_placeholder(*TARGET_SLOT1_SIZE)
    img_showroom = img_showroom_original.resize(TARGET_SHOWROOM_SIZE, Image.Resampling.LANCZOS) if img_showroom_original else get_placeholder(*TARGET_SHOWROOM_SIZE)
    
    home_dim = formats_config.get('HOME_PRIVATE', {'width': 940, 'height': 530})
    if not img_home:
        img_home = get_placeholder(home_dim['width'], home_dim['height'])

    if img_home:
        home_rules = formats_config.get('HOME_PRIVATE', {}).get('rules', {})
        draw_home = ImageDraw.Draw(img_home)

        start_x = home_rules.get('margin', {}).get('x', 20)
        logo_area_height = home_rules.get('logo_area', {}).get('height', 100)
        menu_start_y = home_rules.get('margin', {}).get('y', 40) + logo_area_height + 40 # 40px de margem
        
        menu_items = ["Mais desejados ♡", "Categoria 1", "Categoria 2", "Categoria 3"]
        menu_line_padding = 12
        menu_text_color = (80, 80, 80)
        heart_color = (220, 53, 69)
        
        for item in menu_items:
            
            if "♡" in item:
                text_part = item.replace(" ♡", "")
                draw_home.text((start_x, menu_start_y), text_part, fill=menu_text_color, font=font_menu)
                bbox = draw_home.textbbox((start_x, menu_start_y), text_part, font=font_menu)
                draw_home.text((bbox[2] + 5, menu_start_y), "♡", fill=heart_color, font=font_heart)
            else:
                draw_home.text((start_x, menu_start_y), item, fill=menu_text_color, font=font_menu)

            bbox = draw_home.textbbox((start_x, menu_start_y), item, font=font_menu)
            line_y = bbox[3] + menu_line_padding
            draw_home.line([(start_x, line_y), (home_rules.get('split_width', 300) - MARGIN, line_y)], fill=LINE_COLOR, width=1)
            menu_start_y = line_y + menu_line_padding


    current_y = MARGIN
    try:
        logo_privalia = Image.open(PRIVALIA_LOGO_PATH).convert("RGBA")
        logo_privalia.thumbnail((200, 60), Image.Resampling.LANCZOS)
        logo_x = (CANVAS_WIDTH - logo_privalia.width) // 2
        entrega_canvas.paste(logo_privalia, (logo_x, current_y), logo_privalia)
        current_y += logo_privalia.height + GAP
    except FileNotFoundError:
        current_y += 60 + GAP

    text_y_top = current_y
    draw.text((MARGIN, text_y_top), "Slot 1", fill=TEXT_COLOR, font=font_label)
    draw.text((MARGIN + TARGET_SLOT1_SIZE[0] + GAP, text_y_top), "Showroom Mobile", fill=TEXT_COLOR, font=font_label)

    bbox_top = draw.textbbox((MARGIN, text_y_top), "Slot 1", font=font_label)
    line_y_top = bbox_top[3] + 8

    line1_end_x = MARGIN + TARGET_SLOT1_SIZE[0]
    draw.line([(MARGIN, line_y_top), (line1_end_x, line_y_top)], fill=LINE_COLOR, width=1)

    line2_start_x = MARGIN + TARGET_SLOT1_SIZE[0] + GAP
    line2_end_x = CANVAS_WIDTH - MARGIN
    draw.line([(line2_start_x, line_y_top), (line2_end_x, line_y_top)], fill=LINE_COLOR, width=1)
    
    current_y = line_y_top + GAP 

    entrega_canvas.paste(img_slot1, (MARGIN, current_y))
    entrega_canvas.paste(img_showroom, (MARGIN + TARGET_SLOT1_SIZE[0] + GAP, current_y))
    current_y += TARGET_SHOWROOM_SIZE[1] + GAP

    text_y_home = current_y
    draw.text((MARGIN, text_y_home), "Home", fill=TEXT_COLOR, font=font_section)
    bbox_home = draw.textbbox((MARGIN, text_y_home), "Home", font=font_section)
    line_y_home = bbox_home[3] + 8
    draw.line([(MARGIN, line_y_home), (CANVAS_WIDTH - MARGIN, line_y_home)], fill=LINE_COLOR, width=1)
    current_y = line_y_home + GAP

    entrega_canvas.paste(img_home, (MARGIN, current_y))

    buffer = io.BytesIO()
    entrega_canvas.save(buffer, format='JPEG', quality=95)
    return buffer.getvalue()

def compose_single_format(original_image: Image.Image, analysis: dict, fmt_config: dict, 
                          logos_data: list, overrides: dict = None) -> tuple[Image.Image, dict | None]:
    if overrides is None: overrides = {}
    
    rules = fmt_config.get('rules', {})
    rule_type = rules.get('type', 'full_bleed')
    canvas_w, canvas_h = fmt_config['width'], fmt_config['height']
    composition_data = None
    
    if rule_type == 'logo_only_centered_white_bg':
        logger.info(f"Processando formato 'logo_only_centered_white_bg': {fmt_config['name']}")
        canvas = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 255))
        logo_overrides_list = overrides.get('logo', [])
        processed_logos = []
        total_width_of_logos, logo_spacing = 0, 10
        for i, logo_data in enumerate(logos_data):
            logo_override = logo_overrides_list[i] if i < len(logo_overrides_list) else {}
            logo_image = Image.open(io.BytesIO(logo_data['bytes'])).convert("RGBA")
            if logo_override.get('color_filter'): logo_image = _apply_logo_color_filter(logo_image, logo_override['color_filter'])
            if logo_image.getbbox(): logo_image = logo_image.crop(logo_image.getbbox())
            target_width = logo_override.get('width', rules.get('logo_area', {}).get('width', 150))
            logo_image = logo_image.resize((target_width, int(target_width * logo_image.height / logo_image.width)), Image.Resampling.LANCZOS)
            processed_logos.append(logo_image)
            total_width_of_logos += logo_image.width
        if len(processed_logos) > 1: total_width_of_logos += logo_spacing * (len(processed_logos) - 1)
        current_x = (canvas_w - total_width_of_logos) / 2
        for logo_image in processed_logos:
            paste_y = (canvas_h - logo_image.height) / 2
            canvas.paste(logo_image, (int(current_x), int(paste_y)), mask=logo_image)
            current_x += logo_image.width + logo_spacing
        return canvas.convert('RGB'), None

    elif fmt_config['name'] in ['HOME_PRIVATE', 'HOME_PRIVATE_PUBLIC']:
        logger.info(f"Processando formato especial 'split_left_white': {fmt_config['name']}")
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
            logo_overrides_list = overrides.get('logo', [])
            current_y = rules.get('margin', {}).get('y', 40)
            logo_spacing = 15

            for i, logo_data in enumerate(logos_data):
                logo_override = logo_overrides_list[i] if i < len(logo_overrides_list) else {}
                logo_image = Image.open(io.BytesIO(logo_data['bytes'])).convert("RGBA")
                if logo_override.get('color_filter'):
                    logo_image = _apply_logo_color_filter(logo_image, logo_override['color_filter'])
                
                bbox = logo_image.getbbox()
                if bbox:
                    logo_image = logo_image.crop(bbox)
                
                target_width = logo_override.get('width', rules.get('logo_area', {}).get('width', 260))
                aspect_ratio = logo_image.height / logo_image.width if logo_image.width > 0 else 1
                target_height = int(target_width * aspect_ratio)
                logo_image = logo_image.resize((target_width, target_height), Image.Resampling.LANCZOS)
                
                paste_x = int(logo_override.get('x', rules.get('margin', {}).get('x', 20)))
                paste_y = int(logo_override.get('y', current_y))
                
                canvas.paste(logo_image, (paste_x, paste_y), mask=logo_image)
                current_y = paste_y + logo_image.height + logo_spacing
        
        return canvas.convert('RGB'), composition_data

    else:
        # Lógica para todos os outros formatos (permanece a mesma)
        canvas = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 255))
        background_override = overrides.get('background')
        if background_override:
            bg_type, bg_color = background_override.get('type'), background_override.get('color')
            if bg_type == 'solid': canvas = Image.new('RGBA', (canvas_w, canvas_h), _parse_rgba_color(bg_color))
            elif bg_type == 'gradient': canvas = _create_gradient_image(bg_color, canvas_w, canvas_h)
        
        if 'logo_only' not in rule_type and not background_override:
            image_overrides = overrides.get('image')
            if image_overrides: _apply_manual_image_override(canvas, original_image, image_overrides)
            else: composition_data = _apply_automatic_composition(canvas, original_image, analysis, fmt_config)

        if fmt_config['name'] in ['SLOT1_NEXT_WEB', 'SLOT1_NEXT_WEB_PRE']:
            canvas.paste(Image.new('RGBA', canvas.size, (0,0,0,191)), (0,0), mask=Image.new('RGBA', canvas.size, (0,0,0,191)))

        final_logo_pos, final_logo_size = None, None
        if logos_data and rule_type not in ['full_bleed']:
            logo_overrides_list = overrides.get('logo', [])
            current_y = rules.get('margin', {}).get('y', 20)
            logo_spacing = 15
            for i, logo_data in enumerate(logos_data):
                logo_override = logo_overrides_list[i] if i < len(logo_overrides_list) else {}
                logo_image = Image.open(io.BytesIO(logo_data['bytes'])).convert("RGBA")
                if logo_override.get('color_filter'): logo_image = _apply_logo_color_filter(logo_image, logo_override['color_filter'])
                if logo_image.getbbox(): logo_image = logo_image.crop(logo_image.getbbox())
                logo_w = int(logo_override.get('width', 150))
                logo_h = int(logo_w * logo_image.height / logo_image.width) if logo_image.width > 0 else 0
                logo_image.thumbnail((logo_w, logo_h), Image.Resampling.LANCZOS)
                paste_x = int(logo_override.get('x', rules.get('margin', {}).get('x', 20)))
                paste_y = int(logo_override.get('y', current_y))
                canvas.paste(logo_image, (paste_x, paste_y), mask=logo_image)
                if i == 0: final_logo_pos, final_logo_size = (paste_x, paste_y), logo_image.size
                current_y = paste_y + logo_image.height + logo_spacing
        
        tagline_overrides = overrides.get('tagline')
        if tagline_overrides and tagline_overrides.get('text'):
            try:
                text, font_filename, font_size = tagline_overrides['text'], tagline_overrides.get('font_filename', 'Montserrat-Regular.ttf'), tagline_overrides.get('font_size', 24)
                font_color = tuple(_parse_rgba_color(tagline_overrides.get('color', '#000000')))
                font = ImageFont.truetype(os.path.join("app/static/fonts", font_filename), font_size)
                draw = ImageDraw.Draw(canvas)
                if 'x' in tagline_overrides and 'y' in tagline_overrides: text_x, text_y = tagline_overrides['x'], tagline_overrides['y']
                elif final_logo_pos and final_logo_size: text_x, text_y = final_logo_pos[0], final_logo_pos[1] + final_logo_size[1] + tagline_overrides.get('offset_y', 5)
                else: text_x, text_y = 20, canvas_h - 40
                draw.text((text_x, text_y), text, font=font, fill=font_color)
            except Exception as e: logger.error(f"Erro ao renderizar tagline: {e}")

        return canvas.convert('RGB'), composition_data

def compose_all_formats_assigned(
    files_bytes: dict, 
    assignments: dict, 
    selected_logos_list: list,
    overrides: dict = None
) -> dict[str, dict]:
    if overrides is None: overrides = {}
        
    analysis_A = ia_service.analyze(files_bytes['imageA'])
    analysis_B = ia_service.analyze(files_bytes['imageB'])
    images = {'imageA': Image.open(io.BytesIO(files_bytes['imageA'])), 'imageB': Image.open(io.BytesIO(files_bytes['imageB']))}
    analyses = {'imageA': analysis_A, 'imageB': analysis_B}
    
    logos_to_process = []
    for logo_info in selected_logos_list:
        try:
            with open(os.path.join(LOGOS_BASE_PATH, logo_info['folder'], logo_info['filename']), "rb") as f:
                logos_to_process.append({'bytes': f.read()})
        except Exception as e:
            logger.warning(f"Não foi possível ler o logo {logo_info['filename']}: {e}")
            continue
    
    output_data = {}
    
    # Gera todos os formatos, exceto o ENTREGA
    for fmt_config in FORMAT_CONFIG:
        format_name_with_ext = fmt_config['name'] + ".jpg"
        if fmt_config['name'] == 'ENTREGA':
            continue

        assigned_image_key = assignments.get(format_name_with_ext)
        if not assigned_image_key: continue
            
        image_to_process = images[assigned_image_key]
        analysis_to_use = analyses[assigned_image_key]
        format_override = overrides.get(format_name_with_ext, {})
        
        composed_image, composition_data = compose_single_format(
            image_to_process, 
            analysis_to_use, 
            fmt_config, 
            logos_to_process,
            overrides=format_override
        )
        
        buffer = io.BytesIO()
        composed_image.save(buffer, format='JPEG', quality=90)
        
        output_data[format_name_with_ext] = {
            "image_bytes": buffer.getvalue(),
            "composition_data": composition_data
        }

    componentes_necessarios = ['SLOT1_WEB.jpg', 'SHOWROOM_MOBILE.jpg', 'HOME_PRIVATE.jpg']
    if all(comp in output_data for comp in componentes_necessarios):
        logger.info("Todos os componentes para 'ENTREGA' foram gerados. Montando o formato composto...")
        try:
            formats_map = {fmt['name']: fmt for fmt in FORMAT_CONFIG}
            entrega_bytes = _create_entrega_format(output_data, formats_map)
            output_data['ENTREGA.jpg'] = {"image_bytes": entrega_bytes, "composition_data": None}
        except Exception as e:
            logger.error(f"Falha ao criar o formato ENTREGA: {e}", exc_info=True)
    else:
        logger.warning("Não foi possível gerar 'ENTREGA' pois um ou mais de seus componentes não foram gerados.")
    
    return output_data