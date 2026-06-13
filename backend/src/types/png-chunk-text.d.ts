declare module 'png-chunk-text' {
    interface TextChunk {
        keyword: string;
        text: string;
    }
    export function encode(keyword: string, text: string): { name: string; data: Uint8Array };
    export function decode(data: Uint8Array): TextChunk;
}
