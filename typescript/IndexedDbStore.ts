
export var mode = "browser";
if (eval("typeof indexedDB") == 'undefined') {  // ts-node has problems with typeof
    eval('require("fake-indexeddb/auto");');  // hide require from webpack
    mode = "node";
}
import { Commit } from "transactions_pb";
import { openDB, deleteDB, IDBPDatabase, IDBPTransaction } from 'idb';
import { Store } from "./Store";
import { CommitBytes, Timestamp, Medallion, ChainStart, CommitInfo, ClaimedChains, PriorTime } from "./typedefs";
import { HasMap } from "./HasMap";
import { info } from "./utils";

// IndexedDb orders entries in its b-tree according to a tuple.
// So this CommitKey is specific to this implementation of the Store.
// [Timestamp, Medallion] should enough to uniquely specify a Commit.
// ChainStart and PriorTime are just included here to avoid re-parsing.
export type CommitKey = [Timestamp, Medallion, ChainStart, PriorTime];

function commitInfoToKey(commitInfo: CommitInfo): CommitKey {
    return [commitInfo.timestamp, commitInfo.medallion, commitInfo.chainStart, commitInfo.priorTime]
}

function commitKeyToInfo(commitKey: CommitKey) {
    return {
        timestamp: commitKey[0],
        medallion: commitKey[1],
        chainStart: commitKey[2],
        priorTime: commitKey[3],
    }
}

export interface ChainInfo {
    medallion: Medallion;
    chainStart: ChainStart;
    seenThrough: Timestamp;
}

export class IndexedDbStore implements Store {

    initialized: Promise<void>;
    #wrapped: IDBPDatabase;

    constructor(indexedDbName = "default", reset = false) {
        info(`creating indexedDb ${indexedDbName}, reset=${reset}`)
        this.initialized = this.#initialize(indexedDbName, reset);
    }

    async #initialize(indexedDbName: string, reset: boolean): Promise<void> {
        if (reset) {
            await deleteDB(indexedDbName, {
                blocked() {
                    const msg = `Unable to delete IndexedDB database ${indexedDbName} !!!`;
                    console.error(msg);
                    throw new Error(msg);
                }
            });
        }
        this.#wrapped = await openDB(indexedDbName, 1, {
            upgrade(db: IDBPDatabase, _oldVersion: number, _newVersion: number, _transaction) {
                // info(`upgrade, oldVersion:${oldVersion}, newVersion:${newVersion}`);
                /*
                     The object store for transactions will store the raw bytes received 
                     for each transaction to avoid dropping unknown fields.  Since this 
                     isn't a javascript object, we'll use 
                     [timestamp, medallion] to keep transactions ordered in time.
                 */
                db.createObjectStore('trxns');

                /*
                    Stores ChainInfo objects.
                    This will keep track of which transactions have been processed per chain.
                */
                db.createObjectStore('chainInfos', { keyPath: ["medallion", "chainStart"] });

                /*
                    Keep track of active chains this instance can write to.
                */
                db.createObjectStore('activeChains', { keyPath: "medallion" });
            },
        });
    }

    async close() {
        await this.initialized;
        this.#wrapped.close();
    }

    async getClaimedChains(): Promise<ClaimedChains> {
        await this.initialized;
        const objectStore = this.#wrapped.transaction("activeChains").objectStore("activeChains");
        const items = await objectStore.getAll();
        const result = new Map();
        for (let i = 0; i < items.length; i++) {
            result.set(items[i].medallion, items[i].chainStart);
        }
        return result;
    }

    async claimChain(medallion: Medallion, chainStart: ChainStart): Promise<void> {
        await this.initialized;
        const wrappedTransaction = this.#wrapped.transaction(['activeChains'], 'readwrite');
        await wrappedTransaction.objectStore('activeChains').add({ chainStart, medallion });
        await wrappedTransaction.done;
    }

    async getHasMap(): Promise<HasMap> {
        await this.initialized;
        const hasMap: HasMap = new HasMap({});
        (await this.#getChainInfos()).map((value) => {
            hasMap.markIfNovel({
                medallion: value.medallion,
                chainStart: value.chainStart,
                timestamp: value.seenThrough
            })
        })
        return hasMap;
    }

    async #getChainInfos(): Promise<Array<ChainInfo>> {
        await this.initialized;
        let wrappedTransaction: IDBPTransaction = this.#wrapped.transaction(['chainInfos']);
        let store = wrappedTransaction.objectStore('chainInfos');
        return await store.getAll();
    }

    async addCommit(commitBytes: CommitBytes, commitInfo: CommitInfo): Promise<Boolean> {
        await this.initialized;
        const { timestamp, medallion, chainStart, priorTime } = commitInfo
        const wrappedTransaction = this.#wrapped.transaction(['trxns', 'chainInfos'], 'readwrite');
        let oldChainInfo: ChainInfo = await wrappedTransaction.objectStore("chainInfos").get([medallion, chainStart]);
        if (oldChainInfo || priorTime != 0) {
            if (oldChainInfo?.seenThrough >= timestamp) {
                return false;
            }
            if (oldChainInfo?.seenThrough != priorTime) {
                throw new Error(`missing prior chain entry for ${commitInfo}, have ${oldChainInfo}`);
            }
        }
        let newInfo: ChainInfo = {
            medallion: medallion,
            chainStart: chainStart,
            seenThrough: timestamp,
        }
        await wrappedTransaction.objectStore("chainInfos").put(newInfo);
        // Only timestamp and medallion are required for uniqueness, the others just added to make
        // the getNeededTransactions faster by not requiring re-parsing.
        const commitKey: CommitKey = commitInfoToKey(commitInfo);
        await wrappedTransaction.objectStore("trxns").add(commitBytes, commitKey);
        await wrappedTransaction.done;
        return true;
    }

    // Note the IndexedDB has problems when await is called on anything unrelated
    // to the current commit, so its best if `callBack` doesn't await.
    async getCommits(callBack: (commitBytes: Commit, commitInfo: CommitInfo) => void) {
        await this.initialized;

        // We loop through all commits and send those the peer doesn't have.
        for (let cursor = await this.#wrapped.transaction("trxns").objectStore("trxns").openCursor();
            cursor; cursor = await cursor.continue()) {
            const commitKey = <CommitKey>cursor.key;
            const commitInfo = commitKeyToInfo(commitKey);
            const commitBytes: CommitBytes = cursor.value;
            callBack(commitBytes, commitInfo);
        }
    }
}