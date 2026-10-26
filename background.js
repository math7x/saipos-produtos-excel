chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'SAIPOS_EXCEL_OPEN_REVIEW') {
    (async () => {
      const tabs = await chrome.tabs.query({ url: 'https://conta.saipos.com/*' });
      if (!tabs.length) throw new Error('Abra o Saipos e entre na sua conta antes de continuar.');
      await chrome.storage.local.set({
        saiposExcelProducts: message.products,
        saiposExcelGroups: message.groups,
        saiposExcelOptions: message.options,
        saiposExcelResults: {},
        saiposExcelTabId: tabs[0].id,
        saiposExcelImportedAt: Date.now()
      });
      await chrome.tabs.create({ url: chrome.runtime.getURL('review.html') });
      return { ok: true };
    })().then(respond, error => respond({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'SAIPOS_EXCEL_GET_CATEGORIES') {
    (async () => {
      const tabs = await chrome.tabs.query({ url: 'https://conta.saipos.com/*' });
      if (!tabs.length) throw new Error('Não encontrei uma aba aberta da Saipos.');
      return await chrome.tabs.sendMessage(tabs[0].id, { type: 'SAIPOS_EXCEL_PAGE_GET_CATEGORIES' });
    })().then(respond, error => respond({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'SAIPOS_EXCEL_CREATE_PRODUCT') {
    (async () => {
      const { saiposExcelTabId } = await chrome.storage.local.get('saiposExcelTabId');
      if (!saiposExcelTabId) throw new Error('A sessão de importação expirou. Reabra a planilha.');
      const tab = await chrome.tabs.get(saiposExcelTabId);
      if (!tab.url?.startsWith('https://conta.saipos.com/')) throw new Error('A aba da Saipos não está mais disponível.');
      return await chrome.tabs.sendMessage(saiposExcelTabId, {
        type: 'SAIPOS_EXCEL_PAGE_CREATE_PRODUCT', payload: message.payload
      });
    })().then(respond, error => respond({ ok: false, error: error.message }));
    return true;
  }
});
