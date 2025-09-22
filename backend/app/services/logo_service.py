import os
import base64
import io
import logging
from PIL import Image
from fastapi import HTTPException

logger = logging.getLogger(__name__)
LOGOS_BASE_PATH = "app/static/logos"

def list_logo_folders(query: str = ""):
    """
    Lista as pastas de logos, opcionalmente filtradas por uma query.
    """
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

def list_logos_in_folder(folder_name: str):
    """
    Lista os logos válidos (PNG, SVG) de uma pasta, removendo o espaço transparente extra.
    """
    folder_path = os.path.join(LOGOS_BASE_PATH, folder_name)
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=404, detail="Pasta da marca não encontrada.")

    valid_extensions = ['.png', '.svg']
    logos = []
    for filename in os.listdir(folder_path):
        if any(filename.lower().endswith(ext) for ext in valid_extensions):
            try:
                with open(os.path.join(folder_path, filename), "rb") as f:
                    original_logo_bytes = f.read()

                if filename.lower().endswith('.png'):
                    logo_image = Image.open(io.BytesIO(original_logo_bytes)).convert("RGBA")
                    bbox = logo_image.getbbox()
                    
                    final_image_to_encode = logo_image
                    if bbox:
                        final_image_to_encode = logo_image.crop(bbox)

                    buffer = io.BytesIO()
                    final_image_to_encode.save(buffer, format="PNG")
                    processed_logo_bytes = buffer.getvalue()
                    logo_b64 = base64.b64encode(processed_logo_bytes).decode('utf-8')
                    file_type = 'png'
                else: # SVG
                    logo_b64 = base64.b64encode(original_logo_bytes).decode('utf-8')
                    file_type = 'svg+xml'
                
                logos.append({
                    "filename": filename,
                    "data": f"data:image/{file_type};base64,{logo_b64}"
                })
            except Exception as e:
                logger.error(f"Erro ao processar o logo {filename}: {e}")
                continue
                
    return {"logos": logos}
