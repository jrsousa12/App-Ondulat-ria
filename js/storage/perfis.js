/* Perfis: vários alunos no mesmo aparelho e as chaves de cada um no localStorage. */
/* ============ Vários alunos no mesmo aparelho ============
   O primeiro aluno ('p1') usa as chaves originais (compatível com versões antigas);
   os outros usam as mesmas chaves com o sufixo "__<id>". */
const PERFIS_KEY = 'ondulatoria_perfis';
const PERFIL_PADRAO = 'p1';

function lerPerfis() {
  try {
    const p = JSON.parse(localStorage.getItem(PERFIS_KEY) || 'null');
    if (p && Array.isArray(p.lista) && p.lista.length && p.lista.some(x => x.id === p.atual)) return p;
  } catch (_) {}
  return { atual: PERFIL_PADRAO, lista: [{ id: PERFIL_PADRAO, nome: '', avatar: '' }] };
}
function gravarPerfis(p) { try { localStorage.setItem(PERFIS_KEY, JSON.stringify(p)); } catch (_) {} }
function sufixo(id = lerPerfis().atual) { return id === PERFIL_PADRAO ? '' : `__${id}`; }
export const kDados = id => 'ondulatoria_dados_v1' + sufixo(id);
export const kFlag = id => 'ondulatoria_flag_integridade' + sufixo(id);
export const kCorrompido = id => 'ondulatoria_dados_corrompido' + sufixo(id);

export const perfis = {
  listar() { return lerPerfis().lista; },
  atual() { return lerPerfis().atual; },
  /** Atualiza nome e avatar do aluno atual na lista (chamado ao salvar). */
  atualizarAtual(aluno) {
    const p = lerPerfis();
    const item = p.lista.find(x => x.id === p.atual);
    const nome = `${aluno.primeiroNome || ''} ${aluno.ultimoNome || ''}`.trim();
    if (item && (item.nome !== nome || item.avatar !== (aluno.avatar || ''))) {
      item.nome = nome;
      item.avatar = aluno.avatar || '';
      gravarPerfis(p);
    }
  },
  trocar(id) {
    const p = lerPerfis();
    if (!p.lista.some(x => x.id === id)) return false;
    p.atual = id;
    gravarPerfis(p);
    return true;
  },
  /** Cria um aluno novo (vazio) e passa a usá-lo. */
  criar() {
    const p = lerPerfis();
    let n = p.lista.length + 1;
    while (p.lista.some(x => x.id === `p${n}`)) n++;
    const id = `p${n}`;
    p.lista.push({ id, nome: '', avatar: '' });
    p.atual = id;
    gravarPerfis(p);
    return id;
  },
  /** Remove outro aluno deste aparelho (não o atual). */
  remover(id) {
    const p = lerPerfis();
    if (id === p.atual || !p.lista.some(x => x.id === id)) return false;
    try { [kDados(id), kFlag(id), kCorrompido(id)].forEach(k => localStorage.removeItem(k)); } catch (_) {}
    p.lista = p.lista.filter(x => x.id !== id);
    gravarPerfis(p);
    return true;
  }
};
