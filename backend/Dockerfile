# backend/Dockerfile

# Usamos uma imagem oficial e leve do Python
FROM python:3.11-slim

# Define o diretório de trabalho dentro do contêiner
WORKDIR /code

# Copia o arquivo de dependências e as instala
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copia todo o resto do código do backend
COPY ./app /code/app
COPY ./main.py /code/main.py

# Comando para iniciar a aplicação quando o contêiner rodar
CMD gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT