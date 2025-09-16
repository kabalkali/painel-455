/**
 * Função utilitária para encontrar o índice de uma coluna pelo nome
 * Suporta tanto arquivos CSV quanto SSWWEB
 */
export function findColumnIndex(keys: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = keys.findIndex(key => 
      key && key.toLowerCase().includes(name.toLowerCase())
    );
    if (index !== -1) {
      return index;
    }
  }
  return -1;
}

/**
 * Encontra as colunas necessárias para processamento de dados
 */
export function findRequiredColumns(keys: string[]) {
  const cidadeIndex = findColumnIndex(keys, [
    'Cidade de Entrega',
    'Cidade do Destinatario', 
    'cidade de entrega',
    'cidade entrega',
    'cidade'
  ]);
  
  const unidadeIndex = findColumnIndex(keys, [
    'Unidade Receptora',
    'unidade receptora',
    'unidade'
  ]);
  
  const ufIndex = findColumnIndex(keys, [
    'UF de Entrega',
    'UF do Destinatario',
    'uf de entrega',
    'uf entrega',
    'uf'
  ]);
  
  const previsaoEntregaIndex = findColumnIndex(keys, [
    'Previsao de Entrega',
    'Data de Previsao de Entrega',
    'previsao de entrega',
    'previsao entrega',
    'previsao'
  ]);
  
  const dataUltimoManifestoIndex = findColumnIndex(keys, [
    'Data do Ultimo Manifesto',
    'Ultimo Manifesto',
    'ultimo manifesto',
    'data ultimo manifesto'
  ]);

  const ctrcIndex = findColumnIndex(keys, [
    'Serie/Numero CTRC',
    'Numero CTRC',
    'CTRC',
    'ctrc'
  ]);

  const ocorrenciaIndex = findColumnIndex(keys, [
    'Codigo da Ultima Ocorrencia',
    'Codigo Ocorrencia',
    'codigo ultima ocorrencia',
    'codigo ocorrencia'
  ]);

  return {
    cidade: cidadeIndex !== -1 ? keys[cidadeIndex] : null,
    unidade: unidadeIndex !== -1 ? keys[unidadeIndex] : null,
    uf: ufIndex !== -1 ? keys[ufIndex] : null,
    previsaoEntrega: previsaoEntregaIndex !== -1 ? keys[previsaoEntregaIndex] : null,
    dataUltimoManifesto: dataUltimoManifestoIndex !== -1 ? keys[dataUltimoManifestoIndex] : null,
    ctrc: ctrcIndex !== -1 ? keys[ctrcIndex] : null,
    ocorrencia: ocorrenciaIndex !== -1 ? keys[ocorrenciaIndex] : null,
    indices: {
      cidade: cidadeIndex,
      unidade: unidadeIndex,
      uf: ufIndex,
      previsaoEntrega: previsaoEntregaIndex,
      dataUltimoManifesto: dataUltimoManifestoIndex,
      ctrc: ctrcIndex,
      ocorrencia: ocorrenciaIndex
    }
  };
}