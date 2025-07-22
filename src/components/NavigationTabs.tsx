
import React from 'react';
import { BarChart3 } from 'lucide-react';

const NavigationTabs: React.FC = () => {
  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg">
          <BarChart3 className="h-4 w-4" />
          Análise de Códigos
        </div>
      </div>
    </div>
  );
};

export default NavigationTabs;
