import { DBCProvider } from "./interfaces";

const dbdManifest = "https://raw.githubusercontent.com/wowdev/WoWDBDefs/master/manifest.json";
const baseUrl = "https://wago.tools/api/casc/";

export interface DBDManifestEntry {
    tableName: string;
    tableHash: string;
    db2FileDataID: number;
    dbcFileDataID?: number;
}

export class WagoDBCProvider implements DBCProvider {
    isLoaded: boolean;
    
    tableLookup: { [key: string]: number };

    constructor() {
        this.tableLookup = { };
    }

    async init() {
        const manifestResp = await fetch(dbdManifest);
        const manifest = await manifestResp.json() as DBDManifestEntry[];
        for(const entry of manifest) {
            this.tableLookup[entry.tableName] = entry.db2FileDataID;
        }
        this.isLoaded = true;
    }

    async getTableName(tableName: string, build?: string): Promise<Buffer> {
        if (!this.isLoaded) {
            throw new Error("WagoDBCProvider must be initialized with .init() before tables can be loaded.")
        }

        const fileId = this.tableLookup[tableName];
        const url = `${baseUrl}${fileId}?version=${build}`;
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error("Unable to fetch data from wago tools.")
        }
        const arr = await resp.arrayBuffer();
        return Buffer.from(arr);
    }
}