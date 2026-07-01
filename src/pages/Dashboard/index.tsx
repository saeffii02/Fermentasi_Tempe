// frontend/src/pages/Dashboard/index.tsx
import Lucide from "@/components/Base/Lucide";
import Button from "@/components/Base/Button";
import { useEffect, useState, useRef, useCallback } from "react";
import clsx from "clsx";
import { iotService, setupWebSocket } from '@/services/iotService';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

// Tipe data untuk chart
interface ChartData {
  timestamp: string;
  temperature: number;
  humidity: number;
  time?: string;
}

function Main() {
  const [sensorData, setSensorData] = useState({
    temperature: 0,
    humidity: 0,
    co2: 0,
    activeDevices: 0,
    totalDevices: 0,
    mode: 'AUTO'
  });

  // State untuk batasan dari backend
  const [thresholds, setThresholds] = useState({
    tempMin: 25.0,
    tempMax: 37.0,
    humMin: 60.0,
    humMax: 80.0 // Default diubah ke 80
  });

  const [systemMode, setSystemMode] = useState('AUTO');
  const [historicalData, setHistoricalData] = useState<ChartData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'live' | '1h' | '24h'>('live');
  const [liveData, setLiveData] = useState<ChartData[]>([]);
  const [sensorStatus, setSensorStatus] = useState({
    status: 'NORMAL',
    message: '',
    color: 'success'
  });

  const [actuatorStatus, setActuatorStatus] = useState({
    heater: false,
    humidifier: false,
    fan: false,
    mode: 'AUTO'
  });
  
  const liveDataRef = useRef<ChartData[]>([]);
  const thresholdsRef = useRef(thresholds); // Ref untuk menyimpan thresholds terbaru

  // Update ref when thresholds change
  useEffect(() => {
    thresholdsRef.current = thresholds;
  }, [thresholds]);

  // Load thresholds from backend
  const loadThresholds = useCallback(async () => {
    try {
      const config = await iotService.getSystemConfig();
      const newThresholds = {
        tempMin: config.temp_min,
        tempMax: config.temp_max,
        humMin: config.humidity_min,
        humMax: config.humidity_max
      };
      setThresholds(newThresholds);
      console.log('Thresholds loaded:', newThresholds);
      
      // Update sensor status with new thresholds
      const { temperature, humidity } = sensorData;
      if (temperature !== undefined && humidity !== undefined) {
        updateSensorStatusWithThresholds(temperature, humidity, newThresholds);
      }
    } catch (err) {
      console.error('Failed to load thresholds:', err);
    }
  }, [sensorData.temperature, sensorData.humidity]);

  // Fungsi update status dengan thresholds tertentu
  const updateSensorStatusWithThresholds = (temperature: number, humidity: number, thresholdsData: typeof thresholds) => {
    let status = 'NORMAL';
    let message = '';
    let color = 'success';
    
    const { tempMin, tempMax, humMin, humMax } = thresholdsData;
    
    // Cek suhu
    if (temperature < tempMin) {
      status = 'TERLALU DINGIN';
      message = `Suhu ${temperature.toFixed(1)}°C di bawah normal (min ${tempMin}°C)`;
      color = 'info';
    } else if (temperature > tempMax) {
      status = 'TERLALU PANAS';
      message = `Suhu ${temperature.toFixed(1)}°C di atas normal (max ${tempMax}°C)`;
      color = 'danger';
    } else {
      // Cek kelembaban dengan batasan terbaru
      if (humidity < humMin) {
        status = 'KURANG LEMBAB';
        message = `Kelembaban ${humidity.toFixed(1)}% terlalu rendah (min ${humMin}%)`;
        color = 'warning';
      } else if (humidity > humMax) {
        status = 'TERLALU LEMBAB';
        message = `Kelembaban ${humidity.toFixed(1)}% terlalu tinggi (max ${humMax}%)`;
        color = 'warning';
      } else {
        status = 'NORMAL';
        message = `Suhu ${temperature.toFixed(1)}°C dan kelembaban ${humidity.toFixed(1)}% optimal`;
        color = 'success';
      }
    }
    
    setSensorStatus({ status, message, color });
  };

  // Update fungsi updateSensorStatus menggunakan thresholds terbaru dari ref
  const updateSensorStatus = useCallback((temperature: number, humidity: number) => {
    updateSensorStatusWithThresholds(temperature, humidity, thresholdsRef.current);
  }, []);
  
  useEffect(() => {
    fetchInitialData();
    loadThresholds();
    
    let cleanup: (() => void) | undefined;
    const interval = setInterval(() => {
      if (timeRange !== 'live') {
        fetchHistoricalData(timeRange);
      }
      fetchCurrentData();
      loadThresholds();
    }, 30000);

    try {
      cleanup = setupWebSocket((data) => {
        console.log('Realtime:', data);
        
        if (data.temperature !== undefined && data.humidity !== undefined) {
          const temp = Number(data.temperature);
          const hum = Number(data.humidity);

          setSensorData(prev => ({
            ...prev,
            temperature: temp,
            humidity: hum
          }));

          setActuatorStatus({
            heater: data.heater === 1 || data.heater === true,
            humidifier: data.humidifier === 1 || data.humidifier === true,
            fan: data.fan === 1 || data.fan === true,
            mode: data.mode || 'AUTO'
          });

          // Update status dengan thresholds terbaru
          updateSensorStatus(temp, hum);

          const now = new Date();
          const newPoint: ChartData = {
            timestamp: now.toISOString(),
            temperature: temp,
            humidity: hum,
            time: now.toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })
          };

          liveDataRef.current = [...liveDataRef.current, newPoint];
          
          if (liveDataRef.current.length > 30) {
            liveDataRef.current = liveDataRef.current.slice(-30);
          }

          setLiveData([...liveDataRef.current]);

          if (timeRange === 'live') {
            setChartData([...liveDataRef.current]);
          }
        }
        else if (data.mode) {
          setActuatorStatus(prev => ({
            ...prev,
            heater: data.heater === 1 || data.heater === true,
            humidifier: data.humidifier === 1 || data.humidifier === true,
            fan: data.fan === 1 || data.fan === true,
            mode: data.mode
          }));
        }
      });
    } catch (err) {
      console.error('WebSocket setup failed:', err);
    }

    return () => {
      if (cleanup) cleanup();
      clearInterval(interval);
    };
  }, [timeRange, loadThresholds, updateSensorStatus]);
  
  const fetchInitialData = async () => {
    try {
      setError(null);
      const [current, devicesList] = await Promise.all([
        iotService.getCurrentReadings(),
        iotService.getDevices()
      ]);
      
      setSensorData(current);
      setDevices(devicesList);
      
      const now = new Date();
      const initialPoint: ChartData = {
        timestamp: now.toISOString(),
        temperature: current.temperature,
        humidity: current.humidity,
        time: now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      };

      liveDataRef.current = [initialPoint];
      setLiveData([initialPoint]);

      if (timeRange === 'live') {
        setChartData([initialPoint]);
      } else {
        await fetchHistoricalData('24h');
      }
      
      // Update status setelah thresholds dimuat
      await loadThresholds();
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      setError('Gagal memuat data. Pastikan backend server berjalan.');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchHistoricalData = async (range: '1h' | '24h') => {
    try {
      const [tempData, humidityData] = await Promise.all([
        iotService.getHistoricalData(range, 'temperature'),
        iotService.getHistoricalData(range, 'humidity')
      ]);
      
      const combinedMap = new Map();
      tempData.forEach((item: any) => {
        const key = new Date(item.timestamp).toISOString().slice(0, 13);
        if (!combinedMap.has(key)) {
          combinedMap.set(key, {});
        }
        combinedMap.get(key).temperature = item.value;
        combinedMap.get(key).timestamp = item.timestamp;
      });

      humidityData.forEach((item: any) => {
        const key = new Date(item.timestamp).toISOString().slice(0, 13);
        if (!combinedMap.has(key)) {
          combinedMap.set(key, {});
        }
        combinedMap.get(key).humidity = item.value;
        combinedMap.get(key).timestamp = item.timestamp;
      });

      const combinedData: ChartData[] = [];
      combinedMap.forEach((value) => {
        combinedData.push({
          timestamp: value.timestamp,
          temperature: value.temperature || 0,
          humidity: value.humidity || 0,
          time: new Date(value.timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      });
      
      combinedData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setHistoricalData(combinedData);
      
      if (range === timeRange) {
        setChartData(combinedData);
      }
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
    }
  };
  
  const fetchCurrentData = async () => {
    try {
      const data = await iotService.getCurrentReadings();
      setSensorData(data);
      updateSensorStatus(data.temperature, data.humidity);
    } catch (error) {
      console.error('Failed to fetch current data:', error);
    }
  };
  
  const handleTimeRangeChange = (range: 'live' | '1h' | '24h') => {
    setTimeRange(range);
    if (range === 'live') {
      setChartData([...liveDataRef.current]);
    } else {
      fetchHistoricalData(range);
    }
  };
  
  const handleRefreshData = () => {
    if (timeRange === 'live') {
      setChartData(liveDataRef.current);
    } else {
      fetchHistoricalData(timeRange as '1h' | '24h');
    }
    fetchCurrentData();
    loadThresholds();
  };
  
  const getStatusIcon = () => {
    switch (sensorStatus.color) {
      case 'danger':
        return 'AlertTriangle';
      case 'warning':
        return 'AlertTriangle';
      case 'info':
        return 'Snowflake';
      default:
        return 'CheckCircle';
    }
  };
  
  const getStatusBgColor = () => {
    switch (sensorStatus.color) {
      case 'danger':
        return 'bg-red-100';
      case 'warning':
        return 'bg-yellow-100';
      case 'info':
        return 'bg-blue-100';
      default:
        return 'bg-green-100';
    }
  };
  
  const getStatusTextColor = () => {
    switch (sensorStatus.color) {
      case 'danger':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-green-500';
    }
  };
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="text-sm font-medium mb-2">{new Date(label).toLocaleString('id-ID')}</p>
          <p className="text-sm text-orange-600">
            <span className="font-medium">Temperature:</span> {payload[0]?.value?.toFixed(1)}°C
          </p>
          <p className="text-sm text-blue-600">
            <span className="font-medium">Humidity:</span> {payload[1]?.value?.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Lucide icon="Loader" className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-slate-500">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Lucide icon="AlertTriangle" className="w-12 h-12 text-danger mx-auto" />
          <p className="mt-4 text-danger font-medium">{error}</p>
          <Button variant="primary" className="mt-4" onClick={fetchInitialData}>
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      {/* Header Section */}
      <div className="col-span-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="primary" className="px-4 py-2" onClick={handleRefreshData}>
              <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* Environmental Cards Section */}
      <div className="col-span-12">
        <div className="grid grid-cols-12 gap-5">
          {/* Temperature Card */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="box box--stacked p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-sm">Temperature</div>
                  <div className="text-3xl font-medium mt-1">
                    {sensorData.temperature.toFixed(1)}
                    <span className="text-lg">°C</span>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className={`text-xs ${
                      sensorData.temperature < thresholds.tempMin || sensorData.temperature > thresholds.tempMax 
                        ? 'text-danger' 
                        : 'text-success'
                    }`}>
                      {sensorData.temperature < thresholds.tempMin && `↓ Below normal (min ${thresholds.tempMin}°C)`}
                      {sensorData.temperature > thresholds.tempMax && `↑ Above normal (max ${thresholds.tempMax}°C)`}
                      {sensorData.temperature >= thresholds.tempMin && sensorData.temperature <= thresholds.tempMax && '✓ Normal range'}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Lucide icon="Thermometer" className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Humidity Card */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="box box--stacked p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-sm">Humidity</div>
                  <div className="text-3xl font-medium mt-1">
                    {sensorData.humidity.toFixed(1)}
                    <span className="text-lg">%</span>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className={`text-xs ${
                      sensorData.humidity < thresholds.humMin || sensorData.humidity > thresholds.humMax
                        ? 'text-warning'
                        : 'text-success'
                    }`}>
                      {sensorData.humidity < thresholds.humMin && `↓ Below normal (min ${thresholds.humMin}%)`}
                      {sensorData.humidity > thresholds.humMax && `↑ Above normal (max ${thresholds.humMax}%)`}
                      {sensorData.humidity >= thresholds.humMin && sensorData.humidity <= thresholds.humMax && '✓ Normal range'}
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-info">Real-time</span>
                    <span className="mx-1 text-slate-400">•</span>
                    <span className="text-xs text-slate-500">Target: {thresholds.humMin}-{thresholds.humMax}%</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Lucide icon="Droplets" className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Warning Card - Status Sensor */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className={`box box--stacked p-5`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className={`text-slate-500 text-sm flex items-center ${getStatusTextColor()}`}>
                    <Lucide icon={getStatusIcon()} className="w-4 h-4 mr-1" />
                    Status Sensor
                  </div>
                  <div className={`text-xl font-medium mt-1 ${getStatusTextColor()}`}>
                    {sensorStatus.status}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 truncate" title={sensorStatus.message}>
                    {sensorStatus.message}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="text-[10px] text-slate-400">
                      Normal range: {thresholds.tempMin}°C - {thresholds.tempMax}°C, {thresholds.humMin}-{thresholds.humMax}%
                    </div>
                  </div>
                </div>
                <div className={`w-12 h-12 ${getStatusBgColor()} rounded-full flex items-center justify-center`}>
                  <Lucide icon={getStatusIcon()} className={`w-6 h-6 ${getStatusTextColor()}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Active Devices */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="box box--stacked p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-slate-500 text-sm">Active Devices</div>
                  <div className="text-3xl font-medium mt-1">
                    {devices.filter((device: any) => device.status === "running").length}/{devices.length}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                    {devices
                      .filter((device: any) => device.status === "running")
                      .map((device: any) => (
                        <div key={device.id || device.device_id} className="flex items-center">
                          <div className="w-2 h-2 bg-success rounded-full mr-1"></div>
                          <span className="text-xs whitespace-nowrap">
                            {device.name || device.device_id}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Lucide icon="Radio" className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Mode Actuator */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="box box--stacked p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-sm">System Mode</div>
                  <div className="text-2xl font-medium mt-1">{actuatorStatus.mode}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center text-xs">
                      <div className={`w-2 h-2 rounded-full mr-2 ${actuatorStatus.heater ? 'bg-red-500' : 'bg-slate-300'}`} />
                      Heater
                    </div>
                    <div className="flex items-center text-xs">
                      <div className={`w-2 h-2 rounded-full mr-2 ${actuatorStatus.humidifier ? 'bg-blue-500' : 'bg-slate-300'}`} />
                      Humidifier
                    </div>
                    <div className="flex items-center text-xs">
                      <div className={`w-2 h-2 rounded-full mr-2 ${actuatorStatus.fan ? 'bg-cyan-500' : 'bg-slate-300'}`} />
                      Fan
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                  <Lucide icon="Cpu" className="w-6 h-6 text-cyan-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Environment Chart */}
      <div className="col-span-12 lg:col-span-12">
        <div className="box box--stacked p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="text-base font-medium">Real-time Environment</div>
            <div className="flex gap-2">
              <Button 
                className={clsx("px-3 py-1 text-sm", timeRange === 'live' && "bg-primary text-white", timeRange !== 'live' && "border border-slate-200")}
                onClick={() => handleTimeRangeChange('live')}
              >
                Live
              </Button>
              <Button 
                className={clsx("px-3 py-1 text-sm", timeRange === '1h' && "bg-primary text-white", timeRange !== '1h' && "border border-slate-200")}
                onClick={() => handleTimeRangeChange('1h')}
              >
                1H
              </Button>
              <Button 
                className={clsx("px-3 py-1 text-sm", timeRange === '24h' && "bg-primary text-white", timeRange !== '24h' && "border border-slate-200")}
                onClick={() => handleTimeRangeChange('24h')}
              >
                24H
              </Button>
            </div>
          </div>
          <div className="text-xs text-slate-500 mb-3">
            {timeRange === 'live' ? `Live data (${liveData.length} readings)` : `Temperature & Humidity correlation (Last ${timeRange})`}
          </div>
          <div className="h-[400px] relative">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      if (timeRange === 'live') {
                        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      } else if (timeRange === '1h') {
                        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      } else {
                        return date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit' });
                      }
                    }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    yAxisId="left"
                    domain={[0, 50]}
                    label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    label={{ value: 'Humidity (%)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <ReferenceLine 
                    yAxisId="left"
                    y={thresholds.tempMin} 
                    label="Min Temp" 
                    stroke="red" 
                    strokeDasharray="3 3"
                    ifOverflow="extendDomain"
                  />
                  <ReferenceLine 
                    yAxisId="left"
                    y={thresholds.tempMax} 
                    label="Max Temp" 
                    stroke="red" 
                    strokeDasharray="3 3"
                    ifOverflow="extendDomain"
                  />
                  <ReferenceLine 
                    yAxisId="right"
                    y={thresholds.humMin} 
                    label="Min Humidity" 
                    stroke="orange" 
                    strokeDasharray="3 3"
                    ifOverflow="extendDomain"
                  />
                  <ReferenceLine 
                    yAxisId="right"
                    y={thresholds.humMax} 
                    label="Max Humidity" 
                    stroke="orange" 
                    strokeDasharray="3 3"
                    ifOverflow="extendDomain"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f97316"
                    name="Temperature (°C)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="humidity"
                    stroke="#3b82f6"
                    name="Humidity (%)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Lucide icon="Activity" className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No data available</p>
                  <p className="text-xs text-slate-400 mt-1">Waiting for sensor data...</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
              <span className="text-sm">Temperature (°C)</span>
              <span className="text-xs text-slate-400 ml-2">Normal: {thresholds.tempMin}-{thresholds.tempMax}°C</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm">Humidity (%)</span>
              <span className="text-xs text-slate-400 ml-2">Normal: {thresholds.humMin}-{thresholds.humMax}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;