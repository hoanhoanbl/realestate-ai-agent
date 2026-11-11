// Chạy sau npm run build trong backend khi thay quy tắc SQL của follow-up.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { FOLLOWUP_SELECTOR_SQL } = require(path.join(root, 'backend/dist/followups/followup-sql.js'));
fs.writeFileSync(path.join(root, 'backend/sql/preview-follow-up.sql'), FOLLOWUP_SELECTOR_SQL + '\n');
const file = path.join(root, 'n8n-workflows/luong-2-follow-up.json');
const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
workflow.nodes.find(n => n.name === 'Lấy lead cần follow-up').parameters.query = FOLLOWUP_SELECTOR_SQL + '\n';
fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n');
