
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFormattedCodeDescription } from '@/utils/codeMapping';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Filter, ChevronDown, ChevronUp, MapPin, Building2, Calendar, Clock, List } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface ResultData {
  code: string | number;
  count: number;
  percentage: number;
}

interface CityData {
  city: string;
  count: number;
  percentage: number;
  unidade?: string;
  dates?: Record<string, number>; // Map of date -> count
  ctrcs?: Record<string, string[]>; // Map of date -> ctrcs
}

interface ResultsTableProps {
  data: ResultData[];
  total: number;
  selectedCodes: string[];
  onCodeSelectionChange: (codes: string[]) => void;
  cityByCodeMap?: Record<string, Record<string, number>>;
  filteredCityData?: Record<string, Record<string, number>>;
  unidadeByCityMap?: Record<string, Record<string, string>>;
  datesByCityMap?: Record<string, Record<string, Record<string, number>>>;
  ctrcsByDateMap?: Record<string, Record<string, Record<string, string[]>>>;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ 
  data, 
  total, 
  selectedCodes, 
  onCodeSelectionChange,
  cityByCodeMap = {},
  filteredCityData,
  unidadeByCityMap = {},
  datesByCityMap = {},
  ctrcsByDateMap = {}
}) => {
  const [showCodeSelector, setShowCodeSelector] = useState(false);
  const [sortField, setSortField] = useState<'code' | 'count' | 'percentage'>('count');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({});
  const [expandedDates, setExpandedDates] = useState<Record<string, Record<string, boolean>>>({});
  const [openCityPopovers, setOpenCityPopovers] = useState<{[key: string]: boolean}>({});

  // Debug logging for incoming data
  useEffect(() => {
    console.log("datesByCityMap:", datesByCityMap);
    console.log("ctrcsByDateMap:", ctrcsByDateMap);
  }, [datesByCityMap, ctrcsByDateMap]);

  // Calcular total apenas dos códigos selecionados
  const selectedTotal = data
    .filter(row => selectedCodes.includes(String(row.code)))
    .reduce((sum, row) => sum + row.count, 0);

  // Recalcular as porcentagens baseado nos códigos selecionados
  const recalculatedData = data.map(row => ({
    ...row,
    recalculatedPercentage: selectedCodes.includes(String(row.code))
      ? (row.count / selectedTotal) * 100
      : 0
  }));

  // Ordenar os dados
  const sortedData = [...recalculatedData].sort((a, b) => {
    if (sortField === 'code') {
      const codeA = String(a.code);
      const codeB = String(b.code);
      return sortDirection === 'asc' 
        ? codeA.localeCompare(codeB)
        : codeB.localeCompare(codeA);
    } else if (sortField === 'count') {
      return sortDirection === 'asc' 
        ? a.count - b.count
        : b.count - a.count;
    } else {
      return sortDirection === 'asc' 
        ? a.percentage - b.percentage
        : b.percentage - a.percentage;
    }
  });

  // Filtrar apenas os códigos selecionados para exibição
  const filteredData = sortedData.filter(row => 
    selectedCodes.includes(String(row.code))
  );

  const handleSortChange = (field: 'code' | 'count' | 'percentage') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleCodeSelection = (code: string) => {
    const newSelection = selectedCodes.includes(code)
      ? selectedCodes.filter(c => c !== code)
      : [...selectedCodes, code];
    
    onCodeSelectionChange(newSelection.length > 0 ? newSelection : [data[0].code.toString()]);
  };

  const toggleAllCodes = () => {
    if (selectedCodes.length === data.length) {
      // Se todos estão selecionados, selecione apenas o primeiro
      onCodeSelectionChange([data[0].code.toString()]);
    } else {
      // Senão, selecione todos
      onCodeSelectionChange(data.map(item => String(item.code)));
    }
  };

  const toggleCodeExpansion = (code: string) => {
    setExpandedCodes(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  // Refactored date expansion toggle to ensure it works
  const toggleDateExpansion = (code: string, city: string) => {
    setExpandedDates(prev => {
      const newState = {...prev};
      
      if (!newState[code]) {
        newState[code] = {};
      }
      
      newState[code][city] = !newState[code]?.[city];
      
      console.log(`Toggling date expansion for city ${city} in code ${code}: ${newState[code][city]}`);
      return newState;
    });
  };

  // Refactored popover handling for CTRCs
  const toggleCtrcPopover = (code: string, city: string) => {
    const key = `${code}-${city}`;
    
    setOpenCityPopovers(prev => {
      const newState = {...prev};
      newState[key] = !prev[key];
      
      console.log(`Toggling CTRC popover for city ${city} in code ${code}: ${newState[key]}`);
      return newState;
    });
  };

  // Processar dados das cidades para um determinado código
  const getCityData = (code: string): CityData[] => {
    // Usar os dados de cidades filtrados se disponíveis, caso contrário usar os dados gerais
    const citiesMap = filteredCityData && filteredCityData[code] 
      ? filteredCityData[code] 
      : cityByCodeMap[code] || {};
      
    const totalCount = Object.values(citiesMap).reduce((sum, count) => sum + (count as number), 0);
    
    return Object.entries(citiesMap).map(([city, count]) => {
      const cityDates = datesByCityMap[code]?.[city] || {};
      const cityCtrcs = ctrcsByDateMap[code]?.[city] || {};
      
      console.log(`Processing city ${city} in code ${code}:`, { 
        dates: cityDates, 
        ctrcs: cityCtrcs 
      });
      
      return {
        city,
        count: count as number,
        percentage: totalCount > 0 ? ((count as number) / totalCount) * 100 : 0,
        unidade: unidadeByCityMap[code]?.[city] || 'Não informada',
        dates: cityDates,
        ctrcs: cityCtrcs
      };
    }).sort((a, b) => b.count - a.count);
  };

  // Agrupar cidades por unidade para um determinado código
  const getUnidadeCityData = (code: string): Record<string, CityData[]> => {
    const cityData = getCityData(code);
    const unidadeCityData: Record<string, CityData[]> = {};
    
    cityData.forEach(city => {
      const unidade = city.unidade || 'Não informada';
      if (!unidadeCityData[unidade]) {
        unidadeCityData[unidade] = [];
      }
      unidadeCityData[unidade].push(city);
    });
    
    return unidadeCityData;
  };

  // Calcular o total por unidade para um determinado código
  const getUnidadeTotalData = (code: string): Record<string, {count: number, percentage: number}> => {
    const unidadeCityData = getUnidadeCityData(code);
    const result: Record<string, {count: number, percentage: number}> = {};
    
    let totalCount = 0;
    Object.entries(unidadeCityData).forEach(([unidade, cities]) => {
      const unidadeCount = cities.reduce((sum, city) => sum + city.count, 0);
      result[unidade] = {
        count: unidadeCount,
        percentage: 0 // Calculado posteriormente
      };
      totalCount += unidadeCount;
    });
    
    // Calcular porcentagens
    Object.entries(result).forEach(([unidade, data]) => {
      result[unidade].percentage = totalCount > 0 ? (data.count / totalCount) * 100 : 0;
    });
    
    return result;
  };

  const renderSortIcon = (field: 'code' | 'count' | 'percentage') => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="inline h-4 w-4 ml-1" /> : 
      <ChevronDown className="inline h-4 w-4 ml-1" />;
  };
  
  // Helper function to check if dates object has any values
  const hasDateInfo = (dates: Record<string, number> | undefined): boolean => {
    return !!dates && Object.keys(dates).length > 0;
  };
  
  // Helper function to check if CTRCs object has any values
  const hasCtrcInfo = (ctrcs: Record<string, string[]> | undefined): boolean => {
    return !!ctrcs && Object.keys(ctrcs).length > 0;
  };

  // Helper to get all CTRCs for a city regardless of date
  const getAllCtrcsForCity = (code: string, city: string): string[] => {
    const cityCtrcs = ctrcsByDateMap[code]?.[city] || {};
    const allCtrcs: string[] = [];
    
    Object.values(cityCtrcs).forEach(ctrcsForDate => {
      if (Array.isArray(ctrcsForDate)) {
        allCtrcs.push(...ctrcsForDate);
      }
    });
    
    console.log(`Getting all CTRCs for city ${city} in code ${code}:`, allCtrcs);
    return allCtrcs;
  };

  return (
    <Card className="w-full mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-bold">Resultado da Análise</CardTitle>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowCodeSelector(!showCodeSelector)}
            className="flex items-center gap-1"
          >
            <Filter className="h-4 w-4" />
            Filtrar Códigos
            {showCodeSelector ? 
              <ChevronUp className="h-4 w-4" /> : 
              <ChevronDown className="h-4 w-4" />
            }
          </Button>
        </div>
      </CardHeader>

      {showCodeSelector && (
        <CardContent className="pt-2 pb-3 border-b">
          <div className="bg-muted/30 p-3 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-sm">Selecione os códigos para visualizar:</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleAllCodes}
                className="h-8 text-xs"
              >
                {selectedCodes.length === data.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
              {data.map((row) => (
                <div key={row.code} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`code-${row.code}`}
                    checked={selectedCodes.includes(String(row.code))}
                    onCheckedChange={() => toggleCodeSelection(String(row.code))}
                  />
                  <label 
                    htmlFor={`code-${row.code}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate"
                  >
                    {getFormattedCodeDescription(row.code)}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead 
                  className="font-medium cursor-pointer"
                  onClick={() => handleSortChange('code')}
                >
                  Código {renderSortIcon('code')}
                </TableHead>
                <TableHead 
                  className="font-medium cursor-pointer"
                  onClick={() => handleSortChange('count')}
                >
                  Quantidade {renderSortIcon('count')}
                </TableHead>
                <TableHead 
                  className="font-medium cursor-pointer"
                  onClick={() => handleSortChange('percentage')}
                >
                  {selectedCodes.length === data.length ? 'Porcentagem' : 'Porcentagem (Filtrada)'} 
                  {renderSortIcon('percentage')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((row, index) => {
                const codeStr = String(row.code);
                const unidadeCityData = getUnidadeCityData(codeStr);
                const unidadeTotalData = getUnidadeTotalData(codeStr);
                const hasData = Object.keys(unidadeCityData).length > 0;
                
                return (
                  <React.Fragment key={index}>
                    <TableRow className={expandedCodes[codeStr] ? "bg-muted/20" : ""}>
                      <TableCell className="p-2 w-12">
                        {hasData && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => toggleCodeExpansion(codeStr)}
                          >
                            {expandedCodes[codeStr] ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                            }
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{getFormattedCodeDescription(row.code)}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>
                        <span className="percentage-pill px-3 py-1.5 rounded-md font-medium inline-block min-w-16 text-center text-white bg-gradient-to-r from-blue-500 to-indigo-600">
                          {selectedCodes.length === data.length
                            ? row.percentage.toFixed(2)
                            : row.recalculatedPercentage.toFixed(2)
                          }%
                        </span>
                      </TableCell>
                    </TableRow>
                    
                    {hasData && expandedCodes[codeStr] && (
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={4} className="p-0">
                          <div className="pl-10 pr-4 py-3 border-t border-muted">
                            <div className="text-sm font-medium mb-3 flex items-center">
                              <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                              Unidades e Cidades de entrega
                            </div>
                            <div className="space-y-5">
                              {Object.entries(unidadeCityData).map(([unidade, cities], uidx) => {
                                const unidadeData = unidadeTotalData[unidade] || { count: 0, percentage: 0 };
                                
                                return (
                                  <div key={uidx} className="mb-3">
                                    <div className="flex items-center justify-between mb-2 bg-blue-50/50 p-2 rounded-md">
                                      <div className="flex items-center">
                                        <Building2 className="h-4 w-4 mr-2 text-blue-600" />
                                        <span className="font-medium text-blue-800">{unidade}</span>
                                      </div>
                                      <span className="percentage-pill bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-3 py-1 rounded-md font-medium text-sm">
                                        {unidadeData.percentage.toFixed(2)}%
                                      </span>
                                    </div>
                                    
                                    <div className="ml-4 mt-1 border-l-2 border-blue-100 pl-4">
                                      <div className="text-xs text-blue-700 mb-1 ml-1">Cidades de Entrega</div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                        {cities.map((city, cidx) => {
                                          const hasDateData = hasDateInfo(city.dates);
                                          const hasCtrcData = hasCtrcInfo(city.ctrcs);
                                          const isDateExpanded = expandedDates[codeStr]?.[city.city] || false;
                                          const allCityCtrcs = getAllCtrcsForCity(codeStr, city.city);
                                          const popoverKey = `${codeStr}-${city.city}`;
                                          const isPopoverOpen = !!openCityPopovers[popoverKey];
                                          
                                          return (
                                            <div key={`${cidx}-${city.city}`} className="mb-3 relative">
                                              <div className="flex justify-between items-center text-sm py-1 border-b border-dashed border-muted">
                                                <span className="text-muted-foreground">{city.city}</span>
                                                <div className="flex items-center space-x-4">
                                                  <span className="text-right tabular-nums">{city.count}</span>
                                                  <span className="percentage-pill text-right tabular-nums min-w-16 px-2.5 py-1 rounded-md text-center text-white text-sm bg-gradient-to-r 
                                                      from-teal-500 to-emerald-600">
                                                    {city.percentage.toFixed(2)}%
                                                  </span>
                                                </div>
                                              </div>
                                              
                                              {/* Date information dropdown */}
                                              <div className="ml-2 mt-2 space-y-0.5 flex justify-between items-start">
                                                <div className="flex-1">
                                                  <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className={`h-7 text-xs px-1 py-0 flex items-center text-amber-700 hover:bg-amber-50 ${!hasDateData ? 'opacity-50' : ''}`}
                                                    onClick={() => toggleDateExpansion(codeStr, city.city)}
                                                  >
                                                    <Clock className="h-3 w-3 mr-1 text-amber-500" />
                                                    Última atualização
                                                    {hasDateData && (
                                                      isDateExpanded ? 
                                                        <ChevronUp className="h-3 w-3 ml-1" /> : 
                                                        <ChevronDown className="h-3 w-3 ml-1" />
                                                    )}
                                                  </Button>
                                                  
                                                  {/* Date information dropdown content */}
                                                  {isDateExpanded && (
                                                    <div className="pl-4 pt-1 pb-2 space-y-1 text-xs">
                                                      {city.dates && Object.entries(city.dates)
                                                        .sort((a, b) => b[1] - a[1]) // Sort by count descending
                                                        .map(([date, count], didx) => (
                                                          <div 
                                                            key={`date-item-${didx}-${date}`} 
                                                            className="flex items-center justify-between text-amber-700 bg-amber-50/50 p-1.5 rounded-sm border-l-2 border-amber-200"
                                                          >
                                                            <div className="flex items-center">
                                                              <Calendar className="h-3 w-3 mr-1.5 text-amber-500" />
                                                              <span>{date}</span>
                                                            </div>
                                                            <span className="font-medium">{count}</span>
                                                          </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                                
                                                {/* CTRC button and popover */}
                                                <div>
                                                  <Popover 
                                                    open={isPopoverOpen}
                                                    onOpenChange={(open) => {
                                                      if (open !== isPopoverOpen) {
                                                        toggleCtrcPopover(codeStr, city.city);
                                                      }
                                                    }}
                                                  >
                                                    <PopoverTrigger asChild>
                                                      <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-7 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                                        onClick={() => toggleCtrcPopover(codeStr, city.city)}
                                                      >
                                                        <List className="h-3 w-3 mr-1" />
                                                        Ver CTRC's
                                                      </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 bg-white" align="end" side="top">
                                                      <div className="bg-blue-50/50 p-2 border-b text-xs font-medium text-blue-800">
                                                        Lista de CTRC's - {city.city}
                                                      </div>
                                                      <div className="p-2 max-h-[200px] overflow-y-auto">
                                                        {allCityCtrcs.length > 0 ? (
                                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                                                            {allCityCtrcs.map((ctrc, ctrcIdx) => (
                                                              <div 
                                                                key={`${ctrc}-${ctrcIdx}`} 
                                                                className="text-xs p-1 bg-gray-50 rounded border border-gray-100"
                                                              >
                                                                {ctrc}
                                                              </div>
                                                            ))}
                                                          </div>
                                                        ) : (
                                                          <div className="text-xs text-gray-500 text-center py-2">
                                                            Nenhum CTRC encontrado
                                                          </div>
                                                        )}
                                                      </div>
                                                    </PopoverContent>
                                                  </Popover>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell className="p-2 w-12"></TableCell>
                <TableCell>
                  Total {selectedCodes.length < data.length ? `(${selectedCodes.length} códigos)` : ''}
                </TableCell>
                <TableCell>{selectedTotal}</TableCell>
                <TableCell>
                  <span className="card-percentage bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md font-semibold inline-block min-w-16 text-center">
                    100.00%
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultsTable;
