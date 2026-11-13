/* Estado compartilhado da página do professor. A chave privada fica só em memória. */
export const $ = sel => document.querySelector(sel);
export const TAMANHO_MAX_ARQUIVO = 5 * 1024 * 1024;

export const estado = {
  chavePrivada: null,
  chavePublica: null,
  relatorios: []
};

/** Baixa `conteudo` (texto) como arquivo `nome`. */
export function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
