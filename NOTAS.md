# Notas do projeto

## Economia de contexto (recomendações)

1. Modularizar arquivos grandes: `trilhas.js` (516), `storage.js` (443), `professor.js` (368). Plano abaixo.
2. Dividir `css/estilo.css` (~1000 linhas) em um arquivo por tela.
3. Rodar `/fewer-permission-prompts` para liberar comandos de leitura.
4. Pedidos: indicar arquivos com `@arquivo` + objetivo em uma frase; `/clear` ao trocar de assunto; `/compact` com direcionamento em tarefas longas.
5. Registrar aqui decisões que precisam sobreviver ao `/clear`.

## Plano de modularização

Ordem: do menor risco ao maior. Rodar `validar-dados.js` + `teste-navegador.js` após cada passo.
Todo arquivo novo entra na lista do `sw.js` (subir `CACHE`) e na de `ferramentas/validar-dados.js`.

### Passo 1: `js/storage.js` (443 → 205) ✅ feito
- `js/storage/perfis.js`: `lerPerfis`, `gravarPerfis`, `sufixo`, `perfis`.
- `js/storage/sanitizar.js`: validadores (`obj`, `lista`, `txt`, `num`...) + `sanitizarDados`.
- `js/storage.js` mantém `storage`, `estadoInicial`, integridade (hash/nonce) e reexporta o resto.

### Passo 2: `js/professor.js` (368 → 70) ✅ feito (+ `professor/estado.js`: estado e download comum; fora do `sw.js`, como a página)
- `js/professor/chaves.js`: gerar, importar, copiar e baixar chaves.
- `js/professor/resultados.js`: `renderizarResultados` + formatadores.
- `js/professor/exportar.js`: CSV, `baixarTexto`, limpar.
- `js/professor.js` fica como entrada: decriptação e ligação dos módulos.

### Passo 3: `js/trilhas.js` (516 → 107) ✅ feito (+ `trilha/resultado.js`; troca de etapa via `ctx.ir`)
- Etapas recebem um contexto `{ estado, container, registrarCleanup, salvarDados, avancar }`.
- `js/trilha/leitura.js`: timer de leitura + `renderLeitura`.
- `js/trilha/compreensao.js`: iniciar/render/responder/finalizar compreensão.
- `js/trilha/quiz.js`: `sortearQuestoes` + iniciar/render/responder/finalizar quiz.
- `js/trilhas.js` mantém `renderTrilha` e `cleanupTrilha` (importadores não mudam).

### Passo 4: `css/estilo.css` (1008 → 14 arquivos de 18–229 linhas) ✅ feito (`base.css` virou base + `leitura-quiz` + `lab` + `diversos`; `trilha.css` separado de `trilhas.css` para manter a ordem da cascata)
- `base.css` (linhas 1–467; ler e subdividir se passar de 300), `inicio.css`, `dialogos.css`,
  `desempenho.css`, `identidade.css`, `trilhas.css` (lista + dentro + flashcard), `perfil.css`
  (perfil + cadastro), `treino.css`, `ficha.css`, `telas-grandes.css`.
- `index.html`: um `<link>` por arquivo, **na mesma ordem atual** (cascata).
- Atualizar `css/CLAUDE.md` e `js/CLAUDE.md` removendo as exceções.

## Histórico (tarefas importantes)

- Monitoramento automático do PR desativado (sem tarefas agendadas ativas).
- `CLAUDE.md` da raiz enxugado: só regras globais; regras de domínio em `js/CLAUDE.md` e `css/CLAUDE.md`.
- Modularização concluída (passos 1–4 acima). Decisões que valem daqui em diante:
  - Etapas da trilha (`js/trilha/`) recebem `ctx` e trocam de etapa só por `ctx.ir.*` (sem imports cruzados).
  - Arquivos do professor (`professor.js`, `js/professor/`, `professor.css`) ficam fora do `sw.js`, como a página.
  - CSS: a ordem dos `<link>` no `index.html` é a cascata; não reordenar nem juntar arquivos não vizinhos.
  - `validar-dados.js` confere no `sw.js` todo `js/**` e `css/*.css` (exceto os do professor).
- Cache do `sw.js` em `ondulatoria-v6`.

## Pendências

- Recomendação 3: rodar `/fewer-permission-prompts`.
- Teste de navegador não clica em "Refazer o quiz", "Rever erros" e "Reler o texto"; vale cobrir.
- Sem comparação visual (screenshots) antes/depois da divisão do CSS.
