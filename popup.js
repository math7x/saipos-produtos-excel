const fileInput = document.getElementById('file');
const reviewButton = document.getElementById('review');
const statusBox = document.getElementById('status');
let workbookData = null;

const PRODUCT_COLUMNS = ['Nome do Produto', 'Preço', 'Categoria'];
const GROUP_COLUMN = 'Grupo de Opção';

function status(message, kind = '') {
  statusBox.style.display = 'block';
  statusBox.className = kind;
  statusBox.textContent = message;
}
function readSheet(book, name) {
  const sheet = book.Sheets[name];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) : [];
}
function filled(row, key) { return String(row[key] ?? '').trim(); }
function parsePrice(value) {
  if (typeof value === 'number') return value;
  const s = String(value || '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!s) return NaN;
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  const normalized=comma>=0&&dot>=0?(comma>dot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')):comma>=0?s.replace(/\./g,'').replace(',','.'):s;
  return Number(normalized);
}

fileInput.addEventListener('change', async () => {
  workbookData = null;
  reviewButton.disabled = true;
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const products = readSheet(book, 'Produtos').filter(r => filled(r, 'Nome do Produto'));
    const missing = PRODUCT_COLUMNS.filter(c => !book.Sheets.Produtos || !(XLSX.utils.sheet_to_json(book.Sheets.Produtos, { header: 1 })[0] || []).includes(c));
    if (missing.length) throw new Error(`Na aba Produtos, faltam colunas: ${missing.join(', ')}.`);
    if (!products.length) throw new Error('Não encontrei linhas preenchidas na aba Produtos.');
    const groups = products.filter(p => filled(p, GROUP_COLUMN)).map(p => ({ 'Nome do Produto': filled(p, 'Nome do Produto'), 'Nome do Grupo': filled(p, GROUP_COLUMN) }));
    const problems = [];
    products.forEach((p, i) => {
      const rowNum = i + 2;
      const price = parsePrice(p['Preço']);
      if (!Number.isFinite(price) || price < 0) problems.push(`Produtos, linha ${rowNum}: preço inválido.`);
      else p['Preço'] = price;
      if (!filled(p, 'Categoria')) problems.push(`Produtos, linha ${rowNum}: categoria vazia.`);
      if (filled(p, 'Descrição para o site (opcional)').length > 400) problems.push(`Produtos, linha ${rowNum}: a descrição para o site excede 400 caracteres.`);
    });
    if (problems.length) throw new Error(problems.slice(0, 8).join(' '));
    workbookData = { products, groups, options: [] };
    reviewButton.disabled = false;
    status(`Planilha válida: ${products.length} produto(s) e ${groups.length} vínculo(s) com grupos de opções.`, 'ok');
  } catch (error) { status(error.message || 'Não consegui ler essa planilha.', 'err'); }
});

reviewButton.addEventListener('click', async () => {
  if (!workbookData) return;
  reviewButton.disabled = true;
  status('Abrindo a revisão…');
  const response = await chrome.runtime.sendMessage({ type: 'SAIPOS_EXCEL_OPEN_REVIEW', ...workbookData });
  if (!response?.ok) {
    status(response?.error || 'Não consegui abrir a revisão.', 'err');
    reviewButton.disabled = false;
  } else window.close();
});
