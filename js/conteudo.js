/* Dados fixos do app usados por várias telas (fonte única). */

export const TRILHAS = [
  { id: '1', titulo: 'Ondas: o que são e como se propagam', curto: 'Ondas', desc: 'Revisão + classificação', cor: '#22D3EE' },
  { id: '2', titulo: 'As grandezas das ondas', curto: 'Grandezas', desc: 'λ, A, f, T e v = λ·f', cor: '#A78BFA' },
  { id: '3', titulo: 'O som como onda', curto: 'O som', desc: 'Produção, propagação e velocidade', cor: '#34D399' },
  { id: '4', titulo: 'As qualidades do som', curto: 'Qualidades', desc: 'Altura, intensidade, timbre', cor: '#F59E0B' },
  { id: '5', titulo: 'Fenômenos sonoros', curto: 'Fenômenos', desc: 'Reflexão, refração, difração, ressonância', cor: '#F472B6' },
  { id: '6', titulo: 'Som no cotidiano e saúde auditiva', curto: 'Cotidiano', desc: 'Decibéis, poluição, proteção', cor: '#FB7185' }
];

export const AVATARES = ['🦊', '🐬', '🦉', '🐢', '🐙', '🦋', '🐝', '🐼', '🦁', '🐸', '🚀', '🎧'];

export const IDS_TRILHAS = new Set(TRILHAS.map(t => t.id));

export function trilhaPorId(id) {
  return TRILHAS.find(t => t.id === String(id)) || null;
}

export const NOMES_SUBTEMA = {
  'altura': 'Altura do som',
  'amplitude': 'Amplitude',
  'audivel': 'Faixa audível',
  'classificacao-geral': 'Classificação das ondas',
  'compressao': 'Compressão e rarefação',
  'comprimento-onda': 'Comprimento de onda',
  'decibel': 'Decibéis',
  'definicao': 'O que é uma onda',
  'difracao': 'Difração',
  'eco': 'Eco',
  'equacao-fundamental': 'Equação v = λ·f',
  'fenomenos-gerais': 'Fenômenos sonoros',
  'fones': 'Uso de fones',
  'frequencia': 'Frequência',
  'grandezas-gerais': 'Grandezas das ondas',
  'infrassom-ultrassom': 'Infrassom e ultrassom',
  'intensidade': 'Intensidade',
  'interferencia': 'Interferência',
  'longitudinal': 'Ondas longitudinais',
  'mecanica-eletromagnetica': 'Mecânicas × eletromagnéticas',
  'meio': 'Meios de propagação',
  'periodo': 'Período',
  'poluicao': 'Poluição sonora',
  'producao-som': 'Produção do som',
  'qualidades': 'Qualidades do som',
  'reflexao': 'Reflexão',
  'refracao': 'Refração',
  'ressonancia': 'Ressonância',
  'reverberacao': 'Reverberação',
  'saude': 'Saúde auditiva',
  'timbre': 'Timbre',
  'transversal-longitudinal': 'Transversais × longitudinais',
  'vacuidade-som': 'Som no vácuo',
  'velocidade': 'Velocidade de propagação'
};

export function nomeSubtema(s) {
  return NOMES_SUBTEMA[s] || (s ? String(s).replace(/-/g, ' ') : 'Outros');
}

/** Carrega um JSON de dados uma vez por sessão (as trilhas são lidas por várias telas). */
const cacheJSON = new Map();
export function carregarJSON(caminho) {
  if (!cacheJSON.has(caminho)) {
    const p = fetch(caminho, { cache: 'no-cache' }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${caminho}`);
      return res.json();
    });
    p.catch(() => cacheJSON.delete(caminho));
    cacheJSON.set(caminho, p);
  }
  return cacheJSON.get(caminho);
}
