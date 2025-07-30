from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from ...core.config import settings
import bcrypt
from jose import jwt
from datetime import datetime, timedelta
import json
import os

router = APIRouter()

USERS_FILE = 'users.json'
users_db = []
if os.path.exists(USERS_FILE):
    with open(USERS_FILE, 'r') as f:
        users_db = json.load(f)

class Token(BaseModel):
    access_token: str
    token_type: str

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=8)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt

@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):

    user = next((u for u in users_db if u['username'] == form_data.username), None)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
        )

    password_bytes = form_data.password.encode('utf-8')
    hashed_password_bytes = user['hashed_password'].encode('utf-8')
    
    if not bcrypt.checkpw(password_bytes, hashed_password_bytes):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
        )

    access_token = create_access_token(data={"sub": user['username']})
    
    return {"access_token": access_token, "token_type": "bearer"}