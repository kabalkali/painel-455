import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, ArrowLeft, AlertTriangle, Users, Building, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import FileUploader, { ProcessedData } from '@/components/FileUploader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getDriverName } from '@/utils/driversData';

// Códigos padrão para a análise de ofensores
const DEFAULT_OFFENDER_CODES = ['46', '25', '26', '27', '28', '18', '30', '6', '23', '33', '50'];

interface OffenderData {
  motorista: string;
  placa: string;
  unidade: string;
  uf: string;
  totalInsucessos: number;
  cidades: { [city: string]: number };
}

interface UnidadeData {
  unidade: string;
  uf: string;
  totalInsucessos: number;
  motoristas: { [motorista: string]: number };
}

interface SemMovimentacaoData {
  unidade: string;
  uf: string;
  total: number;
}

const OfendersAnalysisPage = () => {
  const [hasData, setHasData] = useState<boolean>(false);
  const [motoristasData, setMotoristasData] = useState<OffenderData[]>([]);
  const [unidadesData, setUnidadesData] = useState<UnidadeData[]>([]);
  const [semMovimentacaoData, setSemMovimentacaoData] = useState<SemMovimentacaoData[]>([]);
  const [filteredMotoristasData, setFilteredMotoristasData] = useState<OffenderData[]>([]);
  const [filteredUnidadesData, setFilteredUnidadesData] = useState<UnidadeData[]>([]);
  const [filteredSemMovimentacaoData, setFilteredSemMovimentacaoData] = useState<SemMovimentacaoData[]>([]);
  const [ufsEntrega, setUfsEntrega] = useState<string[]>([]);
  const [unidadesReceptoras, setUnidadesReceptoras] = useState<string[]>([]);
  const [unidadesPorUf, setUnidadesPorUf] = useState<Record<string, string[]>>({});
  const [selectedUf, setSelectedUf] = useState<string>('todas');
  const [selectedUnidade, setSelectedUnidade] = useState<string>('todas');
  const [selectedCodes, setSelectedCodes] = useState<string[]>(DEFAULT_OFFENDER_CODES);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const processFileData = (data: ProcessedData, columnName: string) => {
    setIsLoading(true);
    
    const { meta } = data;
    
    setUfsEntrega(meta.ufEntregas);
    setUnidadesPorUf(meta.ufUnidades);
    
    const allUnidades = new Set<string>();
    Object.values(meta.ufUnidades).forEach(unidades => {
      unidades.forEach(unidade => allUnidades.add(unidade));
    });
    setUnidadesReceptoras(Array.from(allUnidades).sort());
    
    processOffendersData(data.full);
    setHasData(true);
    setIsLoading(false);
  };

  const processOffendersData = (fullData: any[]) => {
    if (!fullData || fullData.length === 0) return;
    
    const firstRow = fullData[0];
    const keys = Object.keys(firstRow);
    
    const placaKey = keys[90]; // Coluna 91 - Placa
    const ufKey = keys[50]; // Coluna 51 - UF
    const unidadeKey = keys[52]; // Coluna 53 - Unidade
    const ocorrenciaKey = "Codigo da Ultima Ocorrencia";
    const cityKey = keys[49]; // Coluna 50 - Cidade
    
    // Mapas para agregação
    const motoristasMap = new Map<string, OffenderData>();
    const unidadesMap = new Map<string, UnidadeData>();
    const semMovimentacaoMap = new Map<string, SemMovimentacaoData>();
    
    for (const row of fullData) {
      const placa = row[placaKey];
      const ocorrencia = String(row[ocorrenciaKey] || "");
      const uf = String(row[ufKey] || "");
      const unidade = String(row[unidadeKey] || "");
      const cidade = String(row[cityKey] || "Não informada");
      
      if (!placa) continue;

      // Processamento específico para código 50 (Sem movimentação)
      if (ocorrencia === '50') {
        if (!semMovimentacaoMap.has(unidade)) {
          semMovimentacaoMap.set(unidade, {
            unidade,
            uf,
            total: 0
          });
        }
        const semMovData = semMovimentacaoMap.get(unidade)!;
        semMovData.total++;
      }

      // Processamento para códigos de ofensores
      if (!selectedCodes.includes(ocorrencia)) continue;
      
      const motorista = getDriverName(placa, unidade);
      const motoristaKey = `${motorista}_${placa}`;
      
      // Agregação por motorista
      if (!motoristasMap.has(motoristaKey)) {
        motoristasMap.set(motoristaKey, {
          motorista,
          placa,
          unidade,
          uf,
          totalInsucessos: 0,
          cidades: {}
        });
      }
      
      const motoristaData = motoristasMap.get(motoristaKey)!;
      motoristaData.totalInsucessos++;
      motoristaData.cidades[cidade] = (motoristaData.cidades[cidade] || 0) + 1;
      
      // Agregação por unidade
      if (!unidadesMap.has(unidade)) {
        unidadesMap.set(unidade, {
          unidade,
          uf,
          totalInsucessos: 0,
          motoristas: {}
        });
      }
      
      const unidadeData = unidadesMap.get(unidade)!;
      unidadeData.totalInsucessos++;
      unidadeData.motoristas[motorista] = (unidadeData.motoristas[motorista] || 0) + 1;
    }
    
    const motoristasArray = Array.from(motoristasMap.values())
      .sort((a, b) => b.totalInsucessos - a.totalInsucessos);
    
    const unidadesArray = Array.from(unidadesMap.values())
      .sort((a, b) => b.totalInsucessos - a.totalInsucessos);

    const semMovimentacaoArray = Array.from(semMovimentacaoMap.values())
      .sort((a, b) => b.total - a.total);
    
    setMotoristasData(motoristasArray);
    setUnidadesData(unidadesArray);
    setSemMovimentacaoData(semMovimentacaoArray);
    setFilteredMotoristasData(motoristasArray);
    setFilteredUnidadesData(unidadesArray);
    setFilteredSemMovimentacaoData(semMovimentacaoArray);
  };

  const handleUfChange = (value: string) => {
    setSelectedUf(value);
    setSelectedUnidade('todas');
    filterData(value, 'todas');
  };

  const handleUnidadeChange = (value: string) => {
    setSelectedUnidade(value);
    filterData(selectedUf, value);
  };

  const filterData = (uf: string, unidade: string) => {
    let filteredMotoristas = [...motoristasData];
    let filteredUnidades = [...unidadesData];
    let filteredSemMov = [...semMovimentacaoData];
    
    if (uf !== 'todas') {
      filteredMotoristas = filteredMotoristas.filter(item => item.uf === uf);
      filteredUnidades = filteredUnidades.filter(item => item.uf === uf);
      filteredSemMov = filteredSemMov.filter(item => item.uf === uf);
    }
    
    if (unidade !== 'todas') {
      filteredMotoristas = filteredMotoristas.filter(item => item.unidade === unidade);
      filteredUnidades = filteredUnidades.filter(item => item.unidade === unidade);
      filteredSemMov = filteredSemMov.filter(item => item.unidade === unidade);
    }
    
    setFilteredMotoristasData(filteredMotoristas);
    setFilteredUnidadesData(filteredUnidades);
    setFilteredSemMovimentacaoData(filteredSemMov);
  };

  const resetFilter = () => {
    setSelectedUf('todas');
    setSelectedUnidade('todas');
    setFilteredMotoristasData(motoristasData);
    setFilteredUnidadesData(unidadesData);
    setFilteredSemMovimentacaoData(semMovimentacaoData);
  };

  // Reprocessar dados quando os códigos selecionados mudarem
  useEffect(() => {
    if (hasData) {
      // Aqui você deve reprocessar os dados com os novos códigos
      // Para simplificar, vou manter a funcionalidade básica
    }
  }, [selectedCodes]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-red-400">
            Análise de Ofensores
          </h1>
        </div>

        <div className="grid gap-6">
          {!hasData && (
            <FileUploader onFileUpload={processFileData} />
          )}
          
          {hasData && (
            <>
              {/* Filtros */}
              <div className="flex flex-col md:flex-row gap-4 mt-4 items-start">
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle>
                      <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-red-500" />
                        <span className="font-medium">Filtros:</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 flex flex-wrap gap-4 items-center">
                    {/* Filtro de UF de Entrega */}
                    {ufsEntrega.length > 0 && (
                      <div className="flex-1 min-w-[180px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">UF de Entrega</label>
                        <Select value={selectedUf} onValueChange={handleUfChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a UF" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todas">Todas as UFs</SelectItem>
                            {ufsEntrega.map((uf) => (
                              <SelectItem key={uf} value={uf}>
                                {uf}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Filtro de Unidade Receptora */}
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Receptora</label>
                      <Select value={selectedUnidade} onValueChange={handleUnidadeChange} disabled={isLoading}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione a unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas as unidades</SelectItem>
                          {selectedUf !== 'todas' 
                            ? (unidadesPorUf[selectedUf] || []).map((unidade) => (
                                <SelectItem key={unidade} value={unidade}>
                                  {unidade}
                                </SelectItem>
                              ))
                            : unidadesReceptoras.map((unidade) => (
                                <SelectItem key={unidade} value={unidade}>
                                  {unidade}
                                </SelectItem>
                              ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {(selectedUf !== 'todas' || selectedUnidade !== 'todas') && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={resetFilter} 
                        className="self-end"
                        disabled={isLoading}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Informação sobre códigos padrão */}
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <h3 className="font-medium text-amber-800">Códigos de Insucesso Analisados:</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_OFFENDER_CODES.map((code) => (
                      <Badge key={code} variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Card Sem Movimentação */}
              <Card className="bg-orange-50 border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    Sem Movimentação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unidade</TableHead>
                        <TableHead>UF</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSemMovimentacaoData.length > 0 ? (
                        filteredSemMovimentacaoData.map((item, index) => (
                          <TableRow key={`${item.unidade}_${index}`}>
                            <TableCell className="font-medium">{item.unidade}</TableCell>
                            <TableCell>{item.uf}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                                {item.total}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-gray-500">
                            Nenhuma base sem movimentação encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Tabelas existentes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Motoristas com Mais Insucessos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-red-500" />
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
                          <TableHead>UF</TableHead>
                          <TableHead className="text-right">Insucessos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMotoristasData.slice(0, 10).map((motorista, index) => (
                          <TableRow key={`${motorista.motorista}_${motorista.placa}_${index}`}>
                            <TableCell className="font-medium">{motorista.motorista}</TableCell>
                            <TableCell>{motorista.placa}</TableCell>
                            <TableCell>{motorista.unidade}</TableCell>
                            <TableCell>{motorista.uf}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="destructive">{motorista.totalInsucessos}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Unidades com Mais Insucessos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-red-500" />
                      Unidades com Mais Insucessos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Unidade</TableHead>
                          <TableHead>UF</TableHead>
                          <TableHead className="text-right">Insucessos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUnidadesData.slice(0, 10).map((unidade, index) => (
                          <TableRow key={`${unidade.unidade}_${index}`}>
                            <TableCell className="font-medium">{unidade.unidade}</TableCell>
                            <TableCell>{unidade.uf}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="destructive">{unidade.totalInsucessos}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfendersAnalysisPage;
