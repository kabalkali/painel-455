
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
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

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
  const handleCopyAll = () => {
    const content = `${cidade} - ${ultimaAtualizacao}\n${ctrcs.join('\n')}`;
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Dados copiados para a área de transferência!');
    }).catch(() => {
      toast.error('Erro ao copiar dados');
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>CTRCs - {cidade} - {ultimaAtualizacao}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCopyAll}
              className="ml-4"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Tudo
            </Button>
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
