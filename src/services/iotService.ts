  import axios from 'axios';
  import { io } from "socket.io-client";

  const API_BASE_URL = 'http://localhost:3000';

  const api = axios.create({
    baseURL: `${API_BASE_URL}/api`,  
    headers: {
      "Content-Type": "application/json",
    },
  });

  // ================= DEFINISI TIPE =================
  export interface BatchLog {
    id: string;
    batchId: string;
    timestamp: Date;
    temperature: number;
    humidity: number;
    status: string;
    statusTemp: string;
    statusHumidity: string;
    heaterIntensity: number;
    fanIntensity: number;
    humidifierIntensity: number;
    phase: string;
  }


  export interface Batch {
    id: string;
    name: string;
    strain: string;
    startTime: Date;
    endTime?: Date;
    targetTempMin: number;
    targetTempMax: number;
    targetHumidityMin: number;
    targetHumidityMax: number;
    status: 'active' | 'completed';
    logs: BatchLog[];
    createdAt: Date;
    updatedAt: Date;
  }

  export interface BatchStatistics {
    avgTemp: number;
    avgHumidity: number;
    maxTemp: number;
    minTemp: number;
    maxHumidity: number;
    minHumidity: number;
    avgHeater: number;
    avgFan: number;
    avgHumidifier: number;
    totalEnergy: number;
    duration: number;
    totalRecords: number;
    batchCount?: number;
    phaseCount: {
      initial: number;
      fermentation: number;
      maturation: number;
      cooling: number;
    };
  }

  export interface LogEntryWithBatch extends BatchLog {
    batchId: string;
    batchName: string;
    batchStrain: string;
  }

  export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    severity: 'info' | 'success' | 'warning' | 'error';
    metadata: any;
    isRead: boolean;
    createdAt: string;
    readAt: string | null;
  }

  export interface NotificationsResponse {
    notifications: Notification[];
    total: number;
    unreadCount: number;
    hasMore: boolean;
  }

  type ActuatorType = 'heater' | 'humidifier' | 'fan' | 'auto';
  type ControlMode = 'AUTO' | 'MANUAL';

  // Variabel untuk menyimpan socket instance
  let socketInstance: any = null;

  export const iotService = {
    async getCurrentReadings() {
      const response = await api.get('/sensor/current');
      return response.data;
    },

    async getHistoricalData(period: string, type: string) {
      const response = await api.get('/sensor/historical', {
        params: { period, type },
      });
      return response.data;
    },

    async getDevices() {
      const response = await api.get('/sensor/devices');
      return response.data;
    },

    async controlDevice(data: {
      actuator: ActuatorType;
      state: boolean;
      mode?: ControlMode;
    }) {
      const response = await api.post('/sensor/devices/control', data);
      return response.data;
    },

    async getAlerts() {
      const response = await api.get('/sensor/alerts');
      return response.data;
    },

    async getSystemConfig() {
      const response = await api.get('/sensor/config');
      return response.data;
    },

    async updateSystemConfig(config: {
      temp_min: number;
      temp_max: number;
      humidity_min: number;
      humidity_max: number;
      auto_mode?: boolean;
      sensor_interval?: number;
    }) {
      const response = await api.put('/sensor/config', config);
      return response.data;
    },

    async sendConfigToDevice() {
      const response = await api.post('/sensor/config/send');
      return response.data;
    },

    // Batch methods
    async getAllBatches(): Promise<Batch[]> {
      const response = await api.get('/batches');
      return response.data;
    },

    async getPaginatedLogs(params: {
      page: number;
      limit: number;
      batchId?: string;
      startDate?: Date;
      endDate?: Date;
    }): Promise<{
      logs: LogEntryWithBatch[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    }> {
      const queryParams = new URLSearchParams();
      queryParams.append('page', params.page.toString());
      queryParams.append('limit', params.limit.toString());
      if (params.batchId && params.batchId !== 'all') {
        queryParams.append('batchId', params.batchId);
      }
      if (params.startDate) {
        queryParams.append('startDate', params.startDate.toISOString());
      }
      if (params.endDate) {
        queryParams.append('endDate', params.endDate.toISOString());
      }
      
      const response = await api.get(`/batches/logs/paginated?${queryParams.toString()}`);
      return response.data;
    },
    
    async getFilteredStatistics(params: {
      batchId?: string;
      startDate?: Date;
      endDate?: Date;
    }): Promise<BatchStatistics> {
      const queryParams = new URLSearchParams();
      if (params.batchId && params.batchId !== 'all') {
        queryParams.append('batchId', params.batchId);
      }
      if (params.startDate) {
        queryParams.append('startDate', params.startDate.toISOString());
      }
      if (params.endDate) {
        queryParams.append('endDate', params.endDate.toISOString());
      }
      
      const response = await api.get(`/batches/statistics?${queryParams.toString()}`);
      return response.data;
    },

    async getActiveBatch(): Promise<Batch | null> {
      const response = await api.get('/batches/active');
      return response.data;
    },

    async getBatchById(id: string): Promise<Batch> {
      const response = await api.get(`/batches/${id}`);
      return response.data;
    },

    async createBatch(data: {
      name: string;
      strain: string;
      targetTempMin: number;
      targetTempMax: number;
      targetHumidityMin: number;
      targetHumidityMax: number;
    }): Promise<Batch> {
      const response = await api.post('/batches', data);
      return response.data;
    },

    async addBatchLog(batchId: string, log: {
      temperature: number;
      humidity: number;
      heaterIntensity: number;
      fanIntensity: number;
      humidifierIntensity: number;
      phase: string;
    }): Promise<BatchLog> {
      const response = await api.post(`/batches/${batchId}/logs`, log);
      return response.data;
    },

    async completeBatch(id: string): Promise<Batch> {
      const response = await api.put(`/batches/${id}/complete`);
      return response.data;
    },

    async deleteBatch(id: string): Promise<void> {
      await api.delete(`/batches/${id}`);
    },

    async getBatchStatistics(id: string): Promise<BatchStatistics> {
      const response = await api.get(`/batches/${id}/statistics`);
      return response.data;
    },

    // ================= NOTIFICATION METHODS =================
    async getNotifications(limit: number = 20, offset: number = 0, unreadOnly: boolean = false): Promise<NotificationsResponse> {
      const response = await api.get(`/notifications?limit=${limit}&offset=${offset}&unreadOnly=${unreadOnly}`);
      return response.data;
    },

    async getUnreadCount(): Promise<{ unreadCount: number }> {
      const response = await api.get('/notifications/unread-count');
      return response.data;
    },

    async markNotificationRead(id: string): Promise<Notification> {
      const response = await api.put(`/notifications/${id}/read`);
      return response.data;
    },

    async markAllNotificationsRead(): Promise<{ message: string; count: number }> {
      const response = await api.put('/notifications/read-all');
      return response.data;
    },

    async deleteNotification(id: string): Promise<{ message: string }> {
      const response = await api.delete(`/notifications/${id}`);
      return response.data;
    },

    async deleteAllReadNotifications(): Promise<{ message: string; count: number }> {
      const response = await api.delete('/notifications/read/all');
      return response.data;
    },

    // Evaluate fuzzy point (panggil backend)
    evaluateFuzzyPoint: async (temperature: number, humidity: number) => {
      try {
        const response = await api.get('/fuzzy/evaluate', {
          params: { temperature, humidity }
        });
        return response.data;
      } catch (error) {
        console.error('Evaluate fuzzy error:', error);
        throw error;
      }
    },

    // Get decision matrix
    getDecisionMatrix: async () => {
      const response = await api.get('/fuzzy/matrix');
      return response.data;
    },
  };

  // ================= WEBSOCKET SETUP =================
  export const setupWebSocket = (onDataUpdate: (data: any) => void) => {
    // Tutup koneksi lama jika ada
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }

    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socketInstance = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO');
      
      // Request initial unread count setelah konek
      socket.emit('request:unread-count');
    });

    socket.on('sensor:update', (data) => {
      console.log('📡 Sensor Update from Backend:', data);
      onDataUpdate(data);
    });

    socket.on('device-status', (data) => {
      console.log('Device Status from Backend:', data);
      onDataUpdate(data);
    });

    socket.on('fuzzy:update', (data) => {
      console.log('🧠 Fuzzy Update from Backend:', data);
      onDataUpdate({
        type: 'FUZZY_UPDATE',
        ...data
      });
    });

    socket.on('config:ack', (data) => {
      console.log('Config ACK from ESP32:', data);
      onDataUpdate({
        type: 'CONFIG_ACK',
        ...data
      });
    });

    // ================= EVENT NOTIFICATION =================
    socket.on('notification:new', (notification) => {
      console.log('🔔 New notification received:', notification);
      onDataUpdate({
        type: 'notification:new',
        ...notification
      });
    });

    socket.on('notification:read', (data) => {
      console.log('Notification read:', data);
      onDataUpdate({
        type: 'notification:read',
        id: data.id
      });
    });

    socket.on('notification:all-read', () => {
      console.log('All notifications marked as read');
      onDataUpdate({
        type: 'notification:all-read'
      });
    });

    socket.on('notification:deleted', (data) => {
      console.log('Notification deleted:', data);
      onDataUpdate({
        type: 'notification:deleted',
        id: data.id
      });
    });

    socket.on('unread-count-update', (data) => {
      console.log('Unread count update:', data);
      onDataUpdate({
        type: 'unread-count',
        unreadCount: data.count
      });
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket Error:', err.message);
    });

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
    };
  };

  export const getSocket = () => socketInstance;