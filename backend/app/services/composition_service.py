# backend/app/services/composition_service.py

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

# --- Carregamento da Configuração ---
try:
    with open("app/static/formats.json", "r", encoding="utf-8") as f:
        config = json.load(f)
        formats_map = {fmt['name']: fmt for fmt in config['formats']}
        # Processa as regras de tipo 'copy'
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


def compose_single_format(original_image: Image.Image, analysis: dict, fmt_config: dict, 
                          logo_bytes: bytes, overrides: dict = None) -> tuple[Image.Image, dict | None]:
    if overrides is None:
        overrides = {}
    
    rules = fmt_config.get('rules', {})
    rule_type = rules.get('type', 'full_bleed')
    canvas_w, canvas_h = fmt_config['width'], fmt_config['height']
    composition_data = None
    canvas = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 255))
    
    if rule_type == 'logo_only_centered_white_bg':
        logger.info(f"Processando formato especial 'logo_only_centered_white_bg': {fmt_config['name']}")
        
        # 1. Cria o canvas final com fundo branco
        final_canvas = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 255))
        
        if logo_bytes:
            try:
                logo_image = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
                logo_overrides = overrides.get('logo', {})

                # Aplica filtro de cor se existir no override
                if logo_overrides.get('color_filter'):
                    logo_image = _apply_logo_color_filter(logo_image, logo_overrides['color_filter'])

                bbox = logo_image.getbbox()
                if bbox: logo_image = logo_image.crop(bbox)
                
                # Redimensiona o logo para caber na área definida
                logo_area = rules.get('logo_area')
                if logo_area:
                    logo_image.thumbnail((logo_area['width'], logo_area['height']), Image.Resampling.LANCZOS)
                
                # Centraliza o logo no canvas
                paste_x = (canvas_w - logo_image.width) // 2
                paste_y = (canvas_h - logo_image.height) // 2
                
                final_canvas.paste(logo_image, (paste_x, paste_y), mask=logo_image)

            except Exception as e:
                logger.error(f"Erro ao aplicar logo no formato brand_logo: {e}")

        return final_canvas.convert('RGB'), None
    
    elif rule_type == 'split_left_white':
        logger.info(f"Processando formato especial 'split_left_white': {fmt_config['name']}")
        split_width = rules.get('split_width', 300)
        final_canvas = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 255))
        image_area_w, image_area_h = canvas_w - split_width, canvas_h
        image_canvas = Image.new('RGBA', (image_area_w, image_area_h))
        
        image_overrides = overrides.get('image')
        if image_overrides:
            logger.info("Aplicando override de imagem manual ao layout split.")
            _apply_manual_image_override(image_canvas, original_image, image_overrides)
            composition_data = {'scale': image_overrides.get('zoom'), 'crop': image_overrides.get('crop')}
        else:
            temp_fmt_config = {'width': image_area_w, 'height': image_area_h, 'rules': {'type': 'full_bleed'}}
            composition_data = _apply_automatic_composition(image_canvas, original_image, analysis, temp_fmt_config)
            
        final_canvas.paste(image_canvas, (split_width, 0))
        
        if logo_bytes:
            try:
                logo_image = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
                if overrides.get('logo', {}).get('color_filter'):
                    logo_image = _apply_logo_color_filter(logo_image, overrides['logo']['color_filter'])
                bbox = logo_image.getbbox()
                if bbox: logo_image = logo_image.crop(bbox)
                logo_area = rules.get('logo_area')
                if logo_area: logo_image.thumbnail((logo_area['width'], logo_area['height']), Image.Resampling.LANCZOS)
                paste_x = rules.get('margin', {}).get('x', 20)
                paste_y = rules.get('margin', {}).get('y', 40)
                final_canvas.paste(logo_image, (paste_x, paste_y), mask=logo_image)
            except Exception as e:
                logger.error(f"Erro ao aplicar logo no formato split: {e}")
        
        return final_canvas.convert('RGB'), composition_data

    background_override = overrides.get('background')
    if background_override:
        bg_type, bg_color_str = background_override.get('type'), background_override.get('color')
        if bg_type == 'solid': canvas = Image.new('RGBA', (canvas_w, canvas_h), _parse_rgba_color(bg_color_str))
        elif bg_type == 'gradient': canvas = _create_gradient_image(bg_color_str, canvas_w, canvas_h)
    
    if canvas is None: canvas = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 255))

    if 'logo_only' not in rule_type and not background_override:
        image_overrides = overrides.get('image')
        if image_overrides:
            logger.info("Aplicando override de imagem manual ao layout padrão.")
            _apply_manual_image_override(canvas, original_image, image_overrides)

            composition_data = {'scale': image_overrides.get('zoom'), 'crop': image_overrides.get('crop')}
        else:
            composition_data = _apply_automatic_composition(canvas, original_image, analysis, fmt_config)

    if fmt_config['name'] in ['SLOT1_NEXT_WEB', 'SLOT1_NEXT_WEB_PRE']:
        canvas.paste(Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 191)), (0, 0), mask=Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 191)))
    
    final_logo_pos = None
    final_logo_size = None

    logo_overrides = overrides.get('logo')
    if logo_bytes and rule_type not in ['full_bleed', 'logo_only_fill']:
        try:
            logo_image = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
            if logo_overrides and logo_overrides.get('color_filter'):
                logo_image = _apply_logo_color_filter(logo_image, logo_overrides['color_filter'])
            bbox = logo_image.getbbox()
            if bbox: logo_image = logo_image.crop(bbox)
            
            if logo_overrides:
                logo_w = int(logo_overrides.get('width', 150))
                logo_h = int(logo_image.height * logo_w / logo_image.width) if logo_image.width > 0 else 0
                logo_image.thumbnail((logo_w, logo_h), Image.Resampling.LANCZOS)
                paste_position = (int(logo_overrides.get('x', 0)), int(logo_overrides.get('y', 0)))
            else:
                logo_area = rules.get('logo_area', {'width': canvas_w, 'height': canvas_h})
                logo_image.thumbnail((logo_area['width'], logo_area['height']), Image.Resampling.LANCZOS)
                if rule_type in ['logo_only_centered', 'centered_logo']:
                    paste_position = (int((canvas_w - logo_image.width) / 2), int((canvas_h - logo_image.height) / 2))
                else:
                    margin = rules.get('margin', {'x': 20, 'y': 20})
                    paste_position = (margin['x'], margin['y'])
            
            canvas.paste(logo_image, paste_position, mask=logo_image)

            final_logo_pos = paste_position
            final_logo_size = logo_image.size

        except Exception as e:
            logger.error(f"Erro ao aplicar logo para o formato '{fmt_config['name']}': {e}")
    
    if rule_type == 'logo_only_fill' and logo_bytes:

        pass

    tagline_overrides = overrides.get('tagline')
    if tagline_overrides and tagline_overrides.get('text'):
        try:
            text = tagline_overrides['text']
            font_filename = tagline_overrides.get('font_filename', 'Montserrat-Regular.ttf')
            font_size = tagline_overrides.get('font_size', 24)
            font_color = tuple(_parse_rgba_color(tagline_overrides.get('color', '#000000')))
            font_path = os.path.join("app/static/fonts", font_filename)
            font = ImageFont.truetype(font_path, font_size)
            draw = ImageDraw.Draw(canvas)
            
            if 'x' in tagline_overrides and 'y' in tagline_overrides:
                text_x, text_y = tagline_overrides['x'], tagline_overrides['y']
            else:
                if final_logo_pos and final_logo_size:
                    logo_x, logo_y = final_logo_pos
                    logo_w, logo_h = final_logo_size
                    offset_y = tagline_overrides.get('offset_y', 5)
                    text_y = logo_y + logo_h + offset_y

                    exception_formats = ['SLOT1_NEXT_WEB.jpg', 'SLOT1_NEXT_WEB_PRE.jpg']
                    if fmt_config['name'] in exception_formats:
                        try:
                            text_box = draw.textbbox((0, 0), text, font=font)
                            text_width = text_box[2] - text_box[0]
                        except AttributeError:
                            text_width = draw.textlength(text, font=font)
                        text_x = logo_x + (logo_w - text_width) / 2
                    else:
                        text_x = logo_x
                else:
                    text_x, text_y = 20, canvas_h - 40 
            
            draw.text((text_x, text_y), text, font=font, fill=font_color)

        except Exception as e:
            logger.error(f"Erro ao renderizar tagline: {e}")

    final_image = canvas.convert('RGB')
    return final_image, composition_data

def compose_all_formats_assigned(
    files_bytes: dict, 
    assignments: dict, 
    selected_folder: str,
    selected_logo_filename: str,
    overrides: dict = None
) -> dict[str, dict]:
    if overrides is None:
        overrides = {}
        
    analysis_A = ia_service.analyze(files_bytes['imageA'])
    analysis_B = ia_service.analyze(files_bytes['imageB'])
    images = {'imageA': Image.open(io.BytesIO(files_bytes['imageA'])), 'imageB': Image.open(io.BytesIO(files_bytes['imageB']))}
    analyses = {'imageA': analysis_A, 'imageB': analysis_B}
    
    logo_folder_path = os.path.join(LOGOS_BASE_PATH, selected_folder)
    available_logos = {}
    try:
        for filename in os.listdir(logo_folder_path):
            if any(filename.lower().endswith(ext) for ext in ['.png', '.svg']):
                with open(os.path.join(logo_folder_path, filename), "rb") as f:
                    available_logos[filename] = f.read()
    except Exception as e:
         raise ValueError(f"Não foi possível ler os logos da pasta {selected_folder}: {e}")

    if not available_logos:
        raise ValueError(f"Nenhum logo válido (.png, .svg) encontrado na pasta {selected_folder}")

    output_data = {}
    for fmt_config in FORMAT_CONFIG:
        format_name_with_ext = fmt_config['name'] + ".jpg"
        assigned_image_key = assignments.get(format_name_with_ext)
        if not assigned_image_key:
            continue
            
        image_to_process = images[assigned_image_key]
        analysis_to_use = analyses[assigned_image_key]
        format_override = overrides.get(format_name_with_ext, {})
        
        white_logo_candidates = ['white.png', 'branco.png', 'logo_white.png']
        dark_logo_candidates = ['dark.png', 'preto.png', 'logo_dark.png', 'logo.png', 'logo_color.png']
        
        logo_bytes_to_use = None
        if selected_logo_filename in available_logos:
            logo_bytes_to_use = available_logos[selected_logo_filename]
        else:
            logo_placement_suggestion = ia_service.analyze_logo_placement_area(image_to_process, fmt_config)
            if logo_placement_suggestion == 'light':
                for name in white_logo_candidates:
                    if name in available_logos:
                        logo_bytes_to_use = available_logos[name]; break
            elif logo_placement_suggestion == 'dark':
                for name in dark_logo_candidates:
                    if name in available_logos:
                        logo_bytes_to_use = available_logos[name]; break
            
            if not logo_bytes_to_use and available_logos:
                fallback_logo_name = list(available_logos.keys())[0]
                logo_bytes_to_use = available_logos[fallback_logo_name]
                logger.warning(f"Usando fallback de logo: '{fallback_logo_name}' para o formato '{fmt_config['name']}'")

        composed_image, composition_data = compose_single_format(
            image_to_process, 
            analysis_to_use, 
            fmt_config, 
            logo_bytes_to_use,
            overrides=format_override
        )
        
        buffer = io.BytesIO()
        composed_image.save(buffer, format='JPEG', quality=90)
        
        output_data[format_name_with_ext] = {
            "image_bytes": buffer.getvalue(),
            "composition_data": composition_data
        }

    return output_data