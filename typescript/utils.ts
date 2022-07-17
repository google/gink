import { CommitInfo } from "./typedefs"
import { Message } from "messages_pb";
import { Commit } from "transactions_pb";

export function extractCommitInfo(commitBytes: Uint8Array): CommitInfo {
    const parsed = Commit.deserializeBinary(commitBytes);
    return {
        timestamp: parsed.getTimestamp(), 
        medallion: parsed.getMedallion(), 
        chainStart: parsed.getChainStart(), 
        priorTime: parsed.getPreviousTimestamp(),
        comment: parsed.getComment(),
    }
}

export var assert = assert || function (x: any, msg?: string) {
    if (!x) throw new Error(msg ?? "assert failed");
}

export function now() { return (new Date()).toISOString(); }

export function noOp() {};

/**
 * The Message proto contains an embedded oneof.  Essentially this will wrap
 * the commit bytes payload in a wrapper by prefixing a few bytes to it.
 * In theory the "Message" proto could be expanded with some extra metadata
 * (e.g. send time) in the future.
 * Note that the commit is always passed around as bytes and then
 * re-parsed as needed to avoid losing unknown fields.
 * @param commitBytes: the bytes corresponding to a commit
 * @returns a serialized "Message" proto
 */
export function makeCommitMessage(commitBytes: Uint8Array): Uint8Array {
    const message = new Message();
    message.setCommit(commitBytes);
    const msgBytes = message.serializeBinary();
    return msgBytes;
}

export function makeMedallion() {
    // TODO: figure out a cryptographically secure random number generator
    // that will work in both node and the browser.
    const result = Math.floor(Math.random() * (2**48)) + 2**48;
    assert(result < 2**49 && result > 2**48);
    return result;
}

let logLevel = 0;

export function setLogLevel(level: number) {
    logLevel = level;
}

export function info(msg: string) {
    if (logLevel < 1) return;
    const stackString = new Error().stack;
    const callerLine = stackString.split("\n")[2];
    const caller = callerLine.split(/\//).pop().replace(/:\d+\)/,"");
    const timestamp = now().split("T").pop();
    // using console.error because I want to write to stderr
    console.error(`[${timestamp} ${caller}] ${msg}`);
}
