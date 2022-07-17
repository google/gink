import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'https';
import { readFileSync } from 'fs';
import { Server as StaticServer } from 'node-static';
import { info } from "./utils";
import {
    server as WebSocketServer, request as WebSocketRequest,
    connection as WebSocketConnection, Message as WebSocketMessage
} from 'websocket';
import { Client } from "./Client";
import { Peer } from './Peer';
import { Buffer } from "buffer";
import { Store } from "./Store";

type FilePath = string;
type NumberStr = string;
const PROTOCOL = "gink";

export interface ServerArgs {
    port?: NumberStr;
    sslKeyFilePath?: FilePath;
    sslCertFilePath?: FilePath;
    medallion?: NumberStr;
    staticPath?: string;
}

export class Server extends Client {
    #websocketServer: WebSocketServer;

    constructor(store: Store, args: ServerArgs) {
        super(store);
        const staticPath = args.staticPath || __dirname.split("/").slice(0, -1).join("/");
        const staticServer = new StaticServer(staticPath);
        const port = args.port || "8080";
        const thisServer = this;
        let httpServer: HttpServer | HttpsServer;
        if (args["sslKeyFilePath"] && args["sslCertFilePath"]) {
            var options = {
                key: readFileSync(args["sslKeyFilePath"]),
                cert: readFileSync(args["sslCertFilePath"]),
            };
            httpServer = createHttpsServer(options, function (request, response) {
                staticServer.serve(request, response);
            }).listen(port, () => info(
                `Secure server is listening on port ${port}`));
        } else {
            httpServer = createHttpServer(function (request, response) {
                staticServer.serve(request, response);
            });
            httpServer.listen(port, function () {
                info(`Insecure server is listening on port ${port}`);
            });
        }
        this.#websocketServer = new WebSocketServer({ httpServer });
        this.#websocketServer.on('request', this.#onRequest.bind(this));
    }

    async #onRequest(request: WebSocketRequest) {
        await this.initialized;
        const thisServer = this; // do pass into closures
        let protocol: string | null = null;
        if (request.requestedProtocols.length) {
            if (request.requestedProtocols.includes(PROTOCOL))
                protocol = PROTOCOL;
            else
                return request.reject(400, "bad protocol");
        }
        const connection: WebSocketConnection = request.accept(protocol, request.origin);
        info(`Connection accepted.`);
        const sendFunc = (data: Uint8Array) => { connection.sendBytes(Buffer.from(data)); };
        const closeFunc = () => { connection.close(); };
        const connectionId = this.createConnectionId();
        const peer = new Peer(sendFunc, closeFunc);
        this.peers.set(connectionId, peer);
        connection.on('close', function (_reasonCode, _description) {
            thisServer.peers.delete(connectionId);
            info(' Peer ' + connection.remoteAddress + ' disconnected.');
        });
        connection.on('message', this.#onMessage.bind(this, connectionId));
        sendFunc(this.getGreetingMessageBytes());
    }

    #onMessage(connectionId: number, webSocketMessage: WebSocketMessage) {
        if (webSocketMessage.type === 'utf8') {
            info('Received Text Message: ' + webSocketMessage.utf8Data);
        }
        else if (webSocketMessage.type === 'binary') {
            info('Server received binary message of ' + webSocketMessage.binaryData.length + ' bytes.');
            this.receiveMessage(webSocketMessage.binaryData, connectionId);
        }
    }
}