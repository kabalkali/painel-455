
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CtrcDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cidade: string;
  ultimaAtualizacao: string;
  ctrcs: string[];
}

const CtrcDetailDialog: React.FC<CtrcDetailDialogProps> = ({
  isOpen,
  onClose,
  cidade,
  ultimaAtualizacao,
  ctrcs
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            CTRCs - {cidade} - {ultimaAtualizacao}
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CTRC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ctrcs.length > 0 ? (
                ctrcs.map((ctrc, index) => (
                  <TableRow key={index}>
                    <TableCell>{ctrc}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={1} className="text-center text-gray-500">
                    Nenhum CTRC encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="text-sm text-gray-500 mt-4">
          Total de CTRCs: {ctrcs.length}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CtrcDetailDialog;
