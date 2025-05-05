# 🕸️ agent_graph.py: 전체 에이전트 워크플로우(파이프라인)
from agents.crawler_agent.crawler_momos import crawl_momos
from agents.crawler_agent.crawler_libre import crawl_libre
from agents.crawler_agent.crawler_homebarista import crawl_homebarista
from agents.parser_agent import parse_bean_html
from agents.firestore_agent import save_beans

def run_agent_graph():
    # 1. 크롤러 실행
    momos_html = crawl_momos()
    libre_html = crawl_libre()
    homebarista_html = crawl_homebarista()

    # 2. 파싱
    momos_beans = parse_bean_html(momos_html, "모모스")
    libre_beans = parse_bean_html(libre_html, "리브레")
    homebarista_beans = parse_bean_html(homebarista_html, "홈바리스타")

    # 3. 저장
    save_beans(momos_beans + libre_beans + homebarista_beans)
    print("에이전트 그래프 전체 실행 완료!")

if __name__ == "__main__":
    run_agent_graph() 