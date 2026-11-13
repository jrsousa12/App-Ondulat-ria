# js/
- `trilhas.js`: entrada da trilha (carrega dados, estado, `ctx`). Etapas em `trilha/` (leitura, compreensão, quiz, resultado); cada uma recebe `ctx` e troca de etapa por `ctx.ir.*`.
- `lab/`: um experimento por arquivo. Experimento novo = arquivo novo + aba em `lab.js` + entrada no `sw.js`.
