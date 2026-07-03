// frontend/src/pages/LandingPage/index.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { 
  FiCpu, FiThermometer, FiCloud, FiActivity, FiBarChart2, FiBell,
  FiDroplet, FiClock, FiDatabase, FiCode, FiServer, FiWifi,
  FiEdit, FiEye, FiCheck, FiMail, FiInfo, FiTarget, FiZap,
  FiSun, FiMoon, FiArrowRight, FiTrendingUp, FiShield, FiAward
} from "react-icons/fi";
import { FaPalette, FaRocket } from "react-icons/fa";
import { 
  SiReact, SiNodedotjs, SiSocketdotio, SiMqtt, SiPostgresql 
} from "react-icons/si";
import Button from "@/components/Base/Button";
import { iotService, setupWebSocket } from "@/services/iotService";
import logo from "@/assets/images/SIPANGFER.png";

function Main() {
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState("home");
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [temperatureRange, setTemperatureRange] = useState({ min: 25, max: 37 });
  const [humidityRange, setHumidityRange] = useState({ min: 60, max: 80 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sensorData, setSensorData] = useState({
    temperature: 28.4,
    humidity: 72,
    heater: false,
    humidifier: false,
    fan: false,
    mode: 'AUTO'
  });

  const [actuatorIntensity, setActuatorIntensity] = useState({
    heater: 45,
    humidifier: 30,
    fan: 20
  });

  const wsCleanupRef = useRef<(() => void) | null>(null);

  // ================= GRADIEN WARNA UTAMA =================
  const gradientPrimary = "from-[#667eea] via-[#764ba2] to-[#f093fb]";
  const gradientSecondary = "from-[#4facfe] via-[#00f2fe] to-[#43e97b]";
  const gradientDark = "from-[#0c0e1a] via-[#1a1c2e] to-[#2d1b3d]";

  // ================= GLASSMORPHISM UTILITY =================
  const glassStyle = (dark: boolean) => `
    backdrop-blur-xl 
    bg-opacity-20
    border 
    ${dark 
      ? 'bg-white/10 border-white/10' 
      : 'bg-white/30 border-white/40'
    }
    shadow-[0_8px_32px_rgba(0,0,0,0.12)]
  `;

  const features = [
    {
      icon: FiCpu,
      title: "Fuzzy Tsukamoto Logic",
      description: "Sistem kontrol cerdas menggunakan metode Fuzzy Tsukamoto yang meniru cara berpikir ahli fermentasi.",
      color: "from-purple-400 to-pink-400"
    },
    {
      icon: FiThermometer,
      title: "Real-time Monitoring",
      description: "Pantau suhu dan kelembaban secara real-time dengan visualisasi data yang interaktif.",
      color: "from-blue-400 to-cyan-400"
    },
    {
      icon: FiCloud,
      title: "Cloud-Based IoT",
      description: "Data tersimpan aman di cloud dan dapat diakses dari mana saja.",
      color: "from-indigo-400 to-blue-400"
    },
    {
      icon: FiActivity,
      title: "Batch Management",
      description: "Kelola batch fermentasi dengan mudah. Catat riwayat dan analisis performa.",
      color: "from-emerald-400 to-green-400"
    },
    {
      icon: FiBarChart2,
      title: "Data Analytics",
      description: "Analisis mendalam dengan visualisasi chart interaktif. Export data ke CSV.",
      color: "from-orange-400 to-red-400"
    },
    {
      icon: FiBell,
      title: "Smart Notification",
      description: "Sistem notifikasi cerdas untuk warning, phase change, dan rekomendasi tindakan.",
      color: "from-rose-400 to-pink-400"
    }
  ];

  const stats = [
    { 
      label: "Temperature Range", 
      value: `${temperatureRange.min}-${temperatureRange.max}°C`, 
      icon: FiThermometer,
      gradient: "from-blue-500 to-cyan-500"
    },
    { 
      label: "Humidity Range", 
      value: `${humidityRange.min}-${humidityRange.max}%`, 
      icon: FiDroplet,
      gradient: "from-cyan-500 to-teal-500"
    },
    { 
      label: "Batch Duration", 
      value: "48-72 Hours", 
      icon: FiClock,
      gradient: "from-purple-500 to-pink-500"
    },
    { 
      label: "Data Points", 
      value: "Real-time", 
      icon: FiDatabase,
      gradient: "from-indigo-500 to-blue-500"
    }
  ];

  const technologies = [
    { name: "React.js", icon: SiReact, color: "from-cyan-400 to-blue-500" },
    { name: "Node.js", icon: SiNodedotjs, color: "from-green-400 to-emerald-500" },
    { name: "Socket.IO", icon: SiSocketdotio, color: "from-gray-500 to-gray-700" },
    { name: "MQTT", icon: SiMqtt, color: "from-red-400 to-orange-500" },
    { name: "PostgreSQL", icon: SiPostgresql, color: "from-blue-500 to-indigo-600" },
    { name: "Tailwind CSS", icon: FaPalette, color: "from-teal-400 to-cyan-400" }
  ];

  const howItWorks = [
    { step: "01", title: "Setup Batch", desc: "Buat batch baru dengan nama dan strain", icon: FiEdit },
    { step: "02", title: "Monitoring", desc: "Sistem otomatis memantau suhu & kelembaban", icon: FiEye },
    { step: "03", title: "Fuzzy Control", desc: "AI mengatur aktuator secara cerdas", icon: FiCpu },
    { step: "04", title: "Analysis", desc: "Lihat riwayat dan analisis data", icon: FiBarChart2 }
  ];

  const loadSystemConfig = async () => {
    try {
      setIsLoading(true);
      const config = await iotService.getSystemConfig();
      setTemperatureRange({
        min: config.temp_min,
        max: config.temp_max
      });
      setHumidityRange({
        min: config.humidity_min,
        max: config.humidity_max
      });
      setError(null);
    } catch (err) {
      console.error('Failed to load config:', err);
      setError('Gagal memuat konfigurasi. Menggunakan nilai default.');
      setTemperatureRange({ min: 25, max: 37 });
      setHumidityRange({ min: 60, max: 80 });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentData = async () => {
    try {
      const data = await iotService.getCurrentReadings();
      setSensorData(prev => ({
        ...prev,
        temperature: data.temperature,
        humidity: data.humidity
      }));
    } catch (err) {
      console.error('Failed to fetch sensor data:', err);
    }
  };

  const calculatePercentage = useCallback((value: number, min: number, max: number) => {
    if (value <= min) return 0;
    if (value >= max) return 100;
    return ((value - min) / (max - min)) * 100;
  }, []);

  const calculateHeaterIntensity = useCallback((temp: number, tempMin: number, tempMax: number) => {
    if (temp < tempMin) {
      const diff = tempMin - temp;
      const intensity = Math.min(100, Math.max(0, 50 + (diff / 5) * 50));
      return Math.round(intensity);
    }
    if (temp > tempMax) {
      return 0;
    }
    return Math.round(20 + ((temp - tempMin) / (tempMax - tempMin)) * 20);
  }, []);

  const calculateHumidifierIntensity = useCallback((hum: number, humMin: number, humMax: number) => {
    if (hum < humMin) {
      const diff = humMin - hum;
      const intensity = Math.min(100, Math.max(0, 50 + (diff / 10) * 50));
      return Math.round(intensity);
    }
    if (hum > humMax) {
      return 0;
    }
    return Math.round(20 + ((hum - humMin) / (humMax - humMin)) * 20);
  }, []);

  const calculateFanIntensity = useCallback((temp: number, hum: number, tempMin: number, tempMax: number, humMin: number, humMax: number) => {
    let intensity = 0;
    if (temp > tempMax) intensity += 50;
    if (hum > humMax) intensity += 30;
    if (temp >= tempMin && temp <= tempMax && hum >= humMin && hum <= humMax) intensity = 10;
    if (temp < tempMin) intensity = 5;
    return Math.min(100, Math.max(0, intensity));
  }, []);

  const updateActuatorIntensity = useCallback((temp: number, hum: number) => {
    const heaterIntensity = calculateHeaterIntensity(temp, temperatureRange.min, temperatureRange.max);
    const humidifierIntensity = calculateHumidifierIntensity(hum, humidityRange.min, humidityRange.max);
    const fanIntensity = calculateFanIntensity(temp, hum, temperatureRange.min, temperatureRange.max, humidityRange.min, humidityRange.max);
    
    setActuatorIntensity({
      heater: heaterIntensity,
      humidifier: humidifierIntensity,
      fan: fanIntensity
    });
  }, [temperatureRange, humidityRange, calculateHeaterIntensity, calculateHumidifierIntensity, calculateFanIntensity]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    loadSystemConfig();
    fetchCurrentData();
    
    const cleanup = setupWebSocket((data: any) => {
      console.log("LandingPage WebSocket:", data);
      
      if (data.temperature !== undefined && data.humidity !== undefined) {
        const newTemp = Number(data.temperature);
        const newHum = Number(data.humidity);
        
        setSensorData(prev => ({
          ...prev,
          temperature: newTemp,
          humidity: newHum,
          heater: data.heater === 1 || data.heater === true,
          humidifier: data.humidifier === 1 || data.humidifier === true,
          fan: data.fan === 1 || data.fan === true,
          mode: data.mode || prev.mode
        }));
        
        updateActuatorIntensity(newTemp, newHum);
      }
      
      if (data.fuzzy && data.fuzzy.intensity) {
        setActuatorIntensity({
          heater: data.fuzzy.intensity.heater || 0,
          humidifier: data.fuzzy.intensity.humidifier || 0,
          fan: data.fuzzy.intensity.fan || 0
        });
      }
    });
    
    wsCleanupRef.current = cleanup;
    
    const interval = setInterval(() => {
      fetchCurrentData();
      loadSystemConfig();
    }, 30000);
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (wsCleanupRef.current) {
        wsCleanupRef.current();
      }
      clearInterval(interval);
    };
  }, [darkMode, updateActuatorIntensity]);

  useEffect(() => {
    if (sensorData.temperature && sensorData.humidity) {
      updateActuatorIntensity(sensorData.temperature, sensorData.humidity);
    }
  }, [temperatureRange, humidityRange, sensorData.temperature, sensorData.humidity, updateActuatorIntensity]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('theme', !darkMode ? 'dark' : 'light');
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveNav(sectionId);
    }
  };

  const tempPercentage = calculatePercentage(
    sensorData.temperature, 
    temperatureRange.min, 
    temperatureRange.max
  );
  
  const humidityPercentage = calculatePercentage(
    sensorData.humidity, 
    humidityRange.min, 
    humidityRange.max
  );

  const getTempColor = () => {
    if (sensorData.temperature < temperatureRange.min) return 'text-blue-400';
    if (sensorData.temperature > temperatureRange.max) return 'text-red-400';
    return 'text-emerald-400';
  };

  const getHumidityColor = () => {
    if (sensorData.humidity < humidityRange.min) return 'text-yellow-400';
    if (sensorData.humidity > humidityRange.max) return 'text-blue-400';
    return 'text-emerald-400';
  };

  const getTempStatus = () => {
    if (sensorData.temperature < temperatureRange.min) return 'Dingin';
    if (sensorData.temperature > temperatureRange.max) return 'Panas';
    return 'Normal';
  };

  const getHumidityStatus = () => {
    if (sensorData.humidity < humidityRange.min) return 'Kering';
    if (sensorData.humidity > humidityRange.max) return 'Lembab';
    return 'Normal';
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? `bg-gradient-to-br ${gradientDark}` 
        : 'bg-gradient-to-br from-[#f5f7fa] via-[#c3cfe2] to-[#e8d5b7]'
    }`}>
      
      {/* Navigation Bar - Glassmorphism */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled 
          ? `${glassStyle(darkMode)} py-3`
          : "bg-transparent py-5"
      }`}>
        <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 bg-gradient-to-br ${gradientPrimary} rounded-xl flex items-center justify-center shadow-lg`}>
              <img src={logo} alt="Logo" />
            </div>
            <div>
              <span className={`font-bold text-xl bg-gradient-to-r ${gradientPrimary} bg-clip-text text-transparent`}>
                SIPANGFER
              </span>
              <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} block -mt-1`}>
                Fermentation Control
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {["home", "features", "technology", "stats"].map((section) => (
              <button
                key={section}
                onClick={() => scrollToSection(section)}
                className={`capitalize text-sm font-medium transition-all hover:scale-105 ${
                  activeNav === section 
                    ? `text-transparent bg-clip-text bg-gradient-to-r ${gradientPrimary}` 
                    : darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {section}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl transition-all duration-300 hover:scale-110 ${
                darkMode 
                  ? 'bg-white/10 text-yellow-400 hover:bg-white/20' 
                  : 'bg-black/5 text-slate-700 hover:bg-black/10'
              } ${glassStyle(darkMode)}`}
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <FiSun className="w-5 h-5" />
              ) : (
                <FiMoon className="w-5 h-5" />
              )}
            </button>

            <Link to="/dashboard">
              <Button variant="primary" className={`shadow-xl hover:shadow-2xl transition-all bg-gradient-to-r ${gradientPrimary} border-0`}>
                <FiActivity className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Glassmorphism Background Elements */}
      <section id="home" className="relative pt-32 pb-20 md:pt-40 md:pb-28 px-4 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glassStyle(darkMode) text-sm">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>Sistem Online • 24/7 Monitoring</span>
              </div>
              
              <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold leading-tight ${
                darkMode ? 'text-white' : 'text-slate-900'
              }`}>
                Smart Control for
                <span className={`bg-gradient-to-r ${gradientPrimary} bg-clip-text text-transparent block`}>
                  Tempe Fermentation
                </span>
              </h1>
              
              <p className={`text-lg leading-relaxed ${
                darkMode ? 'text-slate-300' : 'text-slate-600'
              }`}>
                Optimalkan proses fermentasi tempe Anda dengan sistem kontrol cerdas berbasis 
                Fuzzy Tsukamoto. Pantau suhu, kelembaban, dan aktuator secara real-time dari mana saja.
              </p>

              <div className="flex flex-wrap gap-4 pt-4">
                <Link to="/dashboard">
                  <Button variant="primary" size="lg" className={`shadow-xl hover:shadow-2xl transition-all bg-gradient-to-r ${gradientPrimary} border-0 group`}>
                    <FaRocket className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                    Start Monitoring
                  </Button>
                </Link>
                <Button 
                  variant="outline-secondary" 
                  size="lg"
                  onClick={() => scrollToSection("features")}
                  className={`border-2 ${darkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-black/5'}`}
                >
                  <FiInfo className="w-5 h-5 mr-2" />
                  Learn More
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <FiShield className="w-5 h-5 text-emerald-500" />
                  <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Secure</span>
                </div>
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="w-5 h-5 text-blue-500" />
                  <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Reliable</span>
                </div>
                <div className="flex items-center gap-2">
                  <FiAward className="w-5 h-5 text-purple-500" />
                  <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Certified</span>
                </div>
              </div>
            </div>

            {/* Dashboard Preview - Glassmorphism Card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur-3xl animate-pulse"></div>
              <div className={`relative rounded-2xl shadow-2xl overflow-hidden ${glassStyle(darkMode)}`}>
                <div className={`px-4 py-3 flex items-center justify-between ${
                  darkMode ? 'bg-white/5' : 'bg-black/5'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} ml-2`}>
                      sipangfer.local/dashboard
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-400">LIVE</span>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-xl ${glassStyle(darkMode)}`}>
                      <div className="flex items-center justify-between">
                        <div className={`text-2xl font-bold ${getTempColor()}`}>
                          {sensorData.temperature.toFixed(1)}°C
                        </div>
                        <div className={`text-xs px-2 py-0.5 rounded-full ${glassStyle(darkMode)} ${getTempColor()}`}>
                          {getTempStatus()}
                        </div>
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
                        Temperature
                      </div>
                      <div className={`w-full rounded-full h-1.5 mt-2 ${darkMode ? 'bg-white/10' : 'bg-black/10'}`}>
                        <div 
                          className="bg-gradient-to-r from-orange-400 to-red-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, tempPercentage))}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>{temperatureRange.min}°C</span>
                        <span>Normal</span>
                        <span>{temperatureRange.max}°C</span>
                      </div>
                    </div>

                    <div className={`p-3 rounded-xl ${glassStyle(darkMode)}`}>
                      <div className="flex items-center justify-between">
                        <div className={`text-2xl font-bold ${getHumidityColor()}`}>
                          {sensorData.humidity.toFixed(1)}%
                        </div>
                        <div className={`text-xs px-2 py-0.5 rounded-full ${glassStyle(darkMode)} ${getHumidityColor()}`}>
                          {getHumidityStatus()}
                        </div>
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
                        Humidity
                      </div>
                      <div className={`w-full rounded-full h-1.5 mt-2 ${darkMode ? 'bg-white/10' : 'bg-black/10'}`}>
                        <div 
                          className="bg-gradient-to-r from-blue-400 to-cyan-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, humidityPercentage))}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>{humidityRange.min}%</span>
                        <span>Normal</span>
                        <span>{humidityRange.max}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actuator Controls - Glassmorphism */}
                  {[
                    { key: 'heater', label: 'Main Heater', color: 'from-orange-400 to-red-500', icon: '🔥' },
                    { key: 'humidifier', label: 'Humidifier', color: 'from-blue-400 to-cyan-500', icon: '💧' },
                    { key: 'fan', label: 'Circulation Fan', color: 'from-purple-400 to-pink-500', icon: '🌀' }
                  ].map((actuator) => {
                    const intensity = actuatorIntensity[actuator.key as keyof typeof actuatorIntensity];
                    const isActive = intensity > 0;
                    return (
                      <div key={actuator.key} className={`mt-2 p-3 rounded-xl ${glassStyle(darkMode)}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${isActive ? 'animate-pulse' : ''} ${isActive ? `text-${actuator.key === 'heater' ? 'orange' : actuator.key === 'humidifier' ? 'blue' : 'purple'}-500` : 'text-slate-400'}`}
                              style={{ backgroundColor: isActive ? 'currentColor' : undefined }}
                            ></div>
                            <span className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {actuator.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${isActive ? `text-${actuator.key === 'heater' ? 'orange' : actuator.key === 'humidifier' ? 'blue' : 'purple'}-500` : 'text-slate-400'}`}>
                              {isActive ? `${intensity}%` : 'IDLE'}
                            </span>
                            <div className={`w-8 h-4 rounded-full ${isActive ? `bg-gradient-to-r ${actuator.color}` : 'bg-slate-300'} relative transition-all`}>
                              <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all duration-300 ${isActive ? 'right-0.5' : 'left-0.5'}`}></div>
                            </div>
                          </div>
                        </div>
                        <div className={`w-full rounded-full h-1 mt-1 ${darkMode ? 'bg-white/10' : 'bg-black/10'}`}>
                          <div 
                            className={`bg-gradient-to-r ${actuator.color} h-1 rounded-full transition-all duration-300`}
                            style={{ width: `${intensity}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-3 flex justify-between items-center px-1">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>System</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${sensorData.heater ? 'bg-orange-500' : 'bg-slate-500'}`}></div>
                        <span className="text-[10px]">🔥</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${sensorData.humidifier ? 'bg-blue-500' : 'bg-slate-500'}`}></div>
                        <span className="text-[10px]">💧</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${sensorData.fan ? 'bg-purple-500' : 'bg-slate-500'}`}></div>
                        <span className="text-[10px]">🌀</span>
                      </div>
                      <span className={`text-[10px] font-medium text-transparent bg-clip-text bg-gradient-to-r ${gradientPrimary}`}>
                        {sensorData.mode} MODE
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 rounded-full blur-xl animate-pulse delay-1000"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Glassmorphism Cards */}
      <section id="features" className={`py-20 px-4 transition-colors duration-300 ${
        darkMode ? 'bg-white/5' : 'bg-black/5'
      }`}>
        <div className="container mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className={`text-sm font-semibold uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${gradientPrimary}`}>
              Features
            </span>
            <h2 className={`text-3xl md:text-4xl font-bold mt-2 mb-4 ${
              darkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Everything You Need for Perfect Fermentation
            </h2>
            <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>
              Sistem kontrol fermentasi tempe lengkap dengan teknologi AI dan IoT terintegrasi
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className={`group p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] ${glassStyle(darkMode)} hover:shadow-2xl`}
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${
                  darkMode ? 'text-white' : 'text-slate-900'
                }`}>{feature.title}</h3>
                <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                  {feature.description}
                </p>
                <div className="mt-4 flex items-center text-sm text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 font-medium">
                   <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics Section - Glassmorphism */}
      <section id="stats" className={`py-20 px-4 transition-colors duration-300 ${
        darkMode ? 'bg-white/5' : 'bg-black/5'
      }`}>
        <div className="container mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className={`text-sm font-semibold uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${gradientPrimary}`}>
              Optimal Parameters
            </span>
            <h2 className={`text-3xl md:text-4xl font-bold mt-2 mb-4 ${
              darkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Scientifically Proven Standards
            </h2>
            <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>
              Berdasarkan penelitian dan praktik terbaik fermentasi tempe
            </p>
            {error && (
              <div className="mt-4 p-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div 
                key={index}
                className={`text-center p-6 rounded-2xl transition-all hover:scale-105 ${glassStyle(darkMode)}`}
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${stat.gradient} rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                  <stat.icon className="w-8 h-8 text-white" />
                </div>
                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
                  {stat.value}
                </div>
                <div className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div className={`mt-6 rounded-2xl p-6 ${glassStyle(darkMode)}`}>
            <div className="flex flex-wrap gap-6 justify-between items-center">
              <div className="flex items-center gap-3">
                <FiCheck className="w-6 h-6 text-emerald-500" />
                <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                  Optimal temperature for Rhizopus oligosporus growth
                </span>
              </div>
              <div className="flex items-center gap-3">
                <FiCheck className="w-6 h-6 text-emerald-500" />
                <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                  Maintain humidity for mycelium development
                </span>
              </div>
              <div className="flex items-center gap-3">
                <FiCheck className="w-6 h-6 text-emerald-500" />
                <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                  48-72 hours fermentation cycle
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section - Glassmorphism */}
      <section id="technology" className={`py-20 px-4 transition-colors duration-300 ${
        darkMode ? 'bg-white/5' : 'bg-black/5'
      }`}>
        <div className="container mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className={`text-sm font-semibold uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${gradientPrimary}`}>
              Tech Stack
            </span>
            <h2 className={`text-3xl md:text-4xl font-bold mt-2 mb-4 ${
              darkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Modern Technology Stack
            </h2>
            <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>
              Dibangun dengan teknologi terkini untuk performa optimal dan pengalaman terbaik
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {technologies.map((tech, index) => (
              <div 
                key={index}
                className={`group text-center p-4 rounded-xl transition-all hover:scale-105 ${glassStyle(darkMode)}`}
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${tech.color} rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-lg`}>
                  <tech.icon className="w-6 h-6 text-white" />
                </div>
                <div className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  {tech.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section - Glassmorphism */}
      <section className={`py-20 px-4 transition-colors duration-300 ${
        darkMode ? 'bg-white/5' : 'bg-black/5'
      }`}>
        <div className="container mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className={`text-sm font-semibold uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${gradientPrimary}`}>
              Process
            </span>
            <h2 className={`text-3xl md:text-4xl font-bold mt-2 mb-4 ${
              darkMode ? 'text-white' : 'text-slate-900'
            }`}>
              How It Works
            </h2>
            <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>
              Sistem kontrol fermentasi tempe dalam 4 langkah sederhana
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <div key={index} className="text-center group">
                <div className="relative mb-4">
                  <div className={`w-20 h-20 bg-gradient-to-br ${gradientPrimary} rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-8 h-8 text-white" />
                  </div>
                  {index < 3 && (
                    <div className={`hidden md:block absolute top-1/2 -right-6 w-12 h-0.5 ${
                      darkMode ? 'bg-white/20' : 'bg-black/20'
                    }`}></div>
                  )}
                </div>
                <div className={`text-3xl font-bold ${darkMode ? 'text-white/20' : 'text-black/20'} mb-2`}>
                  {item.step}
                </div>
                <h3 className={`font-semibold text-lg mb-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {item.title}
                </h3>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Glassmorphism with Gradient */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className={`relative overflow-hidden rounded-3xl p-8 md:p-12 text-center ${glassStyle(darkMode)}`}>
            {/* Background gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-r ${gradientPrimary} opacity-20`}></div>
            
            <div className="relative z-10">
              <h2 className={`text-2xl md:text-4xl font-bold mb-4 ${
                darkMode ? 'text-white' : 'text-slate-900'
              }`}>
                Ready to Optimize Your Fermentation?
              </h2>
              <p className="{darkMode ? 'text-slate-400' : 'text-slate-600'} mb-8 max-w-lg mx-auto">
                Mulai sekarang dan rasakan kemudahan kontrol fermentasi tempe dengan teknologi AI
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link to="/dashboard">
                  <Button variant="primary" size="lg" className={`shadow-xl hover:shadow-2xl transition-all bg-gradient-to-r ${gradientPrimary} border-0`}>
                    <FiTarget className="w-5 h-5 mr-2" />
                    Launch Dashboard
                  </Button>
                </Link>
                <Link to="/dashboard/active-batch">
                  <Button variant="secondary" size="lg" className={`border-2 ${darkMode ? 'border-white/30 text-white hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-black/5'} transition-all`}>
                    <FiZap className="w-5 h-5 mr-2" />
                    Start New Batch
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 px-4 transition-colors duration-300 ${
        darkMode ? 'bg-black/50' : 'bg-white/50'
      } ${glassStyle(darkMode)}`}>
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 bg-gradient-to-br ${gradientPrimary} rounded-lg flex items-center justify-center`}>
                  <img
                    src="/src/assets/images/SIPANGFER.png"
                    alt="Logo Sipangfer"
                    className="w-[70px] h-[70px] object-contain mx-auto"
                  />
                </div>
                <span className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  SIPANGFER
                </span>
              </div>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Smart fermentation control system for optimal tempe production using fuzzy logic technology.
              </p>
            </div>
            <div>
              <h4 className={`font-semibold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                Quick Links
              </h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><button onClick={() => scrollToSection("home")} className={`hover:${darkMode ? 'text-white' : 'text-slate-900'} transition`}>Home</button></li>
                <li><button onClick={() => scrollToSection("features")} className={`hover:${darkMode ? 'text-white' : 'text-slate-900'} transition`}>Features</button></li>
                <li><button onClick={() => scrollToSection("technology")} className={`hover:${darkMode ? 'text-white' : 'text-slate-900'} transition`}>Technology</button></li>
                <li><Link to="/dashboard" className={`hover:${darkMode ? 'text-white' : 'text-slate-900'} transition`}>Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className={`font-semibold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                Resources
              </h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/dashboard/history" className={`hover:${darkMode ? 'text-white' : 'text-slate-900'} transition`}>Batch History</Link></li>
                <li><Link to="/dashboard/actuator-control" className={`hover:${darkMode ? 'text-white' : 'text-slate-900'} transition`}>Actuator Control</Link></li>
                <li><Link to="/dashboard/decision-matrix" className={`hover:${darkMode ? 'text-white' : 'text-slate-900'} transition`}>Decision Matrix</Link></li>
              </ul>
            </div>
            <div>
              <h4 className={`font-semibold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                Contact
              </h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <FiMail className="w-4 h-4" />
                  saeffii0225@gmail.com
                </li>
                <li className="flex items-center gap-2">
                  <FiCode className="w-4 h-4" />
                  github.com/tempeflow
                </li>
              </ul>
            </div>
          </div>
          <div className={`border-t ${darkMode ? 'border-white/10' : 'border-black/10'} mt-8 pt-8 text-center text-sm text-slate-400`}>
            <p>&copy; 2026 SIPANGFER - Intelligent Fermentation Control System. All rights reserved.</p>
            <p className="mt-1">Powered by Fuzzy Tsukamoto Logic & IoT Technology</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Main;