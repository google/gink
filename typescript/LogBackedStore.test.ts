import { LogBackedStore } from "./LogBackedStore";
import { testStore } from "./Store.test";

const TEST_FILE = "/tmp/test.store";
testStore('LogBackedStore',
    async () => new LogBackedStore(TEST_FILE, true),
    async () => new LogBackedStore(TEST_FILE, false)
);

test('test locks', async () => {
    const lbs2 = new LogBackedStore(TEST_FILE);
    let result = "unknown";
    await lbs2.initialized.then(() => { result = "acquired"; }).catch(() => { result = "barfed"; });
    if (result != "barfed") {
        throw new Error("locking broken");
    }
})