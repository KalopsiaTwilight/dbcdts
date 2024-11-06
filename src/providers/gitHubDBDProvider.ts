import { DBDProvider } from "./interfaces";

const baseUrl = "https://raw.githubusercontent.com/wowdev/WoWDBDefs/master/definitions/";

export class GitHubDBDProvider implements DBDProvider {
    async getTableName(tableName: string): Promise<Buffer> {
        const resp = await fetch(`${baseUrl}/${tableName}.dbd`, {})

        const arr = await resp.arrayBuffer();
        return Buffer.from(arr);
    }
}