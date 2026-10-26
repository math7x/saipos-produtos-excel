(() => {
  'use strict';
  const CATEGORY_HOME = '#/app/v2/cardapio/categories/0';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = el => el instanceof Element && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const waitFor = async (fn, timeout = 9000) => { const end = Date.now() + timeout; while (Date.now() < end) { const r = fn(); if (r) return r; await sleep(150); } return null; };
  const clickable = el => el?.closest('button,a,[role="button"],[role="option"],md-option,mat-option') || el;
  const visibleText = (text, root = document) => [...root.querySelectorAll('button,a,label,span,div,p,li,[role="button"],[role="option"]')].filter(visible).find(el => norm(el.textContent) === norm(text));
  function setValue(el, value) {
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, String(value)); else el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }
  function numericMoney(value) {
    if (typeof value === 'number') return value;
    let s=String(value??'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
    const comma=s.lastIndexOf(','), dot=s.lastIndexOf('.');
    if(comma>=0&&dot>=0)s=comma>dot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
    else if(comma>=0)s=s.replace(/\./g,'').replace(',','.');
    else if(dot>=0&&/^[-+]?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
    return Number(s);
  }
  async function setCurrency(el, value) {
    if (!el) return false;
    const amount=numericMoney(value);
    if(!Number.isFinite(amount))return false;
    // Saipos' currencymask listens to key events to update its Angular model.
    // Setting the text (even with input/change) only changes what is painted
    // in the box and leaves the price control invalid.
    const key = (digit, type) => {
      const code=`Digit${digit}`, keyCode=48+Number(digit);
      el.dispatchEvent(new KeyboardEvent(type,{bubbles:true,cancelable:true,key:digit,code,keyCode,which:keyCode}));
    };
    el.focus();el.select();
    for(const type of ['keydown','keypress','keyup']) {
      el.dispatchEvent(new KeyboardEvent(type,{bubbles:true,cancelable:true,key:'Backspace',code:'Backspace',keyCode:8,which:8}));
    }
    await sleep(80);
    const cents=Math.round(amount*100);
    for(const digit of String(cents)) {
      key(digit,'keydown');key(digit,'keypress');key(digit,'keyup');
      await sleep(35);
    }
    await sleep(200);el.blur();
    await sleep(120);
    return Math.abs(numericMoney(el.value)-amount)<0.005 && !el.classList.contains('ng-pristine') && !el.classList.contains('ng-invalid');
  }
  async function findPriceField() {
    return await waitFor(() => {
      const visibleInputs = [...document.querySelectorAll('input')].filter(el => visible(el) && !['checkbox','radio','button','submit','hidden'].includes(el.type));
      const direct = visibleInputs.find(el => el.hasAttribute('currencymask'))
        || visibleInputs.find(el => /price|preco|valor/i.test(`${el.getAttribute('formcontrolname') || ''} ${el.name || ''} ${el.id || ''}`));
      if (direct) return direct;
      const label = [...document.querySelectorAll('label')].find(el => visible(el) && norm(el.textContent).replace(/[:*]/g, '') === 'preco');
      if (!label) return null;
      const forId = label.htmlFor && document.getElementById(label.htmlFor);
      if (forId instanceof HTMLInputElement && visible(forId)) return forId;
      let node = label;
      for (let i = 0; node && i < 4; i++, node = node.parentElement) {
        const input = [...node.querySelectorAll('input')].find(visible);
        if (input) return input;
      }
      return null;
    }, 8000);
  }
  const visibleProductName = () => {
    const field = document.getElementById('product-name');
    return field && visible(field) ? field : null;
  };
  function setCheck(id, desired) {
    const el = document.getElementById(id);
    if (!el || !(el instanceof HTMLInputElement) || el.type !== 'checkbox') return false;
    if (el.checked !== desired) el.click();
    return el.checked === desired;
  }
  async function clickText(text, root = document) {
    const el = visibleText(text, root); if (!el) return false; clickable(el).click(); await sleep(250); return true;
  }
  async function clickButtonText(text, root = document) {
    const button = [...root.querySelectorAll('button')].find(b => visible(b) && norm(b.innerText || b.textContent) === norm(text));
    if (!button) return false;
    button.click();
    await sleep(300);
    return true;
  }
  async function fillOnlineDetails(value) {
    const description=String(value??'').trim();
    if(!description)return true;
    if(description.length>400)throw new Error('A descrição para o site excede o limite de 400 caracteres da Saipos.');
    if(!await clickText('Disponibilidade e detalhes'))throw new Error('Não encontrei a aba “Disponibilidade e detalhes”.');
    const field=await waitFor(()=>[...document.querySelectorAll('textarea')].find(el=>visible(el)&&(/fale um pouco mais sobre este item/i.test(el.placeholder)||el.maxLength===400)));
    if(!field)throw new Error('Não encontrei o campo Detalhes da Saipos.');
    setValue(field,description);
    await sleep(150);
    if(field.value.trim()!==description)throw new Error('A descrição do produto não foi aceita no campo Detalhes.');
    return true;
  }
  async function categories() {
    location.hash = CATEGORY_HOME;
    if (!await waitFor(() => document.querySelector('a.categories-list-item-link'))) return [];
    await sleep(300);
    const names = [...new Set([...document.querySelectorAll('a.categories-list-item-link')].map(a => a.innerText.trim().split('\n')[0]).filter(n => n && n !== 'Todos os produtos'))];
    const result = [];
    for (const name of names) {
      const link = [...document.querySelectorAll('a.categories-list-item-link')].find(a => a.innerText.trim().split('\n')[0] === name);
      if (!link) continue;
      const before=location.hash;
      link.click();
      if (await waitFor(() => location.hash!==before && /#\/app\/v2\/cardapio\/categories\/\d+/.test(location.hash), 4000)) {
        const id = /categories\/(\d+)/.exec(location.hash)?.[1]; if (id) result.push({ nome: name, id });
      }
      await sleep(350);
    }
    location.hash = CATEGORY_HOME;
    return result;
  }
  function choiceGroupCard(id) {
    const toggle = document.getElementById(`choice-switch-${id}`);
    let node = toggle;
    while (node && node !== document.body) {
      if ([...node.querySelectorAll('button')].some(b => norm(b.textContent) === 'editar')) return node;
      node = node.parentElement;
    }
    return null;
  }
  function findChoiceCheckbox(dialog, name) {
    const label = visibleText(name, dialog);
    let node = label;
    for (let i = 0; node && i < 7; i++, node = node.parentElement) {
      const boxes = [...node.querySelectorAll('input[type="checkbox"][id^="choice-check-"]')];
      if (boxes.length === 1) return boxes[0];
    }
    return null;
  }
  async function selectExistingGroup(name) {
    if (!await clickText('Usar opções já cadastradas')) throw new Error('Não encontrei “Usar opções já cadastradas”.');
    const picker = await waitFor(() => [...document.querySelectorAll('.modal.show,[role="dialog"]')].find(visible));
    if (!picker) throw new Error('A lista de grupos já cadastrados não abriu.');
    // Saipos may render this control as type="search" instead of type="text".
    // Prefer its visible placeholder, then fall back to the modal's visible
    // non-choice input so a markup change doesn't strand the product flow.
    const search = await waitFor(() => {
      const inputs = [...picker.querySelectorAll('input')].filter(i => visible(i) && !['checkbox','radio','button','submit','hidden'].includes(i.type));
      return inputs.find(i => /pesquise pelo grupo de opcoes desejado/i.test(norm(i.placeholder))) || inputs[0];
    });
    if (!search) throw new Error('Não encontrei a busca de grupos da Saipos.');
    setValue(search, name);
    const result = await waitFor(() => {
      const checkbox = findChoiceCheckbox(picker, name);
      if (checkbox) return { checkbox };
      if (norm(picker.textContent).includes('nenhum grupo de opcoes encontrado')) return { missing: true };
      return null;
    }, 7000);
    if (!result) throw new Error(`A Saipos não confirmou se o grupo “${name}” existe. Não criei um grupo para evitar duplicidade.`);
    if (result.missing) {
      if (!await clickText('Cancelar', picker)) throw new Error('O grupo não foi encontrado e não consegui fechar a busca.');
      if (!await waitFor(() => !visible(picker))) throw new Error('A busca de grupos não fechou.');
      return false;
    }
    const checkbox = result.checkbox;
    const id = checkbox.id.replace('choice-check-', '');
    if (!checkbox.checked) checkbox.click();
    if (!await clickText('Usar opções selecionadas', picker)) throw new Error('Não encontrei “Usar opções selecionadas”.');
    if (!await waitFor(() => !visible(picker))) throw new Error('A seleção do grupo não fechou.');
    if (!await waitFor(() => choiceGroupCard(id))) throw new Error(`O grupo “${name}” não foi associado ao produto.`);
    return true;
  }
  async function createManualGroup(name) {
    if (!await clickText('Adicionar novo grupo de opções')) throw new Error('Não encontrei “Adicionar novo grupo de opções”.');
    if (!await clickButtonText('Criadas de forma manual')) throw new Error('Não encontrei o botão “Criadas de forma manual”.');
    if (!await waitFor(() => location.hash.includes('(modal:create-choice/other)') || [...document.querySelectorAll('#choice-name')].some(visible), 7000)) throw new Error('Cliquei em “Criadas de forma manual”, mas a Saipos não abriu o formulário do grupo.');
    const modal = await waitFor(() => {
      const nameInput = [...document.querySelectorAll('#choice-name')].find(visible);
      if (!nameInput) return null;
      // This Saipos form is a router-backed overlay and may not carry
      // .modal.show or role="dialog". Find the smallest visible ancestor
      // containing the group heading and its own Save button.
      let node = nameInput;
      while (node && node !== document.body) {
        const hasSave = [...node.querySelectorAll('button')].some(b => norm(b.innerText || b.textContent) === 'salvar');
        if (hasSave && norm(node.innerText || node.textContent).includes('qual o nome deste grupo de opcoes')) return node;
        node = node.parentElement;
      }
      // Some Saipos versions render the modal outside a dedicated dialog
      // container. In that case the visible field plus modal route is enough
      // to confirm it opened; later controls are selected by their own IDs.
      if (location.hash.includes('(modal:create-choice/other)')) return document.body;
      return null;
    }, 15000);
    if (!modal) throw new Error(`O formulário para criar o grupo “${name}” não abriu.`);
    const nameInput = modal.querySelector('#choice-name');
    if (!nameInput) throw new Error('Não encontrei o nome do novo grupo.');
    setValue(nameInput, name);
    const rows = () => [...modal.querySelectorAll('tbody tr')].filter(row => row.querySelector('input[formcontrolname="descStoreChoiceItem"]'));
    if (!rows().length) {
      const add = [...modal.querySelectorAll('button')].find(b => norm(b.textContent).includes('adicionar opcao'));
      if (!add) throw new Error('Não encontrei como adicionar a opção provisória.');
      add.click();
      if (!await waitFor(() => rows().length > 0, 4000)) throw new Error('A linha da opção provisória não apareceu.');
    }
    let optionField = rows()[0].querySelector('input[formcontrolname="descStoreChoiceItem"]');
    if (!optionField) throw new Error('Não encontrei o campo do nome da opção provisória.');
    setValue(optionField, 'teste');
    while (rows().length > 1) {
      const before = rows().length;
      const last = rows().at(-1);
      const remove = last.querySelector('button.btn.text-danger');
      if (!remove) throw new Error('Não consegui remover uma linha vazia do grupo.');
      remove.click();
      if (!await waitFor(() => rows().length < before, 3000)) throw new Error('A linha vazia do grupo não foi removida.');
    }
    const minimum = modal.querySelector('input[formcontrolname="minChoices"]');
    const maximum = modal.querySelector('input[formcontrolname="maxChoices"]');
    if (!minimum || !maximum) throw new Error('Não encontrei os campos de mínimo e máximo do grupo.');
    setValue(minimum, '1'); setValue(maximum, '1');
    if (norm(nameInput.value) !== norm(name) || norm(rows()[0].querySelector('input[formcontrolname="descStoreChoiceItem"]')?.value) !== 'teste' || minimum.value !== '1' || maximum.value !== '1') throw new Error(`A configuração provisória do grupo “${name}” não foi aceita.`);
    const save = [...modal.querySelectorAll('button')].filter(b => visible(b) && norm(b.textContent) === 'salvar').at(-1);
    if (!save) throw new Error('Não encontrei Salvar ao criar o grupo.');
    save.click();
    if (!await waitFor(() => !visible(modal), 7000)) throw new Error(`A criação do grupo “${name}” não foi confirmada pela Saipos.`);
    const card = await waitFor(() => {
      const label = visibleText(name);
      let node = label;
      for (let i = 0; node && i < 10; i++, node = node.parentElement) {
        if ([...node.querySelectorAll('button')].some(b => norm(b.textContent) === 'editar')) return node;
      }
      return null;
    });
    if (!card && !await selectExistingGroup(name)) throw new Error(`O grupo “${name}” foi criado, mas não apareceu associado ao produto.`);
  }
  async function ensureGroup(name) {
    if (await selectExistingGroup(name)) return;
    await createManualGroup(name);
  }
  async function openProductForm(category) {
    const categoryRoute = `#/app/v2/cardapio/categories/${encodeURIComponent(category.id)}`;
    const currentCategory = /#\/app\/v2\/cardapio\/categories\/(\d+)/.exec(location.hash)?.[1];
    if (currentCategory !== String(category.id)) {
      location.hash = categoryRoute;
      const arrived = await waitFor(() => /#\/app\/v2\/cardapio\/categories\/(\d+)/.exec(location.hash)?.[1] === String(category.id), 7000);
      if (!arrived) return null;
    }
    // Use the same Saipos action as a person. Directly changing the SPA route
    // works intermittently after a save, when the previous form is still
    // transitioning back to the category list.
    const createButton = await waitFor(() => [...document.querySelectorAll('button')].find(button => visible(button) && norm(button.innerText || button.textContent) === 'cadastrar outros produtos'), 10000);
    if (createButton) {
      createButton.click();
      const opened = await waitFor(visibleProductName, 15000);
      if (opened) return opened;
    }
    // Fallback for Saipos layouts that don't expose the category-list button.
    location.hash = `#/app/v2/cardapio/products/create/other?idStoreCategoryItem=${encodeURIComponent(category.id)}`;
    return await waitFor(visibleProductName, 15000);
  }
  async function createProduct(payload) {
    const p = payload.product || {};
    const groupName = String(p['Grupo de Opção'] || '').trim();
    const name = await openProductForm(payload.category);
    if (!name) return {ok:false,haltBatch:true,reason:'A Saipos não abriu o formulário visível de cadastro. O lote foi pausado para não pular este produto.'};
    await sleep(500);
    const categoryLabel = document.querySelector('.ng-value-label')?.innerText.trim() || '';
    if (categoryLabel && norm(categoryLabel) !== norm(payload.category.nome)) return {ok:false,reason:`Categoria pré-selecionada inesperada: “${categoryLabel}”.`};
    setValue(name, p['Nome do Produto']);
    const price = await findPriceField();
    if (!price) return {ok:false,haltBatch:true,reason:'O formulário abriu, mas o campo de preço não apareceu. O lote foi pausado para não pular este produto.'};
    if(!await setCurrency(price,p.Preço)) return {ok:false,haltBatch:true,reason:'A Saipos não registrou o preço no formulário. O lote foi pausado e nenhum produto foi salvo.'};
    const availability = [['Delivery','product-available-delivery'],['Salão/ficha','product-available-table-order'],['Site de delivery','product-available-site-delivery'],['Cardápio digital','product-available-digital-menu']];
    for (const [col,id] of availability) if (String(p[col]??'').trim() && !setCheck(id,['sim','s','true','1','x'].includes(norm(p[col])))) throw new Error(`Não consegui configurar disponibilidade: ${col}.`);
    await fillOnlineDetails(p['Descrição para o site (opcional)']);
    if (groupName) {
      if (!await clickText('Opções')) throw new Error('Não encontrei a aba Opções.');
      await ensureGroup(groupName);
    }
    const before=location.hash;const save=[...document.querySelectorAll('button')].find(b=>norm(b.textContent)==='salvar');if(!save)throw new Error('Não encontrei o botão Salvar do produto.');save.click();
    const changed=await waitFor(()=>location.hash!==before,8000);if(!changed)return {ok:false,reason:'A tela não mudou após Salvar. Confira erros de validação na Saipos; o resultado não foi confirmado.'};
    return {ok:true};
  }
  chrome.runtime.onMessage.addListener((m,_s,send)=>{
    if(m?.type==='SAIPOS_EXCEL_PAGE_GET_CATEGORIES'){categories().then(categories=>send({ok:true,categories})).catch(e=>send({ok:false,error:e.message}));return true;}
    if(m?.type==='SAIPOS_EXCEL_PAGE_CREATE_PRODUCT'){createProduct(m.payload).then(send).catch(e=>send({ok:false,reason:e.message||String(e)}));return true;}
  });
})();
