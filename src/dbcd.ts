import BufferWrapper from "./bufferWrapper";
import { DbReader } from "./dbc/dbReader";
import { DBDReader } from "./dbd";
import { DBCProvider, DBDProvider } from "./providers";

export class DBCD {
    private _dbcProvider: DBCProvider;
    private _dbdProvider: DBDProvider;

    constructor(dbcProvider: DBCProvider, dbdProvider: DBDProvider) {
        this._dbcProvider = dbcProvider;
        this._dbdProvider = dbdProvider;
    }

    async load<T = unknown>(tableName: string, build?: string) {
        const dbdData = await this._dbdProvider.getTableName(tableName, build);
        const dbcData = await this._dbcProvider.getTableName(tableName, build);

        var dbdReader = new DBDReader();
        const dbDefinition = dbdReader.read(new BufferWrapper(dbdData));

        const dbReader = new DbReader();
        return dbReader.read<T>(dbcData, dbDefinition);
    }
}