// Places 매칭 판정 테스트.
// 임계값이나 판정 로직을 건드리면 이걸 먼저 돌린다: node scripts/__tests__/place-match.test.mjs
// resolve-cafe-place-ids.mjs에서 normalize~judge만 떼어 평가한다(Firebase/네트워크 불필요).
const src = (await import('fs')).readFileSync(new URL('../resolve-cafe-place-ids.mjs', import.meta.url),'utf8');
// judge/normalize/dice/distanceMeters만 떼어 평가
const body = src.split('async function searchPlace')[0].split('function normalize')[1];
const mod = new Function(`
  function normalize${body}
  return { normalize, dice, distanceMeters, judge };
`)();
const { judge, distanceMeters } = mod;

const cases = [
  // [우리이름, 별칭, 구글이름, 거리m, 기대]
  ["센터커피 명동점", [], "센터커피 롯데명동점", 20, true],
  ["보난자커피 목동 현대점", [], "보난자커피 현대백화점 목동점", 15, true],
  ["생추어리 (Sanctuary)", ["sanctuary","생추어리"], "Sanctuary", 10, true],
  ["테라로사", ["terarosa"], "Terarosa Coffee", 25, true],
  ["로우키 헤이그라운드점", ["lowkey","로우키"], "Lowkey", 40, true],
  // 아래는 반드시 거부되어야 한다
  ["헬카페 신사", ["hellcafe"], "히트커피로스터스 신사", 180, false],
  ["프릳츠 서촌점", ["fritz"], "프릳츠 원서", 900, false],
  ["커피리브레", ["coffeelibre"], "르 카페 Le Cafe", 250, false],
  ["앤쓰러사이트", ["anthracite"], "보어드앤헝그리", 300, false],
  ["쿼츠커피", ["quartz"], "코르츠", 400, false],
  ["테일러커피 합정점", ["tailorcoffee"], "커피랩스로스터리 합정점", 200, false],
  ["폰트커피 파주 로스팅 팩토리", ["pont"], "커피팩토리 파주", 500, false],
  // 브랜드명 별칭이 같은 브랜드의 다른 지점을 통과시키던 사고
  ["앤트러사이트 성수", ["앤트러사이트","anthracite"], "앤트러사이트 서교점", 4200, false],
  ["앤트러사이트 성수", ["앤트러사이트","anthracite"], "앤트러사이트 합정본점", 3800, false],
  // 같은 지점은 계속 통과해야 한다
  ["앤트러사이트 성수", ["앤트러사이트","anthracite"], "앤트러사이트 성수", 30, true],
];
let fail=0;
for (const [name, aliases, g, m, expect] of cases) {
  const v = judge([name, ...aliases], g, m);
  const ok = v.ok === expect;
  if(!ok) fail++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${expect?'수락':'거부'}  ${name}  ←  ${g}  [${v.why}]`);
}
console.log(fail ? `\n${fail} FAILED` : `\n=== ${cases.length}/${cases.length} 통과 ===`);
process.exit(fail?1:0);
