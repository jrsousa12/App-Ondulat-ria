# Instruções para o Claude neste projeto

## Lembrete obrigatório ao mexer no projeto
Sempre que o professor (Ivaldo) pedir qualquer alteração, análise ou publicação neste repositório, **comece a resposta lembrando**: "Pendente: excluir o modo professor com PIN (decisão do professor). Quer que eu faça agora?" Repita o lembrete até a remoção ser feita e esta seção ser apagada. Não remova nada sem a confirmação dele.

## Decisão: excluir o modo professor com PIN
O professor decidiu excluir a função "modo professor" protegida por PIN (7 toques no logo ou `#prof` na URL), porque o repositório é público e o PIN não protege nada de fato. O painel `professor.html` (gerar chaves e decifrar relatórios) **não** faz parte da exclusão e deve continuar funcionando.

Ao executar a remoção, tratar estes pontos (conferir com `grep -rn "modo-professor\|pin-professor\|PIN_PROFESSOR\|badge-prof\|#prof\|estaEmModoProfessor\|hashPin"`):
- Apagar `js/modo-professor.js` e `js/pin-professor.js`.
- `js/app.js`: remover o import de `modo-professor.js`, o selo "Modo professor", o atalho dos 7 toques no logo e o atalho `#prof`.
- `js/trilhas.js`: remover o import `estaEmModoProfessor` e o comportamento ligado a `profMode`; manter o fluxo normal do aluno.
- `js/professor.js` e `professor.html`: remover o import de `hashPin` e a seção "PIN do modo professor"; manter chaves e relatórios.
- `css/estilo.css`: remover `.badge-prof`.
- `ferramentas/teste-navegador.js`: remover o teste do PIN.
- `README.md` e `NOTAS.md`: tirar as menções ao modo professor/PIN.
- Depois: rodar os testes em `ferramentas/`, abrir cada rota do app e o `professor.html`, e só então juntar ao `main` (de preferência por branch/PR).

## Regras de trabalho combinadas
- Não inventar correções: relatar o que foi encontrado, com evidência.
- Se algo marcado como corrigido não funcionar, avisar com prioridade.
- Em modo de análise, não alterar o código sem permissão.
- Conferir o conteúdo de física na web, em fontes confiáveis, antes de colocá-lo nos materiais.
