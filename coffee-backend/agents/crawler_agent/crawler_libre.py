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

def crawl_libre():
    url = "https://coffeelibre.kr/category/%EC%9B%90%EB%91%90/53/?cate_no=53&sort_method=2"
    headers = {"User-Agent": "Mozilla/5.0"}
    res = requests.get(url, headers=headers)
    soup = BeautifulSoup(res.text, "html.parser")

    beans = []
    for item in soup.select("ul.prdList > li.item"):
        # 이름
        name_tag = item.select_one(".name strong a")
        name = name_tag.get_text(" ", strip=True) if name_tag else ""
        # 상세 링크
        link = name_tag["href"] if name_tag and name_tag.has_attr("href") else ""
        link = "https://coffeelibre.kr" + link if link.startswith("/") else link
        # 이미지
        img_tag = item.select_one("img.thumb")
        image = img_tag["src"] if img_tag and img_tag.has_attr("src") else ""
        image = "https:" + image if image.startswith("//") else image
        # 가격
        price_tag = item.select_one("li.price span.displaynonedisplaynone b")
        price = price_tag.get_text(strip=True) if price_tag else ""
        if price:
            price += "원"
        # 향미(설명)
        flavor_tag = item.select_one("li.desc.ellipsis2")
        flavor = flavor_tag.get_text(" ", strip=True) if flavor_tag else ""
        # 배전도(옵션)
        roast_tag = item.select_one("li.desc.ellipsis")
        roast = roast_tag.get_text(" ", strip=True) if roast_tag else ""

        beans.append({
            "name": name,
            "price": price,
            "flavor": flavor,
            "roast": roast,
            "link": link,
            "image": image,
            "brand": "리브레"
        })
    return beans

if __name__ == "__main__":
    beans = crawl_libre()
    for bean in beans:
        print(bean)
    # Firestore에 저장
    db = init_firestore()
    for bean in beans:
        db.collection('beans').add(bean)
    print(f"{len(beans)}개 원두를 Firestore에 저장 완료!")