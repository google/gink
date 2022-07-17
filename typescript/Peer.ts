import { assert } from "console";
import { CommitInfo, CommitBytes } from "./typedefs";
import { makeCommitMessage, noOp } from "./utils";
import { HasMap } from "./HasMap";

export class Peer {
    #sendFunc: (msg: Uint8Array) => void;
    #closeFunc: () => void;
    hasMap?: HasMap;

    constructor(sendFunc: (msg: Uint8Array) => void, closeFunc: () => void = noOp) { 
        this.#sendFunc = sendFunc;
        this.#closeFunc = closeFunc;
    }

    close() {
        var func = this.#closeFunc;
        func();
    }

    receiveHasMap(hasMap: HasMap) {
        assert(!this.hasMap, "Already received a HasMap/Greeting from this Peer!");
        this.hasMap = hasMap;
    }

    /**
     * Sends a commit if we've received a greeting and our internal recordkeeing indicates
     * that the peer could use this particular commit (but ensures that we're not sending
     * commits that would cause gaps in the peer's chain.)
     * @param commitBytes The commit to be sent.
     * @param commitInfo Metadata about the commit.
     */
    sendIfNeeded(commitBytes: CommitBytes, commitInfo: CommitInfo) {
        if (this.hasMap?.markIfNovel(commitInfo, true)) {
            this.#sendFunc(makeCommitMessage(commitBytes));
        }
    }
}