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

from coffee_crawler.utils.config_loader import load_firebase_config

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
        try:
            # 환경 변수 확인 - DISABLE_FIREBASE가 'true'이면 초기화 건너뛰기
            if os.environ.get('DISABLE_FIREBASE', '').lower() == 'true':
                logger.info("환경 변수 DISABLE_FIREBASE=true로 설정되어 Firebase 초기화 건너뜀")
                self.disabled = True
                self.app = None
                self.db = None
                self.bucket = None
                self.config = {
                    'firebase': {
                        'firestore': {
                            'collection_beans': 'beans',
                            'collection_logs': 'crawl_logs'
                        },
                        'storage': {
                            'image_path': 'bean_images'
                        }
                    }
                }
                return
                
            # Firebase 앱 초기화
            self.app = self._initialize_firebase()
            
            if self.app:
                # Firestore 클라이언트 초기화
                try:
                    self.db = firestore.client()
                    logger.info("Firestore 클라이언트 초기화 완료")
                except Exception as e:
                    logger.error(f"Firestore 클라이언트 초기화 실패: {e}")
                    self.db = None
                
                # Storage 버킷 초기화
                self.bucket = None
                if storage:
                    try:
                        bucket_name = os.getenv('FIREBASE_STORAGE_BUCKET')
                        if bucket_name:
                            self.bucket = storage.bucket(bucket_name)
                            logger.info("Storage 버킷 초기화 완료")
                    except Exception as e:
                        logger.error(f"Storage 버킷 초기화 실패: {e}")
                
                # 기본 설정
                self.config = {
                    'firebase': {
                        'firestore': {
                            'collection_beans': 'beans',
                            'collection_logs': 'crawl_logs'
                        },
                        'storage': {
                            'image_path': 'bean_images'
                        }
                    }
                }
                logger.info("Firebase 클라이언트 초기화 완료")
            else:
                logger.warning("Firebase 앱 초기화에 실패하여 일부 기능을 사용할 수 없습니다.")
                self.db = None
                self.bucket = None
                self.config = {
                    'firebase': {
                        'firestore': {
                            'collection_beans': 'beans',
                            'collection_logs': 'crawl_logs'
                        },
                        'storage': {
                            'image_path': 'bean_images'
                        }
                    }
                }
                
        except Exception as e:
            logger.error(f"Firebase 클라이언트 초기화 중 오류 발생: {e}")
            self.app = None
            self.db = None
            self.bucket = None
            self.config = {
                'firebase': {
                    'firestore': {
                        'collection_beans': 'beans',
                        'collection_logs': 'crawl_logs'
                    },
                    'storage': {
                        'image_path': 'bean_images'
                    }
                }
            }
    
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
        except FileNotFoundError:
            logger.warning(f"Firebase 설정 파일을 찾을 수 없음: {config_path}")
            return {'firebase': {}}
        except Exception as e:
            logger.error(f"설정 파일 로드 실패: {e}")
            return {'firebase': {}}
    
    def _initialize_firebase(self) -> Optional[firebase_admin.App]:
        """
        Firebase 초기화
        
        Returns:
            Firebase 앱 인스턴스 또는 초기화 실패 시 None
        """
        try:
            # 이미 초기화된 앱이 있는지 확인
            if firebase_admin._apps:
                logger.info("기존 Firebase 앱 인스턴스 재사용")
                return firebase_admin._apps.get(None) or list(firebase_admin._apps.values())[0]

            # 필수 환경 변수 확인
            required_vars = {
                'FIREBASE_PROJECT_ID': os.getenv('FIREBASE_PROJECT_ID'),
                'FIREBASE_PRIVATE_KEY_ID': os.getenv('FIREBASE_PRIVATE_KEY_ID'),
                'FIREBASE_PRIVATE_KEY': os.getenv('FIREBASE_PRIVATE_KEY'),
                'FIREBASE_CLIENT_EMAIL': os.getenv('FIREBASE_CLIENT_EMAIL'),
                'FIREBASE_CLIENT_ID': os.getenv('FIREBASE_CLIENT_ID'),
                'FIREBASE_CLIENT_CERT_URL': os.getenv('FIREBASE_CLIENT_CERT_URL')
            }
            
            # 누락된 환경 변수 확인
            missing_vars = [var for var, value in required_vars.items() if not value]
            if missing_vars:
                logger.warning(f"Firebase 설정이 없습니다. 누락된 환경 변수: {', '.join(missing_vars)}")
                return None
            
            # private_key 처리
            private_key = required_vars['FIREBASE_PRIVATE_KEY']
            if not private_key:
                logger.warning("FIREBASE_PRIVATE_KEY가 비어있습니다.")
                return None
                
            # Firebase 설정 구성
            firebase_config = {
                "type": "service_account",
                "project_id": required_vars['FIREBASE_PROJECT_ID'],
                "private_key_id": required_vars['FIREBASE_PRIVATE_KEY_ID'],
                "private_key": private_key.replace('\\n', '\n'),
                "client_email": required_vars['FIREBASE_CLIENT_EMAIL'],
                "client_id": required_vars['FIREBASE_CLIENT_ID'],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": required_vars['FIREBASE_CLIENT_CERT_URL']
            }
            
            # Firebase 앱 초기화
            cred = credentials.Certificate(firebase_config)
            app = firebase_admin.initialize_app(cred)
            logger.info("Firebase 초기화 성공")
            return app
            
        except Exception as e:
            logger.error(f"Firebase 앱 초기화에 실패하여 일부 기능을 사용할 수 없습니다: {e}")
            return None
    
    def is_initialized(self) -> bool:
        """
        Firebase 클라이언트가 성공적으로 초기화되었는지 확인
        
        Returns:
            초기화 여부
        """
        return self.app is not None and self.db is not None
    
    def get_bean(self, bean_id: str) -> Optional[Dict]:
        """
        원두 정보 조회
        
        Args:
            bean_id: 원두 ID
            
        Returns:
            원두 정보 딕셔너리
        """
        if not self.is_initialized():
            logger.warning("Firebase가 초기화되지 않아 원두 정보를 조회할 수 없습니다.")
            return None
            
        try:
            collection = self.config['firebase']['firestore']['collection_beans']
            doc_ref = self.db.collection(collection).document(bean_id)
            doc = doc_ref.get()
            
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"원두 정보 조회 실패: {e}")
            return None
    
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
        # Firebase가 초기화되지 않은 경우
        if not self.is_initialized():
            logger.warning("Firebase가 초기화되지 않아 원두 정보를 추가할 수 없습니다.")
            # ID만 반환하고 추가는 실패
            brand = bean_data.get('brand', '').replace(' ', '_')
            name = bean_data.get('name', '').replace(' ', '_')
            doc_id = f"{brand}_{name}"
            doc_id = ''.join(c for c in doc_id if c.isalnum() or c == '_')
            return doc_id
            
        try:
            collection = self.config['firebase']['firestore']['collection_beans']
            
            # 필수 필드 검증
            required_fields = ['name', 'brand', 'price']  # origin 필드 제거
            missing_fields = [field for field in required_fields if field not in bean_data]
            if missing_fields:
                raise ValueError(f"필수 필드가 누락되었습니다: {', '.join(missing_fields)}")
            
            # 기본 메타데이터 추가
            if 'createdAt' not in bean_data:
                bean_data['createdAt'] = datetime.now()
            
            bean_data['updatedAt'] = datetime.now()
            bean_data['active'] = bean_data.get('active', True)
            
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
            bean_data['updatedAt'] = datetime.now()
            
            doc_ref.update(bean_data)
            logger.info(f"원두 정보 업데이트 완료: {bean_id}")
        except Exception as e:
            logger.error(f"원두 정보 업데이트 실패: {e}")
            raise
    
    def deactivate_bean(self, bean_id: str) -> None:
        """
        원두 비활성화 (active = False)
        
        Args:
            bean_id: 원두 ID
        """
        try:
            collection = self.config['firebase']['firestore']['collection_beans']
            doc_ref = self.db.collection(collection).document(bean_id)
            
            doc_ref.update({
                'active': False,
                'updatedAt': datetime.now()
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