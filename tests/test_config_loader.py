"""
설정 로더 모듈 테스트
"""

import os
import tempfile
import yaml
import pytest
from coffee_crawler.utils.config_loader import ConfigLoader, load_crawler_config, load_firebase_config

class TestConfigLoader:
    """ConfigLoader 클래스 테스트"""
    
    def test_load_config(self):
        """설정 파일 로드 테스트"""
        # 임시 설정 파일 생성
        with tempfile.TemporaryDirectory() as temp_dir:
            # 테스트 설정 데이터
            test_config = {
                "test_key": "test_value",
                "test_section": {
                    "nested_key": "nested_value"
                }
            }
            
            # 설정 파일 경로
            config_path = os.path.join(temp_dir, "test_config.yaml")
            
            # 설정 파일 작성
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(test_config, f)
            
            # ConfigLoader 인스턴스 생성
            loader = ConfigLoader(config_dir=temp_dir)
            
            # 설정 로드
            loaded_config = loader.load_config("test_config")
            
            # 설정 확인
            assert loaded_config is not None
            assert loaded_config["test_key"] == "test_value"
            assert loaded_config["test_section"]["nested_key"] == "nested_value"
    
    def test_config_cache(self):
        """설정 캐시 테스트"""
        # 임시 설정 파일 생성
        with tempfile.TemporaryDirectory() as temp_dir:
            # 테스트 설정 데이터
            test_config = {"version": "1.0.0"}
            
            # 설정 파일 경로
            config_path = os.path.join(temp_dir, "cache_config.yaml")
            
            # 설정 파일 작성
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(test_config, f)
            
            # ConfigLoader 인스턴스 생성
            loader = ConfigLoader(config_dir=temp_dir)
            
            # 첫 번째 로드
            config1 = loader.load_config("cache_config")
            
            # 설정 파일 변경
            test_config["version"] = "2.0.0"
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(test_config, f)
            
            # 두 번째 로드 (캐시된 값)
            config2 = loader.load_config("cache_config")
            
            # 캐시된 값을 반환해야 함
            assert config1["version"] == config2["version"] == "1.0.0"
            
            # 강제 리로드
            config3 = loader.load_config("cache_config", force_reload=True)
            
            # 새로운 값이 로드되어야 함
            assert config3["version"] == "2.0.0"
    
    def test_clear_cache(self):
        """캐시 초기화 테스트"""
        # 임시 설정 파일 생성
        with tempfile.TemporaryDirectory() as temp_dir:
            # 테스트 설정 데이터
            test_config = {"version": "1.0.0"}
            
            # 설정 파일 경로
            config_path = os.path.join(temp_dir, "clear_config.yaml")
            
            # 설정 파일 작성
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(test_config, f)
            
            # ConfigLoader 인스턴스 생성
            loader = ConfigLoader(config_dir=temp_dir)
            
            # 첫 번째 로드
            loader.load_config("clear_config")
            
            # 설정 파일 변경
            test_config["version"] = "2.0.0"
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(test_config, f)
            
            # 캐시 초기화
            loader.clear_cache()
            
            # 다시 로드
            config = loader.load_config("clear_config")
            
            # 새로운 값이 로드되어야 함
            assert config["version"] == "2.0.0"

def test_load_crawler_config():
    """crawler_config 로드 헬퍼 함수 테스트"""
    # 실제 설정 파일이 존재하는지 확인
    config = load_crawler_config()
    assert config is not None
    # cafes 섹션이 존재하는지 확인
    assert "cafes" in config

def test_load_firebase_config():
    """firebase_config 로드 헬퍼 함수 테스트"""
    # 실제 설정 파일이 존재하는지 확인
    config = load_firebase_config()
    assert config is not None
    # firebase 섹션이 존재하는지 확인
    assert "firebase" in config 