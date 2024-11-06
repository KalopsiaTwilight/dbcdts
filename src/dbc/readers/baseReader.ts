import { TextEncoder } from "node:util";

import BufferWrapper from "../../bufferWrapper";
import { DB2Flags } from "../../db2flags";

import { ColumnMetaData, FieldMetaData, IDBRow, SparseEntry } from "./interfaces";

export abstract class BaseReader {
    RecordsCount: number;
    FieldsCount: number;
    RecordSize: number;
    StringTableSize: number;

    // WDB2-WDB3
    Build: number;

    // WDB2+
    MinIndex: number;
    MaxIndex: number;

    // WDB3+
    Flags: DB2Flags;
    Locale: number;

    // WDB5+
    TableHash: number;
    LayoutHash: number;
    IdFieldIndex: number;

    // WDC1+
    PackedDataOffset: number;

    // WDC5+
    SchemaVersion: number;
    SchemaString: string;

    Meta: FieldMetaData[];
    IndexData: number[];
    ColumnMeta: ColumnMetaData[];
    PalletData: number[][];
    CommonData: Map<number, number>[]
    StringTable: Map<bigint, string>;
    ForeignKeyData: number[];

    protected CopyData: Map<number, number>
    protected RecordsData: number[];
    protected SparseEntries: SparseEntry[];

    constructor() {
        this.StringTable = new Map();
        this.SparseEntries = [];
        this.CopyData = new Map();
    }

    clear()
    {
        this.IndexData = null;
        this.PalletData = null;
        this.ColumnMeta = null;
        this.RecordsData = null;
        this.ForeignKeyData = null;
        this.CommonData = null;

        this.StringTable = new Map();
        this.SparseEntries = [];
        this.CopyData = new Map();
    }

    protected readStringTable(reader: BufferWrapper, size: number, baseOffset = 0, usePos = false) {
        var stringTable: Map<bigint, string> = new Map();

        if (size == 0) {
            return stringTable;
        }

        const encoder = new TextEncoder();

        let curOfs = 0;
        const data = reader.readString(size, 'utf8');
        const split = data.split('\0');
        for(const str in split) {
            if (curOfs === size) {
                break;
            }

            if (usePos) {
                stringTable.set(BigInt(reader._ofs - size + curOfs), str);
            } else {
                stringTable.set(BigInt(baseOffset + curOfs), str);
            }
            curOfs += encoder.encode(str).length + 1;
        }

        return stringTable;
    }
}
