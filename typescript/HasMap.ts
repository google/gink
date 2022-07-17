import { Medallion, Timestamp, ChainStart, SeenThrough, CommitInfo } from "./typedefs"
import { Greeting } from "messages_pb";

/**
 * A class to keep track of what data a given instance (self or peer) has for each
 * chain.  So it's kind of like Map<[Medallion, ChainStart], SeenThrough>.
 * This is essentially the same data thats in the Greeting message, so I've included
 * functionality to convert from/to Greeting objects.
 */
export class HasMap {
    readonly #data: Map<Medallion, Map<ChainStart, Timestamp>> = new Map();

    constructor({ greetingBytes = null, greeting = null }) {
        if (greetingBytes) {
            greeting = Greeting.deserializeBinary(greetingBytes)
        }
        if (!greeting) return;
        for (let entry of greeting.getEntriesList()) {
            const medallion: Medallion = entry.getMedallion();
            const chainStart: ChainStart = entry.getChainStart();
            const seenThrough: SeenThrough = entry.getSeenThrough();
            if (!this.#data.has(medallion)) {
                this.#data.set(medallion, new Map());
            }
            this.#data.get(medallion).set(chainStart, seenThrough);
        }
    }

    /**
     * 
     * @param commitInfo Metadata about a particular commit.
     * @param checkValidExtension If true then barfs if this commit isn't a vaild extension.
     * @returns true if the commit represents data not seen before
     */
    markIfNovel(commitInfo: CommitInfo, checkValidExtension?: Boolean): Boolean {
        if (!this.#data.has(commitInfo.medallion)) {
            this.#data.set(commitInfo.medallion, new Map());
        }
        const innerMap = this.#data.get(commitInfo.medallion);
        const seenThrough = innerMap.get(commitInfo.chainStart) || 0;
        if (commitInfo.timestamp > seenThrough) {
            if (checkValidExtension && commitInfo.priorTime > seenThrough) {
                throw new Error(`proposed commit would be an invalid extension` + JSON.stringify(commitInfo));
            }
            innerMap.set(commitInfo.chainStart, commitInfo.timestamp);
            return true;
        }
        return false;
    }

    constructGreeting(): Greeting {
        const greeting = new Greeting();
        for (const [medallion, medallionMap] of this.#data) {
            for (const [chainStart, seenThrough] of medallionMap) {
                const entry = new Greeting.GreetingEntry();
                entry.setMedallion(medallion);
                entry.setChainStart(chainStart);
                entry.setSeenThrough(seenThrough);
                greeting.addEntries(entry);
            }
        }
        return greeting;
    }

    getSeenTo(medallion: Medallion, chainStart: ChainStart): SeenThrough | undefined {
        const inner = this.#data.get(medallion);
        if (!inner) return undefined;
        return inner.get(chainStart);
    }
}