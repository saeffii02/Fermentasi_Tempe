// frontend/src/pages/components/DecisionMatrix/ThreeDSurfaceView.tsx

import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import Lucide from '@/components/Base/Lucide';
import Button from '@/components/Base/Button';
import { 
  TriangleAlert  
} from 'lucide-react';

interface ThreeDSurfaceViewProps {
  systemConfig: any;
}

type ActuatorType = 'heater' | 'humidifier' | 'fan';

function ThreeDSurfaceView({ systemConfig }: ThreeDSurfaceViewProps) {
  const [selectedActuator, setSelectedActuator] = useState<ActuatorType>('heater');
  const [loading, setLoading] = useState(true);
  const [matrixData, setMatrixData] = useState<{
    temperatures: number[];
    humidities: number[];
    heaterMatrix: number[][];
    humidifierMatrix: number[][];
    fanMatrix: number[][];
  } | null>(null);

  const temperatures = [22, 24, 26, 28, 30, 32, 34, 36, 38, 40];
  const humidities = [30, 40, 50, 60, 70, 80, 90];

  useEffect(() => {
    calculateMatrixData();
  }, [systemConfig]);

  const calculateMatrixData = () => {
    setLoading(true);
    
    const tempMin = systemConfig?.temp_min || 25;
    const tempMax = systemConfig?.temp_max || 37;
    const humMin = systemConfig?.humidity_min || 60;
    const humMax = systemConfig?.humidity_max || 80;

    const heaterMatrix: number[][] = [];
    const humidifierMatrix: number[][] = [];
    const fanMatrix: number[][] = [];

    for (const temp of temperatures) {
      const heaterRow: number[] = [];
      const humidifierRow: number[] = [];
      const fanRow: number[] = [];

      for (const hum of humidities) {
        const tempMem = calculateTemperatureMembership(temp, tempMin, tempMax);
        const humMem = calculateHumidityMembership(hum, humMin, humMax);

        heaterRow.push(calculateHeaterIntensity(tempMem));
        humidifierRow.push(calculateHumidifierIntensity(humMem));
        fanRow.push(calculateFanIntensity(tempMem, humMem));
      }

      heaterMatrix.push(heaterRow);
      humidifierMatrix.push(humidifierRow);
      fanMatrix.push(fanRow);
    }

    setMatrixData({
      temperatures,
      humidities,
      heaterMatrix,
      humidifierMatrix,
      fanMatrix
    });
    setLoading(false);
  };

  const calculateTemperatureMembership = (temp: number, min: number, max: number) => {
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
  };

  const calculateHumidityMembership = (hum: number, min: number, max: number) => {
    const domainMin = 30;
    const domainMax = 100;
    let dry = 0, normal = 0, humidVal = 0;
    if (hum <= domainMin) dry = 1;
    else if (hum >= min) dry = 0;
    else dry = (min - hum) / (min - domainMin);
    if (hum >= min && hum <= max) normal = 1;
    else if (hum < min && hum > domainMin) normal = (hum - domainMin) / (min - domainMin);
    else if (hum > max && hum < domainMax) normal = (domainMax - hum) / (domainMax - max);
    if (hum >= domainMax) humidVal = 1;
    else if (hum <= max) humidVal = 0;
    else humidVal = (hum - max) / (domainMax - max);
    return { 
      dry: Number(Math.min(1, Math.max(0, dry)).toFixed(3)), 
      normal: Number(Math.min(1, Math.max(0, normal)).toFixed(3)), 
      humid: Number(Math.min(1, Math.max(0, humidVal)).toFixed(3)) 
    };
  };

  const calculateHeaterIntensity = (tempMem: any) => {
    const numerator = tempMem.cold * 100 + tempMem.normal * 0 + tempMem.hot * 0;
    const denominator = tempMem.cold + tempMem.normal + tempMem.hot;
    if (denominator === 0) return 0;
    return Math.min(100, Math.max(0, Math.round(numerator / denominator)));
  };

  const calculateHumidifierIntensity = (humMem: any) => {
    const numerator = humMem.dry * 100 + humMem.normal * 0 + humMem.humid * 0;
    const denominator = humMem.dry + humMem.normal + humMem.humid;
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
    const numerator = alpha1 * z1 + alpha2 * z2 + alpha3 * z3 + alpha4 * z4 + alpha5 * z5 + alpha6 * z6;
    const denominator = alpha1 + alpha2 + alpha3 + alpha4 + alpha5 + alpha6;
    if (denominator === 0) return 0;
    return Math.min(100, Math.max(0, Math.round(numerator / denominator)));
  };

  const getCurrentMatrix = () => {
    if (!matrixData) return [];
    switch (selectedActuator) {
      case 'heater': return matrixData.heaterMatrix;
      case 'humidifier': return matrixData.humidifierMatrix;
      case 'fan': return matrixData.fanMatrix;
      default: return matrixData.heaterMatrix;
    }
  };

  const getColorscale = () => {
    switch (selectedActuator) {
      case 'heater': return 'YlOrRd';
      case 'humidifier': return 'Blues';
      case 'fan': return 'PuRd';
      default: return 'Viridis';
    }
  };

  const getTitle = () => {
    switch (selectedActuator) {
      case 'heater': return 'Fuzzy Decision Surface - Heater Intensity';
      case 'humidifier': return 'Fuzzy Decision Surface - Humidifier Intensity';
      case 'fan': return 'Fuzzy Decision Surface - Fan Intensity';
      default: return 'Fuzzy Decision Surface';
    }
  };

  if (loading) {
    return (
      <div className="box p-5 text-center">
        <Lucide icon="Loader" className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="mt-2 text-slate-500">Calculating decision surface...</p>
      </div>
    );
  }

  if (!matrixData) {
    return (
      <div className="box p-5 text-center text-slate-500">
        <Lucide icon="TriangleAlert" className="w-8 h-8 mx-auto mb-2" />
        <p>Failed to load decision matrix data</p>
      </div>
    );
  }

  // Plot data dengan type assertion untuk menghindari TypeScript error
  const plotData = {
    z: getCurrentMatrix(),
    x: matrixData.humidities,
    y: matrixData.temperatures,
    type: 'surface' as const,
    colorscale: getColorscale(),
    showscale: true,
    colorbar: {
      title: 'Intensity (%)',
      thickness: 20,
      len: 0.7,
    },
    contours: {
      z: {
        show: true,
        usecolormap: true,
        highlightcolor: 'limegreen',
        project: {
          z: true
        }
      }
    },
    opacity: 0.9,
    lighting: {
      ambient: 0.6,
      diffuse: 0.8,
      specular: 0.5,
      roughness: 0.5
    },
    lightposition: {
      x: 100,
      y: 200,
      z: 300
    }
  };

  const plotLayout = {
    title: {
      text: getTitle(),
      font: { size: 14, family: 'Inter, sans-serif' }
    },
    scene: {
      xaxis: { 
        title: {
          text: 'Humidity (%)',
          font: { size: 12 }
        },
        gridcolor: '#e2e8f0',
        showbackground: true,
        backgroundcolor: 'rgba(255,255,255,0.9)',
        range: [25, 105]
      },
      yaxis: { 
        title: {
          text: 'Temperature (°C)',
          font: { size: 12 }
        },
        gridcolor: '#e2e8f0',
        range: [20, 45]
      },
      zaxis: { 
        title: {
          text: 'Intensity (%)',
          font: { size: 12 }
        },
        range: [0, 100],
        gridcolor: '#e2e8f0'
      },
      camera: {
        eye: { x: 1.8, y: 1.8, z: 1.5 },
        center: { x: 0, y: 0, z: 0 }
      },
      aspectratio: { x: 1.2, y: 1, z: 0.8 }
    },
    margin: { l: 0, r: 0, t: 50, b: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    autosize: true
  };

  const plotConfig = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    displaylogo: false,
    toImageButtonOptions: {
      format: 'png' as const,
      filename: `fuzzy_3d_surface_${selectedActuator}`,
      height: 600,
      width: 800,
      scale: 2
    }
  };

  return (
    <div className="box p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Lucide icon="Box" className="w-5 h-5 text-primary" />
          <span className="font-medium">3D Decision Surface Visualization</span>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={selectedActuator === 'heater' ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => setSelectedActuator('heater')}
            className="flex items-center gap-1"
          >
            <Lucide icon="Flame" className="w-3 h-3" />
            Heater
          </Button>
          <Button
            variant={selectedActuator === 'humidifier' ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => setSelectedActuator('humidifier')}
            className="flex items-center gap-1"
          >
            <Lucide icon="Droplets" className="w-3 h-3" />
            Humidifier
          </Button>
          <Button
            variant={selectedActuator === 'fan' ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => setSelectedActuator('fan')}
            className="flex items-center gap-1"
          >
            <Lucide icon="Fan" className="w-3 h-3" />
            Fan
          </Button>
        </div>
      </div>

      {systemConfig && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-slate-500">Target Range:</span>
            <span className="text-orange-600">
              🌡️ Suhu: {systemConfig.temp_min}°C - {systemConfig.temp_max}°C
            </span>
            <span className="text-blue-600">
              💧 Kelembaban: {systemConfig.humidity_min}% - {systemConfig.humidity_max}%
            </span>
          </div>
        </div>
      )}

      {/* 3D Surface Plot - Menggunakan type assertion untuk mengatasi TypeScript error */}
      <div style={{ width: '100%', height: '550px' }}>
        <Plot
          data={[plotData as any]}
          layout={plotLayout as any}
          config={plotConfig as any}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
        />
      </div>

      <div className="mt-4 p-3 bg-primary/5 rounded-lg text-xs text-slate-600">
        <div className="flex items-center gap-2 mb-2">
          <Lucide icon="Info" className="w-3 h-3" />
          <span className="font-medium">Interpretasi 3D Surface Plot:</span>
        </div>
        <p>
          Plot 3D ini menunjukkan permukaan keputusan fuzzy untuk <strong>{selectedActuator === 'heater' ? 'Heater' : selectedActuator === 'humidifier' ? 'Humidifier' : 'Fan'}</strong>. 
          Sumbu X adalah Kelembaban (%), sumbu Y adalah Suhu (°C), dan sumbu Z adalah Intensitas Output (0-100%).
          Warna yang lebih hangat (oranye/merah) menunjukkan intensitas yang lebih tinggi.
          Plot dapat di-<strong>drag</strong> untuk melihat dari berbagai sudut, dan di-<strong>zoom</strong> untuk detail.
        </p>
      </div>
    </div>
  );
}

export default ThreeDSurfaceView;