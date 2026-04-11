type ConnectionConsole = {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    log(message: string): void;
};

export class ServerLogger {
    private readonly output: ConnectionConsole;

    public constructor(output: ConnectionConsole) {
        this.output = output;
    }

    public info(message: string): void {
        this.output.info(message);
    }

    public warn(message: string): void {
        this.output.warn(message);
    }

    public error(message: string): void {
        this.output.error(message);
    }

    public log(message: string): void {
        this.output.log(message);
    }
}
