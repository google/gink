#!/usr/bin/env ts-node
import {server as WebSocketServer, connection as WebSocketConnection, Message} from 'websocket';
import {createServer as createHttpServer, Server as HttpServer} from 'http';
import {createServer as createHttpsServer, Server as HttpsServer} from 'https';
import {Server as StaticServer} from 'node-static';
import { readFileSync } from 'fs';
const staticServer = new StaticServer(process.env["PWD"])
function now() { return (new Date()).toISOString(); }

const port = process.env["GINK_PORT"] || "8080";
var httpServer: HttpServer | HttpsServer;
if (process.env["GINK_SSL_KEY"] && process.env["GINK_SSL_CERT"]) {
    var options = {
        key: readFileSync(process.env["GINK_SSL_KEY"]),
        cert: readFileSync(process.env["GINK_SSL_CERT"]),
      };
      httpServer = createHttpsServer(options, function (request, response) {
        staticServer.serve(request, response);
      }).listen(port, () => console.log(`${now()} Secure server is listening on port ${port}`));
      
} else {
    httpServer = createHttpServer(function(request, response) {staticServer.serve(request, response);});
    httpServer.listen(port, function() {
        console.log(`${now()} Insecure server is listening on port ${port}`);
    });    
}

var websocketServer = new WebSocketServer({
    httpServer: httpServer,
});
let connection: WebSocketConnection;

function onMessage(message: Message) {
    if (message.type === 'utf8') {
        console.log('Received Message: ' + message.utf8Data);
        connection.sendUTF(message.utf8Data);
    }
    else if (message.type === 'binary') {
        console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
        connection.sendBytes(message.binaryData);
    }
}

websocketServer.on('request', function(request) {
    let protocol: string = null;
    if (request.requestedProtocols.length) {
        if (request.requestedProtocols.includes("echo"))
            protocol = "echo";
        else
            request.reject(400, "bad protocol");
    }
    connection = request.accept(protocol);
    console.log((now()) + ' Connection accepted.');
    connection.on('message', onMessage);
    connection.on('close', function(reasonCode, description) {
        console.log((now()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});
