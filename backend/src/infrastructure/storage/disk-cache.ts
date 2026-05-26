/**
 * 内存受限的 Map — 限制字符串值的总内存使用量
 * 当超过容量时，删除最旧的条目
 */
export class MemoryLimitedMap<V = string> {
    private map = new Map<string, V>();
    private keyTimestamps = new Map<string, number>();
    private currentSize = 0;
    private readonly maxSize: number;

    constructor(capacity: string | number = '100mb') {
        this.maxSize = typeof capacity === 'number' ? capacity : parseSize(capacity);
    }

    has(key: string): boolean {
        return this.map.has(key);
    }

    get(key: string): V | undefined {
        return this.map.get(key);
    }

    set(key: string, value: V): void {
        const valueSize = estimateStringSize(String(value));
        const oldValue = this.map.get(key);
        if (oldValue !== undefined) {
            this.currentSize -= estimateStringSize(String(oldValue));
        }

        while (this.currentSize + valueSize > this.maxSize && this.map.size > 0) {
            this.evictOldest();
        }

        this.map.set(key, value);
        this.keyTimestamps.set(key, Date.now());
        this.currentSize += valueSize;
    }

    delete(key: string): void {
        const value = this.map.get(key);
        if (value !== undefined) {
            this.currentSize -= estimateStringSize(String(value));
            this.map.delete(key);
            this.keyTimestamps.delete(key);
        }
    }

    keys(): IterableIterator<string> {
        return this.map.keys();
    }

    clear(): void {
        this.map.clear();
        this.keyTimestamps.clear();
        this.currentSize = 0;
    }

    get size(): number {
        return this.map.size;
    }

    get currentMemorySize(): number {
        return this.currentSize;
    }

    private evictOldest(): void {
        let oldestKey: string | undefined;
        let oldestTime = Infinity;

        for (const [key, time] of this.keyTimestamps) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }

        if (oldestKey !== undefined) {
            this.delete(oldestKey);
        }
    }
}

function estimateStringSize(value: string): number {
    return Buffer.byteLength(value, 'utf-8');
}

function parseSize(capacity: string): number {
    const match = capacity.match(/^(\d+)\s*(kb|mb|gb)?$/i);
    if (!match) return 100 * 1024 * 1024; // 默认 100MB
    const num = parseInt(match[1], 10);
    const unit = (match[2] || 'mb').toLowerCase();
    switch (unit) {
        case 'kb': return num * 1024;
        case 'gb': return num * 1024 * 1024 * 1024;
        case 'mb':
        default: return num * 1024 * 1024;
    }
}
