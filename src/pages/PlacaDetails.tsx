
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Package, Truck, ListCheck, MapPin, Info, ArrowLeft, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";

export interface PlacaDetail {
  placa: string;
  unidade: string;
  total: number;
  entregue: number;
  insucesso: number;
  emRota: number;
  percentEntregue?: number;
  percentInsucesso?: number;
  percentEmRota?: number;
  uf?: string;
  cidades: {
    entregue: { [city: string]: { count: number, ctrcs: string[] } };
    insucesso: { [city: string]: { count: number, ctrcs: string[] } };
    emRota: { [city: string]: { count: number, ctrcs: string[] } };
  };
}

interface InsucessoDetail {
  code: string;
  count: number;
}

const PlacaDetails = () => {
  const { placa } = useParams();
  const navigate = useNavigate();
  const [selectedDetail, setSelectedDetail] = useState<PlacaDetail | null>(null);
  const [activeTab, setActiveTab] = useState<string>("entregue");
  const [ctrcDialogOpen, setCtrcDialogOpen] = useState<boolean>(false);
  const [selectedCtrcs, setSelectedCtrcs] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("");
  
  // In a real application, this data should be fetched from the backend or session storage
  // For demo purposes, we're assuming it's being passed via location state
  React.useEffect(() => {
    // Check session storage for the selected placa detail
    const storedDetail = sessionStorage.getItem('selectedPlacaDetail');
    if (storedDetail) {
      try {
        const parsedDetail = JSON.parse(storedDetail);
        if (parsedDetail?.placa === placa) {
          setSelectedDetail(parsedDetail);
          return;
        }
      } catch (error) {
        console.error("Failed to parse stored placa detail", error);
      }
    }
    
    // If not found or invalid, redirect back to the main page
    navigate('/');
  }, [placa, navigate]);
  
  if (!selectedDetail) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-2xl mb-4">Carregando...</div>
        <Button onClick={() => navigate('/')}>Voltar</Button>
      </div>
    );
  }

  // Calculate insucesso details - count occurrences of each insucesso code
  const getInsucessoDetails = (): InsucessoDetail[] => {
    const insucessoDetails: Map<string, number> = new Map();
    
    // Collect all CTRCs from insucesso cities
    const insucessoCities = selectedDetail.cidades.insucesso || {};
    
    // For now we'll simulate different insucesso codes for demonstration
    // In a real application, these would come from the actual data
    // We'll simulate different insucesso codes based on cities
    let cityIndex = 0;
    const insucessoCodes = ["Comércio fechado", "1 tentativa", "2 tentativa", "Recusado", "Endereço não localizado"];
    
    Object.entries(insucessoCities).forEach(([city, cityData]) => {
      // Assign an insucesso code based on the city index
      const codeIndex = cityIndex % insucessoCodes.length;
      const code = insucessoCodes[codeIndex];
      
      insucessoDetails.set(code, (insucessoDetails.get(code) || 0) + cityData.count);
      cityIndex++;
    });
    
    return Array.from(insucessoDetails.entries()).map(([code, count]) => ({
      code,
      count
    })).sort((a, b) => b.count - a.count);
  };

  const getCitiesByStatus = (status: 'entregue' | 'insucesso' | 'emRota') => {
    const cities = selectedDetail.cidades[status];
    return Object.entries(cities).map(([name, data]) => ({
      name,
      count: data.count,
      ctrcs: data.ctrcs,
      percentage: (data.count / (status === 'entregue' ? selectedDetail.entregue : 
        status === 'insucesso' ? selectedDetail.insucesso : selectedDetail.emRota)) * 100
    })).sort((a, b) => b.count - a.count);
  };

  const handleViewCtrcs = (city: string, ctrcs: string[]) => {
    setSelectedCity(city);
    setSelectedCtrcs(ctrcs);
    setCtrcDialogOpen(true);
  };

  const closeCtrcDialog = () => {
    setCtrcDialogOpen(false);
    setSelectedCtrcs([]);
    setSelectedCity("");
  };

  const entregueStatusClass = "bg-green-500";
  const insucessoStatusClass = "bg-orange-500";
  const emRotaStatusClass = "bg-blue-500";

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'entregue': return entregueStatusClass;
      case 'insucesso': return insucessoStatusClass;
      case 'emRota': return emRotaStatusClass;
      default: return entregueStatusClass;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">
            Placa: {selectedDetail.placa}
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-700 flex items-center">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Entregas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{selectedDetail.entregue}</div>
              <div className="text-xs text-green-600">
                {((selectedDetail.entregue / selectedDetail.total) * 100).toFixed(1)}% do total
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-orange-700 flex items-center">
                <Package className="h-4 w-4 mr-2" />
                Insucessos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{selectedDetail.insucesso}</div>
              <div className="text-xs text-orange-600">
                {((selectedDetail.insucesso / selectedDetail.total) * 100).toFixed(1)}% do total
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-700 flex items-center">
                <Truck className="h-4 w-4 mr-2" />
                Em Rota
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{selectedDetail.emRota}</div>
              <div className="text-xs text-blue-600">
                {((selectedDetail.emRota / selectedDetail.total) * 100).toFixed(1)}% do total
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <Badge variant="outline" className="mr-2">Unidade: {selectedDetail.unidade}</Badge>
            <Badge variant="outline">UF: {selectedDetail.uf}</Badge>
            <Badge variant="outline" className="ml-2">Total: {selectedDetail.total}</Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="entregue" className="flex items-center gap-1">
              <ClipboardCheck className="h-4 w-4" />
              Entregues
            </TabsTrigger>
            <TabsTrigger value="insucesso" className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              Insucessos
            </TabsTrigger>
            <TabsTrigger value="emRota" className="flex items-center gap-1">
              <Truck className="h-4 w-4" />
              Em Rota
            </TabsTrigger>
          </TabsList>

          {(['entregue', 'insucesso', 'emRota'] as const).map(statusType => (
            <TabsContent key={statusType} value={statusType} className="border rounded-md p-4">
              {statusType === 'insucesso' && (
                <Card className="mb-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-700 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Resumo de Insucessos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getInsucessoDetails().map((insucesso, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                              {insucesso.code}
                            </Badge>
                          </div>
                          <Badge className="bg-orange-500">
                            {insucesso.count} ocorrências
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div className="flex items-center mb-3">
                <MapPin className="h-4 w-4 mr-2 text-gray-600" />
                <h3 className="text-lg font-medium">Cidades ({getCitiesByStatus(statusType).length})</h3>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cidade</TableHead>
                      <TableHead className="text-center">Quantidade</TableHead>
                      <TableHead className="text-center">%</TableHead>
                      <TableHead className="text-right">CTRCs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCitiesByStatus(statusType).map(city => (
                      <TableRow key={city.name}>
                        <TableCell className="font-medium">{city.name}</TableCell>
                        <TableCell className="text-center">{city.count}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={getStatusClass(statusType)}>
                            {city.percentage.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={getStatusClass(statusType) + " text-white hover:bg-opacity-90"}
                            onClick={() => handleViewCtrcs(city.name, city.ctrcs)}
                          >
                            Ver CTRCs
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Dialog for CTRCs */}
        <Dialog open={ctrcDialogOpen} onOpenChange={open => !open && closeCtrcDialog()}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>CTRCs de {selectedCity}</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-1 text-xs bg-gray-50 p-2 rounded border max-h-96 overflow-y-auto">
              {selectedCtrcs.map((ctrc, idx) => (
                <div key={idx} className="py-1 px-2 border-b last:border-b-0">
                  {ctrc}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={closeCtrcDialog}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PlacaDetails;
