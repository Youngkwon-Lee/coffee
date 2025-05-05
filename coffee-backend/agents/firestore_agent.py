import firebase_admin
from firebase_admin import credentials, firestore

def save_beans(beans: list):
    # 이미 초기화된 경우 중복 방지
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    for bean in beans:
        # beans 컬렉션에 저장 (name+brand 조합을 문서ID로 사용)
        doc_id = f"{bean['brand']}_{bean['name']}".replace(" ", "_")
        db.collection("beans").document(doc_id).set(bean)
    print(f"Firestore 저장 완료! ({len(beans)}개)")