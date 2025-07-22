from pydantic import BaseModel
from typing import List, Tuple, Optional

class DetectionBox(BaseModel):
    """Define a estrutura de uma única caixa de detecção."""
    box: Tuple[int, int, int, int]  # (x1, y1, x2, y2)
    label: str

class ImageAnalysisResult(BaseModel):
    """Define a estrutura completa dos resultados da análise de imagem."""
    detections: List[DetectionBox]
    focus_point: Tuple[int, int]
    image_width: int
    image_height: int

class ClientLog(BaseModel):
    name: Optional[str] = None
    message: Optional[str] = None
    stack: Optional[str] = None
    componentStack: Optional[str] = None