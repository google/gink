import { CommitBytes, CommitInfo, ClaimedChains, Medallion, ChainStart } from "./typedefs"
import { HasMap } from "./HasMap"

export interface Store {

    readonly initialized: Promise<void>;

    /**
     * Generates a HasMap describing how much of each chain this store has.
     * Note that this might be expensive to compute (e.g. require going to disk),
     * so it's best for a user of this class to get a has map and then update that
     * in-memory accounting object rather than re-requesting all the time.
     */
    getHasMap: () => Promise<HasMap>;

    /**
     * Returns a set of chains that may be appended to.
     * You'll need to getHasMap to figure out the last 
     * commit for any chain you want to add to though.
     */
    getClaimedChains: () => Promise<ClaimedChains>;

    /**
     * Mark a chain as being owned by this store.
     */
    claimChain: (medallion: Medallion, chainStart: ChainStart) => Promise<void>;

    /**
     * Mark a chain as being closed and unavailable for new commits.
     * (Not really necessary when medallions are randomly generated).
     * endChain: (medallion: Medallion) => Promise<void>;
     * Needs to be added for version 2;
     */

    /**
     * Tries to add a commit to this store; returns truthy
     * if actually added, false if not (e.g. if already has it).
     * If adding to the store, will also update the passed HasMap.
     * Will throw if passed a commit without the proceeding
     * ones in the associated chain.
     */
    addCommit: (trxn: CommitBytes, commitInfo: CommitInfo) => Promise<Boolean>;

    /**
     * Get all commits from a store ordered by [timestamp, medallion].
     * Intended to be used to send to a peer.
     * 
     * The callback should *NOT* await on anything (will cause problems 
     * with the IndexedDb implementation if you do).
     */
    getCommits: (callback: (commitBytes: CommitBytes, commitInfo: CommitInfo) => void) => Promise<void>;

    close: () => Promise<void>;
}