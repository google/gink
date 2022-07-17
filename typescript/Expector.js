#!/usr/bin/node 
const { spawn } = require('child_process');
/**
Expector is a utility class to replecate the functionality found in the command line 
utility "expect" and allow me to test the command line interface in integration tests.
*/
module.exports = class Expector {
    constructor(shellCmd) {
        const thisExpector = this;
        this.captured = "";
        this.expecting = null;
        this.proc = spawn(shellCmd, [], {shell: true});
        const appender = this.notify.bind(this);
        this.proc.stdout.on('data', appender);
        this.proc.stderr.on('data', appender);
    }
    notify(fragment) {
        if (fragment) this.captured += fragment;
        if (!this.expecting) return;
        const match = this.captured.match(this.expecting);
        if (match) {
            this.captured = "";
            this.expecting = null;
            this.onHit(match);
        }
    }
    async expect(what, timeout=1000) {
        this.expecting = what;
        const thisExpector = this;
        const returning = new Promise((resolve, reject) => {
            thisExpector.onHit = resolve;
            setTimeout(()=>{reject(`expected ${what}, had ${thisExpector.captured}`)}, timeout);
        });
        this.notify();
        return returning;
    }
    send(what) { this.proc.stdin.write(what); }
    async close(timeout=1000) { 
        const thisExpector = this;
        const returning = new Promise((resolve, reject) => {
            thisExpector.proc.on('close', resolve);
            setTimeout(reject, timeout);
        });
        this.proc.kill(); 
        return returning;
    }
}
