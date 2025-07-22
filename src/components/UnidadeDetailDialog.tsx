import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown } from 'lucide-react';
import CtrcDetailDialog from './CtrcDetailDialog';
interface UnidadeDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  unidade: string;
  data: any[];
  rawData: any;
  selectedUf: string;
  selectedCodes: string[];
  codigo?: string;
}
interface GroupedRecord {
  cidade: string;
  ultimaAtualizacao: string;
  quantidade: number;
  ctrcs: string[];
}
type SortField = 'cidade' | 'ultimaAtualizacao' | 'quantidade';
type SortDirection = 'asc' | 'desc';
const UnidadeDetailDialog: React.FC<UnidadeDetailDialogProps> = ({
  isOpen,
  onClose,
  unidade,
  data,
  rawData,
  selectedUf,
  selectedCodes,
  codigo
}) => {
  const [ctrcDialogOpen, setCtrcDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedRecord | null>(null);
  const [sortField, setSortField] = useState<SortField>('ultimaAtualizacao');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  if (!rawData || !rawData.full) {
    return null;
  }
  const getFilteredRecords = () => {
    const {
      full
    } = rawData;
    const firstRow = full[0];
    const keys = Object.keys(firstRow);

    // Identificar as colunas necessárias
    const ufKey = keys[50]; // Coluna UF (51)
    const unidadeKey = keys[52]; // Coluna Unidade (53)
    const ocorrenciaKey = "Codigo da Ultima Ocorrencia";
    const cidadeKey = keys[49]; // Coluna AX (50) - Cidade de Entrega
    const dataUltimaOcorrenciaKey = keys[93]; // Coluna CP (94) - Data da Ultima Ocorrencia
    const ctrcKey = keys[1]; // Coluna B (2) - Serie/Numero CTRC

    // Filtrar dados da mesma forma que o UnidadeMetrics
    const filteredData = full.filter((item: any) => {
      const matchesUf = selectedUf === 'todas' || item[ufKey] === selectedUf;
      const matchesUnidade = item[unidadeKey] === unidade;
      const hasOcorrencia = item[ocorrenciaKey];
      const codigoSelecionado = selectedCodes && Array.isArray(selectedCodes) && selectedCodes.includes(String(item[ocorrenciaKey]));

      // Se tem código específico, filtrar por ele
      if (codigo) {
        const matchesCodigo = String(item[ocorrenciaKey]) === codigo;
        return matchesUf && matchesUnidade && hasOcorrencia && matchesCodigo;
      } else {
        // Para projeção (entregues + em rota), filtrar códigos 1 e 59
        const isProjecao = String(item[ocorrenciaKey]) === '1' || String(item[ocorrenciaKey]) === '59';
        return matchesUf && matchesUnidade && hasOcorrencia && isProjecao;
      }
    });

    // Mapear para o formato necessário
    const records = filteredData.map((item: any) => ({
      cidade: item[cidadeKey] || 'N/A',
      ultimaAtualizacao: item[dataUltimaOcorrenciaKey] || 'N/A',
      ctrc: item[ctrcKey] || 'N/A'
    }));

    // Agrupar por cidade e data
    const groupedMap = new Map<string, GroupedRecord>();
    records.forEach(record => {
      const key = `${record.cidade}-${record.ultimaAtualizacao}`;
      if (groupedMap.has(key)) {
        const existing = groupedMap.get(key)!;
        existing.quantidade += 1;
        existing.ctrcs.push(record.ctrc);
      } else {
        groupedMap.set(key, {
          cidade: record.cidade,
          ultimaAtualizacao: record.ultimaAtualizacao,
          quantidade: 1,
          ctrcs: [record.ctrc]
        });
      }
    });
    return Array.from(groupedMap.values());
  };
  const sortedRecords = () => {
    const records = getFilteredRecords();
    return records.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'cidade':
          comparison = a.cidade.localeCompare(b.cidade);
          break;
        case 'ultimaAtualizacao':
          // Para datas, vamos tentar fazer uma comparação mais inteligente
          const dateA = new Date(a.ultimaAtualizacao);
          const dateB = new Date(b.ultimaAtualizacao);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            // Se não conseguir converter para data, compara como string
            comparison = a.ultimaAtualizacao.localeCompare(b.ultimaAtualizacao);
          } else {
            comparison = dateA.getTime() - dateB.getTime();
          }
          break;
        case 'quantidade':
          comparison = a.quantidade - b.quantidade;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUp className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };
  const groupedRecords = sortedRecords();
  const handleVerCtrcs = (group: GroupedRecord) => {
    setSelectedGroup(group);
    setCtrcDialogOpen(true);
  };
  return <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Detalhes - {unidade}
              {codigo && ` - Código ${codigo}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('cidade')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Cidade
                      {renderSortIcon('cidade')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('ultimaAtualizacao')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Última Atualização
                      {renderSortIcon('ultimaAtualizacao')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('quantidade')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Quantidade
                      {renderSortIcon('quantidade')}
                    </Button>
                  </TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRecords.length > 0 ? groupedRecords.map((record, index) => <TableRow key={index}>
                      <TableCell>{record.cidade}</TableCell>
                      <TableCell>{record.ultimaAtualizacao}</TableCell>
                      <TableCell>{record.quantidade}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleVerCtrcs(record)} className="bg-blue-500 hover:bg-blue-400 text-gray-50">
                          Ver CTRC's
                        </Button>
                      </TableCell>
                    </TableRow>) : <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>}
              </TableBody>
            </Table>
          </div>
          
          <div className="text-sm text-gray-500 mt-4">
            Total de grupos: {groupedRecords.length}
          </div>
        </DialogContent>
      </Dialog>

      {selectedGroup && <CtrcDetailDialog isOpen={ctrcDialogOpen} onClose={() => setCtrcDialogOpen(false)} cidade={selectedGroup.cidade} ultimaAtualizacao={selectedGroup.ultimaAtualizacao} ctrcs={selectedGroup.ctrcs} />}
    </>;
};
export default UnidadeDetailDialog;