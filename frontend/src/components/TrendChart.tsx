import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';

interface TrendData {
  date: string;
  status: string;
  count: number;
}

export function TrendChart({ data, onFilterChange }: { data: TrendData[], onFilterChange: (period: string) => void }) {
  const [period, setPeriod] = useState('week');

  const handleFilterChange = (value: string) => {
    setPeriod(value);
    onFilterChange(value);
  };

  // Transform and format data based on period
  const chartData = useMemo(() => {
    console.log('Raw trend data received:', data);

    // Group data by date and aggregate by status
    const grouped = data.reduce((acc: any[], curr) => {
      const existing = acc.find(item => item.date === curr.date);
      if (existing) {
        existing[curr.status] = (existing[curr.status] || 0) + curr.count;
      } else {
        acc.push({
          date: curr.date,
          [curr.status]: curr.count
        });
      }
      return acc;
    }, []);

    // Sort by date
    grouped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Format labels based on period
    const formatted = grouped.map(item => {
      let label = item.date;
      try {
        const date = parseISO(item.date);
        if (period === 'year') {
          // For yearly view, show month names (e.g., "Jan", "Feb")
          label = format(date, 'MMM yy');
        } else if (period === 'month') {
          // For monthly view (30 days), show date like "Dec 1"
          label = format(date, 'MMM d');
        } else {
          // For weekly view (7 days), show day and date like "Mon 1"
          label = format(date, 'EEE d');
        }
      } catch (e) {
        // Keep original if parsing fails
        console.error('Date parsing error:', e);
        label = item.date;
      }

      // Ensure all status fields exist with 0 as default
      return {
        date: item.date,
        WFO: item.WFO || 0,
        WFH: item.WFH || 0,
        LEAVE: item.LEAVE || 0,
        label,
        originalDate: item.date
      };
    });

    console.log('Transformed chart data:', formatted);
    return formatted;
  }, [data, period]);

  // Calculate responsive chart height based on number of data points
  const chartHeight = useMemo(() => {
    const dataLength = chartData.length;
    if (period === 'year') {
      return 350; // 12 months - standard height
    } else if (period === 'month') {
      return 400; // 30 days - slightly taller for readability
    } else {
      return 350; // 7 days - standard height
    }
  }, [chartData.length, period]);

  // Calculate bar size based on number of bars
  const barSize = useMemo(() => {
    const dataLength = chartData.length;
    if (dataLength <= 7) return undefined; // Auto size for 7 or fewer
    if (dataLength <= 12) return 40; // Medium bars for yearly
    if (dataLength <= 30) return 20; // Smaller bars for monthly
    return 15; // Very small bars for lots of data
  }, [chartData.length]);

  return (
    <Card className="col-span-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Attendance Trends</CardTitle>
        <Select value={period} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">7 Days</SelectItem>
            <SelectItem value="month">30 Days</SelectItem>
            <SelectItem value="year">12 Months</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pl-2">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            No attendance data available for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} barSize={barSize}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                angle={period === 'month' ? -45 : 0}
                textAnchor={period === 'month' ? 'end' : 'middle'}
                height={period === 'month' ? 80 : 60}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                domain={[0, 'auto']}
                allowDataOverflow={false}
              />
              <Tooltip
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.originalDate;
                  }
                  return label;
                }}
                formatter={(value: any, name: string) => {
                  return [value || 0, name];
                }}
              />
              <Legend />
              <Bar dataKey="WFO" stackId="a" fill="#8884d8" name="Work From Office" />
              <Bar dataKey="WFH" stackId="a" fill="#82ca9d" name="Work From Home" />
              <Bar dataKey="LEAVE" stackId="a" fill="#ffc658" name="Leave" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
