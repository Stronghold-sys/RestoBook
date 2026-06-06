"use client";

import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TransactionsChartProps {
  data: any[];
}

export default function TransactionsChart({ data }: TransactionsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
        <defs>
          <linearGradient id="colorPendapatan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e85d04" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#e85d04" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#6B7280' }}
          tickFormatter={(value) => `Rp ${value/1000}k`}
        />
        <Tooltip 
          formatter={(value: any) => [`Rp ${Number(value || 0).toLocaleString('id-ID')}`, 'Pendapatan']}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
        />
        <Area type="monotone" dataKey="pendapatan" stroke="#e85d04" strokeWidth={3} fillOpacity={1} fill="url(#colorPendapatan)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
