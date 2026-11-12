// PIN do modo professor, guardado só como hash (PBKDF2-SHA256 com sal).
// O PIN em si não aparece no código. Para trocar: abra professor.html,
// seção "PIN do modo professor", gere um novo arquivo e substitua este.
// PIN inicial: o mesmo da versão anterior. Troque-o assim que possível.
export const PIN_PROFESSOR = {
  sal: 'vFZbjJhI1p7Sbx0mzcs04A==',
  iteracoes: 200000,
  hash: '8OA85zM1ThjARlZDyI9UbT2Qt7cAFAd5q5YzQ1SOSME='
};
