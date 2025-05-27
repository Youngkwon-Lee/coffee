import os
import logging

def setup_directories():
    """GitHub Actions 실행 환경에서 필요한 디렉토리 생성"""
    
    directories = [
        'data',
        'logs',
        'secret'
    ]
    
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"디렉토리 생성: {directory}")
        else:
            print(f"디렉토리 이미 존재: {directory}")

if __name__ == "__main__":
    setup_directories() 