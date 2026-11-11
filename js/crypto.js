function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunk, bytes.length))
    );
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function sha256Hex(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function requerSubtle() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API não disponível. Use HTTPS ou localhost (não abra via file://).');
  }
}

async function importarChavePublica(base64Spki) {
  requerSubtle();
  return crypto.subtle.importKey(
    'spki',
    base64ToArrayBuffer(base64Spki),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

async function importarChavePrivada(base64Pkcs8) {
  requerSubtle();
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToArrayBuffer(base64Pkcs8),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );
}

async function gerarParChaves() {
  requerSubtle();
  const par = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );
  const pubSpki = await crypto.subtle.exportKey('spki', par.publicKey);
  const privPkcs8 = await crypto.subtle.exportKey('pkcs8', par.privateKey);
  return {
    publicaBase64: arrayBufferToBase64(pubSpki),
    privadaBase64: arrayBufferToBase64(privPkcs8)
  };
}

async function criptografarRelatorio(relatorioObj, chavePublicaBase64) {
  if (!chavePublicaBase64) throw new Error('Chave pública do professor não configurada.');
  requerSubtle();
  const publica = await importarChavePublica(chavePublicaBase64);
  const chaveAes = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const jsonStr = JSON.stringify(relatorioObj);
  const enc = new TextEncoder();
  const dadosCifrados = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    chaveAes,
    enc.encode(jsonStr)
  );
  const chaveAesRaw = await crypto.subtle.exportKey('raw', chaveAes);
  const chaveCifrada = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publica,
    chaveAesRaw
  );
  const hashOriginal = await sha256Hex(jsonStr);

  return {
    versao: 1,
    para: 'professor',
    algoritmo: 'RSA-OAEP-2048 + AES-256-GCM',
    chaveCifrada: arrayBufferToBase64(chaveCifrada),
    iv: arrayBufferToBase64(iv.buffer),
    dadosCifrados: arrayBufferToBase64(dadosCifrados),
    hashOriginal
  };
}

async function descriptografarRelatorio(pacote, chavePrivadaBase64) {
  if (!chavePrivadaBase64) throw new Error('Chave privada não carregada.');
  if (!pacote || !pacote.chaveCifrada || !pacote.iv || !pacote.dadosCifrados || !pacote.hashOriginal) {
    throw new Error('Arquivo de relatório incompleto ou em formato inválido.');
  }
  requerSubtle();
  const privada = await importarChavePrivada(chavePrivadaBase64);
  const chaveAesRaw = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privada,
    base64ToArrayBuffer(pacote.chaveCifrada)
  );
  const chaveAes = await crypto.subtle.importKey(
    'raw',
    chaveAesRaw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const iv = new Uint8Array(base64ToArrayBuffer(pacote.iv));
  const dadosPlain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    chaveAes,
    base64ToArrayBuffer(pacote.dadosCifrados)
  );
  const jsonStr = new TextDecoder().decode(dadosPlain);
  const hashCalculado = await sha256Hex(jsonStr);
  return {
    relatorio: JSON.parse(jsonStr),
    integro: hashCalculado === pacote.hashOriginal,
    hashCalculado,
    hashEsperado: pacote.hashOriginal
  };
}

export {
  gerarParChaves,
  criptografarRelatorio,
  descriptografarRelatorio,
  importarChavePublica,
  importarChavePrivada,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  sha256Hex
};