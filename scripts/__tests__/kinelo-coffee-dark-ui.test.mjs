import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import Module from "node:module";
import path from "node:path";
import ts from "typescript";
import postcss from "postcss";

const root = process.cwd();
const oldSha = "1fb9b194de86da4d66521ca50df024d7f9561460";
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const baseline = file => execFileSync("git", ["show", `${oldSha}:${file}`], { encoding: "utf8" });
const contrast = (hexA, hexB) => {
  const light = hex => {
    const [r,g,b] = hex.match(/[a-f0-9]{2}/gi).map(n => parseInt(n,16)/255)
      .map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4);
    return .2126*r + .7152*g + .0722*b;
  };
  const a=light(hexA),b=light(hexB);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
};
function renderHero(props={}) {
  const source=read("app/components/MainPageHero.tsx");
  const compiled=ts.transpileModule(source,{
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}
  }).outputText;
  const file=path.join(root,"app/components/hero-dark-test.cjs");
  const mod=new Module(file);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
  mod._compile(compiled,file);
  const req=createRequire(file);
  return req("react-dom/server").renderToStaticMarkup(req("react").createElement(mod.exports.default,props));
}
test("reference dark palette, CSS parsing and accessible contrast", () => {
  const css=read("src/styles/kinelo-coffee-dark.css");
  assert.doesNotThrow(()=>postcss.parse(css));
  for (const x of ["#151618","#222327","#DDBB84","#F7F6F4","#96969B"]) assert.ok(css.includes(x),x);
  for (const [fg,bg] of [["F7F6F4","151618"],["B7B6B7","222327"],["96969B","151618"],["19191B","DDBB84"]])
    assert.ok(contrast(fg,bg)>=4.5, `${fg} vs ${bg}`);
  assert.ok(css.includes("safe-area-inset-bottom"));
  assert.ok(css.includes("prefers-reduced-motion"));
});
test("brand header has real camera action, accessible menu, and three mobile destinations", () => {
  const shell=read("app/layout.tsx");
  assert.ok(shell.includes('import "@/styles/kinelo-coffee-dark.css"'));
  assert.ok(shell.indexOf('import "@/styles/kinelo-coffee-dark.css"') > shell.indexOf('import "@/styles/kinelo-coffee.css"'));
  assert.ok(shell.includes("<CoffeeHeaderActions />"));
  assert.ok(shell.includes("<CoffeeWebAnalytics />"));
  const menu=read("app/components/CoffeeHeaderActions.tsx");
  assert.ok(menu.includes('href="/record/photo"'));
  assert.ok(menu.includes('aria-label="전체 메뉴"'));
  assert.ok(menu.includes('event.key === "Escape"'));
  const nav=read("app/components/BottomNavigation.tsx");
  assert.ok(nav.includes('href: "/beans"') && nav.includes('href: "/my-beans"'));
  assert.equal((nav.slice(nav.indexOf("const mobileItems"),nav.indexOf("const desktopItems")).match(/label: ".*", icon: (?:House|Coffee|Heart)/g)||[]).length,3);
  assert.ok(!nav.includes("주문하기") && !nav.includes("쿠폰/리워드"));
});
test("photographic home displays grounded bean fixture without imaginary locations/coupons", () => {
  const bean={id:"bean-safe-id",name:"실제 로스터리 원두",brand:"실제 브랜드",image:"https://example.com/bean.jpg",price:"19,000원"};
  const html=renderHero({featuredBeans:[bean]});
  assert.ok(html.includes('href="/beans/bean-safe-id"'));
  assert.ok(html.includes('src="https://example.com/bean.jpg"'));
  assert.ok(html.includes("실제 로스터리 원두"));
  assert.ok(html.includes("19,000원"));
  for (const nonFact of ["강남역점","성수본점","1.9km","4.4km","아메리카노 100원"])assert.ok(!html.includes(nonFact),nonFact);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
});
test("empty featured collection gives an honest fallback without fake photos", () => {
  const html=renderHero();
  assert.ok(html.includes("나에게 맞는 원두 찾기"));
  assert.ok(!html.includes("최근 수집 원두"));
  assert.ok(html.includes('href="/changes"'));
  assert.ok(html.includes('href="/premium"'));
});
test("home feature data is live catalog with filtered HTTPS image and caching", () => {
  const file=read("app/page.tsx");
  assert.ok(file.includes('collection(db, "beans")'));
  assert.ok(file.includes('orderBy("lastUpdated", "desc")'));
  assert.ok(file.includes("seenBrands.has(brand)"));
  assert.ok(file.includes('url.protocol === "https:"'));
  assert.ok(file.includes("revalidate: 1800"));
  assert.ok(!file.includes("강남역점"));
  assert.ok(!file.includes("mockBeans"));
});
test("existing change-feed validation/analytics events and Firestore write paths remain unchanged", () => {
  const changed=read("app/changes/page.tsx");
  assert.ok(changed.includes('event="changes_store_open"'));
  assert.ok(changed.includes('event="change_detail_open"'));
  assert.ok(changed.includes('<ChangesViewSignal />'));
  assert.ok(changed.includes("실시간 재고가 아닙니다"));
  const changedNames=execFileSync("git",[
    "diff","--name-only",oldSha,"--",".github","app/api","coffee_crawler","scripts/reset_all_active_cafes_from_crawl.mjs",
    "firestore.rules","package.json","package-lock.json","src/lib/reportCoffeeFunnel.ts","src/lib/coffeeFunnelEvents.ts"
  ],{encoding:"utf8"}).trim();
  assert.equal(changedNames,"");
});
test("benefit style is real favorites and alert configuration, not fictional coupons", () => {
  const favorites=read("app/my-beans/page.tsx");
  const alert=read("app/settings/alerts/AlertSettingsView.tsx");
  assert.ok(favorites.includes('aria-current="page">찜한 원두'));
  assert.ok(favorites.includes("handleGoogleLogin"));
  assert.ok(favorites.includes("handleRemove(bean.id)"));
  assert.ok(alert.includes('aria-current="page">알림 설정'));
  for(const s of [favorites,alert])assert.ok(!s.includes("아메리카노 100원"));
});
