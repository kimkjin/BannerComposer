from PIL import Image
import io
import json
import logging
import os
from . import ia_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Carregamento e Pré-processamento da Configuração de Formatos ---
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

def compose_single_format(original_image: Image.Image, analysis: dict, fmt_config: dict, logo_bytes: bytes) -> Image.Image:
    """Aplica a regra de composição final com escala e alinhamento baseados no sujeito."""
    
    rules = fmt_config.get('rules', {})
    rule_type = rules.get('type', 'full_bleed')
    canvas_w, canvas_h = fmt_config['width'], fmt_config['height']
    canvas = Image.new('RGB', (canvas_w, canvas_h), 'white')
    
    focus_point_x, _ = analysis['focus_point']
    main_box = analysis.get('main_box', None) 

    if 'logo_only' not in rule_type:
        img_w, img_h = original_image.size
        
        # --- LÓGICA DE ESCALA FINAL ---
        # 1. Calcular a escala horizontal necessária para centralização
        if rule_type == 'standard' and 'logo_area' in rules:
            margin = rules.get('margin', {'x': 0, 'y': 20})
            logo_area = rules['logo_area']
            comp_area_start_x = margin['x'] + logo_area['width'] + margin.get('y')
            comp_area_end_x = canvas_w - margin.get('y')
            target_x_on_canvas = comp_area_start_x + (comp_area_end_x - comp_area_start_x) / 2
        else:
            target_x_on_canvas = canvas_w / 2
        
        scale_x_left = target_x_on_canvas / focus_point_x if focus_point_x > 0 else 1.0
        scale_x_right = (canvas_w - target_x_on_canvas) / (img_w - focus_point_x) if (img_w - focus_point_x) > 0 else 1.0
        scale_x = max(scale_x_left, scale_x_right)

        # 2. Calcular a escala vertical para ajustar o SUJEITO (person_box) à ÁREA DE COMPOSIÇÃO
        scale_y = canvas_h / img_h # Fallback
        if main_box and rule_type == 'standard':
            margin = rules.get('margin', {'x': 0, 'y': 20})
            person_box_h = main_box[3] - main_box[1]
            comp_area_h = canvas_h - (margin.get('y') * 2)
            if person_box_h > 0 and comp_area_h > 0:
                scale_y = comp_area_h / person_box_h
        
        # 3. A escala final é a maior para cumprir todas as regras
        scale = max(scale_x, scale_y)
        
        new_w, new_h = int(img_w * scale), int(img_h * scale)
        resized_image = original_image.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        focus_x_scaled = int(focus_point_x * scale)
        
        # --- LÓGICA DE POSICIONAMENTO FINAL ---
        paste_x = int(target_x_on_canvas - focus_x_scaled)
        
        # O posicionamento Y agora usa o topo da CAIXA DE DETECÇÃO, não o topo da cabeça
        if main_box and rule_type == 'standard':
            margin = rules.get('margin', {'x': 0, 'y': 20})
            box_top_y_scaled = main_box[1] * scale
            paste_y = int(margin.get('y') - box_top_y_scaled)
        else:
            # Fallback para o método antigo se não houver caixa
            subject_top_y_scaled = analysis['subject_top_y'] * scale
            paste_y = int(rules.get('margin', {}).get('y', 20) - subject_top_y_scaled)

        # "PRENDER" (CLAMP) O POSICIONAMENTO DENTRO DOS LIMITES VÁLIDOS
        left_bound = canvas_w - new_w; right_bound = 0
        top_bound = canvas_h - new_h; bottom_bound = 0
        
        paste_x = max(left_bound, min(paste_x, right_bound))
        paste_y = max(top_bound, min(paste_y, bottom_bound))
        
        canvas.paste(resized_image, (paste_x, paste_y))

    # --- Posicionamento do logo e casos especiais ---
    if logo_bytes and rule_type not in ['full_bleed', 'logo_only_fill']:
        try:
            logo_image = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
            logo_area = rules['logo_area']
            logo_image.thumbnail((logo_area['width'], logo_area['height']), Image.Resampling.LANCZOS)
            if rule_type == 'centered_logo':
                logo_x = int((canvas_w - logo_image.width) / 2)
                logo_y = rules['margin']['y']
            else:
                logo_x = rules['margin']['x']
                logo_y = rules['margin']['y']
            canvas.paste(logo_image, (logo_x, logo_y), logo_image)
        except Exception as e:
            logger.error(f"Erro ao aplicar logo para o formato '{fmt_config['name']}': {e}")
            
    if rule_type == 'logo_only_centered' and logo_bytes:
        logo_image = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
        logo_image.thumbnail((canvas_w - 40, canvas_h - 40), Image.Resampling.LANCZOS)
        logo_x = int((canvas_w - logo_image.width) / 2)
        logo_y = int((canvas_h - logo_image.height) / 2)
        canvas.paste(logo_image, (logo_x, logo_y), logo_image)
        
    if rule_type == 'logo_only_fill' and logo_bytes:
        logo_image = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
        resized_logo = logo_image.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
        canvas.paste(resized_logo, (0, 0))
    return canvas

def compose_all_formats_assigned(files_bytes: dict, assignments: dict, selected_folder: str, selected_logo_filename: str) -> dict[str, bytes]:
    logger.info("Iniciando a análise das imagens A e B...")
    analysis_A = ia_service.analyze(files_bytes['imageA'])
    analysis_B = ia_service.analyze(files_bytes['imageB'])
    
    images = {'imageA': Image.open(io.BytesIO(files_bytes['imageA'])), 'imageB': Image.open(io.BytesIO(files_bytes['imageB']))}
    analyses = {'imageA': analysis_A, 'imageB': analysis_B}

    logger.info(f"Análise concluída. Carregando logos da pasta: {selected_folder}")
    
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

    logger.info(f"Composição dos formatos iniciada. Logo selecionado pelo usuário: {selected_logo_filename}")
    output_images = {}
    
    for fmt_config in FORMAT_CONFIG:
        format_name_with_ext = fmt_config['name'] + ".jpg"
        assigned_image_key = assignments.get(format_name_with_ext)

        if not assigned_image_key:
            logger.warning(f"Formato '{format_name_with_ext}' não foi encontrado nas atribuições. Pulando.")
            continue
            
        image_to_process = images[assigned_image_key]
        analysis_to_use = analyses[assigned_image_key]
        
        logo_placement_suggestion = ia_service.analyze_logo_placement_area(image_to_process, fmt_config)
        
        white_logo_candidates = ['white.png', 'branco.png', 'logo_white.png']
        dark_logo_candidates = ['dark.png', 'preto.png', 'logo_dark.png', 'logo.png', 'logo_color.png']
        
        logo_bytes_to_use = None
        if selected_logo_filename in available_logos:
            logo_bytes_to_use = available_logos[selected_logo_filename]
        else:
            if logo_placement_suggestion == 'light':
                for name in white_logo_candidates:
                    if name in available_logos:
                        logo_bytes_to_use = available_logos[name]; break
            elif logo_placement_suggestion == 'dark':
                for name in dark_logo_candidates:
                    if name in available_logos:
                        logo_bytes_to_use = available_logos[name]; break
            if not logo_bytes_to_use:
                fallback_logo_name = list(available_logos.keys())[0]
                logo_bytes_to_use = available_logos[fallback_logo_name]
                logger.warning(f"Usando fallback de logo: '{fallback_logo_name}' para o formato '{fmt_config['name']}'")

        composed_image = compose_single_format(image_to_process, analysis_to_use, fmt_config, logo_bytes_to_use)
        
        buffer = io.BytesIO()
        composed_image.save(buffer, format='JPEG', quality=90)
        output_images[f"{fmt_config['name']}.jpg"] = buffer.getvalue()
        
    logger.info("Composição de todos os formatos concluída com sucesso.")
    return output_images