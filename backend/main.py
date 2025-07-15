# backend/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
from openai import OpenAI
import os
import re

# 1. Inicialização da Aplicação FastAPI
app = FastAPI(
    title="MonsterApp API",
    description="Backend para a extensão MonsterApp, agora com uma arquitetura de agentes de IA.",
    version="2.0.0"
)

# 2. Configuração do CORS
origins = ["*"] # Simplificado para desenvolvimento
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Modelos de Dados para os Agentes (Pydantic)

# Modelo para o Agente de Copywriting (ChatGPT)
class GenerateCopyRequest(BaseModel):
    prompt: str
    tone: str
    niche: str
    profile_data: Optional[dict] = None

# Modelo para o Agente de Pesquisa (Gemini)
class HashtagResearchRequest(BaseModel):
    topic: str
    niche: Optional[str] = None
    profile_data: Optional[dict] = None

# Modelo para o Agente de Design (DALL-E)
class GenerateImageRequest(BaseModel):
    prompt: str
    style: Optional[str] = "photo-realistic" # Ex: photo-realistic, cartoon, abstract

# 4. Configuração das APIs de IA
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY não está definida nas variáveis de ambiente.")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY não está definida nas variáveis de ambiente.")

genai.configure(api_key=GEMINI_API_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# 5. Endpoints da API dos Agentes

@app.get("/", tags=["Root"])
def read_root():
    """Verifica se a API está online."""
    return {"status": "API de Agentes da MonsterApp está funcionando!"}

@app.post("/gerar-copy-social-media", tags=["Agents"])
async def generate_social_media_copy(request: GenerateCopyRequest):
    """
    Agente de Copywriting (ChatGPT): Gera texto para redes sociais.
    """
    try:
        system_message = "Você é um copywriter profissional especializado em conteúdo para redes sociais que engaja."
        user_message = f"Crie uma legenda para um post com base no seguinte:\n" \
                       f"- Tópico principal: {request.prompt}\n" \
                       f"- Tom de voz: {request.tone}\n"

        if request.niche and request.niche != 'autodetect':
            user_message += f"- Nicho de mercado: {request.niche}\n"
        if request.profile_data:
            user_message += f"- Informações do perfil para dar contexto: {request.profile_data}\n"

        user_message += "A legenda deve ser criativa, clara e otimizada para a plataforma."

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
        )
        return {"copy": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no Agente de Copywriting: {str(e)}")

@app.post("/pesquisar-hashtags", tags=["Agents"])
async def research_hashtags(request: HashtagResearchRequest):
    """
    Agente de Pesquisa (Gemini): Encontra as melhores hashtags para um tópico.
    """
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = f"Você é um especialista em social media. Sua tarefa é encontrar as 30 melhores hashtags para um post sobre '{request.topic}'."
        
        if request.niche:
            prompt += f" O nicho é '{request.niche}'."
        if request.profile_data and request.profile_data.get('bio'):
             prompt += f" A bio do perfil é '{request.profile_data['bio']}' para te dar mais contexto sobre o público."

        prompt += " Retorne apenas as hashtags, separadas por espaços, começando com #. Exemplo: #marketing #socialmedia #dicas"

        response = model.generate_content(prompt)
        # Limpeza para garantir que só temos hashtags
        hashtags = re.findall(r'#\w+', response.text)
        return {"hashtags": hashtags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no Agente de Pesquisa de Hashtags: {str(e)}")

@app.post("/gerar-imagem", tags=["Agents"])
async def generate_image(request: GenerateImageRequest):
    """
    Agente de Design (DALL-E): Cria uma imagem com base em uma descrição.
    """
    try:
        # Adapta o prompt para o estilo desejado
        full_prompt = f"Uma imagem no estilo '{request.style}' descrevendo: {request.prompt}. "
        full_prompt += "A imagem deve ser vibrante, de alta qualidade e adequada para postagem em redes sociais como o Instagram."

        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=full_prompt,
            n=1,
            size="1024x1024", # Formato quadrado padrão para redes sociais
            quality="hd" # Solicita maior detalhe
        )
        image_url = response.data[0].url
        return {"image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no Agente de Design: {str(e)}")
