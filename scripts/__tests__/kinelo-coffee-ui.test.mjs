import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import Module from 'node:module';
import ts from 'typescript';
import postcss from 'postcss';

const root=process.cwd();
const base='19dcc989a71e50c02aaac573bbb8f14375708c75';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const before=p=>execFileSync('git',['show',`${base}:${p}`],{encoding:'utf8'});
function declaration(source,name){
  const file=ts.createSourceFile('source.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let found;
  function visit(node){if((ts.isFunctionDeclaration(node)||ts.isVariableDeclaration(node))&&node.name?.getText(file)===name)found=node;ts.forEachChild(node,visit);}
  visit(file);assert.ok(found,`Missing declaration ${name}`);
  return ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,found,file);
}
function contrast(a,b){
  const l=hex=>{const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
  const x=l(a),y=l(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

test('Kinelo source palette and readable light-theme pairs',()=>{
  const css=read('src/styles/kinelo-coffee.css');
  for(const token of ['#F5F7F6','#EAF3EF','#14231F','#205C53','#F7F1E5'])assert.ok(css.includes(token));
  for(const pair of [['FFFFFF','205C53'],['56635E','F5F7F6'],['65706C','FFFFFF']])assert.ok(contrast(...pair)>=4.5,pair.join('/'));
  assert.doesNotThrow(()=>postcss.parse(css));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes('safe-area-inset-bottom'));
});
test('Brand and semantic shell preserve the canonical URL and analytics',()=>{
  const layout=read('app/layout.tsx');
  assert.ok(layout.includes('KineloCoffeeBrand'));
  assert.ok(layout.includes('coffee-omega-lovat.vercel.app'));
  assert.ok(layout.includes('<CoffeeWebAnalytics />'));
  assert.ok(layout.includes('href="#coffee-content"'));
  assert.ok(!layout.includes('<h1'));
  assert.ok(!layout.includes('next/font/google'));
  assert.ok(read('src/components/KineloCoffeeBrand.tsx').includes('Kinelo Coffee 홈'));
});
test('Data validation and public product fetching remain identical',()=>{
  for(const [p,names] of [['app/changes/page.tsx',['loadChanges','numericPrice','sourceLink']],['app/beans/[id]/page.tsx',['getBean','decodeParam','val']]]){
    for(const name of names)assert.equal(declaration(read(p),name),declaration(before(p),name),`${p}:${name}`);
  }
});
test('Wishlist save/removal and login handlers remain identical',()=>{
  for(const [p,names] of [['app/beans/BeanFinderClient.tsx',['toggleWishlist']],['app/my-beans/page.tsx',['handleRemove','handleGoogleLogin']]]){
    for(const name of names)assert.equal(declaration(read(p),name),declaration(before(p),name),`${p}:${name}`);
  }
});
test('No crawler, API, auth rules, tracking contract or dependencies changed',()=>{
  const diff=execFileSync('git',['diff','--name-only',base,'--','coffee_crawler','config','.github','app/api','firestore.rules','package.json','package-lock.json','src/lib/reportCoffeeFunnel.ts','src/lib/coffeeFunnelEvents.ts','src/firebase.ts','app/settings/alerts/page.tsx'],{encoding:'utf8'}).trim();
  assert.equal(diff,'');
});
test('Existing feed and retailer event names are preserved',()=>{
  const feed=read('app/changes/page.tsx'),detail=read('app/beans/[id]/page.tsx');
  for(const event of ['change_detail_open','changes_store_open','alerts_interest'])assert.ok(feed.includes(`event="${event}"`));
  assert.ok(feed.includes('<ChangesViewSignal />'));
  assert.ok(detail.includes('event="bean_store_open"'));
  assert.ok(feed.includes('실시간 재고가 아닙니다'));
});
test('Filters remain controlled and have native keyboard labels',()=>{
  const filter=read('app/components/FilterDropdown.tsx');
  assert.ok(filter.includes('htmlFor={id}'));
  assert.ok(filter.includes('value={selectedValue}'));
  assert.ok(filter.includes('onSelect(event.target.value)'));
  assert.ok(filter.includes('option.count'));
});
test('Home SSR exposes every existing destination without waiting for authentication',()=>{
  const source=read('app/components/MainPageHero.tsx');
  const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const filename=path.join(root,'app/components/home-ui-test.cjs');
  const m=new Module(filename);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(compiled,filename);
  const req=createRequire(filename),React=req('react'),server=req('react-dom/server');
  const html=server.renderToStaticMarkup(React.createElement(m.exports.default));
  for(const route of ['/beans','/changes','/my-beans','/record/photo','/record/manual','/history','/cafes','/onboarding','/premium'])assert.ok(html.includes(`href="${route}"`),route);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.ok(html.includes('커피를 고르는'));
  assert.ok(!source.includes('loadFirebaseAuth'));
});
test('All changed TS/TSX files parse, and restored brand artwork exists',()=>{
  const tracked=execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n');
  const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n');
  for(const p of new Set([...tracked,...untracked].filter(x=>/\.tsx?$/.test(x)))){
    const result=ts.transpileModule(read(p),{fileName:p,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});
    assert.equal(result.diagnostics?.length??0,0,p);
  }
  const logo=read('public/kinelo-coffee-symbol.svg');
  assert.ok(logo.includes('viewBox="0 0 409.1 409.1"'));
  assert.ok(logo.includes('#1E263B')&&logo.includes('#98A9C4'));
  for(const p of ['public/og-image.png','public/icon-192.png','public/icon-512.png','app/favicon.ico'])assert.ok(fs.statSync(path.join(root,p)).size>100);
});
