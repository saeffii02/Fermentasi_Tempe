// frontend/src/pages/DashboardHistory/index.tsx
import Lucide from "@/components/Base/Lucide";
import Button from "@/components/Base/Button";
import { FormSelect } from "@/components/Base/Form";
import Pagination from "@/components/Base/Pagination";
import Table from "@/components/Base/Table";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { iotService, Batch, BatchLog, BatchStatistics } from "@/services/iotService";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Fungsi untuk mendapatkan display status
interface StatusDisplay {
  label: string;
  color: string;
  icon: string;
}

//Interface untuk Batch Summary
interface BatchSummary {
  id: string;
  name: string;
  strain: string;
  status: string;
  startTime: Date;
  endTime: Date | null;
  duration: string;
  totalLogs: number;
  avgTemp: number;
  avgHumidity: number;
  phaseCount: {
    initial: number;
    fermentation: number;
    maturation: number;
    cooling: number;
  };
}

//  Fungsi untuk mendapatkan display status
const getStatusDisplay = (status: string): StatusDisplay => {
  const map: Record<string, StatusDisplay> = {
    'optimal': { label: 'Optimal', color: 'text-green-600 bg-green-100', icon: 'CheckCircle' },
    'belum_optimal': { label: 'Belum Optimal', color: 'text-yellow-600 bg-yellow-100', icon: 'AlertCircle' },
    'kritis': { label: 'Kritis', color: 'text-red-600 bg-red-100', icon: 'AlertTriangle' },
    'normal': { label: 'Normal', color: 'text-green-600 bg-green-100', icon: 'CheckCircle' },
    'rendah': { label: 'Rendah', color: 'text-blue-600 bg-blue-100', icon: 'ArrowDown' },
    'tinggi': { label: 'Tinggi', color: 'text-red-600 bg-red-100', icon: 'ArrowUp' },
    'rendah_ringan': { label: 'Sedikit Rendah', color: 'text-cyan-600 bg-cyan-100', icon: 'ArrowDown' },
    'tinggi_ringan': { label: 'Sedikit Tinggi', color: 'text-orange-600 bg-orange-100', icon: 'ArrowUp' },
    'unknown': { label: 'Tidak Diketahui', color: 'text-slate-600 bg-slate-100', icon: 'Circle' },
  };
  return map[status] || { label: status, color: 'text-slate-600 bg-slate-100', icon: 'Circle' };
};

// UPDATE - Tipe data untuk log entry dengan tambahan batch info DAN status
interface LogEntryWithBatch extends BatchLog {
  batchId: string;
  batchName: string;
  batchStrain: string;
}

// Tipe untuk filter
type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'all';
type DateRange = { start: Date; end: Date };

// Filter untuk batch summaries
type BatchFilterStatus = 'all' | 'active' | 'completed';

function Main() {
  // State untuk data
  const [allLogs, setAllLogs] = useState<LogEntryWithBatch[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntryWithBatch[]>([]);
  const [paginatedLogs, setPaginatedLogs] = useState<LogEntryWithBatch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchStats, setSelectedBatchStats] = useState<BatchStatistics | null>(null);
  
  // State untuk batch summaries
  const [batchSummaries, setBatchSummaries] = useState<BatchSummary[]>([]);
  const [filteredBatchSummaries, setFilteredBatchSummaries] = useState<BatchSummary[]>([]);
  const [paginatedBatchSummaries, setPaginatedBatchSummaries] = useState<BatchSummary[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  
  // Pagination untuk batch summaries
  const [batchCurrentPage, setBatchCurrentPage] = useState(1);
  const [batchItemsPerPage, setBatchItemsPerPage] = useState(6);
  const [batchTotalPages, setBatchTotalPages] = useState(1);
  
  // Filter untuk batch summaries
  const [batchStatusFilter, setBatchStatusFilter] = useState<BatchFilterStatus>('all');
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  
  // System Config state untuk batasan normal
  const [systemConfig, setSystemConfig] = useState({
    tempMin: 25,
    tempMax: 37,
    humMin: 60,
    humMax: 80
  });
  
  // Pagination states untuk log data
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter states untuk log data
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date()
  });

  // Load system config on mount
  useEffect(() => {
    loadSystemConfig();
  }, []);

  const loadSystemConfig = async () => {
    try {
      const config = await iotService.getSystemConfig();
      setSystemConfig({
        tempMin: config.temp_min,
        tempMax: config.temp_max,
        humMin: config.humidity_min,
        humMax: config.humidity_max
      });
      console.log('System Config loaded:', config);
    } catch (err) {
      console.error('Failed to load system config:', err);
    }
  };

  // Load data from API
  useEffect(() => {
    loadDataFromAPI();
  }, []);

  //  Filter batch summaries when dependencies change
  useEffect(() => {
    filterBatchSummaries();
  }, [batchSummaries, batchStatusFilter, batchSearchQuery]);

  //  Update pagination for batch summaries
  useEffect(() => {
    setBatchCurrentPage(1);
    updatePaginatedBatchSummaries();
  }, [filteredBatchSummaries, batchItemsPerPage]);

  // Update paginated batch summaries when page changes
  useEffect(() => {
    updatePaginatedBatchSummaries();
  }, [batchCurrentPage, filteredBatchSummaries, batchItemsPerPage]);

  // Filter logs when dependencies change
  useEffect(() => {
    filterLogs();
  }, [allLogs, timeRange, selectedBatchId, dateRange]);

  // Update pagination when filtered logs change
  useEffect(() => {
    setCurrentPage(1);
    updatePaginatedLogs();
  }, [filteredLogs, itemsPerPage]);

  // Update paginated logs when page changes
  useEffect(() => {
    updatePaginatedLogs();
  }, [currentPage, filteredLogs, itemsPerPage]);

  // Load statistics when batch is selected
  useEffect(() => {
    if (selectedBatchId !== 'all') {
      loadBatchStatistics(selectedBatchId);
    } else {
      setSelectedBatchStats(null);
    }
  }, [selectedBatchId]);

  const updatePaginatedLogs = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filteredLogs.slice(startIndex, endIndex);
    setPaginatedLogs(paginated);
    setTotalPages(Math.ceil(filteredLogs.length / itemsPerPage));
  };

  // Update paginated batch summaries
  const updatePaginatedBatchSummaries = () => {
    const startIndex = (batchCurrentPage - 1) * batchItemsPerPage;
    const endIndex = startIndex + batchItemsPerPage;
    const paginated = filteredBatchSummaries.slice(startIndex, endIndex);
    setPaginatedBatchSummaries(paginated);
    setBatchTotalPages(Math.ceil(filteredBatchSummaries.length / batchItemsPerPage));
  };

  const loadDataFromAPI = async () => {
    try {
      setLoading(true);
      const batchesData = await iotService.getAllBatches();
      setBatches(batchesData);
      
      //TAMBAHAN - Generate batch summaries
      generateBatchSummaries(batchesData);
      
      // Combine all logs from all batches
      const logs: LogEntryWithBatch[] = [];
      batchesData.forEach((batch: Batch) => {
        if (batch.logs && batch.logs.length > 0) {
          batch.logs.forEach((log: BatchLog) => {
            logs.push({
              ...log,
              batchId: batch.id,
              batchName: batch.name,
              batchStrain: batch.strain
            });
          });
        }
      });
      
      // Sort by timestamp (newest first for display)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAllLogs(logs);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk generate batch summaries
  const generateBatchSummaries = (batchesData: Batch[]) => {
    const summaries: BatchSummary[] = batchesData.map(batch => {
      const logs = batch.logs || [];
      const totalLogs = logs.length;
      
      // Hitung rata-rata
      const avgTemp = totalLogs > 0 
        ? logs.reduce((sum, log) => sum + log.temperature, 0) / totalLogs 
        : 0;
      const avgHumidity = totalLogs > 0 
        ? logs.reduce((sum, log) => sum + log.humidity, 0) / totalLogs 
        : 0;
      
      // Hitung durasi
      const startTime = new Date(batch.startTime);
      const endTime = batch.endTime ? new Date(batch.endTime) : null;
      let duration = 'Masih Berjalan';
      if (endTime) {
        const diffMs = endTime.getTime() - startTime.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        duration = `${diffHrs}h ${diffMins}m`;
      }
      
      // Hitung phase distribution
      const phaseCount = {
        initial: logs.filter(l => l.phase === 'initial').length,
        fermentation: logs.filter(l => l.phase === 'fermentation').length,
        maturation: logs.filter(l => l.phase === 'maturation').length,
        cooling: logs.filter(l => l.phase === 'cooling').length,
      };
      
      return {
        id: batch.id,
        name: batch.name,
        strain: batch.strain,
        status: batch.status,
        startTime,
        endTime,
        duration,
        totalLogs,
        avgTemp,
        avgHumidity,
        phaseCount
      };
    });
    
    // Sort by start time (newest first)
    summaries.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    setBatchSummaries(summaries);
  };

  // Fungsi untuk filter batch summaries
  const filterBatchSummaries = () => {
    let filtered = [...batchSummaries];
    
    // Filter by status
    if (batchStatusFilter !== 'all') {
      filtered = filtered.filter(batch => batch.status === batchStatusFilter);
    }
    
    // Filter by search query
    if (batchSearchQuery.trim()) {
      const query = batchSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(batch => 
        batch.name.toLowerCase().includes(query) ||
        batch.strain.toLowerCase().includes(query)
      );
    }
    
    setFilteredBatchSummaries(filtered);
  };

  const loadBatchStatistics = async (batchId: string) => {
    try {
      const stats = await iotService.getBatchStatistics(batchId);
      setSelectedBatchStats(stats);
    } catch (err) {
      console.error('Failed to load batch statistics:', err);
    }
  };

  const filterLogs = () => {
    let filtered = [...allLogs];
    
    // Filter by batch
    if (selectedBatchId !== 'all') {
      filtered = filtered.filter(log => log.batchId === selectedBatchId);
    }
    
    // Filter by time range
    let startDate = new Date(dateRange.start);
    let endDate = new Date(dateRange.end);
    
    const now = new Date();
    switch (timeRange) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        break;
    }
    
    filtered = filtered.filter(log => 
      new Date(log.timestamp) >= startDate && new Date(log.timestamp) <= endDate
    );
    
    setFilteredLogs(filtered);
  };

  // Pagination handlers untuk log data
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  //Pagination handlers untuk batch summaries
  const handleBatchPageChange = (page: number) => {
    if (page >= 1 && page <= batchTotalPages) {
      setBatchCurrentPage(page);
    }
  };

  const handleBatchItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBatchItemsPerPage(Number(e.target.value));
    setBatchCurrentPage(1);
  };

  // Generate pagination items
  const getPaginationItems = () => {
    const items = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      items.push(i);
    }
    
    return items;
  };

  // Generate pagination items untuk batch
  const getBatchPaginationItems = () => {
    const items = [];
    const maxVisible = 5;
    let startPage = Math.max(1, batchCurrentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(batchTotalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      items.push(i);
    }
    
    return items;
  };

  // Prepare chart data for temperature & humidity
  const prepareTempHumidityChartData = () => {
    if (filteredLogs.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }
    
    // Sampling for performance (max 100 points)
    const sampleRate = Math.max(1, Math.ceil(filteredLogs.length / 100));
    const sampledLogs = filteredLogs.filter((_, i) => i % sampleRate === 0);
    // Reverse untuk chart agar chronological
    const chronologicalLogs = [...sampledLogs].reverse();
    const labels = chronologicalLogs.map(log => 
      new Date(log.timestamp).toLocaleString()
    );
    
    return {
      labels,
      datasets: [
        {
          label: 'Temperature (°C)',
          data: chronologicalLogs.map(log => log.temperature),
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: 'Humidity (%)',
          data: chronologicalLogs.map(log => log.humidity),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y1',
        }
      ]
    };
  };

  // Prepare chart data for actuators
  const prepareActuatorChartData = () => {
    if (filteredLogs.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }
    
    const sampleRate = Math.max(1, Math.ceil(filteredLogs.length / 100));
    const sampledLogs = filteredLogs.filter((_, i) => i % sampleRate === 0);
    const chronologicalLogs = [...sampledLogs].reverse();
    const labels = chronologicalLogs.map(log => 
      new Date(log.timestamp).toLocaleString()
    );
    
    return {
      labels,
      datasets: [
        {
          label: 'Heater (%)',
          data: chronologicalLogs.map(log => log.heaterIntensity),
          borderColor: 'rgb(234, 88, 12)',
          backgroundColor: 'rgba(234, 88, 12, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Fan (%)',
          data: chronologicalLogs.map(log => log.fanIntensity),
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Humidifier (%)',
          data: chronologicalLogs.map(log => log.humidifierIntensity),
          borderColor: 'rgb(6, 182, 212)',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          tension: 0.4,
        }
      ]
    };
  };

  const tempHumidityChartData = prepareTempHumidityChartData();
  const actuatorChartData = prepareActuatorChartData();

  // Chart options
  const tempHumidityOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            let value = context.parsed.y;
            if (label.includes('Temperature')) {
              return `${label}: ${value.toFixed(1)}°C`;
            }
            if (label.includes('Humidity')) {
              return `${label}: ${value.toFixed(0)}%`;
            }
            return `${label}: ${value}%`;
          }
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Temperature (°C)',
          color: 'rgb(249, 115, 22)',
        },
        min: 20,
        max: 40,
        ticks: {
          callback: function(value: any) {
            return value + '°C';
          }
        }
      },
      y1: {
        position: 'right' as const,
        title: {
          display: true,
          text: 'Humidity (%)',
          color: 'rgb(59, 130, 246)',
        },
        min: 40,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          }
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const actuatorOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y}%`;
          }
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Intensity (%)',
        },
        min: 0,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          }
        }
      }
    },
  };

  // Export to CSV dengan status
  const exportToCSV = () => {
    const headers = [
      'Timestamp', 'Batch Name', 'Strain', 'Phase', 
      'Temperature (°C)', 'Humidity (%)', 
      'Status Suhu', 'Status Kelembapan', 'Status Keseluruhan',
      'Heater (%)', 'Fan (%)', 'Humidifier (%)'
    ];
    const rows = filteredLogs.map(log => {
      const isTempNormal = log.temperature >= systemConfig.tempMin && log.temperature <= systemConfig.tempMax;
      const isHumidityNormal = log.humidity >= systemConfig.humMin && log.humidity <= systemConfig.humMax;
      const status = isTempNormal && isHumidityNormal ? 'Normal' : 'Warning';
      
      return [
        new Date(log.timestamp).toLocaleString(),
        log.batchName,
        log.batchStrain,
        log.phase,
        log.temperature.toFixed(1),
        log.humidity.toFixed(0),
        log.statusTemp || '-',
        log.statusHumidity || '-',
        log.status || '-',
        log.heaterIntensity,
        log.fanIntensity,
        log.humidifierIntensity
      ];
    });
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fermentation_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get statistics from API or calculate locally
  const getStatistics = () => {
    if (selectedBatchId !== 'all' && selectedBatchStats) {
      return {
        avgTemp: selectedBatchStats.avgTemp.toString(),
        avgHumidity: selectedBatchStats.avgHumidity.toString(),
        maxTemp: selectedBatchStats.maxTemp.toString(),
        minTemp: selectedBatchStats.minTemp.toString(),
        maxHumidity: selectedBatchStats.maxHumidity.toString(),
        minHumidity: selectedBatchStats.minHumidity.toString(),
        avgHeater: selectedBatchStats.avgHeater.toString(),
        avgFan: selectedBatchStats.avgFan.toString(),
        avgHumidifier: selectedBatchStats.avgHumidifier.toString(),
        totalEnergy: selectedBatchStats.totalEnergy.toString(),
        totalRecords: selectedBatchStats.totalRecords,
        batchCount: 1,
        phaseCount: selectedBatchStats.phaseCount
      };
    }
    
    if (filteredLogs.length === 0) return null;
    
    const avgTemp = filteredLogs.reduce((sum, log) => sum + log.temperature, 0) / filteredLogs.length;
    const avgHumidity = filteredLogs.reduce((sum, log) => sum + log.humidity, 0) / filteredLogs.length;
    const maxTemp = Math.max(...filteredLogs.map(log => log.temperature));
    const minTemp = Math.min(...filteredLogs.map(log => log.temperature));
    const maxHumidity = Math.max(...filteredLogs.map(log => log.humidity));
    const minHumidity = Math.min(...filteredLogs.map(log => log.humidity));
    const avgHeater = filteredLogs.reduce((sum, log) => sum + log.heaterIntensity, 0) / filteredLogs.length;
    const avgFan = filteredLogs.reduce((sum, log) => sum + log.fanIntensity, 0) / filteredLogs.length;
    const avgHumidifier = filteredLogs.reduce((sum, log) => sum + log.humidifierIntensity, 0) / filteredLogs.length;
    const totalEnergy = filteredLogs.reduce((sum, log) => sum + (log.heaterIntensity * 0.008 + log.humidifierIntensity * 0.003 + log.fanIntensity * 0.001), 0);
    
    const phaseCount = {
      initial: filteredLogs.filter(l => l.phase === 'initial').length,
      fermentation: filteredLogs.filter(l => l.phase === 'fermentation').length,
      maturation: filteredLogs.filter(l => l.phase === 'maturation').length,
      cooling: filteredLogs.filter(l => l.phase === 'cooling').length,
    };
    
    return {
      avgTemp: avgTemp.toFixed(1),
      avgHumidity: avgHumidity.toFixed(0),
      maxTemp: maxTemp.toFixed(1),
      minTemp: minTemp.toFixed(1),
      maxHumidity: maxHumidity.toFixed(0),
      minHumidity: minHumidity.toFixed(0),
      avgHeater: avgHeater.toFixed(0),
      avgFan: avgFan.toFixed(0),
      avgHumidifier: avgHumidifier.toFixed(0),
      totalEnergy: totalEnergy.toFixed(2),
      totalRecords: filteredLogs.length,
      batchCount: new Set(filteredLogs.map(l => l.batchId)).size,
      phaseCount
    };
  };

  const stats = getStatistics();
  const paginationItems = getPaginationItems();
  const batchPaginationItems = getBatchPaginationItems();

  // Handle date change
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    setDateRange(prev => ({
      ...prev,
      start: newDate
    }));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    setDateRange(prev => ({
      ...prev,
      end: newDate
    }));
  };

  // Format date for input
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Fungsi untuk toggle expand batch
  const toggleBatchExpand = (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
    } else {
      setExpandedBatchId(batchId);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
        <div className="col-span-12 text-center py-16">
          <Lucide icon="Loader" className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-slate-500">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
      {/* Header */}
      <div className="col-span-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-2xl font-medium group-[.mode--light]:text-white">Logging & Riwayat Data</div>
            <div className="text-slate-500 text-sm mt-1 group-[.mode--light]:text-white">
              Riwayat suhu, kelembaban, dan aktuator selama proses fermentasi
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline-secondary" 
              onClick={() => {
                loadDataFromAPI();
                loadSystemConfig();
              }}
              className={`
                backdrop-blur-xl 
                bg-white/20 dark:bg-slate-800/30 
                border border-white/30 dark:border-slate-700/30
                shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                hover:scale-105 hover:bg-white/30 dark:hover:bg-slate-700/40 
                transition-all duration-300
                text-slate-700 dark:text-slate-200
                group-[.mode--light]:bg-white/20 
                group-[.mode--light]:border-white/30 
                group-[.mode--light]:text-white
                group-[.mode--light]:hover:bg-white/30
                group-[.mode--dark]:bg-slate-800/40
                group-[.mode--dark]:border-slate-700/40
                group-[.mode--dark]:text-slate-200
                group-[.mode--dark]:hover:bg-slate-700/50
              `}
            >
              <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            
            <Button 
              variant="primary" 
              onClick={exportToCSV} 
              className={`
                whitespace-nowrap
                backdrop-blur-xl 
                bg-white/20 dark:bg-slate-800/30 
                border border-white/30 dark:border-slate-700/30
                shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                hover:scale-105 hover:bg-white/30 dark:hover:bg-slate-700/40 
                transition-all duration-300
                text-slate-700 dark:text-slate-200
                group-[.mode--light]:bg-white/20 
                group-[.mode--light]:border-white/30 
                group-[.mode--light]:text-white
                group-[.mode--light]:hover:bg-white/30
                group-[.mode--dark]:bg-slate-800/40
                group-[.mode--dark]:border-slate-700/40
                group-[.mode--dark]:text-slate-200
                group-[.mode--dark]:hover:bg-slate-700/50
              `}
            >
              <Lucide icon="Download" className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="col-span-12">
        <div className="box box--stacked p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Time Range Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Time Range
              </label>
              <div className="flex gap-2 flex-wrap">
                {(['hour', 'day', 'week', 'month', 'all'] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={clsx(
                      "px-3 py-1.5 text-sm rounded-lg transition-all",
                      timeRange === range
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {range === 'hour' ? 'Per Jam' :
                     range === 'day' ? 'Per Hari' :
                     range === 'week' ? 'Per Minggu' :
                     range === 'month' ? 'Per Bulan' : 'Semua'}
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Batch Fermentasi
              </label>
              <FormSelect
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
              >
                <option value="all">Semua Batch ({batches.length} batch)</option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name} - {batch.strain} ({batch.logs?.length || 0} logs) - {batch.status}
                  </option>
                ))}
              </FormSelect>
            </div>

            {/* Date Range Picker */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Custom Date Range
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lucide
                    icon="Calendar"
                    className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3]"
                  />
                  <input
                    type="date"
                    value={formatDateForInput(dateRange.start)}
                    onChange={handleStartDateChange}
                    className="pl-9 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="relative flex-1">
                  <Lucide
                    icon="Calendar"
                    className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3]"
                  />
                  <input
                    type="date"
                    value={formatDateForInput(dateRange.end)}
                    onChange={handleEndDateChange}
                    className="pl-9 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Summary Cards dengan Filter & Pagination */}
      <div className="col-span-12">
        <div className="box box--stacked p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="text-base font-medium">
              Riwayat Batch Fermentasi ({filteredBatchSummaries.length} batch)
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Status */}
              <div className="flex gap-1">
                <button
                  onClick={() => setBatchStatusFilter('all')}
                  className={clsx(
                    "px-3 py-1 text-xs rounded-full transition-all",
                    batchStatusFilter === 'all'
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  Semua ({batchSummaries.length})
                </button>
                <button
                  onClick={() => setBatchStatusFilter('active')}
                  className={clsx(
                    "px-3 py-1 text-xs rounded-full transition-all",
                    batchStatusFilter === 'active'
                      ? "bg-green-500 text-white"
                      : "bg-green-50 text-green-600 hover:bg-green-100"
                  )}
                >
                  Aktif ({batchSummaries.filter(b => b.status === 'active').length})
                </button>
                <button
                  onClick={() => setBatchStatusFilter('completed')}
                  className={clsx(
                    "px-3 py-1 text-xs rounded-full transition-all",
                    batchStatusFilter === 'completed'
                      ? "bg-slate-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  Selesai ({batchSummaries.filter(b => b.status === 'completed').length})
                </button>
              </div>
              
              {/*Search Input */}
              <div className="relative">
                <Lucide 
                  icon="Search" 
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" 
                />
                <input
                  type="text"
                  placeholder="Cari batch..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="pl-7 pr-3 py-1 text-sm rounded-lg border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none w-40 sm:w-48"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedBatchSummaries.map((batch) => (
              <div 
                key={batch.id}
                className={clsx(
                  "border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md",
                  batch.status === 'active' 
                    ? "border-green-300 bg-green-50/50" 
                    : "border-slate-200 bg-white"
                )}
                onClick={() => toggleBatchExpand(batch.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{batch.name}</span>
                      <span className={clsx(
                        "text-xs px-2 py-0.5 rounded-full",
                        batch.status === 'active' 
                          ? "bg-green-100 text-green-700" 
                          : "bg-slate-100 text-slate-600"
                      )}>
                        {batch.status === 'active' ? '● Aktif' : '✓ Selesai'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{batch.strain}</div>
                  </div>
                  <Lucide 
                    icon={expandedBatchId === batch.id ? "ChevronUp" : "ChevronDown"} 
                    className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" 
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div>
                    <div className="text-slate-400">Mulai</div>
                    <div className="font-medium">{batch.startTime.toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-400">{batch.startTime.toLocaleTimeString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Selesai</div>
                    {batch.endTime ? (
                      <>
                        <div className="font-medium">{batch.endTime.toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400">{batch.endTime.toLocaleTimeString()}</div>
                      </>
                    ) : (
                      <div className="text-amber-600 font-medium">-</div>
                    )}
                  </div>
                  <div>
                    <div className="text-slate-400">Durasi</div>
                    <div className="font-medium text-primary">{batch.duration}</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">Data: {batch.totalLogs} logs</span>
                  <span className="text-slate-500">
                    Avg: {batch.avgTemp.toFixed(1)}°C / {batch.avgHumidity.toFixed(0)}%
                  </span>
                </div>
                
                {/* Expanded view dengan detail phase */}
                {expandedBatchId === batch.id && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="text-xs font-medium text-slate-600 mb-2">Distribusi Fase:</div>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      <div className="text-center p-1 bg-blue-50 rounded">
                        <div className="font-medium text-blue-600">{batch.phaseCount.initial}</div>
                        <div className="text-slate-400">Initial</div>
                      </div>
                      <div className="text-center p-1 bg-green-50 rounded">
                        <div className="font-medium text-green-600">{batch.phaseCount.fermentation}</div>
                        <div className="text-slate-400">Fermentasi</div>
                      </div>
                      <div className="text-center p-1 bg-yellow-50 rounded">
                        <div className="font-medium text-yellow-600">{batch.phaseCount.maturation}</div>
                        <div className="text-slate-400">Maturation</div>
                      </div>
                      <div className="text-center p-1 bg-purple-50 rounded">
                        <div className="font-medium text-purple-600">{batch.phaseCount.cooling}</div>
                        <div className="text-slate-400">Cooling</div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button 
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBatchId(batch.id);
                        }}
                      >
                        Lihat Log Data →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination untuk Batch Summaries */}
          {filteredBatchSummaries.length > 0 && (
            <div className="flex flex-col-reverse flex-wrap items-center mt-4 pt-4 border-t border-slate-200 flex-reverse gap-y-2 sm:flex-row">
              <div className="flex-1 w-full mr-auto sm:w-auto">
                <div className="flex items-center gap-1">
                  {/* Tombol ke halaman pertama */}
                  <button
                    onClick={() => handleBatchPageChange(1)}
                    disabled={batchCurrentPage === 1}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm transition-all",
                      batchCurrentPage === 1
                        ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"
                        : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                    )}
                  >
                    <Lucide icon="ChevronsLeft" className="w-4 h-4" />
                  </button>
                  
                  {/* Tombol ke halaman sebelumnya */}
                  <button
                    onClick={() => handleBatchPageChange(batchCurrentPage - 1)}
                    disabled={batchCurrentPage === 1}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm transition-all",
                      batchCurrentPage === 1
                        ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"
                        : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                    )}
                  >
                    <Lucide icon="ChevronLeft" className="w-4 h-4" />
                  </button>

                  {/* Pagination items dengan ellipsis */}
                  {batchPaginationItems[0] > 1 && (
                    <>
                      <button
                        onClick={() => handleBatchPageChange(1)}
                        className="px-3 py-1.5 rounded-lg text-sm hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-all"
                      >
                        1
                      </button>
                      {batchPaginationItems[0] > 2 && (
                        <span className="px-2 text-slate-400">...</span>
                      )}
                    </>
                  )}

                  {batchPaginationItems.map(page => (
                    <button
                      key={page}
                      onClick={() => handleBatchPageChange(page)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-sm transition-all",
                        batchCurrentPage === page
                          ? "bg-primary text-white"
                          : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                      )}
                    >
                      {page}
                    </button>
                  ))}

                  {batchPaginationItems[batchPaginationItems.length - 1] < batchTotalPages && (
                    <>
                      {batchPaginationItems[batchPaginationItems.length - 1] < batchTotalPages - 1 && (
                        <span className="px-2 text-slate-400">...</span>
                      )}
                      <button
                        onClick={() => handleBatchPageChange(batchTotalPages)}
                        className="px-3 py-1.5 rounded-lg text-sm hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-all"
                      >
                        {batchTotalPages}
                      </button>
                    </>
                  )}

                  {/* Tombol ke halaman berikutnya */}
                  <button
                    onClick={() => handleBatchPageChange(batchCurrentPage + 1)}
                    disabled={batchCurrentPage === batchTotalPages}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm transition-all",
                      batchCurrentPage === batchTotalPages
                        ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"
                        : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                    )}
                  >
                    <Lucide icon="ChevronRight" className="w-4 h-4" />
                  </button>
                  
                  {/* Tombol ke halaman terakhir */}
                  <button
                    onClick={() => handleBatchPageChange(batchTotalPages)}
                    disabled={batchCurrentPage === batchTotalPages}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm transition-all",
                      batchCurrentPage === batchTotalPages
                        ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"
                        : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                    )}
                  >
                    <Lucide icon="ChevronsRight" className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <FormSelect
                  className="sm:w-20 rounded-[0.5rem]"
                  value={batchItemsPerPage}
                  onChange={handleBatchItemsPerPageChange}
                >
                  <option value={6}>6</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                </FormSelect>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {filteredBatchSummaries.length} batch
                </span>
              </div>
            </div>
          )}

          {filteredBatchSummaries.length === 0 && (
            <div className="text-center py-6 text-slate-500">
              <Lucide icon="Package" className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {batchSearchQuery || batchStatusFilter !== 'all' 
                  ? 'Tidak ada batch yang sesuai dengan filter' 
                  : 'Belum ada batch yang tersimpan'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* System Config Info Banner */}
      <div className="col-span-12">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Lucide icon="Info" className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-blue-700">Status Normal berdasarkan System Config:</span>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              Suhu: {systemConfig.tempMin}°C - {systemConfig.tempMax}°C
            </span>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              Kelembaban: {systemConfig.humMin}% - {systemConfig.humMax}%
            </span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="col-span-12">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="box p-4">
              <div className="text-slate-500 text-xs">Avg Temp</div>
              <div className="text-xl font-bold text-orange-600">{stats.avgTemp}°C</div>
              <div className="text-xs text-slate-400">{stats.minTemp}° / {stats.maxTemp}°</div>
            </div>
            <div className="box p-4">
              <div className="text-slate-500 text-xs">Avg Humidity</div>
              <div className="text-xl font-bold text-blue-600">{stats.avgHumidity}%</div>
              <div className="text-xs text-slate-400">{stats.minHumidity}% / {stats.maxHumidity}%</div>
            </div>
            <div className="box p-4">
              <div className="text-slate-500 text-xs">Avg Heater</div>
              <div className="text-xl font-bold text-orange-600">{stats.avgHeater}%</div>
              <div className="text-xs text-slate-400">Power output</div>
            </div>
            <div className="box p-4">
              <div className="text-slate-500 text-xs">Avg Fan</div>
              <div className="text-xl font-bold text-purple-600">{stats.avgFan}%</div>
              <div className="text-xs text-slate-400">Ventilation</div>
            </div>
            <div className="box p-4">
              <div className="text-slate-500 text-xs">Avg Humidifier</div>
              <div className="text-xl font-bold text-cyan-600">{stats.avgHumidifier}%</div>
              <div className="text-xs text-slate-400">Moisture control</div>
            </div>
            <div className="box p-4">
              <div className="text-slate-500 text-xs">Total Energy</div>
              <div className="text-xl font-bold text-yellow-600">{stats.totalEnergy} kWh</div>
              <div className="text-xs text-slate-400">Period consumption</div>
            </div>
            <div className="box p-4">
              <div className="text-slate-500 text-xs">Data Points</div>
              <div className="text-xl font-bold text-primary">{stats.totalRecords}</div>
              <div className="text-xs text-slate-400">{stats.batchCount} batches</div>
            </div>
            <div className="box p-4">
              <div className="text-slate-500 text-xs">Active Phase</div>
              <div className="text-sm font-medium">
                {stats.phaseCount.fermentation > 0 && `Fermentasi: ${stats.phaseCount.fermentation}`}
                {stats.phaseCount.fermentation === 0 && 'No data'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Temperature & Humidity Chart */}
      <div className="col-span-12">
        <div className="box box--stacked p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="text-base font-medium">Suhu & Kelembaban Over Time</div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Temperature</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Humidity</span>
              </div>
            </div>
          </div>
          <div className="h-[350px]">
            {filteredLogs.length > 0 && tempHumidityChartData.labels.length > 0 ? (
              <Line data={tempHumidityChartData} options={tempHumidityOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Lucide icon="TrendingUp" className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Tidak ada data untuk ditampilkan</p>
                  <p className="text-sm mt-1">Mulai batch fermentasi baru untuk mengumpulkan data</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actuators Chart */}
      <div className="col-span-12">
        <div className="box box--stacked p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="text-base font-medium">Aktuator Intensity Over Time</div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
                <span>Heater</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>Fan</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                <span>Humidifier</span>
              </div>
            </div>
          </div>
          <div className="h-[350px]">
            {filteredLogs.length > 0 && actuatorChartData.labels.length > 0 ? (
              <Line data={actuatorChartData} options={actuatorOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Lucide icon="Gauge" className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Tidak ada data untuk ditampilkan</p>
                  <p className="text-sm mt-1">Data aktuator akan muncul setelah batch dimulai</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🔥 UPDATE - Data Table with Pagination dan Status */}
      <div className="col-span-12">
        <div className="box box--stacked p-5">
          <div className="text-base font-medium mb-4">Detail Log Data</div>
          <div className="overflow-x-auto">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th className="whitespace-nowrap">Waktu</Table.Th>
                  <Table.Th className="whitespace-nowrap">Batch</Table.Th>
                  <Table.Th className="whitespace-nowrap">Strain</Table.Th>
                  <Table.Th className="whitespace-nowrap">Phase</Table.Th>
                  <Table.Th className="whitespace-nowrap">Temp (°C)</Table.Th>
                  <Table.Th className="whitespace-nowrap">Hum (%)</Table.Th>
                  <Table.Th className="whitespace-nowrap">Status Suhu</Table.Th>
                  <Table.Th className="whitespace-nowrap">Status Kelembapan</Table.Th>
                  <Table.Th className="whitespace-nowrap">Status</Table.Th>
                  <Table.Th className="whitespace-nowrap">Heater (%)</Table.Th>
                  <Table.Th className="whitespace-nowrap">Fan (%)</Table.Th>
                  <Table.Th className="whitespace-nowrap">Humidifier (%)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedLogs.map((log, index) => {
                  const isTempNormal = log.temperature >= systemConfig.tempMin && log.temperature <= systemConfig.tempMax;
                  const isHumidityNormal = log.humidity >= systemConfig.humMin && log.humidity <= systemConfig.humMax;
                  
                  return (
                    <Table.Tr key={`${log.id}-${index}`}>
                      <Table.Td className="whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </Table.Td>
                      <Table.Td className="whitespace-nowrap">{log.batchName}</Table.Td>
                      <Table.Td className="whitespace-nowrap">{log.batchStrain}</Table.Td>
                      <Table.Td className="whitespace-nowrap">
                        <span className="capitalize">{log.phase}</span>
                      </Table.Td>
                      <Table.Td className={clsx("whitespace-nowrap font-medium", !isTempNormal && "text-warning")}>
                        {log.temperature.toFixed(1)}°C
                        {!isTempNormal && (
                          <span className="ml-1 text-xs">
                            ({log.temperature < systemConfig.tempMin ? '↓' : '↑'})
                          </span>
                        )}
                      </Table.Td>
                      <Table.Td className={clsx("whitespace-nowrap", !isHumidityNormal && "text-warning")}>
                        {log.humidity.toFixed(0)}%
                        {!isHumidityNormal && (
                          <span className="ml-1 text-xs">
                            ({log.humidity < systemConfig.humMin ? '↓' : '↑'})
                          </span>
                        )}
                      </Table.Td>
                      
                      <Table.Td>
                        <span className={clsx(
                          "text-xs px-2 py-1 rounded-full",
                          getStatusDisplay(log.statusTemp || 'unknown').color
                        )}>
                          {getStatusDisplay(log.statusTemp || 'unknown').label}
                        </span>
                      </Table.Td>
                      <Table.Td>
                        <span className={clsx(
                          "text-xs px-2 py-1 rounded-full",
                          getStatusDisplay(log.statusHumidity || 'unknown').color
                        )}>
                          {getStatusDisplay(log.statusHumidity || 'unknown').label}
                        </span>
                      </Table.Td>
                      <Table.Td>
                        <span className={clsx(
                          "text-xs px-2 py-1 rounded-full",
                          getStatusDisplay(log.status || 'unknown').color
                        )}>
                          {getStatusDisplay(log.status || 'unknown').label}
                        </span>
                      </Table.Td>
                      
                      <Table.Td>
                        <div className="flex items-center gap-2">
                          <span>{log.heaterIntensity}%</span>
                          <div className="w-16 bg-slate-200 rounded-full h-1.5">
                            <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${log.heaterIntensity}%` }}></div>
                          </div>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <div className="flex items-center gap-2">
                          <span>{log.fanIntensity}%</span>
                          <div className="w-16 bg-slate-200 rounded-full h-1.5">
                            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${log.fanIntensity}%` }}></div>
                          </div>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <div className="flex items-center gap-2">
                          <span>{log.humidifierIntensity}%</span>
                          <div className="w-16 bg-slate-200 rounded-full h-1.5">
                            <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${log.humidifierIntensity}%` }}></div>
                          </div>
                        </div>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
          
          {/* Pagination Controls untuk Log Data */}
          {filteredLogs.length > 0 && (
            <div className="flex flex-col-reverse flex-wrap items-center p-5 flex-reverse gap-y-2 sm:flex-row">
              <div className="flex-1 w-full mr-auto sm:w-auto">
                <div className="flex items-center gap-1">
                  {/* Tombol ke halaman pertama */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm transition-all",
                      currentPage === 1
                        ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"
                        : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                    )}
                  >
                    <Lucide icon="ChevronsLeft" className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm transition-all",
                      currentPage === 1
                        ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"
                        : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                    )}
                  >
                    <Lucide icon="ChevronLeft" className="w-4 h-4" />
                  </button>

                  {paginationItems[0] > 1 && (
                    <>
                      <button
                        onClick={() => handlePageChange(1)}
                        className="px-3 py-1.5 rounded-lg text-sm hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-all"
                      >
                        1
                      </button>
                      {paginationItems[0] > 2 && (
                        <span className="px-2 text-slate-400">...</span>
                      )}
                    </>
                  )}

                  {paginationItems.map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-sm transition-all",
                        currentPage === page
                          ? "bg-primary text-white"
                          : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                      )}
                    >
                      {page}
                    </button>
                  ))}

                  {paginationItems[paginationItems.length - 1] < totalPages && (
                    <>
                      {paginationItems[paginationItems.length - 1] < totalPages - 1 && (
                        <span className="px-2 text-slate-400">...</span>
                      )}
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        className="px-3 py-1.5 rounded-lg text-sm hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-all"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

                  {/* Tombol ke halaman berikutnya */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm transition-all",
                      currentPage === totalPages
                        ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"
                        : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                    )}
                  >
                    <Lucide icon="ChevronRight" className="w-4 h-4" />
                  </button>
                  
                  {/* Tombol ke halaman terakhir */}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm transition-all",
                      currentPage === totalPages
                        ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"
                        : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                    )}
                  >
                    <Lucide icon="ChevronsRight" className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <FormSelect
                  className="sm:w-20 rounded-[0.5rem]"
                  value={itemsPerPage}
                  onChange={handleItemsPerPageChange}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </FormSelect>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {filteredLogs.length} data
                </span>
              </div>
            </div>
          )}
          
          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Lucide icon="Database" className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada data untuk periode yang dipilih</p>
              <p className="text-sm mt-1">Mulai batch fermentasi baru untuk mengumpulkan data</p>
            </div>
          )}
          {filteredLogs.length > 0 && (
            <div className="text-sm text-slate-400 mt-4 text-center">
              Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredLogs.length)} dari {filteredLogs.length} data log
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Main;