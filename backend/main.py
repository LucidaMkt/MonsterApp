
# backend/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import google.generativeai as genai
from openai import OpenAI
import os # Importar o módulo os

# 1. Inicialização da Aplicação FastAPI
app = FastAPI(
    title="MonsterApp API",
    description="Backend para a extensão MonsterApp, gerenciando dados de monstros e integrando IA.",
    version="1.0.0"
)

# 2. Configuração do CORS (Cross-Origin Resource Sharing)
# ESSENCIAL para permitir que a extensão do navegador se comunique com esta API.     
origins = [
    # Adicione aqui o ID da sua extensão quando souber.
    # Exemplo: "chrome-extension://abcdefghijklmnoabcdefhijklmnoabc"
    "*" # Usar "*" durante o desenvolvimento para permitir qualquer origem.
        # Para produção, restrinja para o ID da sua extensão.
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Permite todos os métodos (GET, POST, etc)
    allow_headers=["*"], # Permite todos os cabeçalhos
)

# 3. Modelo de Dados (usando Pydantic)
# Define a estrutura de um "Monstro". Isso garante validação automática dos dados.   
class Monster(BaseModel):
    id: int
    name: str
    description: str
    level: int

class PromptRequest(BaseModel):
    prompt: str

# 4. "Banco de Dados" em memória (para fins de exemplo)
# No futuro, isso pode ser substituído por um banco de dados real (SQLite, PostgreSQL, etc.)
db: List[Monster] = [
    Monster(id=1, name="Draco", description="Um dragão cuspidor de fogo.", level=15),
    Monster(id=2, name="Goblin", description="Uma criatura pequena e astuta.", level=2),
]

# 5. Configuração das APIs de IA (Lendo de variáveis de ambiente)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Verificação para garantir que as chaves foram carregadas
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY não está definida nas variáveis de ambiente.")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY não está definida nas variáveis de ambiente.")

genai.configure(api_key=GEMINI_API_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# 6. Endpoints da API
@app.get("/", tags=["Root"])
def read_root():
    """Endpoint raiz para verificar se a API está online."""
    return {"status": "API da MonsterApp está funcionando!"}

@app.get("/api/monsters", response_model=List[Monster], tags=["Monsters"])
def get_all_monsters():
    """Retorna a lista de todos os monstros."""
    return db

@app.post("/api/monsters", response_model=Monster, status_code=201, tags=["Monsters"])
def create_monster(monster: Monster):
    """Cria um novo monstro e o adiciona à base de dados."""
    db.append(monster)
    return monster

@app.post("/api/gemini/generate_text", tags=["AI"])
async def generate_text_gemini(request: PromptRequest):
    """Gera texto usando o modelo Gemini."""
    try:
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(request.prompt)
        return {"generated_text": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar texto com Gemini: {str(e)}")

@app.post("/api/openai/generate_text", tags=["AI"])
async def generate_text_openai(request: PromptRequest):
    """Gera texto usando o modelo OpenAI (ChatGPT)."""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo", # Ou outro modelo como "gpt-4"
            messages=[
                {"role": "user", "content": request.prompt}
            ]
        )
        return {"generated_text": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar texto com OpenAI: {str(e)}")
