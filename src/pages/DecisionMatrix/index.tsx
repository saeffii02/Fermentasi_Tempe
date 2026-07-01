// frontend/src/pages/DecisionMatrix/index.tsx

import { useState, useEffect } from "react";
import Lucide from "@/components/Base/Lucide";
import Button from "@/components/Base/Button";
import { iotService } from "@/services/iotService";

// ✅ IMPORT yang benar - dari folder components/DecisionMatrix/
import ThreeDSurfaceView from "@/components/DecisionMatrix/ThreeDSurfaceView";

type TabMode = 'matrix' | 'rules' | '3d';

function DecisionMatrixPage() {
  const [activeTab, setActiveTab] = useState<TabMode>('matrix');
  const [selectedPoint, setSelectedPoint] = useState<{ temp: number; hum: number } | null>(null);
  const [decisionDetail, setDecisionDetail] = useState<any>(null);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSystemConfig();
  }, []);

  const loadSystemConfig = async () => {
    try {
      const config = await iotService.getSystemConfig();
      setSystemConfig(config);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const handleCellClick = async (temperature: number, humidity: number) => {
    setSelectedPoint({ temp: temperature, hum: humidity });
    setLoading(true);
    try {
      const result = await iotService.evaluateFuzzyPoint(temperature, humidity);
      setDecisionDetail(result);
    } catch (err) {
      console.error('Failed to evaluate fuzzy:', err);
      const localResult = evaluateFuzzyLocally(temperature, humidity, systemConfig);
      setDecisionDetail(localResult);
    } finally {
      setLoading(false);
    }
  };

  const evaluateFuzzyLocally = (temp: number, hum: number, config: any) => {
    const tempMin = config?.temp_min || 25;
    const tempMax = config?.temp_max || 37;
    const humMin = config?.humidity_min || 60;
    const humMax = config?.humidity_max || 80;

    const tempMem = calculateTemperatureMembership(temp, tempMin, tempMax);
    const humMem = calculateHumidityMembership(hum, humMin, humMax);

    return {
      temperature: temp,
      humidity: hum,
      intensity: {
        heater: calculateHeaterIntensity(tempMem),
        humidifier: calculateHumidifierIntensity(humMem),
        fan: calculateFanIntensity(tempMem, humMem)
      },
      membership: {
        temperature: tempMem,
        humidity: humMem
      },
      status: 'EVALUATED'
    };
  };

  return (
    <div className="grid grid-cols-12 gap-6 p-6">
      {/* Header */}
      <div className="col-span-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium group-[.mode--light]:text-white">Decision Matrix - Fuzzy Tsukamoto</h1>
            <p className="text-slate-500 text-sm mt-1 group-[.mode--light]:text-white">
              Visualisasi basis aturan dan keputusan sistem fuzzy untuk kontrol fermentasi tempe
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="col-span-12">
        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all flex items-center gap-2 ${
                activeTab === 'matrix'
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Lucide icon="Table" className="w-4 h-4" />
              Matrix Grid (6x6)
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all flex items-center gap-2 ${
                activeTab === 'rules'
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Lucide icon="FileText" className="w-4 h-4" />
              Rule Base (9 Aturan)
            </button>
            <button
              onClick={() => setActiveTab('3d')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all flex items-center gap-2 ${
                activeTab === '3d'
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Lucide icon="Activity" className="w-4 h-4" />
              3D Surface Plot
            </button>
          </div>
        </div>
      </div>

      {/* Konten Tab - Gunakan komponen yang diimport */}
      <div className="col-span-12">
        {activeTab === 'matrix' && (
          <MatrixGridView 
            onCellClick={handleCellClick}
            systemConfig={systemConfig}
          />
        )}
        
        {activeTab === 'rules' && (
          <RuleBaseView systemConfig={systemConfig} />
        )}
        
        {activeTab === '3d' && (
          <ThreeDSurfaceView systemConfig={systemConfig} />
        )}
      </div>

      {/* Interactive Simulator */}
      <div className="col-span-12 lg:col-span-6">
        <InteractiveSimulator 
          onSimulate={handleCellClick}
          systemConfig={systemConfig}
          loading={loading}
        />
      </div>

      {/* Detail Panel */}
      <div className="col-span-12 lg:col-span-6">
        <DecisionDetailPanel 
          selectedPoint={selectedPoint}
          decisionDetail={decisionDetail}
          loading={loading}
        />
      </div>

      {/* Penjelasan Metode */}
      <div className="col-span-12">
        <div className="box p-4 bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
            <Lucide icon="Info" className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Tentang Decision Matrix</span>
          </div>
          <p className="text-xs text-slate-600">
            Decision matrix ini menunjukkan bagaimana sistem fuzzy Tsukamoto mengambil keputusan kontrol 
            berdasarkan input suhu dan kelembaban. Setiap sel dalam matrix merepresentasikan output keputusan 
            untuk kombinasi nilai suhu dan kelembaban tertentu. Warna menunjukkan aktuator mana yang aktif 
            (🔥 Heater, 💧 Humidifier, 🌀 Fan) dan intensitasnya.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// FUZZY MEMBERSHIP FUNCTIONS
// ============================================

function calculateTemperatureMembership(temp: number, min: number, max: number) {
  const domainMin = 20;
  const domainMax = 45;
  let cold = 0, normal = 0, hot = 0;
  if (temp <= domainMin) cold = 1;
  else if (temp >= min) cold = 0;
  else cold = (min - temp) / (min - domainMin);
  if (temp >= min && temp <= max) normal = 1;
  else if (temp < min && temp > domainMin) normal = (temp - domainMin) / (min - domainMin);
  else if (temp > max && temp < domainMax) normal = (domainMax - temp) / (domainMax - max);
  if (temp >= domainMax) hot = 1;
  else if (temp <= max) hot = 0;
  else hot = (temp - max) / (domainMax - max);
  return {
    cold: Number(Math.min(1, Math.max(0, cold)).toFixed(3)),
    normal: Number(Math.min(1, Math.max(0, normal)).toFixed(3)),
    hot: Number(Math.min(1, Math.max(0, hot)).toFixed(3))
  };
}

function calculateHumidityMembership(hum: number, min: number, max: number) {
  const domainMin = 30;
  const domainMax = 100;
  let dry = 0, normal = 0, humid = 0;
  if (hum <= domainMin) dry = 1;
  else if (hum >= min) dry = 0;
  else dry = (min - hum) / (min - domainMin);
  if (hum >= min && hum <= max) normal = 1;
  else if (hum < min && hum > domainMin) normal = (hum - domainMin) / (min - domainMin);
  else if (hum > max && hum < domainMax) normal = (domainMax - hum) / (domainMax - max);
  if (hum >= domainMax) humid = 1;
  else if (hum <= max) humid = 0;
  else humid = (hum - max) / (domainMax - max);
  return {
    dry: Number(Math.min(1, Math.max(0, dry)).toFixed(3)),
    normal: Number(Math.min(1, Math.max(0, normal)).toFixed(3)),
    humid: Number(Math.min(1, Math.max(0, humid)).toFixed(3))
  };
}

function calculateHeaterIntensity(tempMem: any) {
  const numerator = tempMem.cold * 100 + tempMem.normal * 0 + tempMem.hot * 0;
  const denominator = tempMem.cold + tempMem.normal + tempMem.hot;
  if (denominator === 0) return 0;
  return Math.min(100, Math.max(0, Math.round(numerator / denominator)));
}

function calculateHumidifierIntensity(humMem: any) {
  const numerator = humMem.dry * 100 + humMem.normal * 0 + humMem.humid * 0;
  const denominator = humMem.dry + humMem.normal + humMem.humid;
  if (denominator === 0) return 0;
  return Math.min(100, Math.max(0, Math.round(numerator / denominator)));
}

function calculateFanIntensity(tempMem: any, humMem: any) {
  const z1 = 70, z2 = 60, z3 = 100, z4 = 50, z5 = 40, z6 = 0;
  const alpha1 = Math.min(tempMem.hot, humMem.normal);
  const alpha2 = Math.min(tempMem.normal, humMem.humid);
  const alpha3 = Math.min(tempMem.hot, humMem.humid);
  const alpha4 = tempMem.hot;
  const alpha5 = humMem.humid;
  const alpha6 = Math.min(tempMem.normal, humMem.normal);
  const numerator = alpha1 * z1 + alpha2 * z2 + alpha3 * z3 + alpha4 * z4 + alpha5 * z5 + alpha6 * z6;
  const denominator = alpha1 + alpha2 + alpha3 + alpha4 + alpha5 + alpha6;
  if (denominator === 0) return 0;
  return Math.min(100, Math.max(0, Math.round(numerator / denominator)));
}

// ============================================
// KOMPONEN-KOMPONEN LAINNYA
// ============================================

// MatrixGridView Component
function MatrixGridView({ onCellClick, systemConfig }: { onCellClick: (temp: number, hum: number) => void; systemConfig: any }) {
  const temperatureLevels = [
    { label: "Sangat Dingin", value: 23, range: "< 24°C" },
    { label: "Dingin", value: 24.5, range: "24-25°C" },
    { label: "Normal Bawah", value: 28, range: "25-30°C" },
    { label: "Normal Atas", value: 34, range: "30-37°C" },
    { label: "Panas", value: 39, range: "37-42°C" },
    { label: "Sangat Panas", value: 43, range: "> 42°C" }
  ];

  const humidityLevels = [
    { label: "Sangat Kering", value: 35, range: "< 40%" },
    { label: "Kering", value: 45, range: "40-50%" },
    { label: "Normal Bawah", value: 60, range: "50-65%" },
    { label: "Normal Atas", value: 72, range: "65-80%" },
    { label: "Lembab", value: 88, range: "80-90%" },
    { label: "Sangat Lembab", value: 95, range: "> 90%" }
  ];

  const evaluatePoint = (temp: number, hum: number) => {
    const tempMin = systemConfig?.temp_min || 25;
    const tempMax = systemConfig?.temp_max || 37;
    const humMin = systemConfig?.humidity_min || 60;
    const humMax = systemConfig?.humidity_max || 80;

    const tempMem = calculateTemperatureMembership(temp, tempMin, tempMax);
    const humMem = calculateHumidityMembership(hum, humMin, humMax);

    return {
      heater: calculateHeaterIntensity(tempMem),
      humidifier: calculateHumidifierIntensity(humMem),
      fan: calculateFanIntensity(tempMem, humMem)
    };
  };

  const matrix = temperatureLevels.map(temp => 
    humidityLevels.map(hum => evaluatePoint(temp.value, hum.value))
  );

  const getCellColor = (heater: number, humidifier: number, fan: number) => {
    if (heater > 50) return "bg-orange-100 border-orange-300";
    if (humidifier > 50) return "bg-blue-100 border-blue-300";
    if (fan > 50) return "bg-purple-100 border-purple-300";
    return "bg-green-50 border-green-200";
  };

  // Mengganti emoji dengan icon Lucide
  const getActionIcon = (heater: number, humidifier: number, fan: number) => {
    if (heater > 50) return <Lucide icon="Flame" className="w-5 h-5 text-orange-500" />;
    if (humidifier > 50) return <Lucide icon="Droplets" className="w-5 h-5 text-blue-500" />;
    if (fan > 50) return <Lucide icon="Wind" className="w-5 h-5 text-purple-500" />;
    return <Lucide icon="CircleCheck" className="w-5 h-5 text-green-500" />;
  };

  return (
    <div className="box p-5">
      <div className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Lucide icon="Table" className="w-5 h-5 text-primary" />
        Decision Matrix - Fuzzy Tsukamoto Rule Base
      </div>

      <div className="overflow-x-auto">
        <div className="text-sm text-slate-500 mb-3 text-center flex items-center justify-center gap-2">
          <Lucide icon="MousePointerClick" className="w-4 h-4" />
          <span>Klik pada sel untuk melihat detail keputusan fuzzy</span>
        </div>
        
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2 bg-slate-100 border">Suhu ↓ / Humid →</th>
              {humidityLevels.map(h => (
                <th key={h.label} className="p-2 bg-slate-100 border min-w-[100px]">
                  {h.label}<br/>
                  <span className="text-xs text-slate-400">{h.range}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, tempIdx) => (
              <tr key={tempIdx}>
                <td className="p-2 bg-slate-50 border font-medium text-center">
                  {temperatureLevels[tempIdx].label}<br/>
                  <span className="text-xs text-slate-400">{temperatureLevels[tempIdx].range}</span>
                </td>
                {row.map((cell, humIdx) => (
                  <td 
                    key={humIdx}
                    className={`p-2 border text-center cursor-pointer hover:opacity-80 transition-all ${getCellColor(cell.heater, cell.humidifier, cell.fan)}`}
                    onClick={() => onCellClick(temperatureLevels[tempIdx].value, humidityLevels[humIdx].value)}
                  >
                    <div className="flex items-center justify-center">
                      {getActionIcon(cell.heater, cell.humidifier, cell.fan)}
                    </div>
                    <div className="text-xs font-mono mt-1">
                      {cell.heater > 0 && `H:${cell.heater}%`}
                      {cell.humidifier > 0 && ` M:${cell.humidifier}%`}
                      {cell.fan > 0 && ` F:${cell.fan}%`}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t justify-center">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
            <Lucide icon="Flame" className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs">Pemanasan Aktif</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
            <Lucide icon="Droplets" className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs">Pelembapan Aktif</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
            <Lucide icon="Wind" className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs">Pendingin/Sirkulasi</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
            <Lucide icon="CircleCheck" className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs">Kondisi Optimal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// RuleBaseView Component
function RuleBaseView({ systemConfig }: { systemConfig: any }) {
  const rules = [
    { condition: "IF Suhu = Dingin", action: "Heater ON (100%)", reason: "Menaikkan suhu ke range normal" },
    { condition: "IF Suhu = Normal", action: "Heater OFF", reason: "Pertahankan suhu" },
    { condition: "IF Suhu = Panas", action: "Heater OFF + Fan ON", reason: "Menurunkan suhu" },
    { condition: "IF Kelembaban = Kering", action: "Humidifier ON (100%)", reason: "Menaikkan kelembaban" },
    { condition: "IF Kelembaban = Normal", action: "Humidifier OFF", reason: "Pertahankan kelembaban" },
    { condition: "IF Kelembaban = Lembab", action: "Humidifier OFF + Fan ON", reason: "Mengurangi kelembaban" },
    { condition: "IF Suhu = Panas AND Kelembaban = Lembab", action: "Fan ON (100%)", reason: "Maksimum pendinginan & dehumidifikasi" },
    { condition: "IF Suhu = Panas AND Kelembaban = Normal", action: "Fan ON (70%)", reason: "Pendinginan tinggi" },
    { condition: "IF Suhu = Normal AND Kelembaban = Lembab", action: "Fan ON (60%)", reason: "Sirkulasi udara" },
  ];

  return (
    <div className="box p-5">
      <div className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Lucide icon="FileText" className="w-5 h-5 text-primary" />
        Rule Base - Fuzzy Tsukamoto
      </div>

      <div className="mb-3 text-sm text-slate-500 flex items-center gap-2">
        <Lucide icon="List" className="w-4 h-4" />
        <span>Basis aturan Fuzzy Tsukamoto (9 aturan utama)</span>
      </div>
      
      <div className="space-y-2">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-primary font-bold">R{idx+1}</span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{rule.condition}</div>
              <div className="text-primary text-sm font-semibold">→ {rule.action}</div>
              <div className="text-xs text-slate-500 mt-1">{rule.reason}</div>
            </div>
            <div className="flex-shrink-0">
              <Lucide icon="CircleCheck" className="w-4 h-4 text-green-500" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <Lucide icon="Brain" className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-sm">Metode Defuzzifikasi: Weighted Average</span>
        </div>
        <p className="text-xs text-slate-600">
          Output = Σ(αi × Zi) / Σ(αi)<br/>
          Dimana αi adalah derajat keanggotaan (firing strength) dan Zi adalah nilai output crisp
        </p>
        {systemConfig && (
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <Lucide icon="Settings" className="w-3 h-3" />
            Current Config: Suhu {systemConfig.temp_min}°C - {systemConfig.temp_max}°C | 
            Kelembaban {systemConfig.humidity_min}% - {systemConfig.humidity_max}%
          </div>
        )}
      </div>
    </div>
  );
}

// InteractiveSimulator Component
function InteractiveSimulator({ onSimulate, systemConfig, loading }: { 
  onSimulate: (temp: number, hum: number) => void; 
  systemConfig: any;
  loading: boolean;
}) {
  const [temp, setTemp] = useState(30);
  const [hum, setHum] = useState(65);

  const handleSimulate = () => {
    onSimulate(temp, hum);
  };

  return (
    <div className="box p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lucide icon="Settings" className="w-5 h-5 text-primary" />
        <span className="font-medium">Interactive Simulator</span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
            <Lucide icon="Thermometer" className="w-4 h-4 text-orange-500" />
            Temperature: {temp}°C
          </label>
          <input
            type="range"
            min="20"
            max="45"
            step="0.5"
            value={temp}
            onChange={(e) => setTemp(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>20°C (Dingin)</span>
            <span>32.5°C (Normal)</span>
            <span>45°C (Panas)</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
            <Lucide icon="Droplets" className="w-4 h-4 text-blue-500" />
            Humidity: {hum}%
          </label>
          <input
            type="range"
            min="30"
            max="100"
            step="1"
            value={hum}
            onChange={(e) => setHum(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>30% (Kering)</span>
            <span>65% (Normal)</span>
            <span>100% (Lembab)</span>
          </div>
        </div>

        <Button 
          variant="primary" 
          className="w-full flex items-center justify-center gap-2"
          onClick={handleSimulate}
          disabled={loading}
        >
          {loading ? (
            <Lucide icon="Loader" className="w-4 h-4 animate-spin" />
          ) : (
            <Lucide icon="Brain" className="w-4 h-4" />
          )}
          Evaluate Fuzzy Decision
        </Button>
      </div>
    </div>
  );
}

// DecisionDetailPanel Component
function DecisionDetailPanel({ selectedPoint, decisionDetail, loading }: {
  selectedPoint: { temp: number; hum: number } | null;
  decisionDetail: any;
  loading: boolean;
}) {
  if (!selectedPoint) {
    return (
      <div className="box p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lucide icon="Info" className="w-5 h-5 text-primary" />
          <span className="font-medium">Decision Detail</span>
        </div>
        <div className="text-center text-slate-400 py-8">
          <Lucide icon="MousePointerClick" className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Klik pada sel matrix atau gunakan simulator</p>
          <p className="text-xs mt-1">Untuk melihat detail keputusan fuzzy</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="box p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lucide icon="Info" className="w-5 h-5 text-primary" />
          <span className="font-medium">Decision Detail</span>
        </div>
        <div className="text-center py-8">
          <Lucide icon="Loader" className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-sm text-slate-500">Evaluating...</p>
        </div>
      </div>
    );
  }

  const intensity = decisionDetail?.intensity || {};
  const membership = decisionDetail?.membership || { temperature: {}, humidity: {} };

  return (
    <div className="box p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lucide icon="Brain" className="w-5 h-5 text-primary" />
        <span className="font-medium">Decision Detail</span>
      </div>

      <div className="bg-primary/5 rounded-lg p-3 mb-4">
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <Lucide icon="Target" className="w-3 h-3" />
          Input Conditions
        </div>
        <div className="text-lg font-bold flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Lucide icon="Thermometer" className="w-4 h-4 text-orange-500" />
            {selectedPoint.temp}°C
          </span>
          <span className="text-slate-300">/</span>
          <span className="flex items-center gap-1">
            <Lucide icon="Droplets" className="w-4 h-4 text-blue-500" />
            {selectedPoint.hum}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-orange-50 rounded-lg">
          <div className="text-orange-500 font-bold text-xl flex items-center justify-center gap-1">
            <Lucide icon="Flame" className="w-4 h-4" />
            {intensity.heater || 0}%
          </div>
          <div className="text-xs text-slate-500">Heater</div>
        </div>
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <div className="text-blue-500 font-bold text-xl flex items-center justify-center gap-1">
            <Lucide icon="Droplets" className="w-4 h-4" />
            {intensity.humidifier || 0}%
          </div>
          <div className="text-xs text-slate-500">Humidifier</div>
        </div>
        <div className="text-center p-2 bg-purple-50 rounded-lg">
          <div className="text-purple-500 font-bold text-xl flex items-center justify-center gap-1">
            <Lucide icon="Wind" className="w-4 h-4" />
            {intensity.fan || 0}%
          </div>
          <div className="text-xs text-slate-500">Fan</div>
        </div>
      </div>

      <div className="text-sm font-medium mb-2 flex items-center gap-2">
        <Lucide icon="ChartPie" className="w-4 h-4 text-primary" />
        Membership Values:
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex flex-wrap gap-2">
          <span className="text-slate-500 w-24">Temperature:</span>
          <span className="px-2 py-0.5 bg-blue-100 rounded flex items-center gap-1">
            <Lucide icon="Snowflake" className="w-3 h-3 text-blue-500" />
            Dingin: {((membership.temperature?.cold || 0) * 100).toFixed(0)}%
          </span>
          <span className="px-2 py-0.5 bg-green-100 rounded flex items-center gap-1">
            <Lucide icon="CircleCheck" className="w-3 h-3 text-green-500" />
            Normal: {((membership.temperature?.normal || 0) * 100).toFixed(0)}%
          </span>
          <span className="px-2 py-0.5 bg-red-100 rounded flex items-center gap-1">
            <Lucide icon="Flame" className="w-3 h-3 text-red-500" />
            Panas: {((membership.temperature?.hot || 0) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-slate-500 w-24">Humidity:</span>
          <span className="px-2 py-0.5 bg-yellow-100 rounded flex items-center gap-1">
            <Lucide icon="Sun" className="w-3 h-3 text-yellow-600" />
            Kering: {((membership.humidity?.dry || 0) * 100).toFixed(0)}%
          </span>
          <span className="px-2 py-0.5 bg-green-100 rounded flex items-center gap-1">
            <Lucide icon="CircleCheck" className="w-3 h-3 text-green-500" />
            Normal: {((membership.humidity?.normal || 0) * 100).toFixed(0)}%
          </span>
          <span className="px-2 py-0.5 bg-blue-100 rounded flex items-center gap-1">
            <Lucide icon="CloudRain" className="w-3 h-3 text-blue-500" />
            Lembab: {((membership.humidity?.humid || 0) * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default DecisionMatrixPage;