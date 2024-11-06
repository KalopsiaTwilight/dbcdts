import BitReader from "../../bitReader";

export interface IDBRow
{
    Id: number;
    Data: BitReader
    clone(): IDBRow
}

export interface IEncryptableDatabaseSection
{
    TactKeyLookup: bigint
    NumRecords: number
}

export interface IEncryptionSupportingReader
{
    GetEncryptedSections(): IEncryptableDatabaseSection[];
    GetEncryptedIDs(): { [key: number]: number[] }
}

export interface FieldMetaData
{
    Bits: number;
    Offset: number;
}

export interface ColumnMetaData
{
    RecordOffset: number;
    Size: number;
    AdditionalDataSize: number;
    CompressionType: CompressionType;
    ColumnCompressionData: [number, number, number];
}

export enum CompressionType
{
    None = 0,
    Immediate = 1,
    Common = 2,
    Pallet = 3,
    PalletArray = 4,
    SignedImmediate = 5
}


export interface ReferenceEntry {
    Id: number
    Index: number
}

export class ReferenceData {
    NumRecords: number
    MinId: number
    MaxId: number
    Entries: Map<number, number>

    constructor() {
        this.Entries = new Map()
    }
}

export interface SparseEntry {
    Offset: number
    Size: number
}

export interface SectionHeader extends IEncryptableDatabaseSection
{
    TactKeyLookup: bigint
    FileOffset: number
    NumRecords: number
    StringTableSize: number
    CopyTableSize: number
    SparseTableOffset: number
    IndexDataSize: number
    ParentLookupDataSize: number
}

export interface SectionHeaderWDC3 extends IEncryptableDatabaseSection
{
    TactKeyLookup: bigint
    FileOffset: number
    NumRecords: number
    StringTableSize: number
    OffsetRecordsEndOffset: number
    IndexDataSize: number
    ParentLookupDataSize: number
    OffsetMapIDCount: number
    CopyTableCount: number
}

export interface SectionHeaderWDC4 extends IEncryptableDatabaseSection
{
    TactKeyLookup: bigint
    FileOffset: number
    NumRecords: number
    StringTableSize: number
    OffsetRecordsEndOffset: number
    IndexDataSize: number
    ParentLookupDataSize: number
    OffsetMapIDCount: number
    CopyTableCount: number
}

export interface SectionHeaderWDC5 extends IEncryptableDatabaseSection
{
    TactKeyLookup: bigint
    FileOffset: number
    NumRecords: number
    StringTableSize: number
    OffsetRecordsEndOffset: number
    IndexDataSize: number
    ParentLookupDataSize: number
    OffsetMapIDCount: number
    CopyTableCount: number
}