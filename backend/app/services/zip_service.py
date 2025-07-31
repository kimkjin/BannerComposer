import io
import zipfile
from typing import Dict

def create_zip_from_images(images: Dict[str, bytes]) -> io.BytesIO:
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for name, data in images.items():
            zipf.writestr(name, data)
    
    return zip_buffer