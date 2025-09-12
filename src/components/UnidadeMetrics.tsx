import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { getPrazoByCidade } from '@/utils/prazosEntrega';
import UnidadeDetailDialog from './UnidadeDetailDialog';

interface UnidadeMetricsProps {
  unidades: string[];
  rawData: any;
  selectedUf: string;
  selectedUnidades: string[];
  selectedCodes: string[];
  codigo?: string;
  label?: string;
  showTodayOnly?: boolean;
}

const UnidadeMetrics: React.FC<UnidadeMetricsProps> = ({
  unidades,
  rawData,
  selectedUf,
  selectedUnidades,
  selectedCodes,
  codigo,
  label,
  showTodayOnly = false
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');

  if (!rawData || selectedUnidades.includes('todas') || !selectedCodes || selectedCodes.length === 0) {
    return null;
  }

  const getPercentageColor = (percentage: number, cardType: string): string => {
    console.log(`Card Type: ${cardType}, Percentage: ${percentage}`);
    
    switch (cardType) {
      case 'projecao':
        if (percentage >= 97.0) return 'bg-green-500';
        if (percentage >= 95.0) return 'bg-yellow-500';
        return 'bg-red-500';
      
      case 'entregues':
        if (percentage >= 96.5) return 'bg-green-500';
        if (percentage >= 94.0) return 'bg-yellow-500';
        return 'bg-red-500';
      
      case 'emRota':
        if (percentage === 0) return 'bg-green-500';
        if (percentage <= 5.0) return 'bg-yellow-500';
        return 'bg-red-500';
      
      case 'emPiso':
        if (percentage === 0) return 'bg-green-500';
        if (percentage <= 1.0) return 'bg-yellow-500';
        return 'bg-red-500';
      
      case 'semPrazo':
        if (percentage <= 2.0) return 'bg-green-500';
        if (percentage <= 5.0) return 'bg-yellow-500';
        return 'bg-red-500';
      
      default:
        return 'bg-blue-500'; // Fallback color
    }
  };

  const getCardType = (): string => {
    console.log(`Codigo: ${codigo}, Label: ${label}`);
    
    // Para card de Projeção (quando não tem código específico E o label contém "projeção")
    if (!codigo && label && label.toLowerCase().includes('projeção')) {
      return 'projecao';
    }
    // Ou quando não tem código específico e não tem label (assumindo que é projeção por default)
    if (!codigo && !label) {
      return 'projecao';
    }
    
    if (codigo === '1') {
      return 'entregues';
    }
    if (codigo === '59') {
      return 'emRota';
    }
    if (codigo === '82') {
      return 'emPiso';
    }
    if (codigo === 'semPrazo') {
      return 'semPrazo';
    }
    return 'default';
  };

  const calculateUnidadeMetrics = (unidade: string) => {
    const { full } = rawData;
    if (!full || full.length === 0) return null;

    const firstRow = full[0];
    const keys = Object.keys(firstRow);
    const ufKey = keys[50];
    const unidadeKey = keys[52];
    const ocorrenciaKey = "Codigo da Ultima Ocorrencia";

    // Para card "Insucessos", somar todos os códigos de insucesso por unidade
    if (codigo === 'insucessos') {
      const insucessoCodes = ['26', '18', '46', '23', '25', '27', '28', '65', '66', '33'];
      const dataUltimaOcorrenciaKey = keys[93]; // Coluna CP (94) - Data da Ultima Ocorrencia
      
      // Obter data de hoje no formato DD/MM/YYYY
      const today = new Date();
      const todayString = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

      // Filtrar por data primeiro
      const filteredByDate = full.filter((item: any) => {
        const itemDate = item[dataUltimaOcorrenciaKey];
        if (!itemDate) return false;
        
        if (showTodayOnly) {
          // Mostrar apenas os de hoje
          return itemDate === todayString;
        } else {
          // Mostrar apenas os que NÃO são de hoje (ontem e anteriores)
          return itemDate !== todayString;
        }
      });
      
      // Base total: todos os CTRCs da unidade filtrados por data
      const totalGeralData = filteredByDate.filter((item: any) => {
        const matchesUf = selectedUf === 'todas' || item[ufKey] === selectedUf;
        const matchesUnidade = item[unidadeKey] === unidade;
        const hasOcorrencia = item[ocorrenciaKey];
        return matchesUf && matchesUnidade && hasOcorrencia;
      });

      // Quantidade específica dos códigos de insucesso
      const insucessosCount = totalGeralData.filter((item: any) => 
        insucessoCodes.includes(String(item[ocorrenciaKey]))
      ).length;
      
      const totalGeral = totalGeralData.length;
      const percentage = totalGeral > 0 ? insucessosCount / totalGeral * 100 : 0;
      
      return {
        unidade,
        count: insucessosCount,
        total: totalGeral,
        percentage: percentage
      };
    }

    // Para card "Sem Movimentação" (código 50), calcular porcentagem em relação ao total geral
    if (codigo === '50') {
      // Base total: todos os CTRCs da unidade (independente do código)
      const totalGeralData = full.filter((item: any) => {
        const matchesUf = selectedUf === 'todas' || item[ufKey] === selectedUf;
        const matchesUnidade = item[unidadeKey] === unidade;
        const hasOcorrencia = item[ocorrenciaKey];
        return matchesUf && matchesUnidade && hasOcorrencia;
      });

      // Quantidade específica do código 50
      const codigo50Count = totalGeralData.filter((item: any) => String(item[ocorrenciaKey]) === '50').length;
      
      const totalGeral = totalGeralData.length;
      const percentage = totalGeral > 0 ? codigo50Count / totalGeral * 100 : 0;
      
      return {
        unidade,
        count: codigo50Count,
        total: totalGeral,
        percentage: percentage
      };
    }

    // Para card "Sem Prazo", calcular CTRCs que chegaram sem prazo ideal
    if (codigo === 'semPrazo') {
      const cidadeKey = keys[49]; // Coluna AX (50) - Cidade de Entrega
      const previsaoEntregaKey = keys[97]; // Coluna CV (98) - Previsao de Entrega
      const dataUltimoManifestoKey = keys[85]; // Coluna CI (86) - Data do Ultimo Manifesto
      
      // Base total: todos os CTRCs da unidade (independente do código)
      const totalGeralData = full.filter((item: any) => {
        const matchesUf = selectedUf === 'todas' || item[ufKey] === selectedUf;
        const matchesUnidade = item[unidadeKey] === unidade;
        return matchesUf && matchesUnidade;
      });

      // Quantidade específica dos CTRCs sem prazo
      const semPrazoCount = totalGeralData.filter((item: any) => {
        const cidade = String(item[cidadeKey] || "").trim();
        const previsaoEntrega = item[previsaoEntregaKey];
        const dataUltimoManifesto = item[dataUltimoManifestoKey];
        
        if (!cidade || !previsaoEntrega || !dataUltimoManifesto) return false;
        
        // Obter prazo esperado para a cidade e unidade
        const prazoEsperado = getPrazoByCidade(cidade, unidade);
        if (prazoEsperado === null) return false;
        
        // Calcular diferença de dias entre previsão e último manifesto
        const previsaoDate = new Date(previsaoEntrega);
        const manifestoDate = new Date(dataUltimoManifesto);
        
        if (isNaN(previsaoDate.getTime()) || isNaN(manifestoDate.getTime())) return false;
        
        const diferencaDias = Math.ceil((previsaoDate.getTime() - manifestoDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Incluir apenas se a diferença for menor que o prazo estabelecido
        return diferencaDias < prazoEsperado;
      }).length;
      
      const totalGeral = totalGeralData.length;
      const percentage = totalGeral > 0 ? semPrazoCount / totalGeral * 100 : 0;
      
      return {
        unidade,
        count: semPrazoCount,
        total: totalGeral,
        percentage: percentage
      };
    }

    // Para outros códigos, usar a lógica original com códigos selecionados
    const filteredData = full.filter((item: any) => {
      const matchesUf = selectedUf === 'todas' || item[ufKey] === selectedUf;
      const matchesUnidade = item[unidadeKey] === unidade;
      const hasOcorrencia = item[ocorrenciaKey];
      const codigoSelecionado = selectedCodes && Array.isArray(selectedCodes) && selectedCodes.includes(String(item[ocorrenciaKey]));
      
      return matchesUf && matchesUnidade && hasOcorrencia && codigoSelecionado;
    });

    const totalUnidade = filteredData.length;
    if (totalUnidade === 0) return null;

    if (codigo) {
      // Para códigos específicos (1, 59, 82)
      const codigoCount = filteredData.filter((item: any) => String(item[ocorrenciaKey]) === codigo).length;
      const percentage = totalUnidade > 0 ? codigoCount / totalUnidade * 100 : 0;
      return {
        unidade,
        count: codigoCount,
        total: totalUnidade,
        percentage: percentage
      };
    } else {
      // Para projeção (entregues + em rota)
      const entregues = filteredData.filter((item: any) => String(item[ocorrenciaKey]) === '1').length;
      const emRota = filteredData.filter((item: any) => String(item[ocorrenciaKey]) === '59').length;
      const projecao = entregues + emRota;
      const percentage = totalUnidade > 0 ? projecao / totalUnidade * 100 : 0;
      return {
        unidade,
        count: projecao,
        total: totalUnidade,
        percentage: percentage
      };
    }
  };

  const handleQuantityClick = (unidade: string) => {
    setSelectedUnidade(unidade);
    setDialogOpen(true);
  };

  const cardType = getCardType();
  const metricsData = selectedUnidades
    .filter(unidade => unidade !== 'todas')
    .map(unidade => calculateUnidadeMetrics(unidade))
    .filter(data => data !== null)
    .sort((a, b) => b!.percentage - a!.percentage); // Ordenar por porcentagem do maior para o menor

  if (metricsData.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-4">
        <div className="text-sm font-medium text-gray-700 mb-3">
          Por Unidade:
        </div>
        <div className="bg-white border rounded-lg p-3 space-y-1">
          {metricsData.map((data, index) => (
            <div key={index} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0">
              <div className="flex-1 text-left">
                <span className="font-semibold text-xs text-gray-800">
                  {data!.unidade}
                </span>
              </div>
              <div className="flex-1 text-center">
                <button 
                  onClick={() => handleQuantityClick(data!.unidade)} 
                  className="font-semibold text-xs underline cursor-pointer text-gray-950"
                >
                  {data!.count.toLocaleString()}
                </button>
              </div>
              <div className="flex-1 text-right">
                <Badge 
                  className={`${getPercentageColor(data!.percentage, cardType)} text-white font-semibold text-xs`}
                >
                  {data!.percentage.toFixed(1)}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      <UnidadeDetailDialog 
        isOpen={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        unidade={selectedUnidade} 
        data={metricsData} 
        rawData={rawData} 
        selectedUf={selectedUf} 
        selectedCodes={selectedCodes} 
        codigo={codigo} 
      />
    </>
  );
};

export default UnidadeMetrics;
