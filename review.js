const $ = (selector, root = document) => root.querySelector(selector);
let data = { products: [], groups: [], options: [] };
let categories = [];
let results = {};
let stopRequested = false;
let busy = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const key = value => String(value || '').trim().toLocaleLowerCase('pt-BR');

function truthy(value) {
  return ['sim', 's', 'true', '1', 'x', 'yes'].includes(key(value));
}

function money(value) {
  let number;
  if (typeof value === 'number') number = value;
  else {
    let text = String(value ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
    const comma = text.lastIndexOf(','), dot = text.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    else if (comma >= 0) text = text.replace(/\./g, '').replace(',', '.');
    number = Number(text);
  }
  return Number.isFinite(number) ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(value);
}

function related(name) {
  const normalized = key(name);
  return { groups: data.groups.filter(group => key(group['Nome do Produto']) === normalized) };
}

function channels(product) {
  return ['Delivery', 'Salão/ficha', 'Site de delivery', 'Cardápio digital'].filter(column => truthy(product[column]));
}

function issues(product) {
  const errors = [];
  if (!String(product['Nome do Produto'] || '').trim()) errors.push('nome vazio');
  if (!String(product.Categoria || '').trim()) errors.push('categoria vazia');
  const raw = product.Preço;
  const number = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim().includes(',') ? String(raw).replace(/\./g, '').replace(',', '.') : raw);
  if (!Number.isFinite(number) || number < 0) errors.push('preço inválido');
  if (!['Delivery', 'Salão/ficha', 'Site de delivery', 'Cardápio digital'].some(column => truthy(product[column]))) errors.push('marque ao menos uma disponibilidade');
  if (String(product['Descrição para o site (opcional)'] ?? '').length > 400) errors.push('descrição para o site excede 400 caracteres');
  if (categories.length && !categories.some(category => key(category.nome) === key(product.Categoria))) errors.push('categoria não encontrada');
  return errors;
}

function render() {
  const body = $('#rows');
  body.innerHTML = '';
  data.products.forEach((product, index) => {
    const linked = related(product['Nome do Produto']);
    const errors = issues(product);
    const saved = results[index];
    const confirmed = saved?.state === 'confirmed';
    const row = document.createElement('tr');
    if (errors.length) row.className = 'error';
    const alreadyAttempted = Boolean(saved);
    const retryable = saved?.state === 'error' || saved?.state === 'cancelled';
    const checkbox = `<input type="checkbox" class="choose" data-i="${index}" ${errors.length || confirmed ? 'disabled' : ''} ${errors.length || confirmed || (alreadyAttempted && !retryable) ? '' : 'checked'}>`;
    let statusText = 'Aguardando';
    let statusClass = 'status';
    if (confirmed) { statusText = '✔ Cadastro confirmado'; statusClass += ' good'; }
    else if (saved?.state === 'cancelled') statusText = 'Cadastro cancelado';
    else if (saved?.state === 'error') { statusText = saved.text; statusClass += ' bad'; }
    row.innerHTML = `<td>${checkbox}</td><td><strong>${esc(product['Nome do Produto'])}</strong></td><td>${esc(money(product.Preço))}</td><td><select class="category" data-i="${index}"><option value="">Selecione</option>${categories.map(category => `<option ${key(category.nome) === key(product.Categoria) ? 'selected' : ''}>${esc(category.nome)}</option>`).join('')}</select></td><td>${esc(product['Descrição para o site (opcional)'] || '—')}</td><td>${channels(product).length ? channels(product).map(channel => `<span class="chip">${esc(channel)}</span>`).join('') : '<span class="warn">Nenhuma marcada</span>'}</td><td>${linked.groups.map(group => `<div class="hint">${esc(group['Nome do Grupo'])}</div>`).join('') || '—'}</td><td class="${errors.length ? 'bad' : 'good'}">${errors.length ? esc(errors.join('; ')) : 'Pronto'}</td><td class="${statusClass}" data-status="${index}">${esc(statusText)}</td>`;
    body.appendChild(row);
  });
  $('#start').disabled = !categories.length || !data.products.some((product, index) => !issues(product).length && results[index]?.state !== 'confirmed');
  $('#overall').textContent = `${data.products.length} produto(s) · ${data.groups.length} vínculo(s) com grupo`;
}

async function saveResult(index, state, text = '') {
  results[index] = { state, text };
  await chrome.storage.local.set({ saiposExcelResults: results });
  const output = $(`[data-status="${index}"]`);
  if (!output) return;
  output.textContent = state === 'confirmed' ? '✔ Cadastro confirmado' : text;
  output.className = `status${state === 'confirmed' ? ' good' : state === 'error' ? ' bad' : ''}`;
  const checkbox = $(`.choose[data-i="${index}"]`);
  if (checkbox && state === 'confirmed') { checkbox.checked = false; checkbox.disabled = true; }
  else if (checkbox && state !== 'confirmed') checkbox.checked = state === 'error' || state === 'cancelled';
}

(async () => {
  const stored = await chrome.storage.local.get(['saiposExcelProducts', 'saiposExcelGroups', 'saiposExcelOptions', 'saiposExcelResults']);
  data = { products: stored.saiposExcelProducts || [], groups: stored.saiposExcelGroups || [], options: stored.saiposExcelOptions || [] };
  results = stored.saiposExcelResults || {};
  render();
})();

$('#all').addEventListener('change', event => {
  document.querySelectorAll('.choose:not(:disabled)').forEach(checkbox => { checkbox.checked = event.target.checked; });
});

$('#loadCategories').addEventListener('click', async () => {
  const output = $('#categoryStatus');
  output.textContent = 'Consultando a Saipos…';
  const response = await chrome.runtime.sendMessage({ type: 'SAIPOS_EXCEL_GET_CATEGORIES' });
  if (!response?.ok) { output.textContent = response?.error || 'Falha ao consultar.'; output.className = 'bad'; return; }
  categories = response.categories || [];
  output.textContent = `${categories.length} categoria(s) encontradas.`;
  output.className = 'good';
  render();
});

$('#rows').addEventListener('change', event => {
  if (!event.target.matches('.category')) return;
  data.products[Number(event.target.dataset.i)].Categoria = event.target.value;
  render();
});

$('#stop').addEventListener('click', () => {
  stopRequested = true;
  $('#stop').disabled = true;
  $('#overall').textContent = 'O lote vai parar após o produto em andamento.';
});

$('#start').addEventListener('click', async () => {
  if (busy) return;
  const indexes = [...document.querySelectorAll('.choose:checked')].map(checkbox => Number(checkbox.dataset.i));
  if (!indexes.length) return;
  busy = true;
  stopRequested = false;
  $('#start').disabled = true;
  $('#stop').disabled = false;
  let done = 0, failed = 0, haltedBySaipos = false;

  for (const index of indexes) {
    if (stopRequested) break;
    const product = data.products[index];
    const category = categories.find(item => key(item.nome) === key(product.Categoria));
    const linked = related(product['Nome do Produto']);
    const output = $(`[data-status="${index}"]`);
    if (!category) { await saveResult(index, 'error', 'Categoria não encontrada'); failed++; continue; }
    output.textContent = 'Cadastrando na Saipos…';
    const response = await chrome.runtime.sendMessage({ type: 'SAIPOS_EXCEL_CREATE_PRODUCT', payload: { product, groups: linked.groups, options: [], category } });
    if (response?.ok) {
      await saveResult(index, 'confirmed');
      done++;
    } else {
      const reason = response?.reason || response?.error || 'Falha';
      await saveResult(index, 'error', `✘ ${reason}`);
      failed++;
      if (response?.haltBatch) { haltedBySaipos = true; break; }
    }
    $('#overall').textContent = `Processados ${done + failed}/${indexes.length}`;
  }

  $('#stop').disabled = true;
  $('#start').disabled = !categories.length || !data.products.some((product, index) => !issues(product).length && results[index]?.state !== 'confirmed');
  busy = false;
  $('#overall').textContent = haltedBySaipos
    ? `Lote pausado pela Saipos. ${done} confirmado(s), ${failed} com falha. Corrija ou tente novamente o produto marcado.`
    : stopRequested
    ? `Lote parado. ${done} confirmado(s), ${failed} com falha.`
    : `Concluído. ${done} confirmado(s), ${failed} com falha.`;
});
