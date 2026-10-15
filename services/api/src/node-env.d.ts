declare module 'node:http' {
  export interface IncomingHttpHeaders {
    [header: string]: string | string[] | undefined;
  }

  export class IncomingMessage {
    headers: IncomingHttpHeaders;
    method?: string | undefined;
    url?: string | undefined;
    on(event: 'data', listener: (chunk: Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: unknown) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export class ServerResponse {
    setHeader(name: string, value: string | number | readonly string[]): this;
    writeHead(
      statusCode: number,
      headers?: Record<string, string | number | readonly string[]>,
    ): this;
    end(chunk?: unknown, callback?: () => void): this;
  }

  export interface Server {
    listen(port: number, host: string, listeningListener?: () => void): this;
    close(callback?: (err?: Error) => void): this;
    address(): string | { address: string; family: string; port: number } | null;
    once(event: string, listener: (...args: unknown[]) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export function createServer(
    requestListener?: (req: IncomingMessage, res: ServerResponse) => void,
  ): Server;
}

declare module 'node:net' {
  export interface AddressInfo {
    address: string;
    family: string;
    port: number;
  }
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
  export function readFileSync(path: string): Buffer;
  export function existsSync(path: string): boolean;
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare interface Buffer {
  readonly length: number;
  toString(encoding?: string): string;
}

declare const Buffer: {
  concat(list: readonly Buffer[], totalLength?: number): Buffer;
  from(data: string, encoding?: string): Buffer;
};

declare const process: {
  readonly env: Record<string, string | undefined>;
  readonly exit: (code?: number) => void;
  readonly on?: (signal: string, callback: () => void) => void;
};
