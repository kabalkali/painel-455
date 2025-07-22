
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { getFormattedCodeDescription } from '@/utils/codeMapping';

interface ResultData {
  code: string | number;
  count: number;
  percentage: number;
}

interface ResultsChartProps {
  data: ResultData[];
  hidden?: boolean;
}

const ResultsChart: React.FC<ResultsChartProps> = ({ data, hidden = false }) => {
  if (hidden) return null;
  
  // Cores para o gráfico - palette moderna
  const colors = [
    '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', 
    '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', 
    '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2',
    '#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE',
    '#EC4899', '#F472B6', '#FBCFE8', '#FCE7F3'
  ];

  // Limitar a 15 itens para melhor visualização
  const displayData = data.slice(0, 15).map(item => ({
    code: item.code.toString(),
    description: getFormattedCodeDescription(item.code).split(' ')[0],
    value: item.percentage,
    fullDescription: getFormattedCodeDescription(item.code)
  }));

  const formatTick = (value: string) => {
    // Retorna apenas o código para melhorar legibilidade
    return value;
  };

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Distribuição Percentual {data.length > 15 ? `(Mostrando os 15 maiores)` : ''}</CardTitle>
      </CardHeader>
      <CardContent className="h-[500px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={displayData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            layout="vertical"
          >
            <XAxis 
              type="number"
              tickFormatter={(value) => `${value.toFixed(1)}%`}
              domain={[0, 'dataMax']}
            />
            <YAxis 
              type="category"
              dataKey="code"
              width={40}
              tickFormatter={formatTick}
            />
            <Tooltip 
              formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Porcentagem']}
              labelFormatter={(code) => {
                const item = displayData.find(d => d.code === code);
                return item ? item.fullDescription : code;
              }}
              cursor={{ fill: 'rgba(200, 200, 200, 0.2)' }}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: 'none',
                padding: '12px'
              }}
            />
            <Legend />
            <Bar 
              dataKey="value" 
              name="Porcentagem" 
              radius={[0, 4, 4, 0]}
              barSize={20}
            >
              {displayData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ResultsChart;
