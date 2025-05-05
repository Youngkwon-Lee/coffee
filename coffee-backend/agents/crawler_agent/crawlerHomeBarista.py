from selenium import webdriver
from selenium.webdriver.common.by import By
import time

# 네이버 아이디와 비밀번호를 입력하세요
naver_id = 'aisparkk'  # 여기에 네이버 아이디 입력
naver_pw = 'humaninmotion'  # 여기에 네이버 비밀번호 입력

# 크롬 드라이버 실행
driver = webdriver.Chrome()

# 네이버 로그인 페이지 접속
driver.get('https://nid.naver.com/nidlogin.login')
time.sleep(2)

# 아이디 입력
id_box = driver.find_element(By.ID, 'id')
id_box.send_keys(naver_id)

# 비밀번호 입력
pw_box = driver.find_element(By.ID, 'pw')
pw_box.send_keys(naver_pw)

# 로그인 버튼 클릭
login_btn = driver.find_element(By.ID, 'log.login')
login_btn.click()
time.sleep(5)

# 홈바리스타 카페 메인 페이지로 이동
cafe_url = 'https://cafe.naver.com/homebarista'
driver.get(cafe_url)
time.sleep(3)

# 게시글 목록 프레임으로 전환 (네이버 카페는 게시글이 iframe에 있음)
driver.switch_to.frame('cafe_main')
time.sleep(2)

# 게시글 제목 크롤링 (예시: 전체게시판 1페이지)
posts = driver.find_elements(By.CSS_SELECTOR, 'div.aaa h3 a.article')

for post in posts:
    title = post.text
    link = post.get_attribute('href')
    print(f'제목: {title} | 링크: {link}')

# 크롤링 후 브라우저 종료
driver.quit() 