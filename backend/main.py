# backend/main.py

import os
import re
import stripe # Importar a biblioteca Stripe
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# --- Adicionando os novos imports ---
from sqlalchemy import create_engine, Column, Integer, String, Enum, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from jose import JWTError, jwt
from datetime import datetime, timedelta
import enum

# --- Configuração do Banco de Dados (SQLite) ---
DATABASE_URL = "sqlite:///./monsterapp.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Modelos do Banco de Dados (SQLAlchemy) ---
class Plan(str, enum.Enum):
    FREE = "free"
    PRO = "pro"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    google_id = Column(String, unique=True, index=True)
    plan = Column(Enum(Plan), default=Plan.FREE, nullable=False)
    stripe_customer_id = Column(String, unique=True, nullable=True)

class ApiUsage(Base):
    __tablename__ = "api_usage"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    agent_name = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

# Cria as tabelas no banco de dados na primeira execução
Base.metadata.create_all(bind=engine)

# --- Configuração da Autenticação (JWT) ---
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "a_super_secret_key_for_development") # Use uma chave segura em produção
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 semana

from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- Funções de Dependência ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

# --- Funções de Limite de Uso ---
FREE_TIER_LIMITS = {
    "gerar-copy-social-media": 5,  # 5 usos por dia
    "pesquisar-hashtags": 5,       # 5 usos por dia
    "gerar-imagem": 2,             # 2 usos por dia
}

def check_and_log_usage(db: Session, user: User, agent_name: str):
    if user.plan == Plan.FREE:
        limit = FREE_TIER_LIMITS.get(agent_name, 0)
        if limit > 0:
            # Calcula o início do dia (UTC)
            start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            
            usage_count = db.query(ApiUsage).filter(
                ApiUsage.user_id == user.id,
                ApiUsage.agent_name == agent_name,
                ApiUsage.timestamp >= start_of_day
            ).count()

            if usage_count >= limit:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Limite de uso diário excedido para {agent_name}. Faça upgrade para o plano PRO para uso ilimitado."
                )
    
    # Registra o uso
    new_usage = ApiUsage(user_id=user.id, agent_name=agent_name)
    db.add(new_usage)
    db.commit()
    db.refresh(new_usage)

# --- Pydantic Models ---
class TokenData(BaseModel):
    email: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    token: str # O token ID do Google

class GenerateCopyRequest(BaseModel):
    prompt: str
    tone: str
    niche: Optional[str] = None
    profile_data: Optional[dict] = None

class HashtagResearchRequest(BaseModel):
    topic: str
    niche: Optional[str] = None
    profile_data: Optional[dict] = None

class GenerateImageRequest(BaseModel):
    prompt: str
    style: str

# --- Funções de Autenticação ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Inicialização da Aplicação FastAPI ---
app = FastAPI(
    title="MonsterApp API",
    description="Backend para a extensão MonsterApp com autenticação e agentes de IA.",
    version="3.0.0"
)

# Configuração do CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir todas as origens por enquanto, ajustar para produção
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuração das APIs de IA ---
# Carrega as variáveis de ambiente do arquivo .env
from dotenv import load_dotenv
load_dotenv()

# Configuração da API Gemini
import google.generativeai as genai
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Configuração da API OpenAI
from openai import OpenAI
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Configuração do Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# --- Endpoints de Autenticação e Usuário ---
@app.post("/auth/google", tags=["Authentication"])
async def login_with_google(request: GoogleLoginRequest, db: Session = Depends(get_db)):
    # Em um cenário real, você validaria o token do Google aqui
    # usando a biblioteca google-auth. Por simplicidade, vamos pular a validação.
    # Exemplo de como seria a validação:
    # from google.oauth2 import id_token
    # from google.auth.transport import requests
    # try:
    #     idinfo = id_token.verify_oauth2_token(request.token, requests.Request(), "YOUR_GOOGLE_CLIENT_ID")
    #     user_email = idinfo['email']
    #     google_id = idinfo['sub']
    # except ValueError:
    #     raise HTTPException(status_code=401, detail="Token inválido")

    # Simulação (usaremos um email falso por enquanto)
    user_email = f"user_{hash(request.token)}@example.com"
    google_id = str(hash(request.token))

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = User(email=user_email, google_id=google_id, plan=Plan.FREE)
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

class UserSchema(BaseModel):
    email: str
    plan: Plan

    class Config:
        orm_mode = True

class StripeCheckoutRequest(BaseModel):
    price_id: str
    success_url: str
    cancel_url: str

class CompetitorAnalysisRequest(BaseModel):
    username: str
    bio: Optional[str] = None
    followers: Optional[str] = None
    following: Optional[str] = None
    posts: Optional[str] = None
    recent_captions: Optional[list[str]] = None

class SuggestTopicsRequest(BaseModel):
    niche: Optional[str] = None
    user_profile_data: Optional[dict] = None
    competitor_profile_data: Optional[dict] = None

class GenerateCopyVariationsRequest(BaseModel):
    original_copy: str

@app.get("/users/me", response_model=UserSchema, tags=["Users"])
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Retorna os dados do usuário logado."""
    return current_user

@app.post("/create-checkout-session", tags=["Stripe"])
async def create_checkout_session(request: StripeCheckoutRequest, current_user: User = Depends(get_current_user)):
    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=[
                {
                    'price': request.price_id,
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            customer_email=current_user.email, # Preenche o email do cliente
            client_reference_id=str(current_user.id) # Referência para o seu usuário
        )
        return {"checkout_url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar sessão de checkout: {str(e)}")

@app.post("/analyze-competitor-profile", tags=["Agents"])
async def analyze_competitor_profile(request: CompetitorAnalysisRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_and_log_usage(db, current_user, "analyze-competitor-profile")
    """
    Agente de Pesquisa (Gemini - PRO Feature): Analisa o perfil de um concorrente.
    """
    if current_user.plan == Plan.FREE:
        raise HTTPException(status_code=403, detail="Funcionalidade PRO. Faça upgrade para o plano PRO para usar a Análise de Concorrentes.")

    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = f"Analise o seguinte perfil de concorrente do Instagram e forneça insights sobre seu nicho, estilo de conteúdo e pontos fortes. Retorne a análise em formato de texto, com as seções: 'Nicho Identificado', 'Estilo de Conteúdo' e 'Insights Principais'.\n\n"
        prompt += f"Username: {request.username}\n"
        if request.bio: prompt += f"Bio: {request.bio}\n"
        if request.followers: prompt += f"Seguidores: {request.followers}\n"
        if request.following: prompt += f"Seguindo: {request.following}\n"
        if request.posts: prompt += f"Posts: {request.posts}\n"
        if request.recent_captions: prompt += f"Legendas Recentes: {', '.join(request.recent_captions)}\n"

        response = model.generate_content(prompt)
        
        # Parse Gemini's response
        response_text = response.text
        niche_match = re.search(r"Nicho Identificado:\s*(.*)", response_text)
        style_match = re.search(r"Estilo de Conteúdo:\s*(.*)", response_text)
        insights_match = re.search(r"Insights Principais:\s*(.*)", response_text, re.DOTALL)

        niche = niche_match.group(1).strip() if niche_match else "Não identificado"
        style = style_match.group(1).strip() if style_match else "Não identificado"
        insights = insights_match.group(1).strip().split('\n') if insights_match else ["Nenhum insight disponível."]
        insights = [re.sub(r"^\d+\.\s*", "", s).strip() for s in insights if s.strip()]

        return {
            "username": request.username,
            "niche_identified": niche,
            "content_style_analysis": style,
            "insights": insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no Agente de Análise de Concorrentes: {str(e)}")

@app.post("/suggest-content-topics", tags=["Agents"])
async def suggest_content_topics(request: SuggestTopicsRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_and_log_usage(db, current_user, "suggest-content-topics")
    """
    Agente de Pesquisa (Gemini - PRO Feature): Sugere tópicos de conteúdo.
    """
    if current_user.plan == Plan.FREE:
        raise HTTPException(status_code=403, detail="Funcionalidade PRO. Faça upgrade para o plano PRO para usar a Sugestão de Tópicos.")

    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = "Gere 5 ideias de tópicos de conteúdo para redes sociais. "
        
        if request.niche:
            prompt += f"O nicho principal é '{request.niche}'. "
        if request.user_profile_data:
            prompt += f"O perfil do usuário tem a seguinte bio: {request.user_profile_data.get('bio', '')}. "
            if request.user_profile_data.get('recent_captions'):
                prompt += f"Legendas recentes do usuário: {', '.join(request.user_profile_data['recent_captions'])}. "
        if request.competitor_profile_data:
            prompt += f"Considere também o perfil do concorrente: {request.competitor_profile_data.get('username', '')} com bio: {request.competitor_profile_data.get('bio', '')}. "
            if request.competitor_profile_data.get('recent_captions'):
                prompt += f"Legendas recentes do concorrente: {', '.join(request.competitor_profile_data['recent_captions'])}. "

        prompt += "Retorne apenas uma lista numerada de tópicos, um por linha."

        response = model.generate_content(prompt)
        topics = [line.strip() for line in response.text.split('\n') if line.strip()]
        topics = [re.sub(r"^\d+\.\s*", "", t).strip() for t in topics]

        return {"topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no Agente de Sugestão de Tópicos: {str(e)}")

@app.post("/generate-copy-variations", tags=["Agents"])
async def generate_copy_variations(request: GenerateCopyVariationsRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_and_log_usage(db, current_user, "generate-copy-variations")
    """
    Agente de Copywriting (ChatGPT - PRO Feature): Gera variações de uma copy.
    """
    if current_user.plan == Plan.FREE:
        raise HTTPException(status_code=403, detail="Funcionalidade PRO. Faça upgrade para o plano PRO para usar a Geração de Variações de Copy.")

    try:
        system_message = "Você é um copywriter criativo e versátil. Sua tarefa é gerar 3 variações da copy original, com diferentes tons (ex: mais formal, mais divertido, mais direto). Retorne as variações como uma lista numerada."
        user_message = f"Copy original: {request.original_copy}"

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
        )
        variations = [line.strip() for line in response.choices[0].message.content.split('\n') if line.strip()]
        variations = [re.sub(r"^\d+\.\s*", "", v).strip() for v in variations]

        return {"variations": variations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no Agente de Geração de Variações de Copy: {str(e)}")

# --- Endpoints dos Agentes de IA (Protegidos) ---

@app.post("/gerar-copy-social-media", tags=["Agents"])
async def generate_social_media_copy(request: GenerateCopyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_and_log_usage(db, current_user, "gerar-copy-social-media")
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
async def research_hashtags(request: HashtagResearchRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_and_log_usage(db, current_user, "pesquisar-hashtags")
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
async def generate_image(request: GenerateImageRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_and_log_usage(db, current_user, "gerar-imagem")
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

# --- Endpoints dos Agentes de IA (Protegidos) ---

@app.post("/gerar-copy-social-media", tags=["Agents"])
async def generate_social_media_copy(request: GenerateCopyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_and_log_usage(db, current_user, "gerar-copy-social-media")
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
async def research_hashtags(request: HashtagResearchRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_and_log_usage(db, current_user, "pesquisar-hashtags")
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
async def generate_image(request: GenerateImageRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_and_log_usage(db, current_user, "gerar-imagem")
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