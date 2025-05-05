import json
import firebase_admin
from firebase_admin import credentials, firestore

# 서비스 계정 키 파일 경로 (반드시 본인 환경에 맞게 수정)
cred = credentials.Certificate("./secret/serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# 카페 데이터 파일 읽기
with open("cafes.json", "r", encoding="utf-8") as f:
    cafes = json.load(f)

# Firestore에 업로드
for cafe in cafes:
    doc_ref = db.collection("cafes").document(cafe["name"])
    doc_ref.set(cafe)

print("카페 데이터 업로드 완료!")