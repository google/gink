import { Medallion, ChainStart, CommitBytes, Timestamp } from "./typedefs"
import { Store } from "./Store";
import { Commit } from "transactions_pb";
import { HasMap } from "./HasMap";
import { extractCommitInfo } from "./utils";
// makes an empty Store for testing purposes
export type StoreMaker = () => Promise<Store>;

// Jest complains if there's a test suite without a test.
test('placeholder', () => {
    expect(1 + 2).toBe(3);
});

const MEDALLION1 = 425579549941797;
const START_MICROS1 = Date.parse("2022-02-19 23:24:50") * 1000;
const NEXT_TS1 = Date.parse("2022-02-20 00:39:29") * 1000;

const MEDALLION2 = 458510670893748;
const START_MICROS2 = Date.parse("2022-02-20 00:38:21") * 1000;
const NEXT_TS2 = Date.parse("2022-02-20 00:40:12") * 1000;


function makeChainStart(comment: string, medallion: Medallion, chainStart: ChainStart): CommitBytes {
    const commit = new Commit();
    commit.setChainStart(chainStart);
    commit.setTimestamp(chainStart);
    commit.setMedallion(medallion);
    commit.setComment(comment);
    return commit.serializeBinary();
}

function extendChain(comment: string, previous: CommitBytes, timestamp: Timestamp): CommitBytes {
    const parsedPrevious = Commit.deserializeBinary(previous);
    const subsequent = new Commit();
    subsequent.setMedallion(parsedPrevious.getMedallion());
    subsequent.setPreviousTimestamp(parsedPrevious.getTimestamp());
    subsequent.setChainStart(parsedPrevious.getChainStart());
    subsequent.setTimestamp(timestamp); // one millisecond later
    subsequent.setComment(comment);
    return subsequent.serializeBinary();
}

export async function addTrxns(store: Store, hasMap?: HasMap) {
    const start1 = makeChainStart("chain1,tx1", MEDALLION1, START_MICROS1);
    await store.addCommit(start1, extractCommitInfo(start1));
    const next1 = extendChain("chain1,tx2", start1, NEXT_TS1);
    await store.addCommit(next1, extractCommitInfo(next1));
    const start2 = makeChainStart("chain2,tx1", MEDALLION2, START_MICROS2);
    await store.addCommit(start2, extractCommitInfo(start2));
    const next2 = extendChain("chain2,2", start2, NEXT_TS2);
    await store.addCommit(next2, extractCommitInfo(next2));
}

/**
 * 
 * @param storeMaker must return a fresh (empty) store on each invocation
 * @param implName name of this implementation
 */
export function testStore(implName: string, storeMaker: StoreMaker, replacer?: StoreMaker) {
    let store: Store;

    beforeEach(async () => {
        store = await storeMaker();
        await store.initialized;
    });

    afterEach(async () => {
        await store.close();
    });

    test(`${implName} test accepts chain start but only once`, async () => {
        const chainStart = makeChainStart("Hello, World!", MEDALLION1, START_MICROS1);
        const commitInfo = extractCommitInfo(chainStart)
        const acceptedOnce = await store.addCommit(chainStart, commitInfo);
        const acceptedTwice = await store.addCommit(chainStart, commitInfo);
        expect(acceptedOnce).toBeTruthy();
        expect(acceptedTwice).toBeFalsy();
    });

    test(`${implName} ensure that it rejects when doesn't have chain start`, async () => {
        const chainStart = makeChainStart("Hello, World!", MEDALLION1, START_MICROS1);
        const secondTrxn = extendChain("Hello, again!", chainStart, NEXT_TS1);
        let added = null;
        let barfed = false;
        try {
            added = await store.addCommit(secondTrxn, extractCommitInfo(secondTrxn));
        } catch (e) {
            barfed = true;
        }
        expect(added).toBeFalsy();
        expect(barfed).toBeTruthy();
    });

    test(`${implName} test rejects missing link`, async () => {
        const chainStart = makeChainStart("Hello, World!", MEDALLION1, START_MICROS1);
        const secondTrxn = extendChain("Hello, again!", chainStart, NEXT_TS1);
        const thirdTrxn = extendChain("Hello, a third!", secondTrxn, NEXT_TS1+1);
        await store.addCommit(chainStart, extractCommitInfo(chainStart));
        let added = null;
        let barfed = false;
        try {
            added = await store.addCommit(thirdTrxn, extractCommitInfo(thirdTrxn));
        } catch (e) {
            barfed = true;
        }
        expect(added).toBeFalsy();
        expect(barfed).toBeTruthy();
    });

    test(`${implName} test creates greeting`, async () => {
        await addTrxns(store);
        const hasMap = await store.getHasMap();

        expect(hasMap.getSeenTo(MEDALLION1, START_MICROS1)).toBe(NEXT_TS1);
        expect(hasMap.getSeenTo(MEDALLION2, START_MICROS2)).toBe(NEXT_TS2);
    });

    test(`${implName} test sends trxns in order`, async () => {
        await addTrxns(store);
        if (replacer) {
            await store.close();
            store = await replacer();
        }
        const sent: Array<CommitBytes> = [];
        await store.getCommits((x: CommitBytes) => {sent.push(x);});
        expect(sent.length).toBe(4);
        expect(Commit.deserializeBinary(sent[0]).getTimestamp()).toBe(START_MICROS1);
        expect(Commit.deserializeBinary(sent[1]).getTimestamp()).toBe(START_MICROS2);
        expect(Commit.deserializeBinary(sent[2]).getTimestamp()).toBe(NEXT_TS1);
        expect(Commit.deserializeBinary(sent[3]).getTimestamp()).toBe(NEXT_TS2);
    });

    test(`${implName} test claim chains`, async () => {
        await store.claimChain(MEDALLION1, START_MICROS1);
        await store.claimChain(MEDALLION2, START_MICROS2);
        if (replacer) {
            await store.close();
            store = await replacer();
        }
        const active = await store.getClaimedChains();
        expect(active.size).toBe(2);
        expect(active.get(MEDALLION1)).toBe(START_MICROS1);
        expect(active.get(MEDALLION2)).toBe(START_MICROS2);
    });
}