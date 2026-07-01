// frontend/src/pages/ActuatorControl/index.tsx

import Lucide from "@/components/Base/Lucide";
import Button from "@/components/Base/Button";
import { FormSwitch } from "@/components/Base/Form";
import { useState, useEffect, useCallback, useRef } from "react";
import { iotService, setupWebSocket } from "@/services/iotService";

function Main() {
  // ================= DEVICE STATE =================
  const [heaterEnabled, setHeaterEnabled] = useState(true);
  const [humidifierEnabled, setHumidifierEnabled] = useState(true);
  const [fanEnabled, setFanEnabled] = useState(true);

  // ================= INTENSITY =================
  const [heaterIntensity, setHeaterIntensity] = useState(0);
  const [humidifierIntensity, setHumidifierIntensity] = useState(0);
  const [fanIntensity, setFanIntensity] = useState(0);

  // ================= ACTUAL DEVICE STATE (DARI ESP) =================
  const [actualHeaterState, setActualHeaterState] = useState(false);
  const [actualHumidifierState, setActualHumidifierState] = useState(false);
  const [actualFanState, setActualFanState] = useState(false);
  const [actualMode, setActualMode] = useState("AUTO");
  const [fuzzyResult, setFuzzyResult] = useState<any>(null);

  // ================= RANGE (DARI BACKEND) =================
  const [tempMin, setTempMin] = useState(25.0);
  const [tempMax, setTempMax] = useState(37.0);
  const [humidityMin, setHumidityMin] = useState(60);
  const [humidityMax, setHumidityMax] = useState(70);
  const [autoMode, setAutoMode] = useState(true);
  
  // ================= RANGE EDIT STATE =================
  const [isEditingTemp, setIsEditingTemp] = useState(false);
  const [isEditingHumidity, setIsEditingHumidity] = useState(false);
  const [tempMinEdit, setTempMinEdit] = useState(25.0);
  const [tempMaxEdit, setTempMaxEdit] = useState(37.0);
  const [humidityMinEdit, setHumidityMinEdit] = useState(60);
  const [humidityMaxEdit, setHumidityMaxEdit] = useState(70);
  const [isSaving, setIsSaving] = useState(false);

  // ================= SENSOR =================
  const [temperature, setTemperature] = useState(28.4);
  const [humidity, setHumidity] = useState(72);

  // ================= SENSOR INTERVAL =================
  const [sensorInterval, setSensorInterval] = useState(3);
  const [isEditingInterval, setIsEditingInterval] = useState(false);
  const [sensorIntervalEdit, setSensorIntervalEdit] = useState(3);

  // ================= MEMBERSHIP =================
  const [tempMembership, setTempMembership] = useState({
    cold: 0,
    normal: 1,
    hot: 0
  });

  const [humidityMembership, setHumidityMembership] = useState({
    dry: 0,
    normal: 1,
    humid: 0
  });

  // ================= MQTT STATUS =================
  const [mqttStatus, setMqttStatus] = useState("CONNECTED");
  const [configStatus, setConfigStatus] = useState<string | null>(null);
  
  // ================= CAMERA STATE =================
  const [cameraIp, setCameraIp] = useState("192.168.1.12");
  const [cameraPort, setCameraPort] = useState(8080);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'disconnected'>('idle');
  const [streamUrl, setStreamUrl] = useState("");
  const [fps, setFps] = useState(0);

  const imgRef = useRef<HTMLImageElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const checkingCameraRef = useRef(false);
  const CAMERA_API = "http://localhost:3000/api/camera";

  const MAX_RETRIES = 10;

  
  // ================= DEBOUNCE TIMER =================
  const controlTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ================= GLASSMORPHISM UTILITY =================
  const glassStyle = (dark: boolean = false) => `
    backdrop-blur-xl 
    bg-opacity-20
    border 
    ${dark 
      ? 'bg-white/10 border-white/10' 
      : 'bg-white/30 border-white/40'
    }
    shadow-[0_8px_32px_rgba(0,0,0,0.12)]
  `;

  // =========================================================
  // ================= LOAD CONFIG FROM BACKEND ==============
  // =========================================================
  
  const loadSystemConfig = async () => {
    try {
      const config = await iotService.getSystemConfig();
      setTempMin(config.temp_min);
      setTempMax(config.temp_max);
      setHumidityMin(config.humidity_min);
      setHumidityMax(config.humidity_max);
      setAutoMode(config.auto_mode);
      setSensorInterval(config.sensor_interval);
      setSensorInterval(config.sensor_interval || 3);
      setTempMinEdit(config.temp_min);
      setTempMaxEdit(config.temp_max);
      setHumidityMinEdit(config.humidity_min);
      setHumidityMaxEdit(config.humidity_max);
      
      console.log('Config loaded:', config);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };
  
  const saveSystemConfig = async () => {
    setIsSaving(true);
    setConfigStatus(null);
    
    try {
      if (tempMinEdit >= tempMaxEdit) {
        setConfigStatus('ERROR: Min temperature must be less than Max temperature');
        setIsSaving(false);
        return;
      }
      
      if (humidityMinEdit >= humidityMaxEdit) {
        setConfigStatus('ERROR: Min humidity must be less than Max humidity');
        setIsSaving(false);
        return;
      }

      if (sensorIntervalEdit < 3 || sensorIntervalEdit > 120) {
        setConfigStatus('ERROR: Sensor interval must be between 3 and 120 seconds');
        setIsSaving(false);
        return;
      }
      
      await iotService.updateSystemConfig({
        temp_min: tempMinEdit,
        temp_max: tempMaxEdit,
        humidity_min: humidityMinEdit,
        humidity_max: humidityMaxEdit,
        auto_mode: autoMode,
        sensor_interval: sensorIntervalEdit,
      });
      
      setTempMin(tempMinEdit);
      setTempMax(tempMaxEdit);
      setHumidityMin(humidityMinEdit);
      setHumidityMax(humidityMaxEdit);
      setSensorInterval(sensorIntervalEdit);
      
      await iotService.sendConfigToDevice();
      
      setConfigStatus('SUCCESS: Configuration saved and sent to device!');
      setIsEditingTemp(false);
      setIsEditingHumidity(false);
      
      setTimeout(() => setConfigStatus(null), 3000);
      
    } catch (err) {
      console.error('Failed to save config:', err);
      setConfigStatus('ERROR: Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };
  
  const cancelEditTemp = () => {
    setTempMinEdit(tempMin);
    setTempMaxEdit(tempMax);
    setIsEditingTemp(false);
  };
  
  const cancelEditHumidity = () => {
    setHumidityMinEdit(humidityMin);
    setHumidityMaxEdit(humidityMax);
    setIsEditingHumidity(false);
  };

  // =========================================================
  // ================= CAMERA FUNCTIONS =====================
  // =========================================================

  const setupCameraStream = useCallback(() => {
    if (!mountedRef.current) return;

    const url = `http://${cameraIp}:${cameraPort}/stream?t=${Date.now()}`;

    console.log("📹 Membuka stream kamera:", url);

    setCameraConnected(false);
    setCameraStatus("connecting");
    setIsLoadingCamera(true);
    setCameraError(null);
    setStreamUrl(url);
  }, [cameraIp, cameraPort]);

  const handleImageError = useCallback(() => {
    if (!mountedRef.current) return;

    console.error("❌ Stream kamera gagal dimuat");

    setIsLoadingCamera(false);
    setCameraConnected(false);
    setCameraStatus("error");
    setCameraError("⚠️ Gagal memuat stream ESP32-CAM. Pastikan http://192.168.1.12:8080/stream bisa dibuka di browser.");

    if (retryCountRef.current < MAX_RETRIES) {
      retryCountRef.current++;

      const delay = Math.min(
        1000 * Math.pow(1.5, retryCountRef.current),
        10000
      );

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setupCameraStream();
        }
      }, delay);
    } else {
      setCameraStatus("disconnected");
      setCameraError(
        "❌ Stream gagal setelah beberapa percobaan. ESP32-CAM kemungkinan belum aktif, IP salah, atau browser memblokir akses HTTP."
      );
    }
  }, [setupCameraStream]);

  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return;

    console.log("✅ Stream kamera berhasil dimuat");

    setIsLoadingCamera(false);
    setCameraConnected(true);
    setCameraError(null);
    setCameraStatus("connected");
    retryCountRef.current = 0;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    retryCountRef.current = 0;

    // Langsung buka stream, tidak menunggu backend /status
    setupCameraStream();

    return () => {
      mountedRef.current = false;

      abortControllerRef.current?.abort();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (imgRef.current) {
        imgRef.current.src = "";
      }
    };
  }, [setupCameraStream]);

  const handleReconnect = useCallback(() => {
    if (!mountedRef.current) return;

    retryCountRef.current = 0;
    setCameraError(null);
    setCameraStatus("connecting");

    setupCameraStream();
  }, [setupCameraStream]);


  // =========================================================
  // ================= FETCH SENSOR REALTIME =================
  // =========================================================

  useEffect(() => {
    loadCurrentData();
    loadSystemConfig();

    const cleanup = setupWebSocket((data: any) => {
      console.log("Realtime Sensor:", data);
      
      if (data.type === "temperature" || data.temperature !== undefined) {
        setTemperature(Number(data.temperature || data.value));
      }
      
      if (data.type === "humidity" || data.humidity !== undefined) {
        setHumidity(Number(data.humidity || data.value));
      }
      
      if (data.type === "CONFIG_ACK") {
        setConfigStatus('SUCCESS: Device acknowledged new configuration');
        setTimeout(() => setConfigStatus(null), 3000);
      }
      
      // Update actual device states from ESP
      if (data.heater !== undefined) {
        setActualHeaterState(data.heater === 1 || data.heater === true);
      }

      if (data.humidifier !== undefined) {
        setActualHumidifierState(data.humidifier === 1 || data.humidifier === true);
      }

      if (data.fan !== undefined) {
        setActualFanState(data.fan === 1 || data.fan === true);
      }

      if (data.mode !== undefined) {
        setActualMode(data.mode);
      }

      if (data.fuzzy) {
        setFuzzyResult(data.fuzzy);

        if (data.fuzzy.membership?.temperature) {
          setTempMembership(data.fuzzy.membership.temperature);
        }

        if (data.fuzzy.membership?.humidity) {
          setHumidityMembership(data.fuzzy.membership.humidity);
        }

        if (data.fuzzy.intensity) {
          setHeaterIntensity(data.fuzzy.intensity.heater || 0);
          setHumidifierIntensity(data.fuzzy.intensity.humidifier || 0);
          setFanIntensity(data.fuzzy.intensity.fan || 0);
        }
      }

      if (data.type === 'FUZZY_UPDATE') {
        setFuzzyResult(data);

        if (data.membership?.temperature) {
          setTempMembership(data.membership.temperature);
        }

        if (data.membership?.humidity) {
          setHumidityMembership(data.membership.humidity);
        }

        if (data.intensity) {
          setHeaterIntensity(data.intensity.heater || 0);
          setHumidifierIntensity(data.intensity.humidifier || 0);
          setFanIntensity(data.intensity.fan || 0);
        }

        if (data.actuator) {
          setActualHeaterState(data.actuator.heater === 1);
          setActualHumidifierState(data.actuator.humidifier === 1);
          setActualFanState(data.actuator.fan === 1);
        }
      }
    });

    const interval = setInterval(() => {
      loadCurrentData();
    }, 10000);

    return () => {
      cleanup?.();
      clearInterval(interval);
    };
  }, []);

  const loadCurrentData = async () => {
    try {
      const current = await iotService.getCurrentReadings();
      if (current.temperature !== undefined) {
        setTemperature(Number(current.temperature));
      }
      if (current.humidity !== undefined) {
        setHumidity(Number(current.humidity));
      }
      setMqttStatus("CONNECTED");
    } catch (err) {
      console.error(err);
      setMqttStatus("DISCONNECTED");
    }
  };

  const sendManualActuatorCommand = useCallback(async (
    actuator: 'heater' | 'humidifier' | 'fan',
    state: boolean
  ) => {
    try {
      await iotService.controlDevice({
        actuator,
        state,
        mode: 'MANUAL'
      });

      if (actuator === 'heater') {
        setHeaterEnabled(state);
        setActualHeaterState(state);
        setHeaterIntensity(state ? 100 : 0);
      }

      else if (actuator === 'humidifier') {
        setHumidifierEnabled(state);
        setActualHumidifierState(state);
        setHumidifierIntensity(state ? 100 : 0);
      }

      else if (actuator === 'fan') {
        setFanEnabled(state);
        setActualFanState(state);
        setFanIntensity(state ? 100 : 0);
      }

      console.log(`MANUAL COMMAND: ${actuator} -> ${state ? 'ON' : 'OFF'}`);

    } catch (err) {
      console.error(`Manual control error for ${actuator}:`, err);
      setConfigStatus(`ERROR: Failed to control ${actuator}`);
      setTimeout(() => setConfigStatus(null), 3000);
    }
  }, []);

  const handleAutoModeChange = useCallback(async (checked: boolean) => {
    try {
      setAutoMode(checked);
      setActualMode(checked ? 'AUTO' : 'MANUAL');

      await iotService.updateSystemConfig({
        temp_min: tempMin,
        temp_max: tempMax,
        humidity_min: humidityMin,
        humidity_max: humidityMax,
        auto_mode: checked
      });

      await iotService.sendConfigToDevice();

      await iotService.controlDevice({
        actuator: 'auto',
        state: checked,
        mode: checked ? 'AUTO' : 'MANUAL'
      });

      if (!checked) {
        await sendManualActuatorCommand('heater', false);
        await sendManualActuatorCommand('humidifier', false);
        await sendManualActuatorCommand('fan', false);

        setHeaterEnabled(false);
        setHumidifierEnabled(false);
        setFanEnabled(false);

        setHeaterIntensity(0);
        setHumidifierIntensity(0);
        setFanIntensity(0);

        setFuzzyResult(null);
      }

      setConfigStatus(
        checked
          ? 'SUCCESS: Auto mode aktif, fuzzy Tsukamoto berjalan di backend'
          : 'SUCCESS: Manual mode aktif, aktuator dapat dikontrol manual'
      );

      setTimeout(() => setConfigStatus(null), 3000);

    } catch (err) {
      console.error('Failed to change mode:', err);
      setConfigStatus('ERROR: Failed to change control mode');
      setTimeout(() => setConfigStatus(null), 3000);
    }
  }, [
    tempMin,
    tempMax,
    humidityMin,
    humidityMax,
    sendManualActuatorCommand
  ]);

  // =========================================================
  // ================= STATUS HELPERS ========================
  // =========================================================

  const getTemperatureStatus = useCallback(() => {
    if (temperature < tempMin) {
      return {
        label: "Dingin",
        color: "text-blue-500",
        bg: "bg-blue-100"
      };
    }
    if (temperature > tempMax) {
      return {
        label: "Panas",
        color: "text-red-500",
        bg: "bg-red-100"
      };
    }
    return {
      label: "Normal",
      color: "text-green-500",
      bg: "bg-green-100"
    };
  }, [temperature, tempMin, tempMax]);

  const getHumidityStatus = useCallback(() => {
    if (humidity < humidityMin) {
      return {
        label: "Kering",
        color: "text-yellow-600",
        bg: "bg-yellow-100"
      };
    }
    if (humidity > humidityMax) {
      return {
        label: "Lembab",
        color: "text-blue-600",
        bg: "bg-blue-100"
      };
    }
    return {
      label: "Normal",
      color: "text-green-500",
      bg: "bg-green-100"
    };
  }, [humidity, humidityMin, humidityMax]);

  const tempStatus = getTemperatureStatus();
  const humidityStatus = getHumidityStatus();
  
  // =========================================================
  // ================= RENDER COMPONENT ======================
  // =========================================================
  
  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
      {/* Header Section */}
      <div className="col-span-12">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-medium group-[.mode--light]:text-white">
              Actuator Control & Live Monitoring
            </div>
            <div className="text-sm text-slate-500 group-[.mode--light]:text-white">
              Intelligent environmental control using Tsukamoto fuzzy inference method.
            </div>
          </div>
          <div className="flex gap-3">
            {/* MQTT Status - Glassmorphism dengan theme-aware */}
            <div className={`
              px-4 py-2 rounded-full text-sm font-medium
              backdrop-blur-xl bg-opacity-20 border shadow-[0_8px_32px_rgba(0,0,0,0.12)]
              ${mqttStatus === "CONNECTED" 
                ? 'bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-400' 
                : 'bg-red-500/20 border-red-500/30 text-red-600 dark:text-red-400'
              }
              group-[.mode--light]:bg-white/20 
              group-[.mode--light]:border-white/30 
              group-[.mode--light]:text-white
              flex items-center gap-2 transition-all duration-300 hover:scale-105
            `}>
              <span className={`
                inline-block w-2 h-2 rounded-full animate-pulse
                ${mqttStatus === "CONNECTED" ? 'bg-green-500' : 'bg-red-500'}
                group-[.mode--light]:bg-white
              `}></span>
              <Lucide icon="Wifi" className="w-4 h-4" />
              MQTT: {mqttStatus}
            </div>

            {/* Mode Status - Glassmorphism dengan theme-aware */}
            <div className={`
              px-4 py-2 rounded-full text-sm font-medium
              backdrop-blur-xl bg-opacity-20 border shadow-[0_8px_32px_rgba(0,0,0,0.12)]
              ${autoMode 
                ? 'bg-primary/20 border-primary/30 text-primary' 
                : 'bg-slate-500/20 border-slate-500/30 text-slate-600 dark:text-slate-400'
              }
              group-[.mode--light]:bg-white/20 
              group-[.mode--light]:border-white/30 
              group-[.mode--light]:text-white
              flex items-center gap-2 transition-all duration-300 hover:scale-105
            `}>
              <span className={`
                inline-block w-2 h-2 rounded-full animate-pulse
                ${autoMode ? 'bg-primary' : 'bg-slate-500'}
                group-[.mode--light]:bg-white
              `}></span>
              <Lucide icon={autoMode ? "Cpu" : "Settings"} className="w-4 h-4" />
              {autoMode ? "AUTO MODE" : "MANUAL MODE"}
            </div>
          </div>
        </div>
      </div>

      {/* Config Status Message */}
      {configStatus && (
        <div className="col-span-12">
          <div className={`p-3 rounded-lg ${
            configStatus.startsWith('SUCCESS') 
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              <Lucide icon={configStatus.startsWith('SUCCESS') ? 'CheckCircle' : 'AlertCircle'} className="w-5 h-5" />
              <span>{configStatus}</span>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar dengan sensor real-time */}
      <div className="col-span-12">
        <div className="flex items-center gap-4 bg-gradient-to-r from-slate-100 to-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${autoMode ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            <span className="font-semibold text-sm">{autoMode ? "FUZZY ACTIVE" : "MANUAL MODE"}</span>
          </div>
          <div className="text-sm text-slate-600">Fermentation Room 1</div>
          <div className="flex items-center gap-4 ml-4">
            <div className="flex items-center gap-2">
              <Lucide icon="Thermometer" className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">{temperature.toFixed(1)}°C</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${tempStatus.bg} ${tempStatus.color}`}>
                {tempStatus.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Lucide icon="Droplets" className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">{humidity.toFixed(0)}%</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${humidityStatus.bg} ${humidityStatus.color}`}>
                {humidityStatus.label}
              </span>
            </div>
          </div>
          <div className="text-sm text-slate-400 ml-auto">
            {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, {new Date().toLocaleTimeString('id-ID')}
          </div>
          <div className="flex items-center gap-1 bg-success/20 text-success px-3 py-1 rounded-full text-sm">
            <Lucide icon="Activity" className="w-4 h-4" />
            <span>FLC Running</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="col-span-12 grid grid-cols-12 gap-6">
        {/* Left Column - Camera Feed */}
        <div className="col-span-12 lg:col-span-7">
          <div className="box box--stacked p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Camera Feed Active - ESP32-CAM</div>
              <div className="flex gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${cameraConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className={`w-2 h-2 rounded-full ${cameraConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className={`w-2 h-2 rounded-full ${cameraConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
            </div>
            
            {/* Camera Feed */}
            <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">

              {/* Image stream tetap dirender selama streamUrl ada */}
              {streamUrl && (
                <img
                  ref={imgRef}
                  src={streamUrl}
                  alt="ESP32-CAM Feed"
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    cameraConnected && cameraStatus === "connected" ? "opacity-100" : "opacity-40"
                  }`}
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                />
              )}

              {/* Loading overlay, bukan mengganti img */}
              {(isLoadingCamera || cameraStatus === "connecting") && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/70 z-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                  <p className="text-slate-300 mt-4">Menghubungkan ke kamera...</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Percobaan {retryCountRef.current + 1}/{MAX_RETRIES}
                  </p>
                </div>
              )}

              {/* Error overlay */}
              {(cameraError || cameraStatus === "error" || cameraStatus === "disconnected") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/95 z-20">
                  <Lucide icon="CameraOff" className="w-16 h-16 text-slate-500 mb-4" />
                  <p className="text-slate-400 text-center px-4 max-w-md">{cameraError}</p>

                  <p className="text-xs text-slate-500 mt-2">
                    Percobaan {retryCountRef.current}/{MAX_RETRIES}
                  </p>

                  <div className="mt-4 flex flex-col gap-2 items-center">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cameraIp}
                        onChange={(e) => setCameraIp(e.target.value)}
                        placeholder="Alamat IP ESP32-CAM"
                        className="px-3 py-1 text-sm bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-primary"
                        disabled={isLoadingCamera}
                      />
                      <input
                        type="number"
                        value={cameraPort}
                        onChange={(e) => setCameraPort(parseInt(e.target.value) || 8080)}
                        placeholder="Port"
                        className="px-3 py-1 text-sm bg-slate-700 text-white rounded border border-slate-600 w-20 focus:outline-none focus:border-primary"
                        disabled={isLoadingCamera}
                      />
                    </div>

                    <Button
                      size="sm"
                      onClick={handleReconnect}
                      className="bg-primary text-white hover:bg-primary/90"
                      disabled={isLoadingCamera}
                    >
                      <Lucide icon={isLoadingCamera ? "Loader" : "RefreshCw"} className="w-4 h-4 mr-1" />
                      {isLoadingCamera ? "Menghubungkan..." : "Hubungkan"}
                    </Button>
                  </div>

                  <p className="text-xs text-slate-500 mt-3">
                    Default: 192.168.1.12:8080
                  </p>
                </div>
              )}

              {/* Indikator status kamera */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm z-30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Lucide icon="Cpu" className="w-4 h-4" />
                    <span>ESP32-CAM</span>
                  </div>

                  <span className="text-slate-400">|</span>

                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      cameraConnected && cameraStatus === "connected"
                        ? "bg-green-500 animate-pulse"
                        : cameraStatus === "connecting"
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-red-500"
                    }`}></span>
                    <span className="text-xs">
                      {cameraStatus === "connected" ? "LIVE" :
                      cameraStatus === "connecting" ? "CONNECTING" :
                      cameraStatus === "error" ? "ERROR" : "OFFLINE"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm z-30">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">📍</span>
                  <span className="text-xs">{cameraIp}:{cameraPort}</span>
                </div>
              </div>

              {/* Aktuator status overlay */}
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm z-30">
                <div className="flex gap-3">
                  <span className={actualHeaterState ? "text-orange-400" : "text-slate-400"}>
                    🔥 {actualHeaterState ? "ON" : "OFF"}
                  </span>
                  <span className={actualHumidifierState ? "text-blue-400" : "text-slate-400"}>
                    💧 {actualHumidifierState ? "ON" : "OFF"}
                  </span>
                  <span className={actualFanState ? "text-purple-400" : "text-slate-400"}>
                    🌀 {actualFanState ? "ON" : "OFF"}
                  </span>
                </div>
              </div>

              <div className="absolute bottom-4 right-4 flex gap-3 z-30">
                <Button
                  className="bg-black/50 hover:bg-black/70 text-white border-0 rounded-full w-10 h-10 p-0"
                  onClick={() => window.open(`http://${cameraIp}:${cameraPort}/stream`, "_blank")}
                  title="Buka Stream di Jendela Baru"
                >
                  <Lucide icon="Maximize" className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Camera Status Info */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-xs text-slate-500">Resolution</div>
                <div className="font-medium">QVGA (320x240)</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500">Frame Rate</div>
                <div className="font-medium">~30 fps</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500">Camera IP</div>
                <div className="font-medium text-primary">{cameraIp}:8080</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500">Status</div>
                <div className={`font-medium ${cameraConnected ? 'text-green-500' : 'text-red-500'}`}>
                  {cameraConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Actuator Controls with Fuzzy Logic */}
        <div className="col-span-12 lg:col-span-5">
          <div className="box box--stacked p-5 h-full overflow-y-auto max-h-[calc(100vh-200px)]">
            <div className="text-lg font-semibold mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lucide icon="Brain" className="w-5 h-5 text-primary" />
                Fuzzy Logic Actuator Control
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Auto Mode</span>
                <FormSwitch className="w-12 h-6">
                  <FormSwitch.Input 
                    type="checkbox" 
                    checked={autoMode}
                    onChange={(e) => handleAutoModeChange(e.target.checked)}
                  />
                </FormSwitch>
              </div>
            </div>
            
            {/* Main Heater - Fuzzy Control */}
            <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-white rounded-xl border border-orange-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Lucide icon="Flame" className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <div className="font-semibold">Main Heater</div>
                    <div className="text-xs text-slate-500">Fuzzy temperature regulation</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {actualHeaterState ? "RUNNING" : "IDLE"}
                  </span>
                  <FormSwitch className="w-12 h-6">
                    <FormSwitch.Input 
                      type="checkbox" 
                      checked={autoMode ? actualHeaterState : heaterEnabled}
                      onChange={(e) => {
                        if (!autoMode) {
                          sendManualActuatorCommand('heater', e.target.checked);
                        }
                      }}
                      disabled={autoMode}
                    />
                  </FormSwitch>
                </div>
              </div>
              
              {/* Normal Range Settings - EDITABLE */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-slate-500">Normal Temperature Range</div>
                  {!isEditingTemp ? (
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="text-xs py-1 px-2"
                      onClick={() => setIsEditingTemp(true)}
                    >
                      <Lucide icon="Pencil" className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button 
                        size="sm"
                        className="text-xs py-1 px-2 bg-green-500 text-white"
                        onClick={saveSystemConfig}
                        disabled={isSaving}
                      >
                        <Lucide icon="Check" className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm"
                        className="text-xs py-1 px-2 bg-red-500 text-white"
                        onClick={cancelEditTemp}
                      >
                        <Lucide icon="X" className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {isEditingTemp ? (
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-slate-400">Min (°C)</label>
                      <input 
                        type="number" 
                        step="0.5"
                        value={tempMinEdit}
                        onChange={(e) => setTempMinEdit(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-400">Max (°C)</label>
                      <input 
                        type="number" 
                        step="0.5"
                        value={tempMaxEdit}
                        onChange={(e) => setTempMaxEdit(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-center py-2 bg-slate-50 rounded-lg">
                          {tempMin}°C
                        </div>
                      </div>
                      <div className="text-slate-400">to</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-center py-2 bg-slate-50 rounded-lg">
                          {tempMax}°C
                        </div>
                      </div>
                    </div>
                    <div className="relative mt-3 h-2 bg-slate-200 rounded-full">
                      <div className="absolute h-full bg-green-500 rounded-full" style={{ left: `${((tempMin - 20) / 25) * 100}%`, right: `${100 - ((tempMax - 20) / 25) * 100}%` }}></div>
                      <div className="absolute w-3 h-3 bg-primary rounded-full -top-0.5 cursor-pointer" style={{ left: `${((temperature - 20) / 25) * 100}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>20°C</span>
                      <span>Current: {temperature.toFixed(1)}°C</span>
                      <span>45°C</span>
                    </div>
                  </>
                )}
              </div>

              {/* Membership Degrees */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                <div className="bg-blue-50 p-2 rounded-lg">
                  <div className="text-blue-600">Dingin</div>
                  <div className="font-bold">{(tempMembership.cold * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-green-50 p-2 rounded-lg">
                  <div className="text-green-600">Normal</div>
                  <div className="font-bold">{(tempMembership.normal * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-red-50 p-2 rounded-lg">
                  <div className="text-red-600">Panas</div>
                  <div className="font-bold">{(tempMembership.hot * 100).toFixed(0)}%</div>
                </div>
              </div>

              {/* Fuzzy Action & Intensity */}
              <div className="mt-3 p-3 bg-orange-100/30 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Fuzzy Output:</span>
                  <span className="text-primary font-bold">{heaterIntensity}% Power</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${heaterIntensity}%` }}
                  ></div>
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  {tempMembership.cold > 0.3 ? (
                    <>
                      <Lucide icon="Flame" className="w-3.5 h-3.5 text-orange-500" />
                      <span>Rule: Suhu <span className="font-medium text-blue-500">{tempStatus.label.toLowerCase()}</span> → Pemanasan <span className="font-medium text-orange-500">{heaterIntensity}%</span></span>
                    </>
                  ) : tempMembership.hot > 0.3 ? (
                    <>
                      <Lucide icon="Thermometer" className="w-3.5 h-3.5 text-red-500" />
                      <span>Rule: Suhu <span className="font-medium text-red-500">{tempStatus.label.toLowerCase()}</span> → Heater mati (0%)</span>
                    </>
                  ) : (
                    <>
                      <Lucide icon="CheckCircle" className="w-3.5 h-3.5 text-green-500" />
                      <span>Rule: Suhu <span className="font-medium text-green-500">normal</span> → Heater idle</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Humidifier Unit - Fuzzy Control */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-white rounded-xl border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Lucide icon="Droplets" className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="font-semibold">Humidifier Unit</div>
                    <div className="text-xs text-slate-500">Fuzzy humidity regulation</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {actualHumidifierState ? "RUNNING" : "IDLE"}
                  </span>
                  <FormSwitch className="w-12 h-6">
                    <FormSwitch.Input 
                      type="checkbox" 
                      checked={autoMode ? actualHumidifierState : humidifierEnabled}
                      onChange={(e) => {
                        if (!autoMode) {
                          sendManualActuatorCommand('humidifier', e.target.checked);
                        }
                      }}
                      disabled={autoMode} 
                    />
                  </FormSwitch>
                </div>
              </div>
              
              {/* Normal Range Settings - EDITABLE */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-slate-500">Normal Humidity Range</div>
                  {!isEditingHumidity ? (
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="text-xs py-1 px-2"
                      onClick={() => setIsEditingHumidity(true)}
                    >
                      <Lucide icon="Pencil" className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button 
                        size="sm"
                        className="text-xs py-1 px-2 bg-green-500 text-white"
                        onClick={saveSystemConfig}
                        disabled={isSaving}
                      >
                        <Lucide icon="Check" className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm"
                        className="text-xs py-1 px-2 bg-red-500 text-white"
                        onClick={cancelEditHumidity}
                      >
                        <Lucide icon="X" className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {isEditingHumidity ? (
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-slate-400">Min (%)</label>
                      <input 
                        type="number" 
                        step="5"
                        value={humidityMinEdit}
                        onChange={(e) => setHumidityMinEdit(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-400">Max (%)</label>
                      <input 
                        type="number" 
                        step="5"
                        value={humidityMaxEdit}
                        onChange={(e) => setHumidityMaxEdit(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-center py-2 bg-slate-50 rounded-lg">
                          {humidityMin}%
                        </div>
                      </div>
                      <div className="text-slate-400">to</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-center py-2 bg-slate-50 rounded-lg">
                          {humidityMax}%
                        </div>
                      </div>
                    </div>
                    <div className="relative mt-3 h-2 bg-slate-200 rounded-full">
                      <div className="absolute h-full bg-green-500 rounded-full" style={{ left: `${(humidityMin - 30) / 70 * 100}%`, right: `${100 - ((humidityMax - 30) / 70 * 100)}%` }}></div>
                      <div className="absolute w-3 h-3 bg-primary rounded-full -top-0.5 cursor-pointer" style={{ left: `${((humidity - 30) / 70) * 100}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>30%</span>
                      <span>Current: {humidity.toFixed(0)}%</span>
                      <span>100%</span>
                    </div>
                  </>
                )}
              </div>

              {/* Membership Degrees */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                <div className="bg-yellow-50 p-2 rounded-lg">
                  <div className="text-yellow-600">Kering</div>
                  <div className="font-bold">{(humidityMembership.dry * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-green-50 p-2 rounded-lg">
                  <div className="text-green-600">Normal</div>
                  <div className="font-bold">{(humidityMembership.normal * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg">
                  <div className="text-blue-600">Lembab</div>
                  <div className="font-bold">{(humidityMembership.humid * 100).toFixed(0)}%</div>
                </div>
              </div>

              {/* Fuzzy Action & Intensity */}
              <div className="mt-3 p-3 bg-blue-100/30 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Fuzzy Output:</span>
                  <span className="text-primary font-bold">{humidifierIntensity}% Power</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-400 to-cyan-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${humidifierIntensity}%` }}
                  ></div>
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  {humidityMembership.dry > 0.3 ? (
                    <>
                      <Lucide icon="Droplets" className="w-3.5 h-3.5 text-blue-500" />
                      <span>Rule: Kelembaban <span className="font-medium text-yellow-600">{humidityStatus.label.toLowerCase()}</span> → Pelembapan <span className="font-medium text-blue-500">{humidifierIntensity}%</span></span>
                    </>
                  ) : humidityMembership.humid > 0.3 ? (
                    <>
                      <Lucide icon="Wind" className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Rule: Kelembaban <span className="font-medium text-blue-500">{humidityStatus.label.toLowerCase()}</span> → Humidifier mati</span>
                    </>
                  ) : (
                    <>
                      <Lucide icon="CheckCircle" className="w-3.5 h-3.5 text-green-500" />
                      <span>Rule: Kelembaban <span className="font-medium text-green-500">normal</span> → Humidifier idle</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Circulation Fan - Fuzzy Control */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-white rounded-xl border border-purple-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Lucide icon="Fan" className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="font-semibold">Circulation Fan</div>
                    <div className="text-xs text-slate-500">Fuzzy ventilation control</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {actualFanState ? `RUNNING · ${fanIntensity}%` : "IDLE"}
                  </span>
                  <FormSwitch className="w-12 h-6">
                    <FormSwitch.Input 
                      type="checkbox" 
                      checked={autoMode ? actualFanState : fanEnabled}
                      onChange={(e) => {
                        if (!autoMode) {
                          sendManualActuatorCommand('fan', e.target.checked);
                        }
                      }}
                      disabled={autoMode} 
                    />
                  </FormSwitch>
                </div>
              </div>
              

              {/* Fuzzy Rules Summary */}
              <div className="mt-2 p-2 bg-purple-100/30 rounded-lg text-xs">
                <div className="font-medium mb-1 flex items-center gap-1.5">
                  <Lucide icon="ListChecks" className="w-3.5 h-3.5 text-purple-500" />
                  Active Fuzzy Rules:
                </div>
                <ul className="space-y-0.5 text-slate-600">
                  {tempMembership.hot > 0.3 && humidityMembership.humid > 0.3 && (
                    <li className="flex items-center gap-1.5">
                      <Lucide icon="AlertTriangle" className="w-3 h-3 text-red-500" />
                      <span>HOT & HUMID → Fan 100% (Max cooling)</span>
                    </li>
                  )}
                  {tempMembership.hot > 0.3 && humidityMembership.normal > 0.3 && (
                    <li className="flex items-center gap-1.5">
                      <Lucide icon="Sun" className="w-3 h-3 text-orange-500" />
                      <span>HOT & NORMAL → Fan 70% (High cooling)</span>
                    </li>
                  )}
                  {tempMembership.normal > 0.3 && humidityMembership.humid > 0.3 && (
                    <li className="flex items-center gap-1.5">
                      <Lucide icon="CloudRain" className="w-3 h-3 text-blue-500" />
                      <span>NORMAL & HUMID → Fan 60% (Ventilation)</span>
                    </li>
                  )}
                  {tempMembership.hot > 0.3 && !(humidityMembership.humid > 0.3) && (
                    <li className="flex items-center gap-1.5">
                      <Lucide icon="Sun" className="w-3 h-3 text-orange-500" />
                      <span>HOT → Fan 50% (Medium cooling)</span>
                    </li>
                  )}
                  {humidityMembership.humid > 0.3 && !(tempMembership.hot > 0.3) && (
                    <li className="flex items-center gap-1.5">
                      <Lucide icon="CloudRain" className="w-3 h-3 text-blue-500" />
                      <span>HUMID → Fan 40% (Air circulation)</span>
                    </li>
                  )}
                  {tempMembership.normal > 0.3 && humidityMembership.normal > 0.3 && (
                    <li className="flex items-center gap-1.5">
                      <Lucide icon="CheckCircle" className="w-3 h-3 text-green-500" />
                      <span>NORMAL & NORMAL → Fan 0% (Idle)</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Fuzzy Action & Intensity */}
              <div className="mt-3 p-3 bg-purple-100/30 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Fuzzy Output:</span>
                  <span className="text-primary font-bold">{fanIntensity}% Power</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-400 to-pink-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${fanIntensity}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Sensor Reading Interval - DITAMBAHKAN */}
            <div className="mb-6 mt-6 p-4 bg-gradient-to-r from-teal-50 to-white rounded-xl border border-teal-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                    <Lucide icon="Clock" className="w-5 h-5 text-teal-500" />
                  </div>
                  <div>
                    <div className="font-semibold">Sensor Reading Interval</div>
                    <div className="text-xs text-slate-500">How often ESP32 reads DHT22 sensor</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {sensorInterval}s
                  </span>
                  {!isEditingInterval ? (
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="text-xs py-1 px-2"
                      onClick={() => setIsEditingInterval(true)}
                    >
                      <Lucide icon="Pencil" className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button 
                        size="sm"
                        className="text-xs py-1 px-2 bg-green-500 text-white"
                        onClick={saveSystemConfig}
                        disabled={isSaving}
                      >
                        <Lucide icon="Check" className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm"
                        className="text-xs py-1 px-2 bg-red-500 text-white"
                        onClick={() => {
                          setSensorIntervalEdit(sensorInterval);
                          setIsEditingInterval(false);
                        }}
                      >
                        <Lucide icon="X" className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {isEditingInterval ? (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400">Interval (detik)</label>
                    <select
                      value={sensorIntervalEdit}
                      onChange={(e) => setSensorIntervalEdit(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="3">3 detik (Real-time)</option>
                      <option value="5">5 detik</option>
                      <option value="10">10 detik</option>
                      <option value="30">30 detik</option>
                      <option value="60">1 menit</option>
                      <option value="120">2 menit</option>
                    </select>
                  </div>
                  <div className="text-xs text-slate-400">
                    <Lucide icon="Info" className="w-4 h-4 inline" />
                    Interval pembacaan sensor DHT22
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-center py-2 bg-slate-50 rounded-lg">
                      {sensorInterval} detik
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {sensorInterval === 3 ? '⚡ Real-time monitoring' :
                    sensorInterval <= 10 ? '📊 Frequent updates' :
                    sensorInterval <= 30 ? '📈 Standard interval' :
                    '📉 Power saving mode'}
                  </div>
                </div>
              )}
              
              <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                <Lucide icon="Info" className="w-3 h-3" />
                <span>Nilai yang lebih rendah memberikan data real-time, nilai yang lebih tinggi menghemat daya</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      

      {/* System Stats Footer */}
      <div className="col-span-12">
        <div className="grid grid-cols-12 gap-4">
          {/* Total Power Consumption */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="box box--stacked p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-sm">Total Power</div>
                  <div className="text-2xl font-bold mt-1">
                    {((heaterEnabled && actualHeaterState ? heaterIntensity * 0.008 : 0) + 
                      (humidifierEnabled && actualHumidifierState ? humidifierIntensity * 0.003 : 0) + 
                      (fanEnabled ? fanIntensity * 0.001 : 0)).toFixed(2)} 
                    <span className="text-base font-normal text-slate-500"> kW</span>
                  </div>
                </div>
                <div className="w-10 h-10 bg-warning/10 rounded-full flex items-center justify-center">
                  <Lucide icon="Zap" className="w-5 h-5 text-warning" />
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-2">
                {(heaterIntensity + humidifierIntensity + fanIntensity) / 3}% Avg Intensity
              </div>
            </div>
          </div>

          {/* Fuzzy Inference Status */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="box box--stacked p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-sm">Fuzzy Method</div>
                  <div className="text-2xl font-bold mt-1">Tsukamoto</div>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Lucide icon="Brain" className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-2">Weighted Average Defuzzification</div>
            </div>
          </div>

          {/* Control Stability */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="box box--stacked p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-sm">Control Status</div>
                  <div className="text-2xl font-bold mt-1 text-success">Stable</div>
                </div>
                <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
                  <Lucide icon="Activity" className="w-5 h-5 text-success" />
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-2">All parameters within bounds</div>
            </div>
          </div>

          {/* System Uptime */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="box box--stacked p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-sm">Uptime</div>
                  <div className="text-2xl font-bold mt-1">48h <span className="text-base font-normal text-slate-500">12m</span></div>
                </div>
                <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
                  <Lucide icon="Clock" className="w-5 h-5 text-success" />
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-2">Continuous fuzzy control</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;