#!/usr/bin/node --unhandled-rejections=strict
const Expector = require("./Expector");
(async () => {
const expector = new Expector("echo one two three");
await expector.expect("two");
// await expector.expect("four"); // should throw after timeout

const catTest = new Expector("cat");
catTest.send("hello world");
await catTest.expect("hello");
console.log("okay");
process.exit(0);
})();
