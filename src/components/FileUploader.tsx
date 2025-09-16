import React, { useState, ChangeEvent, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, AlertCircle, FileSpreadsheet, CheckCircle2, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Progress } from '@/components/ui/progress';
import { createWorkerBlob, processDataInWorker, WorkerResult } from '@/utils/WorkerCode';

// Definição da interface com a estrutura esperada de dados processados
export interface ProcessedData {
  sample: any[];
  full: any[];
  meta: {
    frequencyMap: Record<string, number>;
    ufEntregas: string[];
    ufUnidades: Record<string, string[]>;
    totalCount: number;
    cityByCodeMap: Record<string, Record<string, number>>;
  };
}

interface FileUploaderProps {
  onFileUpload: (data: ProcessedData, columnName: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingText, setProcessingText] = useState('Processando arquivo...');
  const { toast } = useToast();
  const targetColumn = "Codigo da Ultima Ocorrencia"; // Coluna sem acentos
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      setIsLoading(false);
      setUploadProgress(0);
      
      toast({
        title: "Processamento cancelado",
        description: "O processamento do arquivo foi cancelado.",
        variant: "default",
      });
    }
  };

  // Função para detectar delimitador automaticamente
  const detectDelimiter = (content: string): string => {
    const sampleLines = content.split('\n').slice(0, 5); // Analisa primeiras 5 linhas
    const delimiters = [';', ',', '\t', '|'];
    let bestDelimiter = ';';
    let maxCount = 0;

    for (const delimiter of delimiters) {
      const counts = sampleLines.map(line => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length);
      const avgCount = counts.reduce((sum, count) => sum + count, 0) / counts.length;
      const consistency = counts.every(count => Math.abs(count - avgCount) <= 1);
      
      if (avgCount > maxCount && consistency && avgCount > 0) {
        maxCount = avgCount;
        bestDelimiter = delimiter;
      }
    }

    console.log(`[SSWWEB] Delimitador detectado: '${bestDelimiter}' com média de ${maxCount} colunas`);
    return bestDelimiter;
  };

  // Função para preprocessar arquivos SSWWEB
  const preprocessSSWWeb = (content: string): { processedContent: string; delimiter: string; headers: string[] } => {
    console.log('[SSWWEB] Iniciando preprocessamento...');
    const lines = content.split('\n');
    console.log(`[SSWWEB] Total de linhas: ${lines.length}`);
    console.log(`[SSWWEB] Primeira linha (será removida):`, lines[0]?.substring(0, 200));
    console.log(`[SSWWEB] Segunda linha (headers):`, lines[1]?.substring(0, 200));
    
    // Remove a primeira linha (geralmente contém informações extras)
    const processedContent = lines.slice(1).join('\n');
    console.log(`[SSWWEB] Linhas após remoção da primeira: ${lines.length - 1}`);
    
    // Detecta o delimitador automaticamente
    const delimiter = detectDelimiter(processedContent);
    
    // Extrai headers da segunda linha (primeira linha dos dados)
    const headers = lines[1] ? lines[1].split(delimiter).map(h => h.trim()) : [];
    console.log(`[SSWWEB] Headers detectados (${headers.length}):`, headers);
    
    // Verificar se as colunas importantes estão presentes
    const pedidosColumn = headers.find(h => h.includes('Serie/Numero CTRC') || h.includes('CTRC'));
    const codigosColumn = headers.find(h => h.includes('Codigo da Ultima Ocorrencia'));
    
    console.log(`[SSWWEB] Coluna de pedidos encontrada:`, pedidosColumn || 'NÃO ENCONTRADA');
    console.log(`[SSWWEB] Coluna de códigos encontrada:`, codigosColumn || 'NÃO ENCONTRADA');
    console.log(`[SSWWEB] Índice da coluna de pedidos:`, headers.indexOf(pedidosColumn || ''));
    console.log(`[SSWWEB] Índice da coluna de códigos:`, headers.indexOf(codigosColumn || ''));
    
    return { processedContent, delimiter, headers };
  };

  const processFile = async (file: File) => {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExt !== 'csv' && fileExt !== 'xlsx' && fileExt !== 'sswweb') {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie apenas arquivos CSV, XLSX ou SSWWEB.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setUploadProgress(10); // Inicia o progresso
    setProcessingText(`Analisando ${file.name}...`);

    try {
      // Criar nova instância de AbortController
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      if (fileExt === 'csv' || fileExt === 'sswweb') {
        // Otimização para CSV: usar streaming para evitar carregamento completo na memória
        setUploadProgress(15);
        
        let headers: string[] = [];
        let firstChunk = true;
        let rowsProcessed = 0;
        const sampleRows: any[] = []; // Apenas para detectar estrutura
        const batchSize = 10000; // Tamanho do lote para processamento de CSV
        let currentBatch: any[] = [];
        let totalRows = 0;
        
        if (fileExt === 'sswweb') {
          // Processar arquivo .sswweb: ler como texto, remover primeira linha e converter delimitadores
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content && !signal.aborted) {
              try {
                if (content.split('\n').length < 2) {
                  toast({
                    title: "Arquivo inválido",
                    description: "O arquivo .sswweb deve ter pelo menos 2 linhas.",
                    variant: "destructive",
                  });
                  setIsLoading(false);
                  return;
                }
                
                const { processedContent, delimiter, headers: detectedHeaders } = preprocessSSWWeb(content);
                console.log(`[SSWWEB] Usando delimitador: '${delimiter}'`);
                console.log(`[SSWWEB] Headers detectados: ${detectedHeaders.length}`);
                
                const blob = new Blob([processedContent], { type: 'text/csv' });
                const processedFile = new File([blob], file.name.replace('.sswweb', '.csv'), { type: 'text/csv' });
                
                // Agora processar como CSV com delimitador detectado automaticamente
                Papa.parse(processedFile, {
                  header: true,
                  skipEmptyLines: true,
                  delimiter: delimiter,
                  chunk: async (results, parser) => {
                    // ... resto da lógica de chunk permanece igual
                    parser.pause();
                    
                    if (signal.aborted) {
                      parser.abort();
                      return;
                    }
                    
                    if (firstChunk) {
                      firstChunk = false;
                      sampleRows.push(...results.data.slice(0, 10));
                      headers = results.meta.fields || detectedHeaders;
                      console.log(`[SSWWEB] Headers finais utilizados: ${headers.length}`, headers.slice(0, 5));
                      
                      // Debug: verificar estrutura dos dados parseados
                      console.log(`[SSWWEB] Primeiro chunk - registros:`, results.data.length);
                      console.log(`[SSWWEB] Amostra de dados parseados:`, results.data.slice(0, 3));
                      
                      // Verificar colunas específicas
                      const firstRow = results.data[0];
                      if (firstRow) {
                        const allKeys = Object.keys(firstRow);
                        console.log(`[SSWWEB] Todas as chaves disponíveis (${allKeys.length}):`, allKeys);
                        
                        // Procurar coluna de pedidos
                        const pedidosKey = allKeys.find(key => key.includes('Serie/Numero CTRC') || key.includes('CTRC') || key.toLowerCase().includes('serie'));
                        console.log(`[SSWWEB] Chave de pedidos encontrada:`, pedidosKey);
                        if (pedidosKey) {
                          console.log(`[SSWWEB] Amostra de valores de pedidos:`, results.data.slice(0, 5).map(row => row[pedidosKey]));
                        }
                        
                        // Procurar coluna de códigos
                        const codigosKey = allKeys.find(key => key.includes('Codigo da Ultima Ocorrencia'));
                        console.log(`[SSWWEB] Chave de códigos encontrada:`, codigosKey);
                        if (codigosKey) {
                          console.log(`[SSWWEB] Amostra de valores de códigos:`, results.data.slice(0, 5).map(row => row[codigosKey]));
                        }
                      }
                    }
                    
                    currentBatch.push(...results.data);
                    rowsProcessed += results.data.length;
                    totalRows += results.data.length;
                    
                    setUploadProgress(Math.min(30, 15 + (rowsProcessed / batchSize) * 15));
                    setProcessingText(`Carregando dados: ${totalRows.toLocaleString()} registros`);
                    
                    if (currentBatch.length >= batchSize) {
                      try {
                        await processAndValidateData(currentBatch, headers, signal);
                        currentBatch = [];
                      } catch (error) {
                        if (error instanceof Error && error.message === 'Processing aborted') {
                          parser.abort();
                          return;
                        }
                        throw error;
                      }
                    }
                    
                    parser.resume();
                  },
                  complete: async () => {
                    if (currentBatch.length > 0 && !signal.aborted) {
                      try {
                        await processAndValidateData(currentBatch, headers, signal);
                      } catch (error) {
                        if (!(error instanceof Error && error.message === 'Processing aborted')) {
                          throw error;
                        }
                      }
                    }
                    
                    if (!signal.aborted) {
                      setProcessingText(`Finalizado: ${totalRows.toLocaleString()} registros processados`);
                      setUploadProgress(100);
                      setTimeout(() => setIsLoading(false), 500);
                    }
                  },
                  error: (error) => {
                    console.error('[SSWWEB] Erro no Papa.parse:', error);
                    throw new Error(`Erro ao processar SSWWEB: ${error}`);
                  }
                });
              } catch (error) {
                console.error('[SSWWEB] Erro geral:', error);
                toast({
                  title: "Erro ao processar arquivo SSWWEB",
                  description: error instanceof Error ? error.message : "Erro desconhecido",
                  variant: "destructive",
                });
                setIsLoading(false);
                setUploadProgress(0);
              }
            }
          };
          reader.readAsText(file, 'UTF-8'); // Especificar encoding
        } else {
          // Processar CSV normal
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            chunk: async (results, parser) => {
            // Pausa o parser para processar o lote atual
            parser.pause();
            
            if (signal.aborted) {
              parser.abort();
              return;
            }
            
            if (firstChunk) {
              firstChunk = false;
              // Guardar amostra de dados para validação
              sampleRows.push(...results.data.slice(0, 10));
              headers = results.meta.fields || [];
            }
            
            // Adicionar dados ao lote atual
            currentBatch.push(...results.data);
            rowsProcessed += results.data.length;
            totalRows += results.data.length;
            
            // Atualizar progresso
            setUploadProgress(Math.min(30, 15 + (rowsProcessed / batchSize) * 15));
            setProcessingText(`Carregando dados: ${totalRows.toLocaleString()} registros`);
            
            // Se o lote atingir o tamanho máximo, processar
            if (currentBatch.length >= batchSize) {
              try {
                await processAndValidateData(currentBatch, headers, signal);
                currentBatch = []; // Limpar o lote
              } catch (error) {
                if (error instanceof Error && error.message === 'Processing aborted') {
                  parser.abort();
                  return;
                }
                throw error;
              }
            }
            
            parser.resume();
          },
          complete: async () => {
            // Processar o último lote, se houver
            if (currentBatch.length > 0 && !signal.aborted) {
              try {
                await processAndValidateData(currentBatch, headers, signal);
              } catch (error) {
                if (!(error instanceof Error && error.message === 'Processing aborted')) {
                  throw error;
                }
              }
            }
            
            if (!signal.aborted) {
              setProcessingText(`Finalizado: ${totalRows.toLocaleString()} registros processados`);
              setUploadProgress(100);
              setTimeout(() => setIsLoading(false), 500);
            }
          },
          error: (error) => {
            throw new Error(`Erro ao processar CSV: ${error}`);
          }
        });
        }
      } else if (fileExt === 'xlsx') {
        setUploadProgress(20);
        
        // Usar FileReader para leitura por chunks
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            setUploadProgress(30);
            const data = e.target?.result;
            if (data && !signal.aborted) {
              setProcessingText('Convertendo XLSX...');
              
              // Otimize XLSX parsing
              const workbook = XLSX.read(data, { 
                type: 'binary',
                cellDates: false, // Desabilita conversão de datas para melhor performance
                cellNF: false,    // Desabilita formatação numérica
                cellStyles: false // Desabilita estilos
              });
              
              setUploadProgress(40);
              
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              
              setProcessingText('Extraindo dados da planilha...');
              // Converter para JSON com configurações de otimização
              const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                defval: '', // Usar string vazia em vez de undefined para células vazias
                raw: true   // Manter valores brutos sem formatação
              });
              
              setUploadProgress(60);
              
              if (!signal.aborted) {
                await processAndValidateData(jsonData, Object.keys(jsonData[0] || {}), signal);
                
                if (!signal.aborted) {
                  setUploadProgress(100);
                  setTimeout(() => setIsLoading(false), 500);
                }
              }
            }
          } catch (error) {
            if (signal.aborted) return;
            
            toast({
              title: "Erro ao processar arquivo",
              description: error instanceof Error ? error.message : "Ocorreu um erro ao processar o arquivo XLSX",
              variant: "destructive",
            });
            setIsLoading(false);
            setUploadProgress(0);
          }
        };
        
        reader.readAsBinaryString(file);
      }
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
        variant: "destructive",
      });
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Nova função para processar e validar dados com worker otimizado
  const processAndValidateData = async (data: any[], headers: string[], signal: AbortSignal) => {
    if (signal.aborted) throw new Error('Processing aborted');
    
    console.log(`[DEBUG] Iniciando processAndValidateData com ${data.length} registros`);
    console.log(`[DEBUG] Headers recebidos (${headers.length}):`, headers.slice(0, 10));
    
    // Verifica se os dados estão vazios
    if (!data || data.length === 0) {
      console.error('[DEBUG] Dados vazios recebidos');
      toast({
        title: "Arquivo vazio",
        description: "O arquivo não contém dados para processar.",
        variant: "destructive",
      });
      return;
    }
    
    setProcessingText(`Processando ${data.length.toLocaleString()} registros...`);
    
    // Tenta encontrar a coluna pelo nome, se não encontrar usa a coluna 33
    const firstRow = data[0];
    let columnName = targetColumn;
    
    console.log(`[DEBUG] Primeira linha de dados:`, Object.keys(firstRow).slice(0, 10));
    console.log(`[DEBUG] Procurando coluna: "${targetColumn}"`);
    
    if (!firstRow.hasOwnProperty(targetColumn)) {
      console.log(`[DEBUG] Coluna "${targetColumn}" não encontrada, tentando usar índice 33`);
      // Se não encontrou a coluna pelo nome, tenta usar o índice 33
      const columnKeys = Object.keys(firstRow);
      console.log(`[DEBUG] Total de colunas disponíveis: ${columnKeys.length}`);
      
      if (columnKeys.length >= 33) {
        columnName = columnKeys[32]; // índice 32 corresponde à coluna 33 (0-based index)
        console.log(`[DEBUG] Usando coluna do índice 33: "${columnName}"`);
      } else {
        console.error(`[DEBUG] Arquivo tem apenas ${columnKeys.length} colunas, menor que 33`);
        toast({
          title: "Erro na estrutura do arquivo",
          description: `Arquivo tem apenas ${columnKeys.length} colunas. É necessário ter pelo menos 33 colunas.`,
          variant: "destructive",
        });
        return;
      }
    } else {
      console.log(`[DEBUG] Coluna "${targetColumn}" encontrada com sucesso`);
    }
    
    // Validar se a coluna selecionada tem dados
    const sampleValues = data.slice(0, 100).map(row => row[columnName]).filter(val => val !== undefined && val !== null && val !== '');
    console.log(`[DEBUG] Amostra de valores da coluna "${columnName}":`, sampleValues.slice(0, 5));
    console.log(`[DEBUG] Total de valores não vazios na amostra: ${sampleValues.length}/100`);
    
    try {
      console.log(`[DEBUG] Iniciando processamento com worker`);
      // Usar o worker otimizado
      const results: WorkerResult = await processDataInWorker(data, columnName);
      
      if (signal.aborted) throw new Error('Processing aborted');
      
      console.log(`[DEBUG] Worker concluído. Registros processados: ${results.totalProcessed}`);
      console.log(`[DEBUG] Códigos únicos encontrados: ${Object.keys(results.frequencyMap).length}`);
      console.log(`[DEBUG] UFs de entrega encontradas: ${results.ufEntregas.length}`);
      
      // Agora passamos apenas os dados essenciais para o componente pai
      toast({
        title: "Arquivo processado com sucesso",
        description: `${results.totalProcessed.toLocaleString()} registros foram carregados.`,
      });
      
      // Passar o conjunto mínimo de dados necessário para o componente pai
      // Criar um array de amostra mais leve para representar os dados
      const sampleData = data.slice(0, 100); // Apenas 100 registros para interface
      
      // Adicionar os metadados calculados pelo worker
      const processedData: ProcessedData = {
        sample: sampleData,
        full: data, // Referência completa para operações específicas quando necessário
        meta: {
          frequencyMap: results.frequencyMap,
          ufEntregas: results.ufEntregas,
          ufUnidades: results.ufUnidades,
          totalCount: results.totalProcessed,
          cityByCodeMap: results.cityByCodeMap
        }
      };
      
      console.log(`[DEBUG] Dados processados enviados para componente pai`);
      onFileUpload(processedData, columnName);
    } catch (error) {
      if (error instanceof Error && error.message === 'Processing aborted') {
        throw error; // Re-throw para ser tratado acima
      }
      
      console.error("[DEBUG] Erro ao processar dados:", error);
      toast({
        title: "Erro ao processar dados",
        description: error instanceof Error ? error.message : "Ocorreu um erro durante o processamento",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { 
            e.preventDefault(); 
            setIsDragging(false);
            const files = e.dataTransfer.files;
            if (files.length) processFile(files[0]);
          }}
          onClick={() => !isLoading && document.getElementById('file-upload')?.click()}
        >
          <input
            id="file-upload"
            type="file"
            accept=".csv,.xlsx,.sswweb"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) processFile(files[0]);
            }}
            disabled={isLoading}
          />
          
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-xs">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <h3 className="text-lg font-medium text-gray-800">{processingText}</h3>
              <Progress value={uploadProgress} className="w-full h-2" />
              <div className="flex items-center justify-between w-full">
                <p className="text-sm text-gray-500">{uploadProgress}% concluído</p>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelProcessing();
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-full bg-blue-50 mb-4">
                <Upload className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-medium mb-2 text-gray-800">
                Faça upload do seu arquivo
              </h3>
              <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                Arraste e solte seu arquivo CSV, XLSX ou SSWWEB aqui, ou clique para selecionar
              </p>
              <Button variant="default" className="bg-blue-500 hover:bg-blue-600">
                Selecionar Arquivo
              </Button>
              <p className="text-xs text-gray-400 mt-4">
                Processamento otimizado: suporta arquivos com milhares de linhas
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUploader;
