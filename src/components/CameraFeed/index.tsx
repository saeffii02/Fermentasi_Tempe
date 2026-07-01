// frontend/src/components/CameraFeed/index.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Lucide from '@/components/Base/Lucide';
import Button from '@/components/Base/Button';

interface CameraFeedProps {
    cameraIp?: string;
    cameraPort?: number;
    onConnectionChange?: (connected: boolean) => void;
}

const CameraFeed: React.FC<CameraFeedProps> = ({
    cameraIp = '192.168.1.12',
    cameraPort = 8080,
    onConnectionChange
}) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [frameCount, setFrameCount] = useState(0);
    const [fps, setFps] = useState(0);
    
    const imgRef = useRef<HTMLImageElement>(null);
    const frameCountRef = useRef(0);
    const fpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const retryCountRef = useRef(0);
    const mountedRef = useRef(true);
    
    const MAX_RETRIES = 10;
    const STREAM_URL = `http://localhost:3000/api/camera/stream?ip=${cameraIp}&port=${cameraPort}`;
    
    // =============================================
    // FPS COUNTER
    // =============================================
    useEffect(() => {
        fpsIntervalRef.current = setInterval(() => {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
        }, 1000);
        
        return () => {
            if (fpsIntervalRef.current) {
                clearInterval(fpsIntervalRef.current);
            }
        };
    }, []);
    
    // =============================================
    // CONNECT TO CAMERA
    // =============================================
    const connectCamera = useCallback(async () => {
        if (!mountedRef.current) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            // Check camera status
            const response = await fetch(
                `http://localhost:3000/api/camera/status?ip=${cameraIp}&port=${cameraPort}`,
                { signal: AbortSignal.timeout(3000) }
            );
            const data = await response.json();
            
            if (data.connected) {
                setIsConnected(true);
                setIsLoading(false);
                retryCountRef.current = 0;
                onConnectionChange?.(true);
                
                // Load stream
                if (imgRef.current) {
                    const timestamp = Date.now();
                    imgRef.current.src = `${STREAM_URL}&t=${timestamp}`;
                }
            } else {
                throw new Error(data.error || 'Camera not responding');
            }
        } catch (err) {
            console.error('Camera connection error:', err);
            setIsConnected(false);
            setIsLoading(false);
            
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            setError(`Cannot connect to ESP32-CAM: ${errorMsg}`);
            onConnectionChange?.(false);
            
            // Auto retry with exponential backoff
            if (retryCountRef.current < MAX_RETRIES) {
                retryCountRef.current++;
                const delay = Math.min(1000 * Math.pow(1.5, retryCountRef.current), 10000);
                
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (mountedRef.current) {
                        connectCamera();
                    }
                }, delay);
            }
        }
    }, [cameraIp, cameraPort, STREAM_URL, onConnectionChange]);
    
    // =============================================
    // HANDLE IMAGE EVENTS
    // =============================================
    const handleImageLoad = useCallback(() => {
        setIsConnected(true);
        setError(null);
        frameCountRef.current++;
        setFrameCount(prev => prev + 1);
        retryCountRef.current = 0;
    }, []);
    
    const handleImageError = useCallback(() => {
        console.warn('Image load error, attempting reconnect...');
        setIsConnected(false);
        
        // Auto reconnect on image error
        if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            const delay = Math.min(1000 * Math.pow(1.5, retryCountRef.current), 5000);
            
            setTimeout(() => {
                if (mountedRef.current && imgRef.current) {
                    const timestamp = Date.now();
                    imgRef.current.src = `${STREAM_URL}&t=${timestamp}`;
                }
            }, delay);
        } else {
            setError('Stream failed after multiple retries');
        }
    }, [STREAM_URL]);
    
    // =============================================
    // REFRESH STREAM
    // =============================================
    const refreshStream = useCallback(() => {
        if (imgRef.current && isConnected) {
            const timestamp = Date.now();
            imgRef.current.src = `${STREAM_URL}&t=${timestamp}`;
        }
    }, [STREAM_URL, isConnected]);
    
    // =============================================
    // INITIAL CONNECTION
    // =============================================
    useEffect(() => {
        mountedRef.current = true;
        connectCamera();
        
        // Periodic keep-alive refresh
        const keepAliveInterval = setInterval(() => {
            if (isConnected && imgRef.current) {
                // Refresh every 3 seconds to keep stream alive
                refreshStream();
            }
        }, 3000);
        
        return () => {
            mountedRef.current = false;
            clearInterval(keepAliveInterval);
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [connectCamera, isConnected, refreshStream]);
    
    // =============================================
    // RENDER
    // =============================================
    return (
        <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
            {/* Loading State */}
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/95 z-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                    <p className="text-slate-400 mt-4 text-sm">Connecting to camera...</p>
                    <p className="text-xs text-slate-500 mt-1">Attempt {retryCountRef.current + 1}/{MAX_RETRIES}</p>
                </div>
            )}
            
            {/* Error State */}
            {error && !isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/95 z-10 p-4">
                    <Lucide icon="CameraOff" className="w-16 h-16 text-slate-500 mb-4" />
                    <p className="text-slate-400 text-center text-sm">{error}</p>
                    <div className="mt-4 flex gap-2">
                        <input
                            type="text"
                            value={cameraIp}
                            readOnly
                            className="px-3 py-1 text-xs bg-slate-700 text-white rounded border border-slate-600"
                            placeholder="IP"
                        />
                        <input
                            type="number"
                            value={cameraPort}
                            readOnly
                            className="px-3 py-1 text-xs bg-slate-700 text-white rounded border border-slate-600 w-16"
                            placeholder="Port"
                        />
                    </div>
                    <Button
                        size="sm"
                        onClick={connectCamera}
                        className="mt-3 bg-primary text-white"
                        disabled={isLoading}
                    >
                        <Lucide icon="RefreshCw" className="w-4 h-4 mr-1" />
                        Reconnect
                    </Button>
                    <p className="text-xs text-slate-500 mt-2">
                        Default: 192.168.1.12:8080
                    </p>
                </div>
            )}
            
            {/* Video Feed */}
            <img
                ref={imgRef}
                src={STREAM_URL}
                alt="ESP32-CAM Feed"
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isConnected && !error ? 'opacity-100' : 'opacity-40'
                }`}
                onLoad={handleImageLoad}
                onError={handleImageError}
                key={`camera-${Date.now()}`}
            />
            
            {/* Overlay Info */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                            isConnected && !error ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                        }`}></span>
                        <span>{isConnected && !error ? 'LIVE' : 'OFFLINE'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Lucide icon="Cpu" className="w-3 h-3" />
                        <span>ESP32-CAM</span>
                    </div>
                </div>
            </div>
            
            {/* FPS Counter */}
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                    <Lucide icon="Activity" className="w-3 h-3 text-green-400" />
                    <span>{fps} fps</span>
                    <span className="text-slate-400">|</span>
                    <span>{frameCount} frames</span>
                </div>
            </div>
            
            {/* Controls */}
            <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                    className="bg-black/60 hover:bg-black/80 text-white border-0 rounded-lg px-3 py-1.5 text-xs"
                    onClick={refreshStream}
                    title="Refresh Stream"
                >
                    <Lucide icon="RefreshCw" className="w-4 h-4" />
                </Button>
                <Button
                    className="bg-black/60 hover:bg-black/80 text-white border-0 rounded-lg px-3 py-1.5 text-xs"
                    onClick={() => window.open(`http://${cameraIp}:${cameraPort}`, '_blank')}
                    title="Open in New Window"
                >
                    <Lucide icon="Maximize" className="w-4 h-4" />
                </Button>
            </div>
            
            {/* Stream Info */}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-3">
                    <span>QVGA</span>
                    <span className="text-slate-400">|</span>
                    <span className="flex items-center gap-1">
                        <Lucide icon="Wifi" className="w-3 h-3" />
                        {cameraIp}:{cameraPort}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default CameraFeed;