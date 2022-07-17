import { testStore } from "./Store.test";
import { IndexedDbStore } from "./IndexedDbStore";

testStore('IndexedDbStore', async () => new IndexedDbStore("test", true));