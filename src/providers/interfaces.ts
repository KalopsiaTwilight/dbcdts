export interface DBCProvider {
    getTableName(tableName: string, build?: string): Promise<Buffer>
}

export interface DBDProvider {
    getTableName(tableName: string, build?: string): Promise<Buffer>
}