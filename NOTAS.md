# Notas do projeto Ondulatória

Instruções de publicação, uso e manutenção do app.

## Onde está o projeto
- Repositório: https://github.com/jrsousa12/App-Ondulat-ria (branch `main`)
- App dos alunos (após ativar o Pages): https://jrsousa12.github.io/App-Ondulat-ria/
- Painel do professor: https://jrsousa12.github.io/App-Ondulat-ria/professor.html
- Conteúdo: `index.html`, `professor.html`, `css/`, `js/` e `dados/` (trilhas, questões e flashcards em JSON).

## Ativar o GitHub Pages
1. No repositório, abra **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Selecione o branch **main** e a pasta **/ (root)**; clique em **Save**.
4. Aguarde 1 a 2 minutos. Se aparecer 404, recarregue com Ctrl+F5.

## Chave do professor (para receber relatórios)
Sem a chave pública, o botão "Gerar arquivo" do aluno informa que o professor ainda não configurou a chave. Hoje `js/chave-publica.js` está com a chave vazia.

1. Abra `professor.html` pelo endereço do Pages (não funciona em `file://`).
2. Clique em **Gerar novo par de chaves**; o navegador baixa `chave-privada-professor-AAAA-MM-DD.json`.
3. Guarde esse arquivo em lugar seguro, com cópia. Se for perdido, os relatórios já enviados não abrem mais. **Nunca suba esse arquivo ao repositório.**
4. Clique em **Baixar chave-publica.js** e substitua `js/chave-publica.js` no repositório.
5. Aguarde o Pages atualizar.

A chave privada fica só na sessão do navegador; em outro dia, importe de novo o `.json` guardado.

## Relatórios dos alunos
1. O aluno abre **Perfil → Enviar para o professor → Gerar arquivo** e manda o `.json` pelo canal combinado.
2. No `professor.html`, importe a chave privada e clique em **Selecionar e decifrar relatórios** (aceita vários arquivos).
3. "Integridade OK" indica arquivo não alterado; "Integridade FALHOU" indica alteração.
4. **Exportar CSV** gera a planilha com todos os alunos carregados.

O progresso do aluno fica só no navegador do aparelho. Em Perfil ele pode baixar backup, importar ou apagar tudo.

## Atualizar o app
Os arquivos formam um conjunto (`utils.js`, `storage.js`, `audio.js`, `lab.js`, `relatorio.js`, `estilo.css` dependem uns dos outros). Misturar versões antigas e novas quebra o app.
1. Faça mudanças em um branch novo.
2. Teste o conjunto inteiro (cada rota, um quiz, gerar relatório).
3. Junte ao `main`; o Pages republica sozinho.

## Pendências
- [ ] **Trabalhar na exclusão do modo professor com PIN** (decisão do professor; detalhes no `CLAUDE.md`).
- [ ] Ativar o GitHub Pages.
- [ ] Gerar o par de chaves e subir `js/chave-publica.js`.
- [ ] Trilha 2, seção 4 (`dados/trilha-2.json`): o texto diz "λ ≈ 0,068 m no aço (~29 vezes mais rápido)". O correto é λ = 5000/170 ≈ 29,4 m, e o aço é cerca de 15 vezes mais rápido que o ar.
- [ ] Contraste de cores: cartão de trilha bloqueada, botão secundário e selo "Concluída" no tema escuro.
- [ ] Aviso de abertura em `file://` e navegação por setas nas abas.
