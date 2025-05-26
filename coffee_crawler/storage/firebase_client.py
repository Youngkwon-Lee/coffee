"""
Firebase 클라이언트 모듈

이 모듈은 Firebase Firestore와의 연결 및 데이터 관리 기능을 제공합니다.
"""

import os
import json
import yaml
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore, storage

# 로거 설정
logger = logging.getLogger(__name__)

class FirebaseClient:
    """Firebase Firestore 및 Storage 연결 및 관리를 위한 클라이언트 클래스"""
    
    def __init__(self, config_path: str = "config/firebase_config.yaml"):
        """
        FirebaseClient 초기화
        
        Args:
            config_path: Firebase 설정 파일 경로
        """
        self.config = self._load_config(config_path)
        self.app = self._initialize_firebase()
        self.db = firestore.client()
        self.bucket = None
        
        if self.config.get('firebase', {}).get('storage', {}).get('bucket_name'):
            self.bucket = storage.bucket(self.config['firebase']['storage']['bucket_name'])
        
        logger.info("Firebase 클라이언트 초기화 완료")
    
    def _load_config(self, config_path: str) -> Dict:
        """
        설정 파일 로드
        
        Args:
            config_path: 설정 파일 경로
            
        Returns:
            설정 딕셔너리
        """
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            return config
        except Exception as e:
            logger.error(f"설정 파일 로드 실패: {e}")
            raise
    
    def _initialize_firebase(self) -> firebase_admin.App:
        """
        Firebase 초기화
        
        Returns:
            Firebase 앱 인스턴스
        """
        # 이미 초기화된 경우
        if firebase_admin._apps:
            return firebase_admin._apps[0]
        
        try:
            auth_method = self.config['firebase']['auth_method']
            
            if auth_method == 'key_file':
                key_path = self.config['firebase']['key_file_path']
                cred = credentials.Certificate(key_path)
            elif auth_method == 'env_var':
                env_var = self.config['firebase']['credentials_env_var']
                cred_json = os.environ.get(env_var)
                if not cred_json:
                    raise ValueError(f"환경 변수 {env_var}가 설정되지 않았습니다.")
                cred_dict = json.loads(cred_json)
                cred = credentials.Certificate(cred_dict)
            else:
                raise ValueError(f"지원하지 않는 인증 방식: {auth_method}")
            
            return firebase_admin.initialize_app(cred)
        except Exception as e:
            logger.error(f"Firebase 초기화 실패: {e}")
            raise
    
    def get_bean(self, bean_id: str) -> Optional[Dict]:
        """
        원두 정보 조회
        
        Args:
            bean_id: 원두 ID
            
        Returns:
            원두 정보 딕셔너리
        """
        try:
            collection = self.config['firebase']['firestore']['collection_beans']
            doc_ref = self.db.collection(collection).document(bean_id)
            doc = doc_ref.get()
            
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"원두 정보 조회 실패: {e}")
            raise
    
    def get_beans(self, filter_dict: Optional[Dict] = None) -> List[Dict]:
        """
        원두 목록 조회
        
        Args:
            filter_dict: 필터링 조건
            
        Returns:
            원두 정보 목록
        """
        try:
            collection = self.config['firebase']['firestore']['collection_beans']
            query = self.db.collection(collection)
            
            if filter_dict:
                for key, value in filter_dict.items():
                    query = query.where(key, '==', value)
            
            docs = query.stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            logger.error(f"원두 목록 조회 실패: {e}")
            raise
    
    def add_bean(self, bean_data: Dict) -> str:
        """
        새 원두 정보 추가
        
        Args:
            bean_data: 원두 데이터 딕셔너리
            
        Returns:
            생성된, 또는 업데이트된 원두 ID
        """
        try:
            collection = self.config['firebase']['firestore']['collection_beans']
            
            # 기본 메타데이터 추가
            if 'createdAt' not in bean_data:
                bean_data['createdAt'] = datetime.now()
            
            bean_data['lastUpdated'] = datetime.now()
            
            # 원두명+브랜드를 기반으로 문서 ID 생성
            brand = bean_data.get('brand', '').replace(' ', '_')
            name = bean_data.get('name', '').replace(' ', '_')
            doc_id = f"{brand}_{name}"
            
            # 특수문자 제거
            doc_id = ''.join(c for c in doc_id if c.isalnum() or c == '_')
            
            doc_ref = self.db.collection(collection).document(doc_id)
            doc_ref.set(bean_data)
            
            logger.info(f"원두 정보 추가 완료: {doc_id}")
            return doc_id
        except Exception as e:
            logger.error(f"원두 정보 추가 실패: {e}")
            raise
    
    def update_bean(self, bean_id: str, bean_data: Dict) -> None:
        """
        원두 정보 업데이트
        
        Args:
            bean_id: 원두 ID
            bean_data: 업데이트할 원두 데이터
        """
        try:
            collection = self.config['firebase']['firestore']['collection_beans']
            doc_ref = self.db.collection(collection).document(bean_id)
            
            # 업데이트 시간 추가
            bean_data['lastUpdated'] = datetime.now()
            
            doc_ref.update(bean_data)
            logger.info(f"원두 정보 업데이트 완료: {bean_id}")
        except Exception as e:
            logger.error(f"원두 정보 업데이트 실패: {e}")
            raise
    
    def deactivate_bean(self, bean_id: str) -> None:
        """
        원두 비활성화 (isActive = False)
        
        Args:
            bean_id: 원두 ID
        """
        try:
            collection = self.config['firebase']['firestore']['collection_beans']
            doc_ref = self.db.collection(collection).document(bean_id)
            
            doc_ref.update({
                'isActive': False,
                'lastUpdated': datetime.now()
            })
            
            logger.info(f"원두 비활성화 완료: {bean_id}")
        except Exception as e:
            logger.error(f"원두 비활성화 실패: {e}")
            raise
    
    def upload_image(self, image_data: bytes, image_name: str) -> str:
        """
        원두 이미지 업로드
        
        Args:
            image_data: 이미지 바이트 데이터
            image_name: 이미지 파일명
            
        Returns:
            업로드된 이미지 URL
        """
        if not self.bucket:
            raise ValueError("Storage 버킷이 설정되지 않았습니다.")
        
        try:
            image_path = f"{self.config['firebase']['storage']['image_path']}/{image_name}"
            blob = self.bucket.blob(image_path)
            blob.upload_from_string(image_data, content_type='image/jpeg')
            
            # 공개 URL 생성
            blob.make_public()
            return blob.public_url
        except Exception as e:
            logger.error(f"이미지 업로드 실패: {e}")
            raise
    
    def add_crawl_log(self, log_data: Dict) -> None:
        """
        크롤링 로그 추가
        
        Args:
            log_data: 로그 데이터
        """
        try:
            collection = self.config['firebase']['firestore']['collection_logs']
            
            # 기본 로그 데이터 추가
            if 'timestamp' not in log_data:
                log_data['timestamp'] = datetime.now()
            
            self.db.collection(collection).add(log_data)
            logger.info("크롤링 로그 추가 완료")
        except Exception as e:
            logger.error(f"크롤링 로그 추가 실패: {e}")
            # 로그 추가 실패는 크리티컬하지 않으므로 예외를 다시 발생시키지 않음
            pass

# 테스트 코드 (이 파일을 직접 실행할 때만 실행)
if __name__ == "__main__":
    # 로깅 설정
    logging.basicConfig(level=logging.INFO)
    
    # 테스트
    try:
        firebase_client = FirebaseClient()
        print("Firebase 연결 성공!")
        
        # 테스트 데이터
        test_bean = {
            "name": "Ethiopia Test Bean",
            "brand": "Test Cafe",
            "origin": "Ethiopia",
            "price": 15000,
            "flavors": ["Fruity", "Floral"],
            "processing": "Washed",
            "roast_level": "Medium",
            "weight_g": 200,
            "isActive": True,
            "desc": "테스트용 원두입니다."
        }
        
        # 테스트 데이터 추가
        doc_id = firebase_client.add_bean(test_bean)
        print(f"테스트 원두 추가 완료: {doc_id}")
        
        # 테스트 데이터 조회
        bean = firebase_client.get_bean(doc_id)
        print(f"조회된 원두: {bean}")
        
        # 테스트 데이터 업데이트
        firebase_client.update_bean(doc_id, {"price": 16000})
        print("원두 가격 업데이트 완료")
        
        # 업데이트 확인
        bean = firebase_client.get_bean(doc_id)
        print(f"업데이트 후 원두: {bean}")
        
        # 테스트 완료 후 데이터 비활성화
        firebase_client.deactivate_bean(doc_id)
        print("테스트 원두 비활성화 완료")
        
    except Exception as e:
        print(f"테스트 실패: {e}") 