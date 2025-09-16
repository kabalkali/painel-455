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

  const preprocessSSWWeb = (content: string): string => {
    const lines = content.split('\n');
    // Remove a primeira linha (cabeçalho inútil) e mantém o resto
    const processedLines = lines.slice(1);
    // Adiciona uma coluna vazia no início para compensar o deslocamento
    // e converte delimitador ; para , para compatibilidade com Papa.parse
    return processedLines.map(line => {
      if (line.trim()) {
        return ',' + line.replace(/;/g, ',');
      }
      return line;
    }).join('\n');
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
                
                const processedContent = preprocessSSWWeb(content);
                const blob = new Blob([processedContent], { type: 'text/csv' });
                const processedFile = new File([blob], file.name.replace('.sswweb', '.csv'), { type: 'text/csv' });
                
                // Agora processar como CSV normal
                Papa.parse(processedFile, {
                  header: true,
                  skipEmptyLines: true,
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
                      headers = results.meta.fields || [];
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
                    throw new Error(`Erro ao processar SSWWEB: ${error}`);
                  }
                });
              } catch (error) {
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
          reader.readAsText(file);
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
    
    // Verifica se os dados estão vazios
    if (!data || data.length === 0) {
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
    
    if (!firstRow.hasOwnProperty(targetColumn)) {
      // Se não encontrou a coluna pelo nome, tenta usar o índice 33
      const columnKeys = Object.keys(firstRow);
      if (columnKeys.length >= 33) {
        columnName = columnKeys[32]; // índice 32 corresponde à coluna 33 (0-based index)
      } else {
        toast({
          title: "Erro na estrutura do arquivo",
          description: "Não foi possível encontrar a coluna 33 no arquivo.",
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      // Usar o worker otimizado
      const results: WorkerResult = await processDataInWorker(data, columnName);
      
      if (signal.aborted) throw new Error('Processing aborted');
      
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
      
      onFileUpload(processedData, columnName);
    } catch (error) {
      if (error instanceof Error && error.message === 'Processing aborted') {
        throw error; // Re-throw para ser tratado acima
      }
      
      console.error("Erro ao processar dados:", error);
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
