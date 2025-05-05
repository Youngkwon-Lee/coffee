import requests
from bs4 import BeautifulSoup

# Firestore 연동 추가
import firebase_admin
from firebase_admin import credentials, firestore

# Firestore 초기화 (이미 초기화된 경우 예외 처리)
def init_firestore():
    if not firebase_admin._apps:
        cred = credentials.Certificate('../../secret/serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    return firestore.client()

def crawl_momos():
    url = "https://momos.co.kr/custom/sub/product_category/sd_shop_roasted_bean.html"
    headers = {"User-Agent": "Mozilla/5.0"}
    res = requests.get(url, headers=headers)
    soup = BeautifulSoup(res.text, "html.parser")
    beans = []

    for slide in soup.select(".slide_item"):
        category = slide.select_one(".title a")
        category_name = category.get_text(strip=True) if category else "기타"
        for item in slide.select("ul.prdList > li"):
            name = item.select_one(".name span")
            name = name.get_text(strip=True) if name else ""
            price = ""
            for li in item.select("ul.spec li"):
                if li.get("data-title") == "판매가":
                    price = li.get_text(strip=True)
            flavor = ""
            for li in item.select("ul.spec li"):
                if li.get("data-title") == "상품간략설명":
                    flavor = li.get_text(strip=True)
            link = item.select_one(".name a")["href"] if item.select_one(".name a") else ""
            link = "https://momos.co.kr" + link if link.startswith("/") else link
            image = item.select_one(".prdImg img")["src"] if item.select_one(".prdImg img") else ""
            image = "https:" + image if image.startswith("//") else image

            beans.append({
                "category": category_name,
                "name": name,
                "price": price,
                "flavor": flavor,
                "link": link,
                "image": image,
                "brand": "모모스"
            })
    return beans

if __name__ == "__main__":
    beans = crawl_momos()
    for bean in beans:
        print(bean)
    # Firestore에 저장
    db = init_firestore()
    for bean in beans:
        db.collection('beans').add(bean)
    print(f"{len(beans)}개 원두를 Firestore에 저장 완료!")