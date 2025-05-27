"""
알림 시스템 모듈

이 모듈은 크롤링 성공 또는 실패 시 이메일이나 메신저로 알림을 보내는 기능을 제공합니다.
"""

import os
import logging
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional, Union
from datetime import datetime

# 로거 설정
logger = logging.getLogger(__name__)

class NotificationSystem:
    """알림 시스템 클래스"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        NotificationSystem 초기화
        
        Args:
            config: 알림 설정 딕셔너리
        """
        self.config = config or {}
        self.email_enabled = self.config.get('email', {}).get('enabled', False)
        self.slack_enabled = self.config.get('slack', {}).get('enabled', False)
        self.discord_enabled = self.config.get('discord', {}).get('enabled', False)
        
        # 환경 변수에서 설정 로드
        if not self.config:
            self._load_config_from_env()
    
    def _load_config_from_env(self):
        """환경 변수에서 알림 설정 로드"""
        # 이메일 설정
        self.email_enabled = os.environ.get('NOTIFICATION_EMAIL_ENABLED', 'false').lower() == 'true'
        self.email_from = os.environ.get('NOTIFICATION_EMAIL_FROM', '')
        self.email_to = os.environ.get('NOTIFICATION_EMAIL_TO', '')
        self.email_smtp_host = os.environ.get('NOTIFICATION_EMAIL_SMTP_HOST', 'smtp.gmail.com')
        self.email_smtp_port = int(os.environ.get('NOTIFICATION_EMAIL_SMTP_PORT', '587'))
        self.email_username = os.environ.get('NOTIFICATION_EMAIL_USERNAME', '')
        self.email_password = os.environ.get('NOTIFICATION_EMAIL_PASSWORD', '')
        
        # Slack 설정
        self.slack_enabled = os.environ.get('NOTIFICATION_SLACK_ENABLED', 'false').lower() == 'true'
        self.slack_webhook_url = os.environ.get('NOTIFICATION_SLACK_WEBHOOK_URL', '')
        
        # Discord 설정
        self.discord_enabled = os.environ.get('NOTIFICATION_DISCORD_ENABLED', 'false').lower() == 'true'
        self.discord_webhook_url = os.environ.get('NOTIFICATION_DISCORD_WEBHOOK_URL', '')
    
    def notify_success(self, cafe_id: str, cafe_name: str, bean_count: int, duration: float) -> bool:
        """
        크롤링 성공 알림 전송
        
        Args:
            cafe_id: 카페 ID
            cafe_name: 카페 이름
            bean_count: 수집된 원두 수
            duration: 소요 시간 (초)
            
        Returns:
            알림 전송 성공 여부
        """
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        subject = f"[커피 크롤러] {cafe_name} 크롤링 성공"
        
        message = (
            f"카페: {cafe_name} ({cafe_id})\n"
            f"상태: 성공 ✅\n"
            f"시간: {timestamp}\n"
            f"원두 수: {bean_count}개\n"
            f"소요 시간: {duration:.2f}초"
        )
        
        return self._send_notification(subject, message, is_success=True)
    
    def notify_failure(self, cafe_id: str, cafe_name: str, error_message: str, duration: float) -> bool:
        """
        크롤링 실패 알림 전송
        
        Args:
            cafe_id: 카페 ID
            cafe_name: 카페 이름
            error_message: 오류 메시지
            duration: 소요 시간 (초)
            
        Returns:
            알림 전송 성공 여부
        """
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        subject = f"[커피 크롤러] {cafe_name} 크롤링 실패"
        
        message = (
            f"카페: {cafe_name} ({cafe_id})\n"
            f"상태: 실패 ❌\n"
            f"시간: {timestamp}\n"
            f"오류: {error_message}\n"
            f"소요 시간: {duration:.2f}초"
        )
        
        return self._send_notification(subject, message, is_success=False)
    
    def _send_notification(self, subject: str, message: str, is_success: bool) -> bool:
        """
        알림 전송
        
        Args:
            subject: 제목
            message: 메시지 내용
            is_success: 성공 여부
            
        Returns:
            알림 전송 성공 여부
        """
        success = True
        
        # 이메일 알림
        if self.email_enabled:
            try:
                success = success and self._send_email(subject, message)
            except Exception as e:
                logger.error(f"이메일 알림 전송 실패: {e}")
                success = False
        
        # Slack 알림
        if self.slack_enabled:
            try:
                success = success and self._send_slack(subject, message, is_success)
            except Exception as e:
                logger.error(f"Slack 알림 전송 실패: {e}")
                success = False
        
        # Discord 알림
        if self.discord_enabled:
            try:
                success = success and self._send_discord(subject, message, is_success)
            except Exception as e:
                logger.error(f"Discord 알림 전송 실패: {e}")
                success = False
        
        return success
    
    def _send_email(self, subject: str, message: str) -> bool:
        """
        이메일 알림 전송
        
        Args:
            subject: 제목
            message: 메시지 내용
            
        Returns:
            이메일 전송 성공 여부
        """
        if not self.email_enabled:
            logger.warning("이메일 알림이 비활성화되어 있습니다.")
            return False
        
        # 이메일 설정 확인
        email_from = self.config.get('email', {}).get('from', self.email_from)
        email_to = self.config.get('email', {}).get('to', self.email_to)
        smtp_host = self.config.get('email', {}).get('smtp_host', self.email_smtp_host)
        smtp_port = self.config.get('email', {}).get('smtp_port', self.email_smtp_port)
        username = self.config.get('email', {}).get('username', self.email_username)
        password = self.config.get('email', {}).get('password', self.email_password)
        
        if not (email_from and email_to and smtp_host and username and password):
            logger.error("이메일 알림 설정이 불완전합니다.")
            return False
        
        try:
            # 메시지 생성
            msg = MIMEMultipart()
            msg['From'] = email_from
            msg['To'] = email_to
            msg['Subject'] = subject
            
            # 메시지 본문 추가
            msg.attach(MIMEText(message, 'plain'))
            
            # SMTP 서버에 연결
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
            server.login(username, password)
            
            # 이메일 전송
            server.send_message(msg)
            server.quit()
            
            logger.info(f"이메일 알림 전송 완료: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"이메일 알림 전송 실패: {e}")
            return False
    
    def _send_slack(self, subject: str, message: str, is_success: bool) -> bool:
        """
        Slack 알림 전송
        
        Args:
            subject: 제목
            message: 메시지 내용
            is_success: 성공 여부
            
        Returns:
            Slack 전송 성공 여부
        """
        if not self.slack_enabled:
            logger.warning("Slack 알림이 비활성화되어 있습니다.")
            return False
        
        # Webhook URL 확인
        webhook_url = self.config.get('slack', {}).get('webhook_url', self.slack_webhook_url)
        
        if not webhook_url:
            logger.error("Slack Webhook URL이 설정되지 않았습니다.")
            return False
        
        try:
            # Slack 메시지 형식
            color = "#36a64f" if is_success else "#ff0000"  # 성공은 녹색, 실패는 빨간색
            
            payload = {
                "attachments": [
                    {
                        "color": color,
                        "pretext": subject,
                        "text": message,
                        "footer": "커피 크롤러 알림 시스템",
                        "ts": int(datetime.now().timestamp())
                    }
                ]
            }
            
            # Webhook 호출
            response = requests.post(webhook_url, json=payload)
            
            if response.status_code == 200:
                logger.info(f"Slack 알림 전송 완료: {subject}")
                return True
            else:
                logger.error(f"Slack 알림 전송 실패: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Slack 알림 전송 실패: {e}")
            return False
    
    def _send_discord(self, subject: str, message: str, is_success: bool) -> bool:
        """
        Discord 알림 전송
        
        Args:
            subject: 제목
            message: 메시지 내용
            is_success: 성공 여부
            
        Returns:
            Discord 전송 성공 여부
        """
        if not self.discord_enabled:
            logger.warning("Discord 알림이 비활성화되어 있습니다.")
            return False
        
        # Webhook URL 확인
        webhook_url = self.config.get('discord', {}).get('webhook_url', self.discord_webhook_url)
        
        if not webhook_url:
            logger.error("Discord Webhook URL이 설정되지 않았습니다.")
            return False
        
        try:
            # Discord 메시지 형식
            color = 0x36a64f if is_success else 0xff0000  # 성공은 녹색, 실패는 빨간색
            
            payload = {
                "embeds": [
                    {
                        "title": subject,
                        "description": message,
                        "color": color,
                        "footer": {
                            "text": "커피 크롤러 알림 시스템"
                        },
                        "timestamp": datetime.now().isoformat()
                    }
                ]
            }
            
            # Webhook 호출
            response = requests.post(webhook_url, json=payload)
            
            if response.status_code == 204:
                logger.info(f"Discord 알림 전송 완료: {subject}")
                return True
            else:
                logger.error(f"Discord 알림 전송 실패: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Discord 알림 전송 실패: {e}")
            return False

# 기본 알림 시스템 인스턴스 제공
_notification_system = None

def get_notification_system() -> NotificationSystem:
    """
    알림 시스템 인스턴스 반환
    
    Returns:
        NotificationSystem 인스턴스
    """
    global _notification_system
    
    if _notification_system is None:
        _notification_system = NotificationSystem()
    
    return _notification_system 