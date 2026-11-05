// Chạy tại gốc repo sau npm ci trong web. Không kết nối mạng hoặc gửi form.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../web/node_modules/typescript');
const react = require('../web/node_modules/react');
const { renderToStaticMarkup } = require('../web/node_modules/react-dom/server');
const root = path.resolve(__dirname, '..');

function load(file, env, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(code, {
    exports, URL, process: { env },
    require(name) {
      if (name === 'react/jsx-runtime') return require('../web/node_modules/react/jsx-runtime');
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename: file });
  return exports;
}

const configFile = 'web/src/lib/newsletter.ts';
const { newsletterFormUrl } = load(configFile, {});
assert.equal(newsletterFormUrl('https://mautic.example.com', '12'), 'https://mautic.example.com/form/12');
assert.equal(newsletterFormUrl('http://localhost:8082', '1'), 'http://localhost:8082/form/1');
for (const base of [undefined, '', 'not a URL', 'javascript:alert(1)',
  'http://mautic.example.com', 'https://user:secret@mautic.example.com',
  'https://mautic.example.com/api', 'https://mautic.example.com/?token=secret',
  'https://mautic.example.com/#private']) {
  assert.equal(newsletterFormUrl(base, '1'), null, `Reject unsafe base: ${base}`);
}
for (const id of [undefined, '', '0', '-1', '1/../../admin', '1?email=private', 'abc']) {
  assert.equal(newsletterFormUrl('https://mautic.example.com', id), null);
}
for (const enabled of [false, true]) {
  const cfg = load(configFile, {
    NEXT_PUBLIC_MAUTIC_URL: 'https://mautic.example.com',
    NEXT_PUBLIC_MAUTIC_NEWSLETTER_FORM_ID: enabled ? '12' : '',
  });
  const component = load('web/src/components/NewsletterSignup.tsx', {}, { '@/lib/newsletter': cfg }).default;
  const html = renderToStaticMarkup(react.createElement(component));
  assert.equal(html.includes('<iframe'), enabled);
  assert.equal(html.includes('<form'), false); // Gửi trực tiếp ở Mautic, không tạo form lead thứ hai.
  if (enabled) {
    assert.ok(html.includes('src="https://mautic.example.com/form/12"'));
    assert.ok(html.includes('referrerPolicy="no-referrer"'));
    assert.ok(html.includes('rel="noopener noreferrer"'));
  }
}
console.log('FE-21: URL/ID guards, enabled/disabled embed and referrer checks passed. No data sent.');
