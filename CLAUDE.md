# CLAUDE.md

Prioridade: economizar contexto e tokens. Regras obrigatórias.

## Projeto
- PWA estático: HTML + CSS + JS puro (ES modules). Sem framework, build ou servidor.
- Dados em `dados/*.json`. Offline via `sw.js`. Publicado no GitHub Pages.
- Rodar: `python -m http.server 8000` (`file://` não funciona).
- Testes: `node ferramentas/validar-dados.js` e `node ferramentas/teste-navegador.js` (requer `npm i --no-save playwright@1.48.2`).
- Lint (igual ao CI): `for f in $(find js ferramentas -name '*.js') sw.js; do node --check "$f"; done`
- Convenções: nomes em português; funções em camelCase, constantes em UPPER_SNAKE; um módulo por tela/responsabilidade.
- Arquivo novo em `js/` ou `dados/` → incluir no `sw.js` e subir a versão de `CACHE`.
- Plano e decisões pendentes: `NOTAS.md`.

## Tamanho de arquivo
- Máximo 300 linhas; ideal abaixo de 200.
- Arquivo acima do limite → propor modularização e **perguntar** antes de editá-lo. O usuário decide.
- Funcionalidade nova já nasce em módulos pequenos.
- Exceções ficam no `CLAUDE.md` do subdiretório (`js/`, `css/`).

## CLAUDE.md
- Raiz: só regras globais, comandos e convenções. Subpastas: regras do domínio.
- Curtos, em bullets. Este arquivo: abaixo de 200 linhas.
- Revisar quando mudar a estrutura (stack, módulo, fluxo).

## Leitura e edição
- Ler só arquivos e trechos relevantes; não varrer o projeto nem reler o que já foi lido.
- Preferir edições pontuais a reescrever arquivos.
- Tarefa complexa → plano em passos, validado com o usuário antes de codar.

## Terminal
- Silenciar saídas longas (`-q`, `--silent`) ou filtrar (`| grep -E "FAIL|PASS|Error"`).

## Sessão
- Avisar em uma frase, com o motivo, quando:
  - mudar de assunto ou concluir tarefa → sugerir `/clear`;
  - conversa longa na mesma tarefa → sugerir `/compact <direcionamento>`;
  - arquivo em edição chegar a 300 linhas → pausar e propor modularização.
