import requests
from bs4 import BeautifulSoup
import re

def get_page_structure(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 페이지 기본 구조 확인
        print(f"URL: {url}")
        print("페이지 제목:", soup.title.text.strip() if soup.title else "제목 없음")
        
        # 제품 목록 관련 요소 찾기
        print("\n=== HTML 구조 요약 ===")
        body = soup.body
        if body:
            top_level_tags = body.find_all(recursive=False)
            print(f"최상위 태그 수: {len(top_level_tags)}")
            for i, tag in enumerate(top_level_tags[:5]):  # 처음 5개만 표시
                print(f"  태그 {i+1}: {tag.name} (class: {' '.join(tag.get('class', []))})")
        
        # 제품 아이템을 찾을 수 있는 태그 탐색
        print("\n=== 잠재적인 제품 컨테이너 ===")
        potential_containers = soup.find_all(['div', 'ul', 'section'], class_=re.compile(r'product|item|list|grid'))
        for i, container in enumerate(potential_containers[:10]):  # 처음 10개만 표시
            items = container.find_all(['li', 'div', 'article'], class_=re.compile(r'item|product'))
            print(f"컨테이너 {i+1}: {container.name}.{' '.join(container.get('class', []))} - 항목 수: {len(items)}")
            
            # 첫 번째 항목의 자식 요소 표시
            if items:
                print("  첫 번째 항목 자식 요소:")
                for child in items[0].find_all(recursive=False)[:5]:  # 처음 5개 자식만 표시
                    print(f"    {child.name} (class: {' '.join(child.get('class', []))})")
        
        # 모든 링크 텍스트 확인 (제품명 후보)
        print("\n=== 잠재적인 제품 링크 ===")
        product_links = soup.find_all('a', href=re.compile(r'product|item|detail'))
        for i, link in enumerate(product_links[:10]):  # 처음 10개 링크만 표시
            text = link.get_text().strip()
            if text:
                print(f"링크 {i+1}: {text[:50]}... (href: {link.get('href', '')})")
        
        # 제품 이미지 확인
        print("\n=== 잠재적인 제품 이미지 ===")
        product_images = soup.find_all('img', src=re.compile(r'product|item'))
        for i, img in enumerate(product_images[:5]):  # 처음 5개 이미지만 표시
            print(f"이미지 {i+1}: alt={img.get('alt', '없음')} (src: {img.get('src', '')})")
        
        # 특정 텍스트를 포함하는 요소 검색 (원두 등의 키워드)
        print("\n=== 특정 키워드를 포함하는 요소 ===")
        keywords = ['원두', '커피', 'coffee', 'bean']
        for keyword in keywords:
            elements = soup.find_all(text=re.compile(keyword, re.IGNORECASE))
            if elements:
                print(f"'{keyword}' 키워드 포함 요소: {len(elements)}개")
                for i, element in enumerate(elements[:3]):  # 처음 3개만 표시
                    parent = element.parent
                    print(f"  요소 {i+1}: {parent.name}.{' '.join(parent.get('class', []))}: {element.strip()[:50]}...")
        
    except Exception as e:
        print(f"에러 발생: {e}")

if __name__ == "__main__":
    # 센터커피
    print("\n" + "="*50)
    print("센터커피 분석")
    print("="*50)
    get_page_structure("https://centercoffee.co.kr/shop") 
from bs4 import BeautifulSoup
import re

def get_page_structure(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 페이지 기본 구조 확인
        print(f"URL: {url}")
        print("페이지 제목:", soup.title.text.strip() if soup.title else "제목 없음")
        
        # 제품 목록 관련 요소 찾기
        print("\n=== HTML 구조 요약 ===")
        body = soup.body
        if body:
            top_level_tags = body.find_all(recursive=False)
            print(f"최상위 태그 수: {len(top_level_tags)}")
            for i, tag in enumerate(top_level_tags[:5]):  # 처음 5개만 표시
                print(f"  태그 {i+1}: {tag.name} (class: {' '.join(tag.get('class', []))})")
        
        # 제품 아이템을 찾을 수 있는 태그 탐색
        print("\n=== 잠재적인 제품 컨테이너 ===")
        potential_containers = soup.find_all(['div', 'ul', 'section'], class_=re.compile(r'product|item|list|grid'))
        for i, container in enumerate(potential_containers[:10]):  # 처음 10개만 표시
            items = container.find_all(['li', 'div', 'article'], class_=re.compile(r'item|product'))
            print(f"컨테이너 {i+1}: {container.name}.{' '.join(container.get('class', []))} - 항목 수: {len(items)}")
            
            # 첫 번째 항목의 자식 요소 표시
            if items:
                print("  첫 번째 항목 자식 요소:")
                for child in items[0].find_all(recursive=False)[:5]:  # 처음 5개 자식만 표시
                    print(f"    {child.name} (class: {' '.join(child.get('class', []))})")
        
        # 모든 링크 텍스트 확인 (제품명 후보)
        print("\n=== 잠재적인 제품 링크 ===")
        product_links = soup.find_all('a', href=re.compile(r'product|item|detail'))
        for i, link in enumerate(product_links[:10]):  # 처음 10개 링크만 표시
            text = link.get_text().strip()
            if text:
                print(f"링크 {i+1}: {text[:50]}... (href: {link.get('href', '')})")
        
        # 제품 이미지 확인
        print("\n=== 잠재적인 제품 이미지 ===")
        product_images = soup.find_all('img', src=re.compile(r'product|item'))
        for i, img in enumerate(product_images[:5]):  # 처음 5개 이미지만 표시
            print(f"이미지 {i+1}: alt={img.get('alt', '없음')} (src: {img.get('src', '')})")
        
        # 특정 텍스트를 포함하는 요소 검색 (원두 등의 키워드)
        print("\n=== 특정 키워드를 포함하는 요소 ===")
        keywords = ['원두', '커피', 'coffee', 'bean']
        for keyword in keywords:
            elements = soup.find_all(text=re.compile(keyword, re.IGNORECASE))
            if elements:
                print(f"'{keyword}' 키워드 포함 요소: {len(elements)}개")
                for i, element in enumerate(elements[:3]):  # 처음 3개만 표시
                    parent = element.parent
                    print(f"  요소 {i+1}: {parent.name}.{' '.join(parent.get('class', []))}: {element.strip()[:50]}...")
        
    except Exception as e:
        print(f"에러 발생: {e}")

if __name__ == "__main__":
    # 센터커피
    print("\n" + "="*50)
    print("센터커피 분석")
    print("="*50)
    get_page_structure("https://centercoffee.co.kr/shop") 