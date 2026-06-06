"use client";

import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface RewardsChartProps {
  data: any[];
}

export default function RewardsChart({ data }: RewardsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: "var(--card-color)", border: "1px solid var(--border-color)", borderRadius: "12px", fontSize: "12px" }} />
        <Bar dataKey="count" fill="#ff5722" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
