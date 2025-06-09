#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Firebase Client

Firebase Firestore와의 연동을 담당하는 클라이언트 클래스
"""

import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import hashlib

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    firebase_admin = None
    credentials = None
    firestore = None
    FIREBASE_AVAILABLE = False

logger = logging.getLogger(__name__)

class FirebaseClient:
    """Firebase Firestore 클라이언트"""
    
    def __init__(self):
        """Firebase 클라이언트 초기화"""
        self.db = None
        self._initialize_firebase()
    
    def _initialize_firebase(self):
        """Firebase 앱 초기화"""
        if not FIREBASE_AVAILABLE:
            logger.warning("firebase-admin 패키지가 설치되지 않았습니다. Firebase 기능을 사용할 수 없습니다.")
            return
        
        try:
            # 이미 초기화된 앱이 있는지 확인
            app = firebase_admin.get_app()
            logger.info("기존 Firebase 앱 재사용")
        except ValueError:
            # 새로 초기화
            cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            
            if not cred_path:
                # 기본 경로들 시도
                possible_paths = [
                    'firebase_credentials.json',
                    'your-service-account-key.json',
                    'coffee-37b81-firebase-adminsdk-fbsvc-08f9391d90.json'
                ]
                
                for path in possible_paths:
                    if os.path.exists(path):
                        cred_path = path
                        break
            
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                app = firebase_admin.initialize_app(cred)
                logger.info(f"Firebase 앱 초기화 완료: {cred_path}")
            else:
                logger.error("Firebase 인증 파일을 찾을 수 없습니다")
                return
        
        self.db = firestore.client()
    
    def is_available(self) -> bool:
        """Firebase 사용 가능 여부 확인"""
        return FIREBASE_AVAILABLE and self.db is not None
    
    def add_bean(self, bean_data: Dict[str, Any]) -> bool:
        """
        원두 정보를 Firestore에 추가/업데이트
        
        Args:
            bean_data: 원두 정보 딕셔너리
            
        Returns:
            성공 여부
        """
        if not self.is_available():
            logger.warning("Firebase를 사용할 수 없습니다")
            return False
        
        try:
            # 고유 ID 생성 (이름 + 브랜드 + URL 기반)
            id_string = f"{bean_data.get('name', '')}_{bean_data.get('brand', '')}_{bean_data.get('url', '')}"
            bean_id = hashlib.md5(id_string.encode('utf-8')).hexdigest()[:16]
            
            # 현재 시간 추가
            now = datetime.now()
            bean_data['lastUpdated'] = now
            
            # 기존 데이터 확인
            doc_ref = self.db.collection('beans').document(bean_id)
            existing_doc = doc_ref.get()
            
            if existing_doc.exists:
                # 기존 데이터와 비교하여 변경사항 있을 때만 업데이트
                existing_data = existing_doc.to_dict()
                
                # 가격 변경 확인
                if existing_data.get('price') != bean_data.get('price'):
                    logger.info(f"가격 변동 감지: {bean_data.get('name')} - {existing_data.get('price')}원 → {bean_data.get('price')}원")
                
                # 데이터 업데이트
                doc_ref.update(bean_data)
                logger.debug(f"원두 정보 업데이트: {bean_id}")
            else:
                # 새 데이터 추가
                bean_data['createdAt'] = now
                bean_data['isActive'] = True
                doc_ref.set(bean_data)
                logger.info(f"신규 원두 추가: {bean_data.get('name')} ({bean_data.get('brand')})")
            
            return True
            
        except Exception as e:
            logger.error(f"Firebase 저장 실패: {e}")
            return False
    
    def get_all_beans(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """
        모든 원두 정보 조회
        
        Args:
            active_only: 활성 상태 원두만 조회할지 여부
            
        Returns:
            원두 정보 리스트
        """
        if not self.is_available():
            logger.warning("Firebase를 사용할 수 없습니다")
            return []
        
        try:
            query = self.db.collection('beans')
            
            if active_only:
                query = query.where('isActive', '==', True)
            
            docs = query.stream()
            beans = []
            
            for doc in docs:
                bean_data = doc.to_dict()
                bean_data['id'] = doc.id
                beans.append(bean_data)
            
            logger.info(f"원두 조회 완료: {len(beans)}개")
            return beans
            
        except Exception as e:
            logger.error(f"Firebase 조회 실패: {e}")
            return []
    
    def get_beans_by_cafe(self, cafe_id: str, active_only: bool = True) -> List[Dict[str, Any]]:
        """
        특정 카페의 원두 정보 조회
        
        Args:
            cafe_id: 카페 ID
            active_only: 활성 상태 원두만 조회할지 여부
            
        Returns:
            원두 정보 리스트
        """
        if not self.is_available():
            logger.warning("Firebase를 사용할 수 없습니다")
            return []
        
        try:
            query = self.db.collection('beans').where('brand', '==', cafe_id)
            
            if active_only:
                query = query.where('isActive', '==', True)
            
            docs = query.stream()
            beans = []
            
            for doc in docs:
                bean_data = doc.to_dict()
                bean_data['id'] = doc.id
                beans.append(bean_data)
            
            logger.info(f"{cafe_id} 원두 조회 완료: {len(beans)}개")
            return beans
            
        except Exception as e:
            logger.error(f"Firebase 조회 실패: {e}")
            return []
    
    def deactivate_missing_beans(self, current_beans: List[Dict[str, Any]], cutoff_days: int = 14):
        """
        현재 크롤링에서 누락된 원두들을 비활성화
        
        Args:
            current_beans: 현재 크롤링된 원두 리스트
            cutoff_days: 비활성화 기준 일수
        """
        if not self.is_available():
            logger.warning("Firebase를 사용할 수 없습니다")
            return
        
        try:
            # 현재 원두들의 ID 세트 생성
            current_ids = set()
            for bean in current_beans:
                id_string = f"{bean.get('name', '')}_{bean.get('brand', '')}_{bean.get('url', '')}"
                bean_id = hashlib.md5(id_string.encode('utf-8')).hexdigest()[:16]
                current_ids.add(bean_id)
            
            # 기준 날짜 계산
            cutoff_date = datetime.now() - timedelta(days=cutoff_days)
            
            # 모든 활성 원두 조회
            active_beans = self.get_all_beans(active_only=True)
            
            deactivated_count = 0
            for bean in active_beans:
                if (bean['id'] not in current_ids and 
                    bean.get('lastUpdated', datetime.now()) < cutoff_date):
                    
                    # 비활성화
                    doc_ref = self.db.collection('beans').document(bean['id'])
                    doc_ref.update({
                        'isActive': False,
                        'lastUpdated': datetime.now()
                    })
                    
                    logger.info(f"원두 비활성화: {bean.get('name')} ({bean.get('brand')})")
                    deactivated_count += 1
            
            logger.info(f"총 {deactivated_count}개 원두 비활성화 완료")
            
        except Exception as e:
            logger.error(f"비활성화 처리 실패: {e}")
    
    def get_statistics(self) -> Dict[str, Any]:
        """데이터베이스 통계 정보 조회"""
        if not self.is_available():
            return {}
        
        try:
            all_beans = self.get_all_beans(active_only=False)
            active_beans = [b for b in all_beans if b.get('isActive', True)]
            
            # 카페별 통계
            cafe_stats = {}
            for bean in active_beans:
                brand = bean.get('brand', 'unknown')
                if brand not in cafe_stats:
                    cafe_stats[brand] = {'count': 0, 'total_price': 0}
                
                cafe_stats[brand]['count'] += 1
                price = bean.get('price', 0)
                if isinstance(price, (int, float)) and price > 0:
                    cafe_stats[brand]['total_price'] += price
            
            # 평균 가격 계산
            for brand, stats in cafe_stats.items():
                if stats['count'] > 0:
                    stats['avg_price'] = stats['total_price'] / stats['count']
                else:
                    stats['avg_price'] = 0
            
            return {
                'total_beans': len(all_beans),
                'active_beans': len(active_beans),
                'inactive_beans': len(all_beans) - len(active_beans),
                'cafe_stats': cafe_stats,
                'last_updated': datetime.now()
            }
            
        except Exception as e:
            logger.error(f"통계 조회 실패: {e}")
            return {} 