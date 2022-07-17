#!/usr/bin/node --unhandled-rejections=strict
const Expector = require("./Expector");
(async () => {
    const server = new Expector("make server");
    await server.expect("ready", 3000);
    const client = new Expector("make client");
    await client.expect("ready", 3000);

    server.send("hello\r\n");
    await client.expect(/received commit:.*hello/);

    client.send("world\r\n");
    await server.expect(/received commit:.*world/);

    await server.close();
    await client.close();
    console.log("ok!");
    //process.exit(0);
})();
