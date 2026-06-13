declare module 'png-chunks-extract' {
    interface PngChunk {
        name: string;
        data: Uint8Array;
    }
    export default function extract(buffer: Uint8Array): PngChunk[];
}
