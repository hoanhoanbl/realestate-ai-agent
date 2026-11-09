// BF-07: chạy component với hook/router giả lập, không gửi dữ liệu tới Mautic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../web/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const jsx = (type, props) => ({ type, props });
const scoring = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(root, 'web/src/lib/mautic.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, { exports: scoring, process: { env: {} } });

function loadComponent(file, state) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, URL,
    window: state.window, document: state.document,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return {
        Suspense: 'Suspense', useEffect: fn => state.effects.push(fn),
      };
      if (name === 'next/navigation') return { usePathname: () => state.pathname };
      if (name === 'next/script') return { default: 'Script' };
      if (name === '@/lib/mautic') return { ...scoring, MAUTIC_PUBLIC_URL: state.mauticUrl };
      if (name === '@/components/LevelBadge') return { default: 'LevelBadge' };
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename: file });
  return exports.default;
}

const state = {
  pathname: '/', mauticUrl: 'http://mautic.test', effects: [],
  window: { location: { href: 'http://web.test/' } }, document: { referrer: '' },
};
const Tracking = loadComponent('web/src/components/MauticTracking.tsx', state);
function renderTracking(pathname) {
  state.pathname = pathname;
  state.window.location.href = `http://web.test${pathname || '/'}`;
  state.effects = [];
  const inner = Tracking().props.children;
  const rendered = inner.type(inner.props);
  for (const effect of state.effects) effect();
  return rendered;
}

const privatePaths = ['/lich', '/hop-dong', '/ky', '/cam-nhan', '/admin'];
for (const prefix of privatePaths) {
  for (const route of [prefix, `${prefix}/SECRET`, `${prefix}/SECRET/details`]) {
    assert.equal(renderTracking(route), null, `Must not load script on ${route}`);
    assert.equal(state.window.mt, undefined, `Must not queue pageview on ${route}`);
  }
}
assert.equal(renderTracking(null), null);
state.mauticUrl = '';
const DisabledTracking = loadComponent('web/src/components/MauticTracking.tsx', state);
const disabledInner = DisabledTracking().props.children;
state.pathname = '/nha/1';
assert.equal(disabledInner.type(disabledInner.props), null);
state.effects = [];
state.mauticUrl = 'http://mautic.test';
assert(renderTracking('/nha/1'), 'Public property must load script');
assert.equal(state.window.mt.q.length, 1);
const firstHit = state.window.mt.q[0];
assert.equal(firstHit[2].page_url, 'http://web.test/nha/1');
assert.equal(renderTracking('/lich/SECRET'), null);
assert.equal(state.window.mt.q.length, 1, 'SPA navigation must not queue secret URL');
assert.equal(firstHit[2].page_url, 'http://web.test/nha/1', 'Queued URL must stay public');
for (const prefix of privatePaths) {
  state.document.referrer = `http://web.test${prefix}/SECRET`;
  renderTracking('/');
  assert.equal(state.window.mt.q.at(-1)[2].referrer, '', 'Private referrer must be removed');
}
state.document.referrer = 'https://search.test/results';
renderTracking('/nha/2');
assert.equal(state.window.mt.q.at(-1)[2].referrer, state.document.referrer);
state.document.referrer = 'invalid URL';
renderTracking('/');
assert.equal(state.window.mt.q.at(-1)[2].referrer, '');

const ScoreCard = loadComponent('web/src/components/MauticScoreCard.tsx', state);
const card = (score, points, level = 'WARM') => JSON.stringify(ScoreCard({
  lead: { score, level, mauticPoints: points },
}));
assert(card(69, 20).includes('Tương tác bứt phá'));
for (const score of [70, 74, 75, 100]) {
  assert(card(score, 20).includes('Ưu tiên số 1'), `AI ${score} must be hot`);
  assert(card(score, 19).includes('Tiềm năng cao nhưng đang nguội'));
}
assert(card(null, 20, 'HOT').includes('Ưu tiên số 1'));
assert(card(null, 20).includes('Tương tác bứt phá'));

// Chạy các hàm thực tế của hai trang để bắt lỗi thẻ và bộ lọc khác quy tắc.
function pageFunctions(file, names, constants) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(declarations.length, names.length);
  const code = declarations.map(node => node.getText(source)).join('\n');
  const context = { ...constants, isHotLead: scoring.isHotLead, ENGAGED_POINTS: 20 };
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  return context;
}
const { buildMatrix } = pageFunctions('web/src/app/admin/page.tsx', ['buildMatrix']);
const { matchesFilter } = pageFunctions('web/src/app/admin/leads/page.tsx', ['isEngaged', 'matchesFilter']);
for (const score of [null, 0, 39, 40, 69, 70, 74, 75, 100]) {
  for (const level of [null, 'COLD', 'WARM', 'HOT']) {
    for (const points of [undefined, 0, 19, 20, 25]) {
      const lead = { score, level, mauticPoints: points };
      const hot = level === 'HOT' || (score !== null && score >= 70);
      const engaged = (points ?? 0) >= 20;
      const matrix = buildMatrix([lead]);
      assert.equal(matrix.vipHot, Number(hot && engaged));
      assert.equal(matrix.coolingHot, Number(hot && !engaged));
      assert.equal(matrix.breakthrough, Number(!hot && engaged));
      assert.equal(matrix.nurturing, Number(!hot && !engaged));
      assert.equal(matchesFilter(lead, 'VIP_HOT'), hot && engaged);
      assert.equal(matchesFilter(lead, 'HIGH_ENGAGEMENT'), engaged);
      assert.equal(matchesFilter(lead, 'WARM'), level === 'WARM');
    }
  }
}
console.log('PASS: BF-07 private routes, SPA queue, referrer and scoring boundaries.');
