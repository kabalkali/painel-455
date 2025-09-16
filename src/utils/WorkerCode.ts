
// Define the expected worker result type
export interface WorkerResult {
  frequencyMap: Record<string, number>;
  ufEntregas: string[];
  ufUnidades: Record<string, string[]>;
  totalProcessed: number;
  cityByCodeMap: Record<string, Record<string, number>>;
}

// Este é o código que será executado dentro do worker
export const workerCode = `
  self.onmessage = function(e) {
    const { chunk, targetColumn } = e.data;
    
    console.log('[WORKER] Iniciando processamento de chunk:', chunk.length, 'registros');
    console.log('[WORKER] Coluna alvo:', targetColumn);
    
    // Usar Map e Set para melhor performance com grandes conjuntos de dados
    const frequencyMap = new Map();
    const ufEntregaSet = new Set();
    const ufUnidadeMap = new Map();
    const cityByCodeMap = new Map(); // Map para relacionar código <-> cidade
    
    // Debug: verificar primeiro registro
    if (chunk.length > 0) {
      const firstRow = chunk[0];
      console.log('[WORKER] Primeiro registro - chaves:', Object.keys(firstRow));
      console.log('[WORKER] Primeiro registro - amostra:', firstRow);
      console.log('[WORKER] Valor da coluna alvo no primeiro registro:', firstRow[targetColumn]);
    }
    
    // Processar apenas os dados necessários, sem fazer cópias completas
    chunk.forEach((row, index) => {
      // Extrair UF de Entrega (coluna 51)
      if (row[Object.keys(row)[50]]) {
        const ufEntrega = String(row[Object.keys(row)[50]]);
        ufEntregaSet.add(ufEntrega);
        
        // Mapeamento UF -> Unidade (coluna 53)
        if (row[Object.keys(row)[52]]) {
          const unidade = String(row[Object.keys(row)[52]]);
          if (!ufUnidadeMap.has(ufEntrega)) {
            ufUnidadeMap.set(ufEntrega, new Set());
          }
          ufUnidadeMap.get(ufEntrega).add(unidade);
        }
      }
      
      // Contar ocorrências de códigos usando Map para melhor performance
      if (row[targetColumn] !== undefined && row[targetColumn] !== null && row[targetColumn] !== '') {
        const code = String(row[targetColumn]);
        frequencyMap.set(code, (frequencyMap.get(code) || 0) + 1);
        
        // Debug: log apenas dos primeiros códigos encontrados
        if (index < 3) {
          console.log('[WORKER] Código encontrado na linha', index + 1, ':', code);
        }
        
        // Extrair cidade (coluna 50) e relacionar com o código
        const cityKey = Object.keys(row)[49]; // Índice 49 corresponde a coluna 50
        
        if (row[cityKey]) {
          const city = String(row[cityKey]);
          
          if (!cityByCodeMap.has(code)) {
            cityByCodeMap.set(code, new Map());
          }
          
          const cityMap = cityByCodeMap.get(code);
          cityMap.set(city, (cityMap.get(city) || 0) + 1);
        }
      } else if (index < 2) {
        console.log('[WORKER] Linha', index + 1, 'sem código válido. Valor:', row[targetColumn]);
      }
    });
    
    console.log('[WORKER] Códigos únicos encontrados:', frequencyMap.size);
    console.log('[WORKER] UFs de entrega encontradas:', ufEntregaSet.size);
    
    // Converter Map para objeto apenas no final para enviar resultado
    const frequencyObj = {};
    frequencyMap.forEach((value, key) => {
      frequencyObj[key] = value;
    });
    
    // Converter Maps de cidades por código para objetos
    const cityByCodeObj = {};
    cityByCodeMap.forEach((cityMap, code) => {
      const cityObj = {};
      cityMap.forEach((count, city) => {
        cityObj[city] = count;
      });
      cityByCodeObj[code] = cityObj;
    });
    
    // Converter Sets para arrays
    const ufEntregas = Array.from(ufEntregaSet).sort();
    const ufUnidades = {};
    
    ufUnidadeMap.forEach((unidadesSet, uf) => {
      ufUnidades[uf] = Array.from(unidadesSet).sort();
    });
    
    // Enviamos apenas os dados processados, não o chunk completo
    // Isso reduz drasticamente a quantidade de dados transferidos entre o worker e o thread principal
    self.postMessage({
      frequencyMap: frequencyObj,
      ufEntregas,
      ufUnidades,
      cityByCodeMap: cityByCodeObj,
      processedCount: chunk.length // Apenas o número de registros processados
    });
  };
`;

// Função para criar um worker blob
export function createWorkerBlob() {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

// Função otimizada para processar grandes conjuntos de dados
export const processDataInWorker = (data: any[], targetColumn: string, chunkSize = 5000): Promise<WorkerResult> => {
  return new Promise((resolve, reject) => {
    const totalRows = data.length;
    const chunks = [];
    
    // Dividir em chunks menores para processamento mais rápido
    for (let i = 0; i < totalRows; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    
    // Criar o worker e seu URL
    const workerUrl = createWorkerBlob();
    const worker = new Worker(workerUrl);
    
    // Resultados agregados
    const aggregatedResults = {
      frequencyMap: {} as Record<string, number>,
      ufEntregas: new Set<string>(),
      ufUnidades: {} as Record<string, Set<string>>,
      totalProcessed: 0,
      cityByCodeMap: {} as Record<string, Record<string, number>>
    };
    
    let completedChunks = 0;
    const totalChunks = chunks.length;
    
    // Configurar worker
    worker.onmessage = (e) => {
      const { frequencyMap, ufEntregas, ufUnidades, processedCount, cityByCodeMap } = e.data;
      
      // Agregar contagens
      Object.entries(frequencyMap).forEach(([code, count]) => {
        aggregatedResults.frequencyMap[code] = (aggregatedResults.frequencyMap[code] || 0) + (count as number);
      });
      
      // Agregar UFs
      if (Array.isArray(ufEntregas)) {
        ufEntregas.forEach(uf => aggregatedResults.ufEntregas.add(uf));
      }
      
      // Agregar mapeamentos UF -> unidades
      if (ufUnidades && typeof ufUnidades === 'object') {
        Object.entries(ufUnidades).forEach(([uf, unidades]) => {
          if (!aggregatedResults.ufUnidades[uf]) {
            aggregatedResults.ufUnidades[uf] = new Set();
          }
          
          if (Array.isArray(unidades)) {
            unidades.forEach(unidade => {
              aggregatedResults.ufUnidades[uf].add(unidade);
            });
          }
        });
      }
      
      // Agregar mapeamentos código -> cidade -> contagem
      if (cityByCodeMap && typeof cityByCodeMap === 'object') {
        Object.entries(cityByCodeMap).forEach(([code, cityMap]) => {
          if (!aggregatedResults.cityByCodeMap[code]) {
            aggregatedResults.cityByCodeMap[code] = {};
          }
          
          Object.entries(cityMap).forEach(([city, count]) => {
            aggregatedResults.cityByCodeMap[code][city] = 
              (aggregatedResults.cityByCodeMap[code][city] || 0) + (count as number);
          });
        });
      }
      
      aggregatedResults.totalProcessed += processedCount;
      
      completedChunks++;
      
      // Se for o último chunk, finalizar
      if (completedChunks === totalChunks) {
        // Converter conjuntos para arrays
        const finalResults: WorkerResult = {
          frequencyMap: aggregatedResults.frequencyMap,
          ufEntregas: Array.from(aggregatedResults.ufEntregas).sort(),
          ufUnidades: {},
          totalProcessed: aggregatedResults.totalProcessed,
          cityByCodeMap: aggregatedResults.cityByCodeMap
        };
        
        // Converter Sets para arrays no mapeamento final
        Object.entries(aggregatedResults.ufUnidades).forEach(([uf, unidadesSet]) => {
          finalResults.ufUnidades[uf] = Array.from(unidadesSet).sort();
        });
        
        // Limpar recursos
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        
        resolve(finalResults);
      } else {
        // Processar próximo chunk
        worker.postMessage({
          chunk: chunks[completedChunks],
          targetColumn
        });
      }
    };
    
    worker.onerror = (error) => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(error);
    };
    
    // Iniciar processamento com o primeiro chunk
    if (chunks.length > 0) {
      worker.postMessage({
        chunk: chunks[0],
        targetColumn
      });
    } else {
      resolve({
        frequencyMap: {},
        ufEntregas: [],
        ufUnidades: {},
        totalProcessed: 0,
        cityByCodeMap: {}
      });
    }
  });
};
