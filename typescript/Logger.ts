import { now } from "./utils";

export class Logger {
    info(msg: string) {
    // Using console.error to write to stderr on the console.
    console.error(`[INFO ${now()}${this.constructor.name}] ${msg}`);
    }
}