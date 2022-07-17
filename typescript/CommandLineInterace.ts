import { Server } from "./Server";
import { LogBackedStore } from "./LogBackedStore";
import { IndexedDbStore } from "./IndexedDbStore";
import { Store } from "./Store";
import { Client, Commit } from "./Client";
import { info } from "./utils";
var readline = require('readline');


export class CommandLineInterface {
    targets;
    store: Store;
    instance: Client | Server;

    constructor(process: NodeJS.Process) {
        info("starting...");

        const logFile = process.env["GINK_LOG_FILE"];
        const reset = !!process.env["GINK_RESET"];

        if (logFile) {
            info(`using log file=${logFile}, reset=${reset}`);
            this.store = new LogBackedStore(logFile,);
        } else {
            info(`using in-memory database`);
            this.store = new IndexedDbStore();
        }

        if (process.env["GINK_PORT"]) {
            this.instance = new Server(this.store, {
                port: process.env["GINK_PORT"],
                sslKeyFilePath: process.env["GINK_SSL_KEY"],
                sslCertFilePath: process.env["GINK_SSL_CERT"],
                staticPath: process.env["GINK_STATIC_PATH"],
            });
        } else {
            this.instance = new Client(this.store);
        }
        this.targets = process.argv.slice(2);
    }

    async run() {
        await this.instance.initialized;
        for (let target of this.targets) {
            info(`connecting to: ${target}`)
            await this.instance.connectTo(target);
            info(`connected!`)
        }
        const chainManager = await this.instance.getChainManager();
        info(`got chain manager, using medallion=${chainManager.medallion}`)
        info("ready (type a comment and press enter to create a commit)");
        const readlineInterface = readline.createInterface(process.stdin, process.stdout);
        readlineInterface.on('line', async (comment: string) => {
            const commit = new Commit(comment);
            await chainManager.addCommit(commit);
        })
    }

}
