
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Export the interface for use in other components
export interface PlacaDetail {
  placa: string;
  unidade: string;
  motorista?: string;
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

interface PlacaDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  detail: PlacaDetail | null;
}

const PlacaDetailDialog: React.FC<PlacaDetailDialogProps> = ({ isOpen, onClose, detail }) => {
  if (!detail) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Placa: {detail.placa}</DialogTitle>
        </DialogHeader>
        <p className="text-center text-gray-500">
          Esta visualização foi depreciada. Use a página de detalhes para ver informações completas.
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlacaDetailDialog;
