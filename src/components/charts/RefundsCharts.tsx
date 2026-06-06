"use client";

import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";

interface RefundPieChartProps {
  data: any[];
}

export function RefundPieChart({ data }: RefundPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry: any, index: number) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} Pengajuan`, 'Jumlah']} />
        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface RefundBarChartProps {
  data: any[];
}

export function RefundBarChart({ data }: RefundBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} />
        <YAxis stroke="#888888" fontSize={10} tickLine={false} tickFormatter={(val) => `Rp ${val / 1000}k`} />
        <Tooltip formatter={(value) => [`Rp ${Number(value).toLocaleString("id-ID")}`, 'Nominal']} />
        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
        <Bar dataKey="Disetujui" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Menunggu" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
