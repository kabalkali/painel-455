
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Truck, ClipboardCheck, Package, ArrowUp, ArrowDown, Check, User, MapPin } from 'lucide-react';
import { PlacaDetail } from './PlacaDetailDialog';
import { getDriverName } from '@/utils/driversData';

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
  motorista?: string;
  cidadePrincipal?: string;
  cidades?: {
    entregue: { [city: string]: { count: number, ctrcs: string[] } };
    insucesso: { [city: string]: { count: number, ctrcs: string[] } };
    emRota: { [city: string]: { count: number, ctrcs: string[] } };
  };
}

interface PlacaTableProps {
  data: PlacaData[];
}

type SortField = 'placa' | 'unidade' | 'motorista' | 'cidadePrincipal' | 'total' | 'entregue' | 'insucesso' | 'emRota' | 'percentEntregue';
type SortDirection = 'asc' | 'desc';

const PlacaTable: React.FC<PlacaTableProps> = ({ data }) => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  if (!data.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          Nenhum dado encontrado para os filtros selecionados.
        </CardContent>
      </Card>
    );
  }

  // Função para determinar a cidade com mais pedidos
  const getCidadePrincipal = (placa: PlacaData): string => {
    if (placa.cidadePrincipal) {
      return placa.cidadePrincipal;
    }

    if (!placa.cidades) {
      return 'N/A';
    }

    const cidadeCount: { [city: string]: number } = {};

    // Somar todos os pedidos por cidade (entregues, insucessos e em rota)
    Object.entries(placa.cidades.entregue || {}).forEach(([city, data]) => {
      cidadeCount[city] = (cidadeCount[city] || 0) + data.count;
    });

    Object.entries(placa.cidades.insucesso || {}).forEach(([city, data]) => {
      cidadeCount[city] = (cidadeCount[city] || 0) + data.count;
    });

    Object.entries(placa.cidades.emRota || {}).forEach(([city, data]) => {
      cidadeCount[city] = (cidadeCount[city] || 0) + data.count;
    });

    // Encontrar a cidade com mais pedidos
    let cidadePrincipal = 'N/A';
    let maxCount = 0;

    Object.entries(cidadeCount).forEach(([city, count]) => {
      if (count > maxCount) {
        maxCount = count;
        cidadePrincipal = city;
      }
    });

    return cidadePrincipal;
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'placa':
        comparison = a.placa.localeCompare(b.placa);
        break;
      case 'unidade':
        comparison = a.unidade.localeCompare(b.unidade);
        break;
      case 'motorista':
        const motoristaA = a.motorista || getDriverName(a.placa, a.unidade);
        const motoristaB = b.motorista || getDriverName(b.placa, b.unidade);
        comparison = motoristaA.localeCompare(motoristaB);
        break;
      case 'cidadePrincipal':
        const cidadeA = getCidadePrincipal(a);
        const cidadeB = getCidadePrincipal(b);
        comparison = cidadeA.localeCompare(cidadeB);
        break;
      case 'total':
        comparison = a.total - b.total;
        break;
      case 'entregue':
        comparison = a.entregue - b.entregue;
        break;
      case 'insucesso':
        comparison = a.insucesso - b.insucesso;
        break;
      case 'emRota':
        comparison = a.emRota - b.emRota;
        break;
      case 'percentEntregue':
        comparison = a.percentEntregue - b.percentEntregue;
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getSortIcon = (field: SortField) => {
    if (field !== sortField) return null;
    
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 inline" /> 
      : <ArrowDown className="h-4 w-4 ml-1 inline" />;
  };

  const isFinished = (percentEntregue: number, emRota: number): boolean => {
    return percentEntregue === 100 || (emRota === 0 && percentEntregue < 100);
  };

  // Calcular porcentagem de conclusão (entregues + insucessos)
  const getCompletionPercentage = (placa: PlacaData): number => {
    return placa.percentEntregue + placa.percentInsucesso;
  };
  
  const handleRowClick = (placa: PlacaData) => {
    // Create a valid PlacaDetail object from the PlacaData
    const detailPlaca: PlacaDetail = {
      ...placa,
      motorista: placa.motorista || getDriverName(placa.placa, placa.unidade),
      cidades: placa.cidades || {
        entregue: {},
        insucesso: {},
        emRota: {}
      }
    };
    
    // Store the selected placa data in session storage to retrieve it in the details page
    sessionStorage.setItem('selectedPlacaDetail', JSON.stringify(detailPlaca));
    
    // Navigate to the details page
    navigate(`/placa/${placa.placa}`);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white">
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-blue-600" />
          <span>Pedidos por Placa</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead 
                  className="w-[16%] cursor-pointer hover:bg-gray-100 p-2" 
                  onClick={() => handleSort('motorista')}
                >
                  <div className="flex items-center text-xs">
                    <User className="h-3 w-3 mr-1" />
                    Motorista {getSortIcon('motorista')}
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[10%] cursor-pointer hover:bg-gray-100 p-2" 
                  onClick={() => handleSort('placa')}
                >
                  <div className="flex items-center text-xs">
                    Placa {getSortIcon('placa')}
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[8%] cursor-pointer hover:bg-gray-100 p-2" 
                  onClick={() => handleSort('unidade')}
                >
                  <div className="flex items-center text-xs">
                    Unidade {getSortIcon('unidade')}
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[12%] cursor-pointer hover:bg-gray-100 p-2" 
                  onClick={() => handleSort('cidadePrincipal')}
                >
                  <div className="flex items-center text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    Cidade {getSortIcon('cidadePrincipal')}
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[6%] text-center cursor-pointer hover:bg-gray-100 p-2" 
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center justify-center text-xs">
                    Total {getSortIcon('total')}
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[12%] cursor-pointer hover:bg-gray-100 p-2" 
                  onClick={() => handleSort('entregue')}
                >
                  <div className="flex items-center text-xs">
                    <ClipboardCheck className="h-3 w-3 mr-1 text-green-500" />
                    Entregues {getSortIcon('entregue')}
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[12%] cursor-pointer hover:bg-gray-100 p-2" 
                  onClick={() => handleSort('insucesso')}
                >
                  <div className="flex items-center text-xs">
                    <Package className="h-3 w-3 mr-1 text-orange-500" />
                    Insucessos {getSortIcon('insucesso')}
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[12%] cursor-pointer hover:bg-gray-100 p-2" 
                  onClick={() => handleSort('emRota')}
                >
                  <div className="flex items-center text-xs">
                    <Truck className="h-3 w-3 mr-1 text-blue-500" />
                    Em Rota {getSortIcon('emRota')}
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[12%] cursor-pointer hover:bg-gray-100 p-2"
                  onClick={() => handleSort('percentEntregue')}
                >
                  <div className="flex items-center text-xs">
                    Progresso {getSortIcon('percentEntregue')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((placa, index) => {
                const driverName = placa.motorista || getDriverName(placa.placa, placa.unidade);
                const cidadePrincipal = getCidadePrincipal(placa);
                const completionPercentage = getCompletionPercentage(placa);
                
                return (
                  <TableRow 
                    key={placa.placa} 
                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} cursor-pointer hover:bg-blue-50`}
                    onClick={() => handleRowClick(placa)}
                  >
                    <TableCell className="p-2">
                      <div className="flex items-center">
                        <User className="h-3 w-3 text-gray-500 mr-1 flex-shrink-0" />
                        <span className={`${driverName === 'Não encontrado' ? 'text-gray-400 italic' : ''} text-xs truncate`}>
                          {driverName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <span className="text-xs font-medium truncate block">{placa.placa}</span>
                    </TableCell>
                    <TableCell className="p-2">
                      <span className="text-xs truncate block">{placa.unidade}</span>
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 text-blue-500 mr-1 flex-shrink-0" />
                        <span className="text-xs truncate">{cidadePrincipal}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center p-2">
                      <span className="text-xs font-semibold">{placa.total}</span>
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="text-center">
                        <div className="text-xs font-medium">{placa.entregue}</div>
                        <Badge className="bg-green-500 text-xs px-1 py-0">
                          {placa.percentEntregue.toFixed(0)}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="text-center">
                        <div className="text-xs font-medium">{placa.insucesso}</div>
                        <Badge className="bg-orange-500 text-xs px-1 py-0">
                          {placa.percentInsucesso.toFixed(0)}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="text-center">
                        <div className="text-xs font-medium">{placa.emRota}</div>
                        <Badge className="bg-blue-500 text-xs px-1 py-0">
                          {placa.percentEmRota.toFixed(0)}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="text-center">
                        {isFinished(placa.percentEntregue, placa.emRota) ? (
                          <div>
                            {placa.percentEntregue === 100 ? (
                              <div className="flex items-center justify-center bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Finalizado
                              </div>
                            ) : (
                              <div className="flex items-center justify-center bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                <Package className="h-3 w-3 mr-1" />
                                Finalizado c/ Insucessos
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">
                              {completionPercentage.toFixed(0)}%
                            </div>
                            <div className="text-xs text-gray-500">
                              Concluído
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlacaTable;
