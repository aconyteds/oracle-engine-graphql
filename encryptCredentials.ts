import fs from "fs";
import path from "path";

const file = path.resolve(__dirname, "oracle-engine.firebase.private.json");
const content = fs.readFileSync(file, { encoding: "utf-8" });

const encoded = btoa(content);
console.log(encoded);
