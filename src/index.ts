import { App } from "./App";
import { BackupManagerV1 } from "backup/BackupManagerV1";
import { LocalStorage } from "./storage/LocalStorage";
// import { IndexDBStorage } from "storage/IndexDBStorage";

window.addEventListener("load", () => {
  new App(new LocalStorage(), new BackupManagerV1(), window).run();
});
