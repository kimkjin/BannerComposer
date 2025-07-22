import base64
import json
import logging
import os
from PIL import Image
import io
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Response 
from ...services import composition_service, ia_service
from ...models.schemas import ClientLog
from ...services import zip_service
from ...services.composition_service import FORMAT_CONFIG

router = APIRouter()
logger = logging.getLogger(__name__)
LOGOS_BASE_PATH = "app/static/logos"
FONTS_BASE_PATH = "app/static/fonts" # Constante para a pasta de fontes

@router.post("/log-client-error")
async def log_client_error(log: ClientLog):
    logger.error(f"--- ERRO RECEBIDO DO CLIENTE (FRONTEND) ---")
    logger.error(f"Nome do Erro: {log.name}")
    logger.error(f"Mensagem: {log.message}")    
    logger.error(f"Stack Trace: \n{log.stack}")
    logger.error(f"Component Stack: \n{log.componentStack}")
    logger.error(f"--- FIM DO ERRO DO CLIENTE ---")
    return {"status": "log received"}

@router.get("/get-formats-config")
async def get_formats_config():
    if not FORMAT_CONFIG:
        raise HTTPException(status_code=500, detail="A configuração de formatos não foi carregada no servidor.")
    return FORMAT_CONFIG

@router.get("/list-fonts")
async def list_fonts(query: str = ""):
    """Lista os arquivos de fonte (.ttf, .otf) disponíveis no servidor."""
    try:
        if not os.path.exists(FONTS_BASE_PATH) or not os.path.isdir(FONTS_BASE_PATH):
            logger.warning(f"Diretório de fontes não encontrado ou não é um diretório: {FONTS_BASE_PATH}")
            return {"fonts": []}

        valid_extensions = ['.ttf', '.otf']
        all_fonts = [f for f in os.listdir(FONTS_BASE_PATH) if os.path.isfile(os.path.join(FONTS_BASE_PATH, f)) and any(f.lower().endswith(ext) for ext in valid_extensions)]
        
        if query:
            def normalize_name(name): return name.split('.')[0].replace('-', ' ').lower()
            filtered_fonts = [font for font in all_fonts if query.lower() in normalize_name(font)]
            results = sorted(filtered_fonts)
        else:
            results = sorted(all_fonts)
        return {"fonts": results}
    except Exception as e:
        logger.error(f"Erro ao listar fontes: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Erro interno ao buscar fontes.")

@router.post("/test-recognition")
async def test_recognition(
    file: UploadFile = File(...), 
    format_name: str = Form(...)
):
    try:
        fmt_config = next((fmt for fmt in FORMAT_CONFIG if fmt['name'] == format_name), None)
        if not fmt_config:
            raise HTTPException(status_code=404, detail=f"Formato '{format_name}' não encontrado.")
        image_bytes = await file.read()
        annotated_image_bytes = ia_service.draw_detections_on_image(image_bytes, fmt_config)
        return Response(content=annotated_image_bytes, media_type="image/jpeg")
    except Exception as e:
        logger.error(f"Erro na rota /test-recognition: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno no servidor: {str(e)}")

@router.post("/generate-previews")
async def generate_previews(
    imageA: UploadFile = File(...),
    imageB: UploadFile = File(...),
    assignments: UploadFile = File(...),
    selected_folder: str = Form(...),
    selected_logo_filename: str = Form(...),
    overrides: UploadFile = File(...) 
):
    try:
        files_bytes = { "imageA": await imageA.read(), "imageB": await imageB.read() }
        assignments_dict = json.loads(await assignments.read())
        overrides_dict = json.loads(await overrides.read())

        composed_data = composition_service.compose_all_formats_assigned(
            files_bytes,
            assignments_dict,
            selected_folder,
            selected_logo_filename,
            overrides=overrides_dict
        )
        
        formats_map = {fmt['name']: fmt for fmt in composition_service.FORMAT_CONFIG}
        previews_data = {}
        
        # O loop agora processa TODOS os formatos, incluindo BRAND_LOGO
        for name, data_dict in composed_data.items():
            format_name_key = name.replace('.jpg', '')
            previews_data[name] = {
                "data": base64.b64encode(data_dict['image_bytes']).decode('utf-8'),
                "width": formats_map[format_name_key].get('width'),
                "height": formats_map[format_name_key].get('height'),
                "composition_data": data_dict['composition_data']
            }
            
        return {"previews": previews_data}
    except Exception as e:
        logger.error(f"Erro na rota /generate-previews: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno no servidor: {str(e)}")
    
@router.post("/generate-single-preview")
async def generate_single_preview(
    file: UploadFile = File(...),
    format_name: str = Form(...),
    selected_folder: str = Form(...),
    selected_logo_filename: str = Form(...),
    overrides: UploadFile = File(...)
):
    try:
        fmt_config = next((fmt for fmt in FORMAT_CONFIG if fmt['name'] == format_name), None)
        if not fmt_config:
            raise HTTPException(status_code=404, detail=f"Formato '{format_name}' não encontrado.")

        image_bytes = await file.read()
        overrides_bytes = await overrides.read()
        overrides_dict = json.loads(overrides_bytes)
        
        format_override = overrides_dict.get(f"{format_name}.jpg", {})

        image_to_process = Image.open(io.BytesIO(image_bytes))
        analysis_to_use = ia_service.analyze(image_bytes)
        
        logo_path = os.path.join(LOGOS_BASE_PATH, selected_folder, selected_logo_filename)
        with open(logo_path, "rb") as f:
            logo_bytes_to_use = f.read()

        composed_image, _ = composition_service.compose_single_format(
            image_to_process,
            analysis_to_use,
            fmt_config,
            logo_bytes_to_use,
            overrides=format_override
        )
        
        buffer = io.BytesIO()
        composed_image.save(buffer, format='JPEG', quality=90)
        buffer.seek(0)

        return Response(content=buffer.getvalue(), media_type="image/jpeg")

    except Exception as e:
        logger.error(f"Erro na rota /generate-single-preview: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno no servidor: {str(e)}")

@router.get("/list-logo-folders")
async def list_logo_folders(query: str = ""):
    try:
        all_folders = [d for d in os.listdir(LOGOS_BASE_PATH) if os.path.isdir(os.path.join(LOGOS_BASE_PATH, d))]
        
        if query:
            filtered_folders = [folder for folder in all_folders if query.lower() in folder.lower()]
            results = sorted(filtered_folders)
        else:
            results = sorted(all_folders)

        return {"folders": results[:10]}
        
    except FileNotFoundError:
        logger.error(f"Diretório de logos não encontrado em: {LOGOS_BASE_PATH}")
        raise HTTPException(status_code=404, detail="Diretório de logos não encontrado.")

# --- FUNÇÃO ATUALIZADA ---
@router.get("/list-logos/{folder_name}")
async def list_logos_in_folder(folder_name: str):
    """Lista os logos válidos (PNG, SVG) de uma pasta, removendo o espaço transparente extra."""
    folder_path = os.path.join(LOGOS_BASE_PATH, folder_name)
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=404, detail="Pasta da marca não encontrada.")

    valid_extensions = ['.png', '.svg']
    logos = []
    for filename in os.listdir(folder_path):
        if any(filename.lower().endswith(ext) for ext in valid_extensions):
            try:
                # Lógica para remover espaço transparente
                with open(os.path.join(folder_path, filename), "rb") as f:
                    original_logo_bytes = f.read()

                # Usa a biblioteca Pillow para abrir a imagem
                logo_image = Image.open(io.BytesIO(original_logo_bytes)).convert("RGBA")
                
                # Encontra a caixa delimitadora dos pixels visíveis
                bbox = logo_image.getbbox()
                
                final_image_to_encode = logo_image
                if bbox:
                    # Se uma caixa foi encontrada, recorta a imagem para essa caixa
                    final_image_to_encode = logo_image.crop(bbox)

                # Salva a imagem recortada (ou a original se não houver recorte) em um buffer na memória
                buffer = io.BytesIO()
                # Salva como PNG para manter a transparência
                final_image_to_encode.save(buffer, format="PNG")
                cropped_logo_bytes = buffer.getvalue()
                
                # Codifica os bytes da *nova imagem recortada* para Base64
                logo_b64 = base64.b64encode(cropped_logo_bytes).decode('utf-8')
                
                # Para SVGs, a lógica de recorte do Pillow não se aplica, então usamos o original
                if filename.lower().endswith('.svg'):
                    logo_b64 = base64.b64encode(original_logo_bytes).decode('utf-8')

                file_type = 'svg+xml' if filename.lower().endswith('.svg') else 'png'
                
                logos.append({
                    "filename": filename,
                    "data": f"data:image/{file_type};base64,{logo_b64}"
                })
            except Exception as e:
                logger.error(f"Erro ao processar o logo {filename}: {e}")
                # Pode optar por pular este logo ou enviar o original sem recorte
                continue
                
    return {"logos": logos}