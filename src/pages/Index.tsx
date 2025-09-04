import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import FileUploader, { ProcessedData } from '@/components/FileUploader';
import ResultsTable from '@/components/ResultsTable';
import ResultsChart from '@/components/ResultsChart';
import PlacaTable from '@/components/PlacaTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, BarChart2, Table as TableIcon, FileText, ChevronDown, ChevronUp, Loader, Minimize, Truck, ListCheck, Eye, Info, Package, Users, AlertTriangle, Building2, Clock } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormattedCodeDescription } from '@/utils/codeMapping';
import { getDriverName } from '@/utils/driversData';
import UnidadeMetrics from '@/components/UnidadeMetrics';
interface ResultData {
  code: string | number;
  count: number;
  percentage: number;
}
interface PlacaData {
  placa: string;
  total: number;
  entregue: number;
  insucesso: number;
  emRota: number;
  percentEntregue: number;
  percentInsucesso: number;
  percentEmRota: number;
  uf: string;
  unidade: string;
  cidades: {
    entregue: {
      [city: string]: {
        count: number;
        ctrcs: string[];
      };
    };
    insucesso: {
      [city: string]: {
        count: number;
        ctrcs: string[];
      };
    };
    emRota: {
      [city: string]: {
        count: number;
        ctrcs: string[];
      };
    };
  };
}
interface OfendersData {
  codigosByFrequency: Array<{
    code: string;
    count: number;
    percentage: number;
    description: string;
  }>;
  unidadesByFrequency: Array<{
    unidade: string;
    count: number;
    percentage: number;
  }>;
  motoristasByFrequency: Array<{
    motorista: string;
    placa: string;
    unidade: string;
    count: number;
    percentage: number;
  }>;
  totalInsucessos: number;
  totalRegistros: number;
  percentualInsucesso: number;
  totalUnidades: number;
  totalMotoristas: number;
}

// Lista de códigos que devem ser pré-selecionados por padrão
const DEFAULT_SELECTED_CODES = ['1', '6', '18', '23', '25', '26', '27', '28', '30', '33', '34', '46', '48', '50', '58', '59', '65', '67', '71', '75', '82', '97'];
const Index: React.FC = () => {
  const [results, setResults] = useState<ResultData[]>([]);
  const [filteredResults, setFilteredResults] = useState<ResultData[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [hasResults, setHasResults] = useState<boolean>(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [cityByCodeMap, setCityByCodeMap] = useState<Record<string, Record<string, number>>>({});
  const [filteredCityData, setFilteredCityData] = useState<Record<string, Record<string, number>>>({});
  const [unidadeByCityMap, setUnidadeByCityMap] = useState<Record<string, Record<string, string>>>({});
  const [placasData, setPlacasData] = useState<PlacaData[]>([]);
  const [filteredPlacasData, setFilteredPlacasData] = useState<PlacaData[]>([]);
  const [ufsEntrega, setUfsEntrega] = useState<string[]>([]);
  const [unidadesReceptoras, setUnidadesReceptoras] = useState<string[]>([]);
  const [unidadesPorUf, setUnidadesPorUf] = useState<Record<string, string[]>>({});
  const [selectedUf, setSelectedUf] = useState<string>('todas');
  const [selectedUnidades, setSelectedUnidades] = useState<string[]>(['todas']);
  const [rawData, setRawData] = useState<ProcessedData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [unidadeCodesMap, setUnidadeCodesMap] = useState<Record<string, string[]>>({});
  const [uploadCollapsed, setUploadCollapsed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("codigos");
  const [unidadeSearch, setUnidadeSearch] = useState<string>('');

  // Novo estado para dados de ofensores
  const [ofendersData, setOfendersData] = useState<OfendersData | null>(null);
  const [filteredOfendersData, setFilteredOfendersData] = useState<OfendersData | null>(null);
  const [selectedOfendersCodes, setSelectedOfendersCodes] = useState<string[]>([]);

  // Novo estado para dados de código 50 (sem movimentação)
  const [semMovimentacaoData, setSemMovimentacaoData] = useState<{
    count: number;
    bases: Array<{
      unidade: string;
      uf: string;
      total: number;
    }>;
  } | null>(null);

  // Novo estado para dados de insucessos
  const [insucessosData, setInsucessosData] = useState<{
    count: number;
    percentage: number;
  } | null>(null);
  const [showTodayInsucessos, setShowTodayInsucessos] = useState(false);
  const processFileData = (data: ProcessedData, columnName: string) => {
    setIsLoading(true);
    setRawData(data);
    const {
      meta
    } = data;
    setUfsEntrega(meta.ufEntregas);
    setUnidadesPorUf(meta.ufUnidades);
    const allUnidades = new Set<string>();
    Object.values(meta.ufUnidades).forEach(unidades => {
      unidades.forEach(unidade => allUnidades.add(unidade));
    });
    setUnidadesReceptoras(Array.from(allUnidades).sort());
    const unidadeCodes = mapUnidadeCodes(data.sample, columnName);
    setUnidadeCodesMap(unidadeCodes);
    processCodigoOcorrencias(meta.frequencyMap, meta.totalCount);
    processPlacaData(data.full);
    processOfendersData(data.full, columnName);
    processSemMovimentacaoData(data.full, columnName); // Nova função
    processInsucessosData(data.full, columnName); // Nova função para insucessos
    if (meta.cityByCodeMap) {
      setCityByCodeMap(meta.cityByCodeMap);
      setFilteredCityData(meta.cityByCodeMap);
    }

    // Processar mapeamento de unidades por cidade
    processUnidadeByCityMap(data.full);
    setUploadCollapsed(true);
    setIsLoading(false);
  };

  // Nova função para processar dados de código 50
  const processSemMovimentacaoData = (fullData: any[], columnName: string) => {
    if (!fullData || fullData.length === 0) return;
    const firstRow = fullData[0];
    const keys = Object.keys(firstRow);
    const ocorrenciaKey = columnName || "Codigo da Ultima Ocorrencia";
    const unidadeKey = keys[52]; // Unidade receptora
    const ufKey = keys[50]; // UF

    if (!ocorrenciaKey || !unidadeKey || !ufKey) return;

    // Mapear bases com código 50
    const basesMap = new Map<string, {
      uf: string;
      total: number;
    }>();
    let totalCount = 0;
    for (const row of fullData) {
      const codigo = String(row[ocorrenciaKey] || "");
      const unidade = String(row[unidadeKey] || "");
      const uf = String(row[ufKey] || "");
      if (codigo === "50" && unidade) {
        totalCount++;
        const key = `${unidade}_${uf}`;
        if (basesMap.has(key)) {
          const existing = basesMap.get(key)!;
          basesMap.set(key, {
            ...existing,
            total: existing.total + 1
          });
        } else {
          basesMap.set(key, {
            uf,
            total: 1
          });
        }
      }
    }

    // Converter para array ordenado
    const bases = Array.from(basesMap.entries()).map(([key, data]) => {
      const unidade = key.split('_')[0];
      return {
        unidade,
        uf: data.uf,
        total: data.total
      };
    }).sort((a, b) => b.total - a.total);
    setSemMovimentacaoData({
      count: totalCount,
      bases
    });
  };

  // Nova função para processar dados de insucessos
  const processInsucessosData = (fullData: any[], columnName: string) => {
    if (!fullData || fullData.length === 0) return;
    
    const ocorrenciaKey = columnName || "Codigo da Ultima Ocorrencia";
    
    // Códigos de insucesso especificados
    const insucessoCodes = ['26', '18', '46', '23', '25', '27', '28', '65', '66', '33'];
    
    let totalCount = 0;
    const totalRegistros = fullData.length;
    
    for (const row of fullData) {
      const codigo = String(row[ocorrenciaKey] || "");
      if (insucessoCodes.includes(codigo)) {
        totalCount++;
      }
    }
    
    const percentage = totalRegistros > 0 ? (totalCount / totalRegistros) * 100 : 0;
    
    setInsucessosData({
      count: totalCount,
      percentage: percentage
    });
  };

  // Nova função para processar dados de ofensores
  const processOfendersData = (fullData: any[], columnName: string) => {
    if (!fullData || fullData.length === 0) return;
    const firstRow = fullData[0];
    const keys = Object.keys(firstRow);
    const ocorrenciaKey = columnName || "Codigo da Ultima Ocorrencia";
    const unidadeKey = keys[52]; // Unidade receptora
    const placaKey = keys[90]; // Placa

    if (!ocorrenciaKey || !unidadeKey || !placaKey) return;

    // Mapas para contar ocorrências
    const codigosMap = new Map<string, number>();
    const unidadesMap = new Map<string, number>();
    const motoristasMap = new Map<string, {
      count: number;
      placa: string;
      unidade: string;
    }>();
    let totalInsucessos = 0;
    const totalRegistros = fullData.length;
    for (const row of fullData) {
      const codigo = String(row[ocorrenciaKey] || "");
      const unidade = String(row[unidadeKey] || "");
      const placa = String(row[placaKey] || "");

      // Considera insucesso tudo que não é código 1 (entregue) nem 59 (em rota)
      if (codigo && codigo !== "1" && codigo !== "59") {
        totalInsucessos++;

        // Contar códigos
        codigosMap.set(codigo, (codigosMap.get(codigo) || 0) + 1);

        // Contar unidades
        if (unidade) {
          unidadesMap.set(unidade, (unidadesMap.get(unidade) || 0) + 1);
        }

        // Contar motoristas usando a base de dados de placas
        if (placa && unidade) {
          const motoristaNome = getDriverName(placa, unidade);
          const key = `${motoristaNome}_${placa}`;
          if (motoristasMap.has(key)) {
            const existing = motoristasMap.get(key)!;
            motoristasMap.set(key, {
              ...existing,
              count: existing.count + 1
            });
          } else {
            motoristasMap.set(key, {
              count: 1,
              placa,
              unidade
            });
          }
        }
      }
    }

    // Converter para arrays ordenados
    const codigosByFrequency = Array.from(codigosMap.entries()).map(([code, count]) => ({
      code,
      count,
      percentage: count / totalInsucessos * 100,
      description: getFormattedCodeDescription(code)
    })).sort((a, b) => b.count - a.count);
    const unidadesByFrequency = Array.from(unidadesMap.entries()).map(([unidade, count]) => ({
      unidade,
      count,
      percentage: count / totalInsucessos * 100
    })).sort((a, b) => b.count - a.count);
    const motoristasByFrequency = Array.from(motoristasMap.entries()).map(([key, data]) => {
      const motoristaNome = key.split('_')[0];
      return {
        motorista: motoristaNome,
        placa: data.placa,
        unidade: data.unidade,
        count: data.count,
        percentage: data.count / totalInsucessos * 100
      };
    }).sort((a, b) => b.count - a.count);
    const processedOfendersData: OfendersData = {
      codigosByFrequency,
      unidadesByFrequency,
      motoristasByFrequency,
      totalInsucessos,
      totalRegistros,
      percentualInsucesso: totalInsucessos / totalRegistros * 100,
      totalUnidades: unidadesByFrequency.length,
      totalMotoristas: motoristasByFrequency.length
    };
    setOfendersData(processedOfendersData);
    setFilteredOfendersData(processedOfendersData);

    // Definir códigos padrão selecionados para ofensores
    const allAvailableCodes = codigosByFrequency.map(item => String(item.code));
    const defaultCodesAvailable = DEFAULT_SELECTED_CODES.filter(code => allAvailableCodes.includes(code));
    setSelectedOfendersCodes(defaultCodesAvailable.length > 0 ? defaultCodesAvailable : allAvailableCodes.length > 0 ? [allAvailableCodes[0]] : []);
  };

  // Função para processar o mapeamento de unidades por cidade para cada código
  const processUnidadeByCityMap = (fullData: any[]) => {
    if (!fullData || fullData.length === 0) return;
    const firstRow = fullData[0];
    const keys = Object.keys(firstRow);

    // Índices das colunas necessárias (ajuste conforme necessário)
    const ocorrenciaKey = "Codigo da Ultima Ocorrencia";
    const cityKey = keys[49]; // Cidade
    const unidadeKey = keys[52]; // Unidade receptora

    if (!ocorrenciaKey || !cityKey || !unidadeKey) return;
    const unidadeByCityMapTemp: Record<string, Record<string, string>> = {};
    for (const row of fullData) {
      const ocorrencia = String(row[ocorrenciaKey] || "");
      const cidade = String(row[cityKey] || "");
      const unidade = String(row[unidadeKey] || "Não informada");
      if (!ocorrencia || !cidade) continue;
      if (!unidadeByCityMapTemp[ocorrencia]) {
        unidadeByCityMapTemp[ocorrencia] = {};
      }

      // Associar a cidade à unidade
      unidadeByCityMapTemp[ocorrencia][cidade] = unidade;
    }
    setUnidadeByCityMap(unidadeByCityMapTemp);
  };
  const mapUnidadeCodes = (sampleData: any[], targetColumn: string): Record<string, string[]> => {
    if (!sampleData || sampleData.length === 0) return {};
    const firstRow = sampleData[0];
    const keys = Object.keys(firstRow);
    if (keys.length < 53) return {};
    const unidadeKey = keys[52];
    const unidadeCodes: Record<string, Set<string>> = {};
    sampleData.forEach(item => {
      if (item[unidadeKey] && item[targetColumn]) {
        const unidade = String(item[unidadeKey]);
        const codigo = String(item[targetColumn]);
        if (!unidadeCodes[unidade]) {
          unidadeCodes[unidade] = new Set<string>();
        }
        unidadeCodes[unidade].add(codigo);
      }
    });
    const result: Record<string, string[]> = {};
    for (const unidade in unidadeCodes) {
      result[unidade] = Array.from(unidadeCodes[unidade]);
    }
    return result;
  };
  const processCodigoOcorrencias = (frequencyMap: Record<string, number>, total: number) => {
    const totalCount = total;
    setTotalRecords(totalCount);
    const resultsArray: ResultData[] = Object.entries(frequencyMap).map(([code, count]) => ({
      code,
      count: Number(count),
      percentage: Number(count) / totalCount * 100
    }));
    resultsArray.sort((a, b) => b.count - a.count);
    setResults(resultsArray);
    setFilteredResults(resultsArray);
    setHasResults(true);

    // Selecionar códigos padrão
    const allAvailableCodes = resultsArray.map(item => String(item.code));
    const defaultCodesAvailable = DEFAULT_SELECTED_CODES.filter(code => allAvailableCodes.includes(code));

    // Se nenhum dos códigos padrão estiver disponível, selecione o primeiro
    setSelectedCodes(defaultCodesAvailable.length > 0 ? defaultCodesAvailable : allAvailableCodes.length > 0 ? [allAvailableCodes[0]] : []);
  };
  const processPlacaData = (fullData: any[]) => {
    if (!fullData || fullData.length === 0) return;
    const firstRow = fullData[0];
    const keys = Object.keys(firstRow);
    const placaKey = keys[90];
    const ufKey = keys[50];
    const unidadeKey = keys[52];
    const ocorrenciaKey = "Codigo da Ultima Ocorrencia";
    const ctrcKey = keys[1];
    const cityKey = keys[49];
    if (!placaKey || !ocorrenciaKey || !ctrcKey) return;
    const placaMap = new Map<string, {
      total: number;
      entregue: number;
      insucesso: number;
      emRota: number;
      uf: string;
      unidade: string;
      cidades: {
        entregue: {
          [city: string]: {
            count: number;
            ctrcs: string[];
          };
        };
        insucesso: {
          [city: string]: {
            count: number;
            ctrcs: string[];
          };
        };
        emRota: {
          [city: string]: {
            count: number;
            ctrcs: string[];
          };
        };
      };
    }>();
    for (const row of fullData) {
      const placa = row[placaKey];
      if (!placa || placa === "") continue;
      const ocorrencia = String(row[ocorrenciaKey] || "");
      const uf = String(row[ufKey] || "");
      const unidade = String(row[unidadeKey] || "");
      const cidade = String(row[cityKey] || "Não informada");
      const ctrc = String(row[ctrcKey] || "");
      if (!placaMap.has(placa)) {
        placaMap.set(placa, {
          total: 0,
          entregue: 0,
          insucesso: 0,
          emRota: 0,
          uf,
          unidade,
          cidades: {
            entregue: {},
            insucesso: {},
            emRota: {}
          }
        });
      }
      const placaInfo = placaMap.get(placa)!;
      placaInfo.total++;
      let statusType: 'entregue' | 'insucesso' | 'emRota';
      if (ocorrencia === "1" || ocorrencia.toLowerCase() === "entregue") {
        placaInfo.entregue++;
        statusType = 'entregue';
      } else if (ocorrencia === "59") {
        placaInfo.emRota++;
        statusType = 'emRota';
      } else if (ocorrencia) {
        placaInfo.insucesso++;
        statusType = 'insucesso';
      } else {
        continue;
      }
      if (!placaInfo.cidades[statusType][cidade]) {
        placaInfo.cidades[statusType][cidade] = {
          count: 0,
          ctrcs: []
        };
      }
      placaInfo.cidades[statusType][cidade].count++;
      if (ctrc) {
        placaInfo.cidades[statusType][cidade].ctrcs.push(ctrc);
      }
    }
    const placaArray: PlacaData[] = Array.from(placaMap.entries()).map(([placa, data]) => {
      const total = data.total;
      return {
        placa,
        total,
        entregue: data.entregue,
        insucesso: data.insucesso,
        emRota: data.emRota,
        percentEntregue: data.entregue / total * 100,
        percentInsucesso: data.insucesso / total * 100,
        percentEmRota: data.emRota / total * 100,
        uf: data.uf,
        unidade: data.unidade,
        cidades: data.cidades
      };
    });
    placaArray.sort((a, b) => b.total - a.total);
    setPlacasData(placaArray);
    setFilteredPlacasData(placaArray);
  };

  // Função para filtrar dados de ofensores
  const filterOfendersData = (uf: string, unidades: string[], columnName: string = "Codigo da Ultima Ocorrencia") => {
    if (!rawData || !ofendersData) return;
    if (uf === 'todas' && unidades.includes('todas')) {
      setFilteredOfendersData(ofendersData);
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      const {
        full
      } = rawData;
      const firstRow = full[0];
      const keys = Object.keys(firstRow);
      const ufKey = keys[50];
      const unidadeKey = keys[52];
      const ocorrenciaKey = columnName;
      const placaKey = keys[90];
      const filteredData = full.filter(item => {
        const matchesUf = uf === 'todas' || item[ufKey] === uf;
        const matchesUnidade = unidades.includes('todas') || unidades.includes(item[unidadeKey]);
        return matchesUf && matchesUnidade;
      });

      // Reprocessar dados de ofensores com dados filtrados
      const codigosMap = new Map<string, number>();
      const unidadesMap = new Map<string, number>();
      const motoristasMap = new Map<string, {
        count: number;
        placa: string;
        unidade: string;
      }>();
      let totalInsucessos = 0;
      const totalRegistros = filteredData.length;
      for (const row of filteredData) {
        const codigo = String(row[ocorrenciaKey] || "");
        const unidade = String(row[unidadeKey] || "");
        const placa = String(row[placaKey] || "");
        if (codigo && codigo !== "1" && codigo !== "59") {
          totalInsucessos++;
          codigosMap.set(codigo, (codigosMap.get(codigo) || 0) + 1);
          if (unidade) {
            unidadesMap.set(unidade, (unidadesMap.get(unidade) || 0) + 1);
          }
          if (placa && unidade) {
            const motoristaNome = getDriverName(placa, unidade);
            const key = `${motoristaNome}_${placa}`;
            if (motoristasMap.has(key)) {
              const existing = motoristasMap.get(key)!;
              motoristasMap.set(key, {
                ...existing,
                count: existing.count + 1
              });
            } else {
              motoristasMap.set(key, {
                count: 1,
                placa,
                unidade
              });
            }
          }
        }
      }
      const filteredOfendersResult: OfendersData = {
        codigosByFrequency: Array.from(codigosMap.entries()).map(([code, count]) => ({
          code,
          count,
          percentage: totalInsucessos > 0 ? count / totalInsucessos * 100 : 0,
          description: getFormattedCodeDescription(code)
        })).sort((a, b) => b.count - a.count),
        unidadesByFrequency: Array.from(unidadesMap.entries()).map(([unidade, count]) => ({
          unidade,
          count,
          percentage: totalInsucessos > 0 ? count / totalInsucessos * 100 : 0
        })).sort((a, b) => b.count - a.count),
        motoristasByFrequency: Array.from(motoristasMap.entries()).map(([key, data]) => {
          const motoristaNome = key.split('_')[0];
          return {
            motorista: motoristaNome,
            placa: data.placa,
            unidade: data.unidade,
            count: data.count,
            percentage: totalInsucessos > 0 ? data.count / totalInsucessos * 100 : 0
          };
        }).sort((a, b) => b.count - a.count),
        totalInsucessos,
        totalRegistros,
        percentualInsucesso: totalRegistros > 0 ? totalInsucessos / totalRegistros * 100 : 0,
        totalUnidades: unidadesMap.size,
        totalMotoristas: motoristasMap.size
      };
      setFilteredOfendersData(filteredOfendersResult);
      setIsLoading(false);
    }, 10);
  };
  const handleUfChange = (value: string) => {
    setSelectedUf(value);
    setSelectedUnidades(['todas']);
    filterData(value, ['todas']);
    if (activeTab === "ofensores") {
      filterOfendersData(value, ['todas'], "Codigo da Ultima Ocorrencia");
    }
  };
  const handleUnidadeChange = (unidades: string[]) => {
    if (unidades.length === 0) {
      setSelectedUnidades(['todas']);
      filterData(selectedUf, ['todas']);
      if (activeTab === "ofensores") {
        filterOfendersData(selectedUf, ['todas'], "Codigo da Ultima Ocorrencia");
      }
      return;
    }
    if (unidades.includes('todas') && !selectedUnidades.includes('todas')) {
      setSelectedUnidades(['todas']);
      filterData(selectedUf, ['todas']);
      if (activeTab === "ofensores") {
        filterOfendersData(selectedUf, ['todas'], "Codigo da Ultima Ocorrencia");
      }
      return;
    }
    if (selectedUnidades.includes('todas') && unidades.length > 1) {
      const filteredUnidades = unidades.filter(u => u !== 'todas');
      setSelectedUnidades(filteredUnidades);
      filterData(selectedUf, filteredUnidades);
      if (activeTab === "ofensores") {
        filterOfendersData(selectedUf, filteredUnidades, "Codigo da Ultima Ocorrencia");
      }
      return;
    }
    setSelectedUnidades(unidades);
    filterData(selectedUf, unidades);
    if (activeTab === "ofensores") {
      filterOfendersData(selectedUf, unidades, "Codigo da Ultima Ocorrencia");
    }
  };
  const toggleUnidade = (unidade: string) => {
    console.log("Toggling unit:", unidade, "Current selection:", selectedUnidades);
    if (unidade === 'todas') {
      // Se 'todas' está sendo selecionada
      if (selectedUnidades.includes('todas')) {
        // Já está selecionada, não faz nada
        return;
      } else {
        // Seleciona apenas 'todas'
        setSelectedUnidades(['todas']);
        filterData(selectedUf, ['todas']);
        if (activeTab === "ofensores") {
          filterOfendersData(selectedUf, ['todas'], "Codigo da Ultima Ocorrencia");
        }
      }
    } else {
      // Se uma unidade específica está sendo selecionada
      let newSelection;
      if (selectedUnidades.includes('todas')) {
        // Se 'todas' está selecionada, remove e adiciona apenas esta unidade
        newSelection = [unidade];
      } else if (selectedUnidades.includes(unidade)) {
        // Se esta unidade já está selecionada, remove ela
        newSelection = selectedUnidades.filter(u => u !== unidade);
        // Se ficou vazio, volta para 'todas'
        if (newSelection.length === 0) {
          newSelection = ['todas'];
        }
      } else {
        // Adiciona esta unidade às já selecionadas
        newSelection = [...selectedUnidades, unidade];
      }
      console.log("New selection:", newSelection);
      setSelectedUnidades(newSelection);
      filterData(selectedUf, newSelection);
      if (activeTab === "ofensores") {
        filterOfendersData(selectedUf, newSelection, "Codigo da Ultima Ocorrencia");
      }
    }
  };
  const filterData = (uf: string, unidades: string[]) => {
    filterByUfAndUnidade(uf, unidades);
    if (!placasData.length) return;
    let filtered = [...placasData];
    if (uf !== 'todas') {
      filtered = filtered.filter(item => item.uf === uf);
    }
    if (!unidades.includes('todas')) {
      filtered = filtered.filter(item => unidades.includes(item.unidade));
    }
    setFilteredPlacasData(filtered);
  };
  const filterByUfAndUnidade = (uf: string, unidades: string[]) => {
    if (!rawData) return;
    const {
      meta,
      full
    } = rawData;
    const targetColumnKey = "Codigo da Ultima Ocorrencia";
    let filteredFrequencyMap: Record<string, number> = {};
    let filteredCityCodeMap: Record<string, Record<string, number>> = {};
    let filteredTotal = 0;
    if (uf === 'todas' && unidades.includes('todas')) {
      filteredFrequencyMap = meta.frequencyMap;
      filteredTotal = meta.totalCount;
      setFilteredCityData(meta.cityByCodeMap);
    } else {
      setIsLoading(true);
      setTimeout(() => {
        const firstRow = full[0];
        const keys = Object.keys(firstRow);
        if (keys.length < 53) {
          setIsLoading(false);
          return;
        }
        const ufKey = keys[50];
        const unidadeKey = keys[52];
        const cityKey = keys[49];
        const filteredData = full.filter(item => {
          const matchesUf = uf === 'todas' || item[ufKey] === uf;
          const matchesUnidade = unidades.includes('todas') || unidades.includes(item[unidadeKey]);
          return matchesUf && matchesUnidade;
        });
        const validData = filteredData.filter(item => item[targetColumnKey] !== undefined && item[targetColumnKey] !== null && item[targetColumnKey] !== '');
        filteredTotal = validData.length;
        if (filteredTotal === 0) {
          setFilteredResults([]);
          setFilteredCityData({});
          setIsLoading(false);
          return;
        }
        filteredCityCodeMap = {};
        validData.forEach(item => {
          const value = String(item[targetColumnKey]);
          filteredFrequencyMap[value] = (filteredFrequencyMap[value] || 0) + 1;
          if (item[cityKey]) {
            const city = String(item[cityKey]);
            if (!filteredCityCodeMap[value]) {
              filteredCityCodeMap[value] = {};
            }
            filteredCityCodeMap[value][city] = (filteredCityCodeMap[value][city] || 0) + 1;
          }
        });
        setFilteredCityData(filteredCityCodeMap);
        processFilteredResults(filteredFrequencyMap, filteredTotal, unidades);
        setIsLoading(false);
      }, 10);
      return;
    }
    processFilteredResults(filteredFrequencyMap, filteredTotal, unidades);
  };
  const processFilteredResults = (frequencyMap: Record<string, number>, total: number, unidades: string[]) => {
    setTotalRecords(total);
    const resultsArray: ResultData[] = Object.entries(frequencyMap).map(([code, count]) => ({
      code,
      count: Number(count),
      percentage: Number(count) / total * 100
    }));
    resultsArray.sort((a, b) => b.count - a.count);
    setFilteredResults(resultsArray);

    // Manter os códigos padrão selecionados mesmo ao mudar filtros
    const allAvailableCodes = resultsArray.map(item => String(item.code));
    const defaultCodesAvailable = DEFAULT_SELECTED_CODES.filter(code => allAvailableCodes.includes(code));

    // Se nenhum dos códigos padrão estiver disponível, selecione o primeiro código disponível
    setSelectedCodes(defaultCodesAvailable.length > 0 ? defaultCodesAvailable : allAvailableCodes.length > 0 ? [allAvailableCodes[0]] : []);
  };
  const resetFilter = () => {
    setSelectedUf('todas');
    setSelectedUnidades(['todas']);
    if (rawData) {
      setFilteredCityData(rawData.meta.cityByCodeMap);
      processCodigoOcorrencias(rawData.meta.frequencyMap, rawData.meta.totalCount);
    }
    setFilteredPlacasData(placasData);
    if (activeTab === "ofensores" && ofendersData) {
      setFilteredOfendersData(ofendersData);
    }
  };
  const handleCodeSelectionChange = (codes: string[]) => {
    setSelectedCodes(codes);
  };
  const renderSelectedUnidades = () => {
    if (selectedUnidades.includes('todas')) {
      return 'Todas as unidades';
    }
    if (selectedUnidades.length <= 2) {
      return selectedUnidades.join(', ');
    }
    return `${selectedUnidades.length} unidades selecionadas`;
  };
  const filteredUnidades = useMemo(() => {
    if (!unidadeSearch.trim()) {
      return selectedUf !== 'todas' ? unidadesPorUf[selectedUf] || [] : unidadesReceptoras;
    }
    const searchLower = unidadeSearch.toLowerCase().trim();
    const unidadesToFilter = selectedUf !== 'todas' ? unidadesPorUf[selectedUf] || [] : unidadesReceptoras;
    return unidadesToFilter.filter(unidade => unidade.toLowerCase().includes(searchLower));
  }, [unidadeSearch, selectedUf, unidadesPorUf, unidadesReceptoras]);

  // Funções para filtrar dados de ofensores baseado nos códigos selecionados
  const filteredOfendersCodigoData = useMemo(() => {
    if (!filteredOfendersData || selectedOfendersCodes.length === 0) {
      return filteredOfendersData?.codigosByFrequency || [];
    }
    return filteredOfendersData.codigosByFrequency.filter(item => selectedOfendersCodes.includes(String(item.code)));
  }, [filteredOfendersData, selectedOfendersCodes]);
  const handleOfendersCodeSelectionChange = (codes: string[]) => {
    setSelectedOfendersCodes(codes);
  };

  // Funções para renderizar tabelas de ofensores
  const renderOfendersSummaryCards = () => {
    if (!filteredOfendersData) return null;

    // Calcular totais baseados nos códigos selecionados
    const selectedCodesSet = new Set(selectedOfendersCodes);

    // Filtrar dados de códigos apenas pelos códigos selecionados
    const selectedCodesData = filteredOfendersData.codigosByFrequency.filter(item => selectedCodesSet.has(String(item.code)));

    // Calcular total de insucessos dos códigos selecionados
    const totalInsucessosSelected = selectedCodesData.reduce((sum, item) => sum + item.count, 0);

    // Filtrar unidades que têm insucessos nos códigos selecionados
    const unidadesWithSelectedCodes = new Set<string>();

    // Filtrar motoristas que têm insucessos nos códigos selecionados
    const motoristasWithSelectedCodes = new Set<string>();

    // Se não há dados brutos ou códigos selecionados, usar dados totais
    if (!rawData || selectedOfendersCodes.length === 0) {
      return <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {filteredOfendersData.totalInsucessos.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground text-center">
                Total de Insucessos
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {filteredOfendersData.totalUnidades.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground text-center">
                Unidades Envolvidas
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {filteredOfendersData.totalMotoristas.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground text-center">
                Motoristas Envolvidos
              </div>
            </CardContent>
          </Card>
        </div>;
    }

    // Reprocessar dados brutos para contar apenas os códigos selecionados
    const {
      full
    } = rawData;
    const firstRow = full[0];
    const keys = Object.keys(firstRow);
    const ufKey = keys[50];
    const unidadeKey = keys[52];
    const ocorrenciaKey = "Codigo da Ultima Ocorrencia";
    const placaKey = keys[90];

    // Filtrar dados pelos filtros de UF/Unidade já aplicados
    const filteredData = full.filter(item => {
      const matchesUf = selectedUf === 'todas' || item[ufKey] === selectedUf;
      const matchesUnidade = selectedUnidades.includes('todas') || selectedUnidades.includes(item[unidadeKey]);
      return matchesUf && matchesUnidade;
    });

    // Contar apenas registros com códigos selecionados
    for (const row of filteredData) {
      const codigo = String(row[ocorrenciaKey] || "");
      const unidade = String(row[unidadeKey] || "");
      const placa = String(row[placaKey] || "");

      // Verificar se o código está nos códigos selecionados
      if (selectedCodesSet.has(codigo)) {
        if (unidade) {
          unidadesWithSelectedCodes.add(unidade);
        }
        if (placa && unidade) {
          const motoristaNome = getDriverName(placa, unidade);
          const key = `${motoristaNome}_${placa}`;
          motoristasWithSelectedCodes.add(key);
        }
      }
    }
    return <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {totalInsucessosSelected.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground text-center">
              Total de Insucessos
              {selectedOfendersCodes.length < filteredOfendersData.codigosByFrequency.length && <div className="text-xs text-gray-400 mt-1">
                  ({selectedOfendersCodes.length} códigos selecionados)
                </div>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {unidadesWithSelectedCodes.size.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground text-center">
              Unidades Envolvidas
              {selectedOfendersCodes.length < filteredOfendersData.codigosByFrequency.length && <div className="text-xs text-gray-400 mt-1">
                  (códigos selecionados)
                </div>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {motoristasWithSelectedCodes.size.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground text-center">
              Motoristas Envolvidos
              {selectedOfendersCodes.length < filteredOfendersData.codigosByFrequency.length && <div className="text-xs text-gray-400 mt-1">
                  (códigos selecionados)
                </div>}
            </div>
          </CardContent>
        </Card>
      </div>;
  };
  const renderOfendersCodigosTable = () => {
    if (!filteredOfendersData) return null;
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Códigos de Insucesso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <ResultsTable data={filteredOfendersData.codigosByFrequency.map(item => ({
            code: item.code,
            count: item.count,
            percentage: item.percentage
          }))} total={filteredOfendersData.totalInsucessos} selectedCodes={selectedOfendersCodes} onCodeSelectionChange={handleOfendersCodeSelectionChange} cityByCodeMap={{}} filteredCityData={{}} unidadeByCityMap={{}} />
          </div>
        </CardContent>
      </Card>;
  };
  const renderOfendersUnidadesTable = () => {
    if (!filteredOfendersData?.unidadesByFrequency) return null;
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-500" />
            Unidades com Mais Insucessos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Percentual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOfendersData.unidadesByFrequency.map((item, index) => <TableRow key={index}>
                  <TableCell className="font-medium">{item.unidade}</TableCell>
                  <TableCell className="text-right font-medium">{item.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="bg-blue-500 text-white">
                      {item.percentage.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>;
  };
  const renderOfendersMotoristasTable = () => {
    if (!filteredOfendersData?.motoristasByFrequency) return null;
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Motoristas com Mais Insucessos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Percentual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOfendersData.motoristasByFrequency.map((item, index) => <TableRow key={index}>
                  <TableCell className="font-medium">{item.motorista}</TableCell>
                  <TableCell className="font-mono">{item.placa}</TableCell>
                  <TableCell>{item.unidade}</TableCell>
                  <TableCell className="text-right font-medium">{item.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="bg-purple-500 text-white">
                      {item.percentage.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>;
  };
  const chartData = useMemo(() => {
    return filteredResults.filter(item => selectedCodes.includes(String(item.code)));
  }, [filteredResults, selectedCodes]);
  const getRecalculatedPercentage = (code: string) => {
    // Get total of all selected codes
    const selectedTotal = filteredResults.filter(row => selectedCodes.includes(String(row.code))).reduce((sum, row) => sum + row.count, 0);

    // Find the specific code data
    const codeData = filteredResults.find(item => String(item.code) === code);

    // Calculate percentage based on selected total
    if (codeData && selectedTotal > 0) {
      return codeData.count / selectedTotal * 100;
    }
    return 0;
  };
  const emRotaData = useMemo(() => {
    const codigo59 = filteredResults.find(item => String(item.code) === '59');
    const filteredPercentage = selectedCodes.includes('59') ? getRecalculatedPercentage('59') : 0;
    return {
      percentage: selectedCodes.length < filteredResults.length ? filteredPercentage : codigo59?.percentage || 0,
      count: codigo59?.count || 0
    };
  }, [filteredResults, selectedCodes]);
  const projecaoEntrega = useMemo(() => {
    const codigo1 = filteredResults.find(item => String(item.code) === '1');
    const codigo59 = filteredResults.find(item => String(item.code) === '59');
    const entregueFilteredPercentage = selectedCodes.includes('1') ? getRecalculatedPercentage('1') : 0;
    const emRotaFilteredPercentage = selectedCodes.includes('59') ? getRecalculatedPercentage('59') : 0;
    let somaCount = 0;
    let somaPercentage = 0;
    if (codigo1) {
      somaCount += codigo1.count;
      somaPercentage += selectedCodes.length < filteredResults.length ? entregueFilteredPercentage : codigo1.percentage;
    }
    if (codigo59) {
      somaCount += codigo59.count;
      somaPercentage += selectedCodes.length < filteredResults.length ? emRotaFilteredPercentage : codigo59.percentage;
    }
    return {
      percentage: somaPercentage,
      count: somaCount
    };
  }, [filteredResults, selectedCodes]);
  const entregueData = useMemo(() => {
    const codigo1 = filteredResults.find(item => String(item.code) === '1');
    const filteredPercentage = selectedCodes.includes('1') ? getRecalculatedPercentage('1') : 0;
    return {
      percentage: selectedCodes.length < filteredResults.length ? filteredPercentage : codigo1?.percentage || 0,
      count: codigo1?.count || 0
    };
  }, [filteredResults, selectedCodes]);
  const emPisoData = useMemo(() => {
    const codigo82 = filteredResults.find(item => String(item.code) === '82');
    const filteredPercentage = selectedCodes.includes('82') ? getRecalculatedPercentage('82') : 0;
    return {
      percentage: selectedCodes.length < filteredResults.length ? filteredPercentage : codigo82?.percentage || 0,
      count: codigo82?.count || 0
    };
  }, [filteredResults, selectedCodes]);

  const insucessosFilteredData = useMemo(() => {
    if (!rawData || !rawData.full) {
      return { count: 0, percentage: 0 };
    }

    const insucessoCodes = ['26', '18', '46', '23', '25', '27', '28', '65', '66', '33'];
    const { full } = rawData;
    const firstRow = full[0];
    const keys = Object.keys(firstRow);
    const dataUltimaOcorrenciaKey = keys[93]; // Coluna CP (94) - Data da Ultima Ocorrencia
    const ocorrenciaKey = "Codigo da Ultima Ocorrencia";
    const ufKey = keys[50];
    const unidadeKey = keys[52];

    // Obter data de hoje no formato DD/MM/YYYY
    const today = new Date();
    const todayString = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Filtrar dados com base no checkbox de data
    const filteredByDate = full.filter((item: any) => {
      const itemDate = item[dataUltimaOcorrenciaKey];
      if (!itemDate) return false;
      
      if (showTodayInsucessos) {
        // Mostrar apenas os de hoje
        return itemDate === todayString;
      } else {
        // Mostrar apenas os que NÃO são de hoje (ontem e anteriores)
        return itemDate !== todayString;
      }
    });

    // Aplicar filtros de UF e Unidade
    const filteredData = filteredByDate.filter((item: any) => {
      const matchesUf = selectedUf === 'todas' || item[ufKey] === selectedUf;
      const matchesUnidade = selectedUnidades.includes('todas') || selectedUnidades.includes(item[unidadeKey]);
      const hasOcorrencia = item[ocorrenciaKey];
      const isInsucesso = insucessoCodes.includes(String(item[ocorrenciaKey]));
      
      return matchesUf && matchesUnidade && hasOcorrencia && isInsucesso;
    });

    // Calcular total de registros para a porcentagem (todos os registros filtrados por data, UF e unidade)
    const totalRegistros = filteredByDate.filter((item: any) => {
      const matchesUf = selectedUf === 'todas' || item[ufKey] === selectedUf;
      const matchesUnidade = selectedUnidades.includes('todas') || selectedUnidades.includes(item[unidadeKey]);
      const hasOcorrencia = item[ocorrenciaKey];
      
      return matchesUf && matchesUnidade && hasOcorrencia;
    }).length;

    const insucessosCount = filteredData.length;
    const percentage = totalRegistros > 0 ? (insucessosCount / totalRegistros) * 100 : 0;
    
    return {
      count: insucessosCount,
      percentage: percentage
    };
  }, [rawData, selectedUf, selectedUnidades, showTodayInsucessos]);
  return <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">
            Análise de Códigos de Ocorrência
          </h1>
          <p className="mt-3 text-xl text-gray-500 max-w-2xl mx-auto">
            Faça upload de sua planilha para analisar os dados de ocorrências e entregas
          </p>
        </div>

        <div className="grid gap-6">
          <Collapsible open={!uploadCollapsed} onOpenChange={setUploadCollapsed}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className={`${!hasResults ? 'invisible' : ''} flex items-center gap-1`}>
                  {uploadCollapsed ? <ChevronDown className="h-4 w-4" /> : <Minimize className="h-4 w-4" />}
                  {uploadCollapsed ? 'Expandir' : 'Minimizar'} seção de upload
                </Button>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent>
              <FileUploader onFileUpload={processFileData} />
            </CollapsibleContent>
          </Collapsible>
          
          {hasResults && <>
              <Tabs defaultValue="codigos" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="codigos" className="flex items-center gap-2">
                    <ListCheck className="h-4 w-4" />
                    Análise de Códigos
                  </TabsTrigger>
                  <TabsTrigger value="placas" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Análise de Placas
                  </TabsTrigger>
                  <TabsTrigger value="ofensores" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Análise de Ofensores
                  </TabsTrigger>
                </TabsList>
                
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <Card className="w-full shadow-md hover:shadow-lg transition-all duration-200">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <CardTitle>
                        <div className="flex items-center gap-2">
                          <Filter className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">Filtros:</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 flex flex-wrap gap-4 items-center">
                      {ufsEntrega.length > 0 && <div className="flex-1 min-w-[180px]">
                          <label className="block text-sm font-medium text-gray-700 mb-1">UF de Entrega</label>
                          <Select value={selectedUf} onValueChange={handleUfChange}>
                            <SelectTrigger className="w-full border-blue-200 focus:border-blue-400">
                              <SelectValue placeholder="Selecione a UF" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todas">Todas as UFs</SelectItem>
                              {ufsEntrega.map(uf => <SelectItem key={uf} value={uf}>
                                  {uf}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>}
                      
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Receptora</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between border-blue-200 focus:border-blue-400" disabled={isLoading}>
                              {renderSelectedUnidades()}
                              <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-2 bg-white" align="start">
                            <div className="space-y-2">
                              <div className="pb-2">
                                <Input type="text" placeholder="Pesquisar unidades..." value={unidadeSearch} onChange={e => setUnidadeSearch(e.target.value)} className="w-full border-blue-200" />
                              </div>
                              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                                <Checkbox id="select-todas" checked={selectedUnidades.includes('todas')} onCheckedChange={() => toggleUnidade('todas')} />
                                <label htmlFor="select-todas" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer" onClick={() => toggleUnidade('todas')}>
                                  Todas as unidades
                                </label>
                              </div>
                              
                              <ScrollArea className="h-[200px] pr-3">
                                <div className="space-y-1">
                                  {filteredUnidades.map(unidade => <div key={unidade} className="flex items-center space-x-2 py-1">
                                      <Checkbox id={`select-${unidade}`} checked={selectedUnidades.includes(unidade)} onCheckedChange={() => toggleUnidade(unidade)} />
                                      <label htmlFor={`select-${unidade}`} className="text-sm leading-none cursor-pointer" onClick={() => toggleUnidade(unidade)}>
                                        {unidade}
                                      </label>
                                    </div>)}
                                  
                                  {filteredUnidades.length === 0 && <p className="text-sm text-gray-500 text-center py-2">
                                      Nenhuma unidade encontrada
                                    </p>}
                                </div>
                              </ScrollArea>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      {(selectedUf !== 'todas' || !selectedUnidades.includes('todas')) && <Button variant="outline" size="sm" onClick={resetFilter} className="self-end border-blue-300 hover:bg-blue-50" disabled={isLoading}>
                          Limpar filtros
                        </Button>}
                    </CardContent>
                  </Card>

                  {activeTab === "codigos" && <Card className="w-full shadow-md hover:shadow-lg transition-all duration-200">
                      <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
                        <CardTitle>
                          <div className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-indigo-500" />
                            <span className="font-medium text-gray-700">Visualização:</span>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-indigo-500" />
                          <span className="font-medium text-gray-700">Formato:</span>
                        </div>
                        <ToggleGroup type="single" value={viewMode} onValueChange={value => value && setViewMode(value as 'table' | 'chart')} className="border border-indigo-200 rounded-md">
                          <ToggleGroupItem value="table" aria-label="Tabela" className="data-[state=on]:bg-indigo-100 data-[state=on]:text-indigo-700">
                            <TableIcon className="h-5 w-5 mr-1" />
                            Tabela
                          </ToggleGroupItem>
                          <ToggleGroupItem value="chart" aria-label="Gráfico" className="data-[state=on]:bg-indigo-100 data-[state=on]:text-indigo-700">
                            <BarChart2 className="h-5 w-5 mr-1" />
                            Gráfico
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </CardContent>
                    </Card>}
                </div>
                
                <TabsContent value="codigos" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <Card className="shadow-md hover:shadow-lg transition-all duration-200">
                      <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-50 pb-3">
                        <CardTitle className="text-lg font-semibold text-green-700">Projeção</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center">
                          <div className="text-3xl font-bold text-green-600">{projecaoEntrega.count}</div>
                          <div className="text-xl font-semibold px-3 py-1 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full shadow-sm">
                            {projecaoEntrega.percentage.toFixed(1)}%
                          </div>
                          <div className="bg-green-50 p-3 rounded-full">
                            <Truck className="h-8 w-8 text-green-500" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Entregues + Em Rota</p>
                        {rawData && <UnidadeMetrics unidades={unidadesReceptoras} rawData={rawData} selectedUf={selectedUf} selectedUnidades={selectedUnidades} selectedCodes={selectedCodes} />}
                      </CardContent>
                    </Card>
                    
                    <Card className="shadow-md hover:shadow-lg transition-all duration-200">
                      <CardHeader className="bg-gradient-to-br from-blue-50 to-sky-50 pb-3">
                        <CardTitle className="text-lg font-semibold text-blue-700">Entregues</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center">
                          <div className="text-3xl font-bold text-blue-600">{entregueData.count}</div>
                          <div className="text-xl font-semibold px-3 py-1 bg-gradient-to-r from-blue-400 to-sky-500 text-white rounded-full shadow-sm">
                            {entregueData.percentage.toFixed(1)}%
                          </div>
                          <div className="bg-blue-50 p-3 rounded-full">
                            <Truck className="h-8 w-8 text-blue-500" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Código 1 - Entregas realizadas</p>
                        {rawData && <UnidadeMetrics unidades={unidadesReceptoras} rawData={rawData} selectedUf={selectedUf} selectedUnidades={selectedUnidades} selectedCodes={selectedCodes} codigo="1" label="Entregues por Unidade:" />}
                      </CardContent>
                    </Card>

                    <Card className="shadow-md hover:shadow-lg transition-all duration-200">
                      <CardHeader className="bg-gradient-to-br from-indigo-50 to-purple-50 pb-3">
                        <CardTitle className="text-lg font-semibold text-indigo-700">Em Rota</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center">
                          <div className="text-3xl font-bold text-indigo-600">{emRotaData.count}</div>
                          <div className="text-xl font-semibold px-3 py-1 bg-gradient-to-r from-indigo-400 to-purple-500 text-white rounded-full shadow-sm">
                            {emRotaData.percentage.toFixed(1)}%
                          </div>
                          <div className="bg-indigo-50 p-3 rounded-full">
                            <Truck className="h-8 w-8 text-indigo-500" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Código 59 - Separado para processo de entrega</p>
                        {rawData && <UnidadeMetrics unidades={unidadesReceptoras} rawData={rawData} selectedUf={selectedUf} selectedUnidades={selectedUnidades} selectedCodes={selectedCodes} codigo="59" label="Em Rota por Unidade:" />}
                      </CardContent>
                    </Card>
                    
                    <Card className="shadow-md hover:shadow-lg transition-all duration-200">
                      <CardHeader className="bg-gradient-to-br from-amber-50 to-orange-50 pb-3">
                        <CardTitle className="text-lg font-semibold text-amber-700">Em Piso</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center">
                          <div className="text-3xl font-bold text-amber-600">{emPisoData.count}</div>
                          <div className="text-xl font-semibold px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full shadow-sm">
                            {emPisoData.percentage.toFixed(1)}%
                          </div>
                          <div className="bg-amber-50 p-3 rounded-full">
                            <Package className="h-8 w-8 text-amber-500" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Código 82 - Mercadoria em piso</p>
                        {rawData && <UnidadeMetrics unidades={unidadesReceptoras} rawData={rawData} selectedUf={selectedUf} selectedUnidades={selectedUnidades} selectedCodes={selectedCodes} codigo="82" label="Em Piso por Unidade:" />}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <Card className="shadow-md hover:shadow-lg transition-all duration-200">
                      <CardHeader className="bg-gradient-to-br from-orange-50 to-red-50 pb-3">
                        <CardTitle className="text-lg font-semibold text-orange-700">Sem Movimentação</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center">
                          <div className="text-3xl font-bold text-orange-600">
                            {semMovimentacaoData?.count || 0}
                          </div>
                          <div className="text-xl font-semibold px-3 py-1 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-full shadow-sm">
                            {semMovimentacaoData && totalRecords > 0 ? (semMovimentacaoData.count / totalRecords * 100).toFixed(1) : 0}%
                          </div>
                          <div className="bg-orange-50 p-3 rounded-full">
                            <Clock className="h-8 w-8 text-orange-500" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Código 50 - Todas as bases</p>
                        {semMovimentacaoData && semMovimentacaoData.bases.length > 0}
                        <UnidadeMetrics unidades={selectedUnidades} rawData={rawData} selectedUf={selectedUf} selectedUnidades={selectedUnidades} selectedCodes={['50']} codigo="50" label="Sem Movimentação" />
                      </CardContent>
                    </Card>

                    <Card className="shadow-md hover:shadow-lg transition-all duration-200">
                      <CardHeader className="bg-gradient-to-br from-red-50 to-rose-50 pb-3">
                        <CardTitle className="text-lg font-semibold text-red-700">Insucessos</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Checkbox 
                            id="today-insucessos" 
                            checked={showTodayInsucessos}
                            onCheckedChange={(checked) => setShowTodayInsucessos(checked === true)}
                          />
                          <label 
                            htmlFor="today-insucessos" 
                            className="text-sm font-medium text-gray-700 cursor-pointer"
                          >
                            Mostrar apenas do dia de hoje
                          </label>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-3xl font-bold text-red-600">
                            {insucessosFilteredData.count}
                          </div>
                          <div className="text-xl font-semibold px-3 py-1 bg-gradient-to-r from-red-400 to-rose-500 text-white rounded-full shadow-sm">
                            {insucessosFilteredData.percentage.toFixed(1)}%
                          </div>
                          <div className="bg-red-50 p-3 rounded-full">
                            <AlertTriangle className="h-8 w-8 text-red-500" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Códigos 26, 18, 46, 23, 25, 27, 28, 65, 66, 33 - {showTodayInsucessos ? 'Apenas hoje' : 'Exceto hoje'}
                        </p>
                        {rawData && <UnidadeMetrics unidades={unidadesReceptoras} rawData={rawData} selectedUf={selectedUf} selectedUnidades={selectedUnidades} selectedCodes={['26', '18', '46', '23', '25', '27', '28', '65', '66', '33']} codigo="insucessos" label="Insucessos por Unidade:" showTodayOnly={showTodayInsucessos} />}
                      </CardContent>
                    </Card>
                  </div>

                  {isLoading ? <Card className="bg-white p-8 flex justify-center items-center">
                      <div className="flex flex-col items-center">
                        <Loader className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
                        <p className="text-gray-600">Processando dados...</p>
                      </div>
                    </Card> : viewMode === 'table' ? <div className="bg-white rounded-lg shadow-md overflow-hidden border border-indigo-100">
                      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
                        <h3 className="text-lg font-medium text-indigo-800 flex items-center">
                          <ListCheck className="h-5 w-5 mr-2 text-indigo-600" />
                          Códigos de Ocorrência
                        </h3>
                      </div>
                      <ResultsTable data={filteredResults} total={totalRecords} selectedCodes={selectedCodes} onCodeSelectionChange={handleCodeSelectionChange} cityByCodeMap={cityByCodeMap} filteredCityData={filteredCityData} unidadeByCityMap={unidadeByCityMap} />
                    </div> : <Card className="bg-white shadow-md overflow-hidden border border-indigo-100">
                      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border-b border-indigo-100">
                        <CardTitle className="text-lg font-medium text-indigo-800 flex items-center">
                          <BarChart2 className="h-5 w-5 mr-2 text-indigo-600" />
                          Gráfico de Ocorrências
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <ResultsChart data={chartData} hidden={false} />
                      </CardContent>
                    </Card>}
                  
                  <Card className="mt-4 bg-white shadow-md hover:shadow-lg transition-all border border-indigo-100">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-indigo-100">
                      <CardTitle className="text-sm font-medium text-indigo-800 flex items-center">
                        <Info className="h-4 w-4 mr-2 text-indigo-600" />
                        Como interpretar os resultados
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="text-sm text-gray-600">
                        <h3 className="font-medium text-gray-800 mb-2">Como interpretar:</h3>
                        <p>
                          A análise mostra a distribuição dos valores na coluna "Codigo da Ultima Ocorrencia".
                          Cada código é apresentado com sua frequência absoluta (quantidade) e relativa (porcentagem).
                        </p>
                        {selectedUf !== 'todas' && <p className="mt-2">
                            <strong>Filtro de UF ativo:</strong> Mostrando apenas registros da UF de Entrega: {selectedUf}
                          </p>}
                        {!selectedUnidades.includes('todas') && <p className="mt-2">
                            <strong>Filtro de Unidade ativo:</strong> Mostrando apenas registros das Unidades: {selectedUnidades.join(', ')}
                          </p>}
                        {selectedCodes.length !== filteredResults.length && <p className="mt-2">
                            <strong>Seleção de códigos:</strong> A porcentagem está recalculada considerando apenas os {selectedCodes.length} códigos selecionados.
                          </p>}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="placas" className="mt-4">
                  {isLoading ? <Card className="bg-white p-8 flex justify-center items-center">
                      <div className="flex flex-col items-center">
                        <Loader className="h-10 w-10 text-blue-500 animate-spin mb-4" />
                        <p className="text-gray-600">Processando dados...</p>
                      </div>
                    </Card> : <>
                      <PlacaTable data={filteredPlacasData} />
                      
                      <Card className="mt-4 bg-white shadow-sm hover:shadow-md transition-all">
                        <CardContent className="p-6">
                          <div className="text-sm text-gray-600">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-5 w-5 text-blue-500" />
                              <h3 className="font-medium text-gray-800">Como interpretar:</h3>
                            </div>
                            <div className="ml-7 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-500">Entregue</Badge>
                                <p>Pedidos que foram entregues com sucesso</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-orange-500">Insucesso</Badge>
                                <p>Pedidos com outras ocorrências (não entregues, nem em rota)</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-blue-500">Em Rota</Badge>
                                <p>Pedidos que estão separados para o processo de entrega</p>
                              </div>
                              <div className="mt-2">
                                <p><strong>Finalizado:</strong> Quando todos os pedidos (100%) foram entregues</p>
                                <p><strong>Finalizado com Insucessos:</strong> Quando não há mais pedidos em rota, mas existem insucessos</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>}
                </TabsContent>

                <TabsContent value="ofensores" className="mt-4">
                  {isLoading ? <Card className="bg-white p-8 text-center">
                      <p className="text-gray-500">Processando dados...</p>
                    </Card> : filteredOfendersData ? <>
                      {renderOfendersSummaryCards()}
                      
                      <Tabs defaultValue="codigos" className="space-y-4">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="codigos" className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Códigos
                          </TabsTrigger>
                          <TabsTrigger value="unidades" className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Unidades
                          </TabsTrigger>
                          <TabsTrigger value="motoristas" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Motoristas
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="codigos">
                          {renderOfendersCodigosTable()}
                        </TabsContent>

                        <TabsContent value="unidades">
                          {renderOfendersUnidadesTable()}
                        </TabsContent>

                        <TabsContent value="motoristas">
                          {renderOfendersMotoristasTable()}
                        </TabsContent>
                      </Tabs>
                    </> : <Card className="bg-white p-8 text-center">
                      <p className="text-gray-500">Nenhum dado de ofensores disponível</p>
                    </Card>}
                </TabsContent>
              </Tabs>
            </>}
          
          {!hasResults && <Card className="mt-4 bg-white shadow-sm">
              <CardContent className="p-8 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Envie um arquivo para visualizar os resultados da análise</p>
                <p className="text-sm text-gray-400 mt-2">Otimizado para arquivos com até 100.000 linhas</p>
              </CardContent>
            </Card>}
        </div>
      </div>
    </div>;
};
export default Index;