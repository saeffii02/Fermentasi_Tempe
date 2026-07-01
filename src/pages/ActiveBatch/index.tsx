// frontend/src/pages/ActiveBatch/index.tsx
import Lucide from "@/components/Base/Lucide";
import Button from "@/components/Base/Button";
import { FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { iotService, setupWebSocket, Batch, BatchLog } from "@/services/iotService";

// 🔥 TAMBAHAN - Interface untuk Status Info
interface StatusInfo {
  tempStatus: string;
  humidityStatus: string;
  overallStatus: string;
  tempStatusLabel?: string;
  humidityStatusLabel?: string;
  overallStatusLabel?: string;
}

// 🔥 TAMBAHAN - Interface untuk Status Display
interface StatusDisplay {
  label: string;
  color: string;
  icon: string;
}

function Main() {
  const navigate = useNavigate();
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [showStartForm, setShowStartForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  
  // 🔥 TAMBAHAN - State untuk status fermentasi
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null);
  
  // Form state untuk batch baru
  const [newBatch, setNewBatch] = useState({
    name: '',
    strain: 'Ragi Tempe Instan',
    notes: '',
  });

  // Sensor & Actuator state
  const [temperature, setTemperature] = useState(28.4);
  const [humidity, setHumidity] = useState(72);
  const [heaterIntensity, setHeaterIntensity] = useState(0);
  const [fanIntensity, setFanIntensity] = useState(0);
  const [humidifierIntensity, setHumidifierIntensity] = useState(0);
  
  // Timer untuk logging
  const logIntervalRef = useRef<NodeJS.Timeout>();
  const sensorIntervalRef = useRef<NodeJS.Timeout>();
  const activeBatchIdRef = useRef<string | null>(null);
  const websocketCleanupRef = useRef<(() => void) | null>(null);

  // Load active batch and system config on mount
  useEffect(() => {
    loadActiveBatch();
    loadSystemConfig();
    setupWebSocketConnection();
    
    return () => {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
      if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
      if (websocketCleanupRef.current) websocketCleanupRef.current();
    };
  }, []);

  const loadSystemConfig = async () => {
    try {
      const config = await iotService.getSystemConfig();
      setSystemConfig(config);
    } catch (err) {
      console.error('Failed to load system config:', err);
    }
  };

  const loadActiveBatch = async () => {
    try {
      setLoading(true);
      const batch = await iotService.getActiveBatch();
      if (batch) {
        setActiveBatch(batch);
        activeBatchIdRef.current = batch.id;
        startMonitoring();
      }
    } catch (err) {
      console.error('Failed to load active batch:', err);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 PERBAIKAN - Update WebSocket handler dengan status
  const setupWebSocketConnection = () => {
    websocketCleanupRef.current = setupWebSocket((data: any) => {
      // Update sensor data from backend/ESP32
      if (data.temperature !== undefined) {
        setTemperature(Number(data.temperature));
      }
      if (data.humidity !== undefined) {
        setHumidity(Number(data.humidity));
      }
      
      // 🔥 TAMBAHAN - Update status info dari WebSocket
      if (data.status) {
        setStatusInfo({
          tempStatus: data.status.tempStatus || 'unknown',
          humidityStatus: data.status.humidityStatus || 'unknown',
          overallStatus: data.status.overallStatus || 'unknown',
          tempStatusLabel: data.status.tempStatusLabel || data.status.tempStatus,
          humidityStatusLabel: data.status.humidityStatusLabel || data.status.humidityStatus,
          overallStatusLabel: data.status.overallStatusLabel || data.status.overallStatus,
        });
      }
      
      // Update actuator states from fuzzy
      if (data.fuzzy) {
        if (data.fuzzy.intensity) {
          setHeaterIntensity(data.fuzzy.intensity.heater || 0);
          setHumidifierIntensity(data.fuzzy.intensity.humidifier || 0);
          setFanIntensity(data.fuzzy.intensity.fan || 0);
        }
      }
      
      // Refresh batch if updated
      if (data.type === 'BATCH_UPDATED' || data.type === 'batch:log-added') {
        loadActiveBatch();
      }
    });
  };

  // Start new batch
  const startNewBatch = async () => {
    if (!newBatch.name.trim()) {
      alert("Please enter batch name");
      return;
    }
    
    try {
      // Gunakan system config untuk target range
      const batch = await iotService.createBatch({
        name: newBatch.name,
        strain: newBatch.strain,
        targetTempMin: systemConfig?.temp_min || 25,
        targetTempMax: systemConfig?.temp_max || 37,
        targetHumidityMin: systemConfig?.humidity_min || 60,
        targetHumidityMax: systemConfig?.humidity_max || 80,
      });
      setActiveBatch(batch);
      activeBatchIdRef.current = batch.id;
      setShowStartForm(false);
      startMonitoring();
    } catch (error: any) {
      alert(error.response?.data?.error || error.message);
    }
  };

  // Start monitoring and logging
  const startMonitoring = () => {
    fetchCurrentSensorData();
    sensorIntervalRef.current = setInterval(() => {
      fetchCurrentSensorData();
    }, 5000);
  };
  
  const fetchCurrentSensorData = async () => {
    try {
      const current = await iotService.getCurrentReadings();
      if (current.temperature !== undefined) {
        setTemperature(Number(current.temperature));
      }
      if (current.humidity !== undefined) {
        setHumidity(Number(current.humidity));
      }
    } catch (err) {
      console.error('Failed to fetch sensor data:', err);
    }
  };

  // Save log to batch
  const saveLog = async () => {
    if (!activeBatchIdRef.current) return;

    // Calculate actuator intensities based on fuzzy logic
    const tempMem = calculateTemperatureMembership(
      temperature, 
      activeBatch!.targetTempMin, 
      activeBatch!.targetTempMax
    );
    const humMem = calculateHumidityMembership(
      humidity, 
      activeBatch!.targetHumidityMin, 
      activeBatch!.targetHumidityMax
    );
    
    const heaterInt = calculateHeaterIntensity(tempMem);
    const humidifierInt = calculateHumidifierIntensity(humMem);
    const fanInt = calculateFanIntensity(tempMem, humMem);

    setHeaterIntensity(heaterInt);
    setHumidifierIntensity(humidifierInt);
    setFanIntensity(fanInt);

    // Determine phase based on duration
    const elapsedHours = (Date.now() - new Date(activeBatch!.startTime).getTime()) / (1000 * 60 * 60);
    let phase = 'initial';
    if (elapsedHours < 12) phase = 'initial';
    else if (elapsedHours < 36) phase = 'fermentation';
    else if (elapsedHours < 48) phase = 'maturation';
    else phase = 'cooling';

    try {
      await iotService.addBatchLog(activeBatchIdRef.current, {
        temperature,
        humidity,
        heaterIntensity: heaterInt,
        fanIntensity: fanInt,
        humidifierIntensity: humidifierInt,
        phase
      });
      
      await loadActiveBatch();
    } catch (err) {
      console.error('Failed to save log:', err);
    }
  };

  // Start manual logging interval
  useEffect(() => {
    if (activeBatch) {
      logIntervalRef.current = setInterval(() => {
        saveLog();
      }, 30000);
      
      return () => {
        if (logIntervalRef.current) clearInterval(logIntervalRef.current);
      };
    }
  }, [activeBatch, temperature, humidity]);

  // Fuzzy logic functions
  const calculateTemperatureMembership = (temp: number, min: number, max: number) => {
    const coldLimit = min - 2;
    const hotLimit = max + 2;
    
    let cold = 0;
    if (temp <= coldLimit) cold = 1;
    else if (temp >= min) cold = 0;
    else cold = (min - temp) / (min - coldLimit);
    
    let hot = 0;
    if (temp >= hotLimit) hot = 1;
    else if (temp <= max) hot = 0;
    else hot = (temp - max) / (hotLimit - max);
    
    let normal = 0;
    if (temp >= min && temp <= max) normal = 1;
    else if (temp < min && temp > coldLimit) normal = (temp - coldLimit) / (min - coldLimit);
    else if (temp > max && temp < hotLimit) normal = (hotLimit - temp) / (hotLimit - max);
    
    return { cold, normal, hot };
  };

  const calculateHumidityMembership = (hum: number, min: number, max: number) => {
    const dryLimit = min - 10;
    const humidLimit = max + 10;
    
    let dry = 0;
    if (hum <= dryLimit) dry = 1;
    else if (hum >= min) dry = 0;
    else dry = (min - hum) / (min - dryLimit);
    
    let humid = 0;
    if (hum >= humidLimit) humid = 1;
    else if (hum <= max) humid = 0;
    else humid = (hum - max) / (humidLimit - max);
    
    let normal = 0;
    if (hum >= min && hum <= max) normal = 1;
    else if (hum < min && hum > dryLimit) normal = (hum - dryLimit) / (min - dryLimit);
    else if (hum > max && hum < humidLimit) normal = (humidLimit - hum) / (humidLimit - max);
    
    return { dry, normal, humid };
  };

  const calculateHeaterIntensity = (tempMem: any) => {
    const z1 = 100, z2 = 0, z3 = 0;
    const alpha1 = tempMem.cold, alpha2 = tempMem.normal, alpha3 = tempMem.hot;
    const numerator = (alpha1 * z1) + (alpha2 * z2) + (alpha3 * z3);
    const denominator = alpha1 + alpha2 + alpha3;
    if (denominator === 0) return 0;
    return Math.min(100, Math.max(0, Math.round(numerator / denominator)));
  };

  const calculateHumidifierIntensity = (humMem: any) => {
    const z1 = 100, z2 = 0, z3 = 0;
    const alpha1 = humMem.dry, alpha2 = humMem.normal, alpha3 = humMem.humid;
    const numerator = (alpha1 * z1) + (alpha2 * z2) + (alpha3 * z3);
    const denominator = alpha1 + alpha2 + alpha3;
    if (denominator === 0) return 0;
    return Math.min(100, Math.max(0, Math.round(numerator / denominator)));
  };

  const calculateFanIntensity = (tempMem: any, humMem: any) => {
    const z1 = 70, z2 = 60, z3 = 100, z4 = 50, z5 = 40, z6 = 0;
    const alpha1 = Math.min(tempMem.hot, humMem.normal);
    const alpha2 = Math.min(tempMem.normal, humMem.humid);
    const alpha3 = Math.min(tempMem.hot, humMem.humid);
    const alpha4 = tempMem.hot;
    const alpha5 = humMem.humid;
    const alpha6 = Math.min(tempMem.normal, humMem.normal);
    const numerator = (alpha1 * z1) + (alpha2 * z2) + (alpha3 * z3) + (alpha4 * z4) + (alpha5 * z5) + (alpha6 * z6);
    const denominator = alpha1 + alpha2 + alpha3 + alpha4 + alpha5 + alpha6;
    if (denominator === 0) return 0;
    return Math.min(100, Math.max(0, Math.round(numerator / denominator)));
  };

  // 🔥 TAMBAHAN - Fungsi untuk mendapatkan display status
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

  // Complete batch
  const completeBatch = async () => {
    if (!activeBatch) return;
    
    try {
      await saveLog();
      await iotService.completeBatch(activeBatch.id);
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
      if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
      navigate('/history');
    } catch (err) {
      console.error('Failed to complete batch:', err);
      alert('Failed to complete batch');
    }
  };

  // Calculate elapsed time
  const getElapsedTime = () => {
    if (!activeBatch) return '0h 0m';
    const elapsed = Date.now() - new Date(activeBatch.startTime).getTime();
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Get current phase
  const getCurrentPhase = () => {
    if (!activeBatch) return 'Unknown';
    const elapsedHours = (Date.now() - new Date(activeBatch.startTime).getTime()) / (1000 * 60 * 60);
    if (elapsedHours < 12) return 'Initialization';
    if (elapsedHours < 36) return 'Active Fermentation';
    if (elapsedHours < 48) return 'Maturation';
    return 'Cooling Down';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
        <div className="col-span-12 text-center py-16">
          <Lucide icon="Loader" className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!activeBatch && !showStartForm) {
    return (
      <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
        <div className="col-span-12">
          <div className="text-center py-16">
            <Lucide icon="Factory" className="w-20 h-20 mx-auto text-slate-400 mb-4" />
            <h2 className="text-2xl font-medium mb-2 group-[.mode--light]:text-white">No Active Batch</h2>
            <p className="text-slate-500 mb-6 group-[.mode--light]:text-white">Start a new fermentation batch to begin monitoring</p>
            <Button variant="primary" onClick={() => setShowStartForm(true)}>
              <Lucide icon="Plus" className="w-4 h-4 mr-2" />
              Start New Batch
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showStartForm) {
    return (
      <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
        <div className="col-span-12 max-w-2xl mx-auto">
          <div className="box p-8">
            <div className="text-2xl font-medium mb-6">Start New Fermentation Batch</div>
            
            <div className="space-y-4">
              <div>
                <FormLabel>Batch Name</FormLabel>
                <FormInput
                  value={newBatch.name}
                  onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                  placeholder="e.g., Fermentation Batch #001"
                />
              </div>

              <div>
                <FormLabel>Strain Type</FormLabel>
                <FormSelect
                  value={newBatch.strain}
                  onChange={(e) => setNewBatch({ ...newBatch, strain: e.target.value })}
                >
                  <option value="Ragi Tempe Instan">Ragi Tempe Instan</option>
                  <option value="Ragi Raprima">Ragi Raprima</option>
                  <option value="Ragi Lokal / Tradisional">Ragi Lokal / Tradisional</option>
                  <option value="Starter Tempe Komersial">Starter Tempe Komersial</option>
                  <option value="Starter Tempe Buatan Sendiri">Starter Tempe Buatan Sendiri</option>
                  <option value="Laru Tempe Tradisional">Laru Tempe Tradisional</option>
                  <option value="Lainnya">Lainnya</option>
                </FormSelect>
              </div>

              <div>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormInput
                  value={newBatch.notes}
                  onChange={(e) => setNewBatch({ ...newBatch, notes: e.target.value })}
                  placeholder="Additional notes about this batch..."
                />
              </div>

              {/* Informasi target range dari system config */}
              {systemConfig && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm font-medium text-slate-700 mb-2">System Configuration</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Target Temperature:</span>
                      <span className="ml-2 font-medium">{systemConfig.temp_min} - {systemConfig.temp_max}°C</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Target Humidity:</span>
                      <span className="ml-2 font-medium">{systemConfig.humidity_min} - {systemConfig.humidity_max}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    *Target range diambil dari konfigurasi sistem (dapat diubah di halaman Actuator Control)
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="primary" onClick={startNewBatch}>
                  Start Batch
                </Button>
                <Button variant="outline-secondary" onClick={() => setShowStartForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active batch view
  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
      {/* Header */}
      <div className="col-span-12">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-2xl font-medium">Active Batch Monitoring</div>
            <div className="text-slate-500 mt-1">{activeBatch!.name} - {activeBatch!.strain}</div>
          </div>
          <Button variant="outline-danger" onClick={completeBatch}>
            <Lucide icon="CheckCheck" className="w-4 h-4 mr-2" />
            Complete Batch
          </Button>
        </div>
      </div>

      {/* Batch Info Cards */}
      <div className="col-span-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="box p-4">
            <div className="text-slate-500 text-sm">Elapsed Time</div>
            <div className="text-2xl font-bold">{getElapsedTime()}</div>
          </div>
          <div className="box p-4">
            <div className="text-slate-500 text-sm">Current Phase</div>
            <div className="text-xl font-bold text-primary">{getCurrentPhase()}</div>
          </div>
          <div className="box p-4">
            <div className="text-slate-500 text-sm">Target Temp (System)</div>
            <div className="text-xl font-bold">{activeBatch!.targetTempMin} - {activeBatch!.targetTempMax}°C</div>
          </div>
          <div className="box p-4">
            <div className="text-slate-500 text-sm">Target Humidity (System)</div>
            <div className="text-xl font-bold">{activeBatch!.targetHumidityMin} - {activeBatch!.targetHumidityMax}%</div>
          </div>
        </div>
      </div>

      {/* Sensor Readings */}
      <div className="col-span-12 lg:col-span-6">
        <div className="box p-5">
          <div className="text-lg font-semibold mb-4">Live Sensor Readings</div>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <Lucide icon="Thermometer" className="w-12 h-12 mx-auto text-orange-500 mb-2" />
              <div className="text-3xl font-bold">{temperature.toFixed(1)}°C</div>
              <div className="text-sm text-slate-500">Temperature</div>
              <div className={clsx(
                "text-xs mt-2 px-2 py-1 rounded-full inline-block",
                temperature >= activeBatch!.targetTempMin && temperature <= activeBatch!.targetTempMax
                  ? "bg-green-100 text-green-600"
                  : "bg-yellow-100 text-yellow-600"
              )}>
                {temperature >= activeBatch!.targetTempMin && temperature <= activeBatch!.targetTempMax
                  ? "Normal Range"
                  : temperature < activeBatch!.targetTempMin ? "Below Target" : "Above Target"}
              </div>
            </div>
            <div className="text-center">
              <Lucide icon="Droplets" className="w-12 h-12 mx-auto text-blue-500 mb-2" />
              <div className="text-3xl font-bold">{humidity.toFixed(0)}%</div>
              <div className="text-sm text-slate-500">Humidity</div>
              <div className={clsx(
                "text-xs mt-2 px-2 py-1 rounded-full inline-block",
                humidity >= activeBatch!.targetHumidityMin && humidity <= activeBatch!.targetHumidityMax
                  ? "bg-green-100 text-green-600"
                  : "bg-yellow-100 text-yellow-600"
              )}>
                {humidity >= activeBatch!.targetHumidityMin && humidity <= activeBatch!.targetHumidityMax
                  ? "Normal Range"
                  : humidity < activeBatch!.targetHumidityMin ? "Below Target" : "Above Target"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 TAMBAHAN - Status Fermentasi Card */}
      <div className="col-span-12 lg:col-span-6">
        <div className="box p-5">
          <div className="text-lg font-semibold mb-4">Status Fermentasi</div>
          
          {statusInfo ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50">
                <span className="font-medium">Status Keseluruhan</span>
                <span className={clsx(
                  "px-4 py-1.5 rounded-full text-sm font-medium",
                  getStatusDisplay(statusInfo.overallStatus).color
                )}>
                  <Lucide icon={getStatusDisplay(statusInfo.overallStatus).icon as any} className="w-4 h-4 inline mr-1" />
                  {statusInfo.overallStatusLabel || getStatusDisplay(statusInfo.overallStatus).label}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50">
                <span className="font-medium">Status Suhu</span>
                <span className={clsx(
                  "px-4 py-1.5 rounded-full text-sm font-medium",
                  getStatusDisplay(statusInfo.tempStatus).color
                )}>
                  {statusInfo.tempStatusLabel || getStatusDisplay(statusInfo.tempStatus).label}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50">
                <span className="font-medium">Status Kelembapan</span>
                <span className={clsx(
                  "px-4 py-1.5 rounded-full text-sm font-medium",
                  getStatusDisplay(statusInfo.humidityStatus).color
                )}>
                  {statusInfo.humidityStatusLabel || getStatusDisplay(statusInfo.humidityStatus).label}
                </span>
              </div>

              {/* Indikator visual */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Optimal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span>Belum Optimal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>Kritis</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Lucide icon="Loader" className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
              <p className="text-sm">Menunggu data status...</p>
            </div>
          )}
        </div>
      </div>

      {/* Actuator Status - TETAP */}
      <div className="col-span-12 lg:col-span-6">
        <div className="box p-5">
          <div className="text-lg font-semibold mb-4">Actuator Control Status</div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="flex items-center gap-2">
                  <Lucide icon="Flame" className="w-4 h-4 text-orange-500" />
                  Heater
                </span>
                <span className="font-medium">{heaterIntensity}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${heaterIntensity}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="flex items-center gap-2">
                  <Lucide icon="Droplets" className="w-4 h-4 text-cyan-500" />
                  Humidifier
                </span>
                <span className="font-medium">{humidifierIntensity}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-cyan-500 h-2 rounded-full transition-all" style={{ width: `${humidifierIntensity}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="flex items-center gap-2">
                  <Lucide icon="Fan" className="w-4 h-4 text-purple-500" />
                  Circulation Fan
                </span>
                <span className="font-medium">{fanIntensity}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${fanIntensity}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Logs - TETAP */}
      <div className="col-span-12">
        <div className="box p-5">
          <div className="text-lg font-semibold mb-4">Recent Data Logs</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-slate-500 text-sm">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Phase</th>
                  <th className="pb-2">Temp (°C)</th>
                  <th className="pb-2">Hum (%)</th>
                  <th className="pb-2">Heater (%)</th>
                  <th className="pb-2">Fan (%)</th>
                  <th className="pb-2">Humidifier (%)</th>
                </tr>
              </thead>
              <tbody>
                {activeBatch!.logs && activeBatch!.logs.slice(-10).reverse().map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2 text-sm">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 text-sm capitalize">{log.phase}</td>
                    <td className="py-2 text-sm">{log.temperature.toFixed(1)}°C</td>
                    <td className="py-2 text-sm">{log.humidity.toFixed(0)}%</td>
                    <td className="py-2 text-sm">{log.heaterIntensity}%</td>
                    <td className="py-2 text-sm">{log.fanIntensity}%</td>
                    <td className="py-2 text-sm">{log.humidifierIntensity}%</td>
                  </tr>
                ))}
                {(!activeBatch!.logs || activeBatch!.logs.length === 0) && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-slate-500">
                      No logs yet. Waiting for data...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-sm text-slate-400 mt-3 text-center">
            Logging every 30 seconds • {activeBatch!.logs?.length || 0} total records
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;