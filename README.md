# Cadastro de Produtos Saipos por Excel

Extensão Chrome/Brave em Manifest V3 para importar uma planilha local, revisar os produtos e cadastrar cada item no formulário da Saipos.

> Projeto independente, sem vínculo oficial com a Saipos.

## Instalação

1. Abra `chrome://extensions` (ou `brave://extensions`).
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione esta pasta.
4. Abra uma aba em `https://conta.saipos.com/` e entre na sua conta.
5. Prepare a sua própria planilha seguindo os campos descritos abaixo.

## Campos do modelo

- **Produtos:** nome, preço, categoria, canais de disponibilidade (Delivery, Salão/ficha, Site de delivery e Cardápio digital), descrição online opcional e **Grupo de Opção** opcional. A descrição tem limite de 400 caracteres e é preenchida em “Disponibilidade e detalhes” na Saipos.
- Se **Grupo de Opção** ficar vazio, o produto será cadastrado sem grupo.
- Para cada nome de grupo, a extensão procura primeiro um grupo igual na Saipos. Se encontrar, associa o grupo ao produto. Se não encontrar, cria o grupo com uma opção provisória chamada **teste**, com mínimo 1 e máximo 1.
- Quando outro produto usar o mesmo nome, a extensão seleciona o grupo já cadastrado em **Usar opções já cadastradas**. Grupos compartilhados podem afetar todos os produtos que os utilizam.

## Fluxo

1. Selecione o Excel no popup da extensão.
2. A extensão valida os campos obrigatórios, os preços e o limite da descrição.
3. Na tela de revisão, carregue as categorias atuais da Saipos e confira os produtos.
4. Revise os itens e clique em **Cadastrar selecionados**. A extensão preenche os produtos selecionados automaticamente, um de cada vez.
5. Use **Parar lote** para interromper o processo após o produto em andamento.
6. Os produtos confirmados ficam marcados e não são enviados novamente ao reabrir a mesma revisão. Para uma nova planilha, os resultados começam limpos.
7. A extensão indica o resultado por linha. Se não conseguir confirmar o salvamento, confira a Saipos antes de tentar esse produto de novo.

## Limites

- O grupo criado e a opção provisória são salvos na Saipos antes do produto. Se o cadastro do produto falhar depois, o grupo poderá continuar cadastrado e será reutilizado na próxima tentativa.
- A extensão cria produtos novos e não procura duplicidades nem atualiza itens existentes.
- A interface da Saipos pode mudar. Confira o primeiro cadastro antes de processar o restante da planilha.

A planilha e os dados são processados localmente no navegador. A extensão não possui servidor próprio.

## Privacidade e cuidados

- A extensão não envia a planilha para serviços externos.
- O cadastro é feito somente após revisão e confirmação na própria Saipos.
- O repositório não inclui cardápios ou planilhas de clientes. Use uma cópia da sua planilha operacional ao carregar a extensão.

## Autoria

Desenvolvido por [math7x](https://github.com/math7x).


