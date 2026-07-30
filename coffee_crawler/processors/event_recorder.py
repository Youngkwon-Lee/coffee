"""
원두 변경 이벤트 기록 모듈

이 모듈은 change_detector가 감지한 변경사항(신규/재입고/판매중단/가격변동)을
Firestore `bean_events` 컬렉션에 영속화합니다.

`bean_events` 문서 구조:
    bean_id       : beans 컬렉션 문서 ID (md5(name_brand_url)[:16])
    brand         : 브랜드명
    name          : 원두명
    type          : 'new' | 'restored' | 'deleted' | 'price_change'
    old_price_krw : 이전 가격 (숫자, 없으면 None)
    new_price_krw : 현재 가격 (숫자, 없으면 None)
    link          : 상품 링크
    image         : 이미지 URL
    detected_at   : 서버 타임스탬프
"""

import hashlib
import logging
from typing import Any, Dict, List, Optional

from coffee_crawler.models.bean import parse_price_krw
from coffee_crawler.processors.change_detector import (
    CHANGE_TYPE_DELETED,
    CHANGE_TYPE_NEW,
    CHANGE_TYPE_RESTORED,
    CHANGE_TYPE_UPDATED,
    get_change_detector,
)

try:
    from firebase_admin import firestore
    FIRESTORE_AVAILABLE = True
except ImportError:  # pragma: no cover - firebase-admin 미설치 환경
    firestore = None
    FIRESTORE_AVAILABLE = False

# 로거 설정
logger = logging.getLogger(__name__)

# 이벤트 유형
EVENT_TYPE_NEW = 'new'                    # 신상 원두
EVENT_TYPE_RESTORED = 'restored'          # 재입고 (재판매)
EVENT_TYPE_DELETED = 'deleted'            # 판매 중단 (품절 프록시)
EVENT_TYPE_PRICE_CHANGE = 'price_change'  # 가격 변동

# Firestore 컬렉션 이름
BEAN_EVENTS_COLLECTION = 'bean_events'

# Firestore 배치 최대 크기
_BATCH_SIZE = 400

# 신규/재입고 구분을 위한 과거 이벤트 조회 상한 (읽기 비용 제한)
_MAX_RESTORE_LOOKUPS = 50

# 인자 미지정 표시용 센티널
_UNSET = object()


def compute_bean_id(bean: Dict[str, Any]) -> str:
    """
    beans 컬렉션 문서 ID 계산

    firebase_client.add_bean / scripts/reset_all_active_cafes_from_crawl.mjs와
    동일한 규칙(md5(name_brand_url)[:16])을 사용합니다.

    Args:
        bean: 원두 데이터

    Returns:
        문서 ID 문자열
    """
    url = bean.get('url') or bean.get('link') or ''
    id_string = f"{bean.get('name', '')}_{bean.get('brand', '')}_{url}"
    return hashlib.md5(id_string.encode('utf-8')).hexdigest()[:16]


class BeanEventRecorder:
    """원두 변경 이벤트 기록 클래스"""

    def __init__(self, firebase_client=None, detect_restored_from_history: bool = True):
        """
        BeanEventRecorder 초기화

        Args:
            firebase_client: FirebaseClient 인스턴스 (None이면 새로 생성)
            detect_restored_from_history: 과거 'deleted' 이벤트를 조회해
                신규(new)를 재입고(restored)로 승격할지 여부
        """
        if firebase_client is None:
            from coffee_crawler.storage.firebase_client import FirebaseClient
            firebase_client = FirebaseClient()

        self.firebase_client = firebase_client
        self.detect_restored_from_history = detect_restored_from_history
        self._restore_lookups = 0

    @property
    def db(self):
        """Firestore 클라이언트"""
        return getattr(self.firebase_client, 'db', None)

    def is_available(self) -> bool:
        """이벤트 기록 가능 여부 확인"""
        return bool(FIRESTORE_AVAILABLE and self.firebase_client and self.firebase_client.is_available())

    # ------------------------------------------------------------------
    # 이벤트 생성
    # ------------------------------------------------------------------

    def build_events(
        self,
        new_beans: List[Dict[str, Any]],
        existing_beans: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        변경 감지 결과로부터 이벤트 목록 생성

        Args:
            new_beans: 새로 크롤링된 원두 목록
            existing_beans: Firestore에 저장된 기존 원두 목록 (id 포함)

        Returns:
            이벤트 딕셔너리 목록
        """
        # 원본 데이터 오염 방지를 위해 얕은 복사 후 ID 부여
        prepared_new = []
        for bean in new_beans:
            copied = dict(bean)
            if not copied.get('id'):
                copied['id'] = compute_bean_id(copied)
            prepared_new.append(copied)

        prepared_existing = [dict(bean) for bean in existing_beans if bean.get('id')]
        existing_by_id = {bean['id']: bean for bean in prepared_existing}

        detector = get_change_detector()
        changes = detector.detect_changes(prepared_new, prepared_existing)

        events: List[Dict[str, Any]] = []

        # 신규 원두 (과거에 판매중단 이벤트가 있었다면 재입고로 처리)
        for bean in changes.get(CHANGE_TYPE_NEW, []):
            event_type = EVENT_TYPE_NEW
            if self._was_previously_deleted(bean['id']):
                event_type = EVENT_TYPE_RESTORED
            events.append(self._make_event(bean, event_type, old_price_krw=None))

        # 재입고 (비활성 상태였다가 다시 수집된 원두)
        for bean in changes.get(CHANGE_TYPE_RESTORED, []):
            existing = existing_by_id.get(bean['id'], {})
            events.append(self._make_event(
                bean,
                EVENT_TYPE_RESTORED,
                old_price_krw=self._price_of(existing)
            ))

        # 판매 중단
        for bean in changes.get(CHANGE_TYPE_DELETED, []):
            events.append(self._make_event(
                bean,
                EVENT_TYPE_DELETED,
                old_price_krw=self._price_of(bean),
                new_price_krw=None
            ))

        # 가격 변동 (숫자 가격이 실제로 달라진 경우에만)
        for bean in changes.get(CHANGE_TYPE_UPDATED, []):
            existing = existing_by_id.get(bean['id'], {})
            old_price = self._price_of(existing)
            new_price = self._price_of(bean)

            if old_price is None or new_price is None or old_price == new_price:
                continue

            events.append(self._make_event(
                bean,
                EVENT_TYPE_PRICE_CHANGE,
                old_price_krw=old_price,
                new_price_krw=new_price
            ))

        return events

    def _price_of(self, bean: Dict[str, Any]) -> Optional[int]:
        """원두 데이터에서 숫자 가격 추출"""
        price_krw = parse_price_krw(bean.get('price_krw'))
        if price_krw is None:
            price_krw = parse_price_krw(bean.get('price'))
        return price_krw

    def _make_event(
        self,
        bean: Dict[str, Any],
        event_type: str,
        old_price_krw: Optional[int] = None,
        new_price_krw: Any = _UNSET
    ) -> Dict[str, Any]:
        """
        이벤트 딕셔너리 생성

        Args:
            bean: 원두 데이터
            event_type: 이벤트 유형
            old_price_krw: 이전 가격
            new_price_krw: 현재 가격 (미지정 시 bean에서 추출)

        Returns:
            이벤트 딕셔너리
        """
        if new_price_krw is _UNSET:
            new_price_krw = self._price_of(bean)

        return {
            'bean_id': bean.get('id') or compute_bean_id(bean),
            'brand': bean.get('brand') or '',
            'name': bean.get('name') or '',
            'type': event_type,
            'old_price_krw': old_price_krw,
            'new_price_krw': new_price_krw,
            'link': bean.get('link') or bean.get('url') or '',
            'image': bean.get('image') or (bean.get('images') or [None])[0] or '',
        }

    def _was_previously_deleted(self, bean_id: str) -> bool:
        """
        과거에 판매중단(deleted) 이벤트가 기록된 원두인지 확인

        beans 컬렉션은 재적용 시 문서를 삭제하고 다시 만들기 때문에
        (scripts/reset_all_active_cafes_from_crawl.mjs) isActive 기반 재입고 감지가
        동작하지 않습니다. 대신 bean_events 이력을 재입고 판단 근거로 사용합니다.

        Args:
            bean_id: 원두 문서 ID

        Returns:
            과거 판매중단 이력 존재 여부
        """
        if not self.detect_restored_from_history or not self.is_available():
            return False

        if self._restore_lookups >= _MAX_RESTORE_LOOKUPS:
            return False

        self._restore_lookups += 1

        try:
            # 등호 조건만 사용해 복합 인덱스 없이 조회
            docs = (
                self.db.collection(BEAN_EVENTS_COLLECTION)
                .where('bean_id', '==', bean_id)
                .where('type', '==', EVENT_TYPE_DELETED)
                .limit(1)
                .stream()
            )
            return any(True for _ in docs)
        except Exception as e:
            logger.warning(f"과거 판매중단 이벤트 조회 실패 ({bean_id}): {e}")
            return False

    # ------------------------------------------------------------------
    # 이벤트 저장
    # ------------------------------------------------------------------

    def record(self, events: List[Dict[str, Any]]) -> int:
        """
        이벤트를 Firestore `bean_events` 컬렉션에 저장

        Args:
            events: 이벤트 목록

        Returns:
            저장된 이벤트 수
        """
        if not events:
            return 0

        if not self.is_available():
            logger.warning("Firebase를 사용할 수 없어 원두 이벤트를 기록하지 않습니다")
            return 0

        saved = 0

        try:
            collection = self.db.collection(BEAN_EVENTS_COLLECTION)
            batch = self.db.batch()
            ops = 0

            for event in events:
                payload = dict(event)
                payload['detected_at'] = firestore.SERVER_TIMESTAMP
                batch.set(collection.document(), payload)
                ops += 1
                saved += 1

                if ops >= _BATCH_SIZE:
                    batch.commit()
                    batch = self.db.batch()
                    ops = 0

            if ops > 0:
                batch.commit()

            logger.info(f"원두 이벤트 {saved}건 기록 완료")
            return saved

        except Exception as e:
            logger.error(f"원두 이벤트 기록 실패: {e}")
            return 0

    def record_changes(
        self,
        new_beans: List[Dict[str, Any]],
        existing_beans: Optional[List[Dict[str, Any]]] = None,
        brand: Optional[str] = None,
        dry_run: bool = False
    ) -> List[Dict[str, Any]]:
        """
        변경 감지 + 이벤트 기록을 한 번에 수행

        Args:
            new_beans: 새로 크롤링된 원두 목록
            existing_beans: 기존 원두 목록 (None이면 brand 기준으로 Firestore에서 조회)
            brand: 기존 원두 조회에 사용할 브랜드명
            dry_run: True면 Firestore에 저장하지 않고 이벤트만 반환

        Returns:
            생성된 이벤트 목록
        """
        if not new_beans:
            # 크롤 결과가 0건이면 전량 판매중단으로 오판할 수 있어 건너뜀
            logger.warning("크롤 결과가 없어 원두 이벤트 기록을 건너뜁니다")
            return []

        if existing_beans is None:
            existing_beans = self._fetch_existing_beans(new_beans, brand)

        events = self.build_events(new_beans, existing_beans)

        if events and not dry_run:
            self.record(events)

        return events

    def _fetch_existing_beans(
        self,
        new_beans: List[Dict[str, Any]],
        brand: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        비교 대상 기존 원두 목록 조회 (브랜드 단위)

        Args:
            new_beans: 새로 크롤링된 원두 목록
            brand: 브랜드명 (없으면 new_beans에서 추출)

        Returns:
            기존 원두 목록
        """
        if not self.is_available():
            return []

        brands = {brand} if brand else {b.get('brand') for b in new_beans if b.get('brand')}
        brands = {b for b in brands if b}

        existing: List[Dict[str, Any]] = []

        for brand_name in sorted(brands):
            try:
                docs = self.db.collection('beans').where('brand', '==', brand_name).stream()
                for doc in docs:
                    data = doc.to_dict() or {}
                    data['id'] = doc.id
                    existing.append(data)
            except Exception as e:
                logger.error(f"기존 원두 조회 실패 ({brand_name}): {e}")

        logger.info(f"이벤트 비교용 기존 원두 {len(existing)}개 조회 (브랜드: {', '.join(sorted(brands)) or '없음'})")
        return existing


# 글로벌 이벤트 기록기 인스턴스
_event_recorder = None


def get_event_recorder() -> BeanEventRecorder:
    """
    이벤트 기록기 인스턴스 반환

    Returns:
        BeanEventRecorder 인스턴스
    """
    global _event_recorder
    if _event_recorder is None:
        _event_recorder = BeanEventRecorder()
    return _event_recorder


def record_bean_events(
    new_beans: List[Dict[str, Any]],
    existing_beans: Optional[List[Dict[str, Any]]] = None,
    brand: Optional[str] = None,
    dry_run: bool = False
) -> List[Dict[str, Any]]:
    """
    원두 변경 이벤트 기록 함수

    Args:
        new_beans: 새로 크롤링된 원두 목록
        existing_beans: 기존 원두 목록 (None이면 Firestore에서 조회)
        brand: 브랜드명
        dry_run: True면 Firestore에 저장하지 않음

    Returns:
        생성된 이벤트 목록
    """
    recorder = get_event_recorder()
    return recorder.record_changes(new_beans, existing_beans, brand, dry_run)
