// frontend/src/services/batchService.ts
export interface BatchLog {
  id: string;
  batchId: string;
  timestamp: string;
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
  targetTemp: {
    min: number;
    max: number;
  };
  targetHumidity: {
    min: number;
    max: number;
  };
  logs: BatchLog[];
  status: 'active' | 'completed';
}

class BatchStorageService {
  private STORAGE_KEY = 'fermentation_batches';

  // Get all batches
  getBatches(): Batch[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];
    
    const batches = JSON.parse(stored);
    // Convert date strings back to Date objects
    return batches.map((batch: any) => ({
      ...batch,
      startTime: new Date(batch.startTime),
      endTime: batch.endTime ? new Date(batch.endTime) : undefined,
      logs: batch.logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }))
    }));
  }

  // Save batches
  private saveBatches(batches: Batch[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(batches));
  }

  // Get active batch
  getActiveBatch(): Batch | null {
    const batches = this.getBatches();
    return batches.find(batch => batch.status === 'active') || null;
  }

  // Create new batch
  createBatch(data: {
    name: string;
    strain: string;
    targetTemp: { min: number; max: number };
    targetHumidity: { min: number; max: number };
  }): Batch {
    const batches = this.getBatches();
    
    // Check if there's an active batch
    const activeBatch = batches.find(b => b.status === 'active');
    if (activeBatch) {
      throw new Error('There is already an active batch. Please complete it first.');
    }
    
    const newBatch: Batch = {
      id: `batch_${Date.now()}`,
      name: data.name,
      strain: data.strain,
      startTime: new Date(),
      targetTemp: data.targetTemp,
      targetHumidity: data.targetHumidity,
      logs: [],
      status: 'active'
    };
    
    batches.push(newBatch);
    this.saveBatches(batches);
    return newBatch;
  }

  // Add log to batch
  addLogToBatch(batchId: string, log: BatchLog): void {
    const batches = this.getBatches();
    const batchIndex = batches.findIndex(b => b.id === batchId);
    
    if (batchIndex !== -1 && batches[batchIndex].status === 'active') {
      batches[batchIndex].logs.push(log);
      this.saveBatches(batches);
    }
  }

  // Complete batch
  completeBatch(batchId: string): void {
    const batches = this.getBatches();
    const batchIndex = batches.findIndex(b => b.id === batchId);
    
    if (batchIndex !== -1) {
      batches[batchIndex].status = 'completed';
      batches[batchIndex].endTime = new Date();
      this.saveBatches(batches);
    }
  }

  // Get batch by ID
  getBatchById(batchId: string): Batch | null {
    const batches = this.getBatches();
    return batches.find(b => b.id === batchId) || null;
  }

  // Delete batch
  deleteBatch(batchId: string): void {
    const batches = this.getBatches();
    const filtered = batches.filter(b => b.id !== batchId);
    this.saveBatches(filtered);
  }

  // Clear all batches
  clearAllBatches(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export default new BatchStorageService();