import os
from fastapi import FastAPI
from pydantic import BaseModel
import openai
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# .env 파일에서 OPENAI_API_KEY 불러오기
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# 최신 openai 방식
client = openai.OpenAI(api_key=OPENAI_API_KEY)

# Firestore 초기화
cred = credentials.Certificate('secret/serviceAccountKey.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

app = FastAPI()

class ChatRequest(BaseModel):
    message: str

@app.post("/recommend")
def recommend_chat(req: ChatRequest):
    # Firestore에서 원두 데이터 불러오기
    beans_ref = db.collection('beans')
    beans = [doc.to_dict() for doc in beans_ref.stream()]
    # GPT 프롬프트 생성
    prompt = f"""
    사용자가 '{req.message}'라고 했을 때, 아래 원두 리스트 중에서 감성적으로 어울리는 원두 1~3개를 추천해줘.\n각 원두에 대해 추천 이유도 한 줄로 설명해줘.\n아래 형식으로 답변해줘:\n\n- 원두명1: 추천 이유\n- 원두명2: 추천 이유\n- ...\n\n원두 리스트: {beans}
    """
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0.8,
    )
    return {"result": response.choices[0].message.content} 