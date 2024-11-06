
import { DB2Flags, hasDB2Flag } from "../../db2flags";
import BitReader from "../../bitReader";
import {
    ColumnDefinition, DBDefinition, Definition, FieldType, getByteLength,
    getFieldTypeFromDBD, getVersionDefinitionByLayoutHash, reinterpretAsFieldType
} from "../../dbd";
import BufferWrapper from "../../bufferWrapper";
import { decimalToHex } from "../../utils";

import { BaseReader } from "./baseReader";
import { ColumnMetaData, CompressionType, FieldMetaData, IDBRow, ReferenceData, SectionHeaderWDC3 } from "./interfaces";
import { BaseEncryptionSupportingReader } from "./baseEncryptionSupportingReader";

export class WDC3Row implements IDBRow {
    private _reader: BaseReader;
    private _dataOffset: number;
    private _dataBitPosition: number;
    private _recordOffset: number;
    private _recordIndex: number;

    Id: number;
    Data: BitReader;

    private _fieldMeta: FieldMetaData[];
    private _columnMeta: ColumnMetaData[];
    private _palletData: number[][];
    private _commonData: Map<number, number>[]
    private _refId: number;

    constructor(reader: BaseReader, data: BitReader, id: number, refID: number, recordIndex: number) {
        this._reader = reader;
        this.Data = data;
        this._recordOffset = (recordIndex * reader.RecordSize) - (reader.RecordsCount * reader.RecordSize);
        this._recordIndex = recordIndex;
        this._dataOffset = data.byteOffset;
        this._dataBitPosition = data.bitPosition;
        this._fieldMeta = reader.Meta;
        this._columnMeta = reader.ColumnMeta;
        this._palletData = reader.PalletData;
        this._commonData = reader.CommonData;
        this._refId = refID;

        this.Id = id;
    }

    readData<T extends {}>(fields: Definition[], columnInfos: ColumnDefinition[]): T {
        let entry: T = {} as T;
        let indexFieldOffSet = 0;

        this.Data.bitPosition = this._dataBitPosition;
        this.Data.byteOffset = this._dataOffset;

        for (let i = 0; i < columnInfos.length; i++) {
            const definition = fields[i];
            const info = columnInfos[i];
            if (i == this._reader.IdFieldIndex) {
                if (this.Id != -1)
                    indexFieldOffSet++;
                else {
                    this.Id = 0;
                    this.Id = this.GetFieldValue(i, FieldType.Int32);
                }

                entry[definition.name as keyof T] = this.Id as T[keyof T];
                continue;
            }

            let value: unknown = null;
            let fieldIndex = i - indexFieldOffSet;

            if (fieldIndex >= this._reader.Meta.length) {
                entry[definition.name as keyof T] = this._refId as T[keyof T];
                continue;
            }

            const fieldType = getFieldTypeFromDBD(definition, info);

            if (definition.arrLength > 0) {
                if (info.type === 'string' || info.type === 'locstring') {
                    this.GetFieldValueStringArray(fieldIndex);
                } else {
                    value = this.GetFieldValueArray(fieldIndex, fieldType);
                }
            }
            else {
                if (info.type === 'string' || info.type === 'locstring') {
                    if (hasDB2Flag(this._reader.Flags, DB2Flags.Sparse)) {
                        value = this.Data.readCString();
                    } else {
                        value = this.getStringTableRecord(fieldIndex);
                    }
                } else {
                    value = this.GetFieldValue(fieldIndex, fieldType);
                }
            }

            entry[definition.name as keyof T] = value as T[keyof T];
        }
        return entry;
    }

    private getStringTableRecord(i: number) {
        var index = this._recordOffset + (this.Data.bitPosition >> 3) + this.GetFieldValue(i, FieldType.Int32);

        // This presumably is needed because when strings are supposed to be empty ('0' in record data) the index turns negative, which is invalid.
        if (index < 0)
            index = 0;

        return this._reader.StringTable.get(BigInt(index));
    }

    private GetFieldValue(i: number, type: FieldType.Float): number
    private GetFieldValue(i: number, type: FieldType.Int8): number
    private GetFieldValue(i: number, type: FieldType.Int16): number
    private GetFieldValue(i: number, type: FieldType.Int32): number
    private GetFieldValue(i: number, type: FieldType.Int64): bigint
    private GetFieldValue(i: number, type: FieldType.NonInlineID): number
    private GetFieldValue(i: number, type: FieldType.Relation): number
    private GetFieldValue(i: number, type: FieldType.UInt8): number
    private GetFieldValue(i: number, type: FieldType.UInt16): number
    private GetFieldValue(i: number, type: FieldType.UInt32): number
    private GetFieldValue(i: number, type: FieldType.UInt64): bigint
    private GetFieldValue(i: number, type: FieldType): number | bigint
    private GetFieldValue(i: number, fieldType: FieldType) {
        const fieldMeta = this._fieldMeta[i];
        const columnMeta = this._columnMeta[i];
        const palletData = this._palletData[i];
        const commonData = this._commonData[i];

        switch (columnMeta.CompressionType) {
            case CompressionType.None: {
                let bitSize = 32 - fieldMeta.Bits;
                if (bitSize <= 0)
                    bitSize = columnMeta.ColumnCompressionData[1];

                return reinterpretAsFieldType(this.Data.readValue64(bitSize), fieldType);
            }
            case CompressionType.SignedImmediate: {
                return reinterpretAsFieldType(this.Data.readValue64Signed(columnMeta.ColumnCompressionData[1]), fieldType);
            }
            case CompressionType.Immediate: {
                return reinterpretAsFieldType(this.Data.readValue64(columnMeta.ColumnCompressionData[1]), fieldType);
            }
            case CompressionType.Common: {
                if (commonData.get(this.Id)) {
                    return commonData.get(this.Id);
                }
                return reinterpretAsFieldType(columnMeta.ColumnCompressionData[0], fieldType);
            }
            case CompressionType.Pallet: {
                let palletIndex = this.Data.readValue32(columnMeta.ColumnCompressionData[1]);
                return reinterpretAsFieldType(palletData[palletIndex], fieldType);
            }
            case CompressionType.PalletArray: {
                if (columnMeta.ColumnCompressionData[2] != 1)
                    break;

                let palletIndex = this.Data.readValue32(columnMeta.ColumnCompressionData[1]);
                return reinterpretAsFieldType(palletData[palletIndex], fieldType);
            }
        }

        throw new Error(`Unexpected compression type ${columnMeta.CompressionType}`);
    }

    private GetFieldValueArray(i: number, type: FieldType.Float): number[]
    private GetFieldValueArray(i: number, type: FieldType.Int8): number[]
    private GetFieldValueArray(i: number, type: FieldType.Int16): number[]
    private GetFieldValueArray(i: number, type: FieldType.Int32): number[]
    private GetFieldValueArray(i: number, type: FieldType.Int64): bigint[]
    private GetFieldValueArray(i: number, type: FieldType.NonInlineID): number[]
    private GetFieldValueArray(i: number, type: FieldType.Relation): number[]
    private GetFieldValueArray(i: number, type: FieldType.UInt8): number[]
    private GetFieldValueArray(i: number, type: FieldType.UInt16): number[]
    private GetFieldValueArray(i: number, type: FieldType.UInt32): number[]
    private GetFieldValueArray(i: number, type: FieldType.UInt64): bigint[]
    private GetFieldValueArray(i: number, type: FieldType): (number | bigint)[]
    private GetFieldValueArray(i: number, fieldType: FieldType) {
        const fieldMeta = this._fieldMeta[i];
        const columnMeta = this._columnMeta[i];
        const palletData = this._palletData[i];

        switch (columnMeta.CompressionType) {
            case CompressionType.None: {
                let bitSize = 32 - fieldMeta.Bits;
                if (bitSize <= 0)
                    bitSize = columnMeta.ColumnCompressionData[1];

                let result = [];
                let arrayLength = columnMeta.Size / (getByteLength(fieldType) * 8);
                for (let i = 0; i < arrayLength; i++) {
                    result.push(reinterpretAsFieldType(this.Data.readValue64(bitSize), fieldType));
                }

                return result;
            }
            case CompressionType.PalletArray: {
                const cardinality = columnMeta.ColumnCompressionData[2];
                const palletArrayIndex = this.Data.readValue32(columnMeta.ColumnCompressionData[1]);

                let result = [];
                for (let i = 0; i < cardinality; i++)
                    result.push(reinterpretAsFieldType(palletData[i + cardinality * palletArrayIndex], fieldType));

                return result;
            }
        }

        throw new Error(`Unexpected compression type ${columnMeta.CompressionType}`);
    }

    private GetFieldValueStringArray(i: number): string[] {
        const fieldMeta = this._fieldMeta[i];
        const columnMeta = this._columnMeta[i];

        switch (columnMeta.CompressionType) {
            case CompressionType.None:
                let bitSize = 32 - fieldMeta.Bits;
                if (bitSize <= 0)
                    bitSize = columnMeta.ColumnCompressionData[1];

                const result: string[] = [];
                let arrayLength = columnMeta.Size / (4 * 8);
                for (let i = 0; i < arrayLength; i++) {
                    let index = BigInt((this.Data.bitPosition >> 3) + this._recordOffset) + this.Data.readValue64(bitSize);

                    // This presumably is needed because when strings are supposed to be empty ('0' in record data) the index turns negative, which is invalid.
                    if (index < 0)
                        index = BigInt(0);

                    result.push(this._reader.StringTable.get(index));
                }

                return result;
        }

        throw new Error(`Unexpected compression type ${columnMeta.CompressionType}`);
    }

    clone() {
        return new WDC3Row(this._reader, this.Data, this.Id, this._refId, this._recordIndex);
    }
}

export class WDC3Reader extends BaseEncryptionSupportingReader {
    private HeaderSize = 72;
    private WDC3FmtSig = 0x33434457; // WDC3

    constructor() {
        super();
    }

    readRecords<T>(reader: BufferWrapper, dbDefinition: DBDefinition) {
        if (reader.byteLength < this.HeaderSize) {
            throw new Error("Invalid size of WDC3 file.");
        }

        const magic = reader.readUInt32LE();
        if (magic != this.WDC3FmtSig) {
            throw new Error("Invalid magic number in WDC3 file.");
        }

        this.RecordsCount = reader.readInt32LE();
        this.FieldsCount = reader.readInt32LE();
        this.RecordSize = reader.readInt32LE();
        this.StringTableSize = reader.readInt32LE();
        this.TableHash = reader.readUInt32LE();
        this.LayoutHash = reader.readUInt32LE();
        this.MinIndex = reader.readInt32LE();
        this.MaxIndex = reader.readInt32LE();
        this.Locale = reader.readInt32LE();
        this.Flags = reader.readUInt16LE();
        this.IdFieldIndex = reader.readUInt16LE();
        const totalFieldsCount = reader.readInt32LE();
        this.PackedDataOffset = reader.readInt32LE();   // Offset within the field where packed data starts
        const lookupColumnCount = reader.readInt32LE();   // count of lookup columns
        const columnMetaDataSize = reader.readInt32LE();   // 24 * NumFields bytes, describes column bit packing, {ushort recordOffset, ushort size, uint additionalDataSize, uint compressionType, uint packedDataOffset or commonvalue, uint cellSize, uint cardinality}[NumFields], sizeof(DBC2CommonValue) == 8
        const commonDataSize = reader.readInt32LE();
        const palletDataSize = reader.readInt32LE();   // in bytes, sizeof(DBC2PalletValue) == 4
        const sectionsCount = reader.readInt32LE();

        const sectionHeaders: SectionHeaderWDC3[] = new Array(sectionsCount);
        for (let i = 0; i < sectionsCount; i++) {
            sectionHeaders[i] = {
                TactKeyLookup: reader.readUInt64LE(),
                FileOffset: reader.readUInt32LE(),
                NumRecords: reader.readUInt32LE(),
                StringTableSize: reader.readUInt32LE(),
                OffsetRecordsEndOffset: reader.readUInt32LE(),
                IndexDataSize: reader.readUInt32LE(),
                ParentLookupDataSize: reader.readUInt32LE(),
                OffsetMapIDCount: reader.readUInt32LE(),
                CopyTableCount: reader.readUInt32LE()
            };
        }

        this.Meta = new Array(this.FieldsCount);
        for (let i = 0; i < this.FieldsCount; i++) {
            this.Meta[i] = {
                Bits: reader.readInt16LE(),
                Offset: reader.readUInt16LE()
            }
        }

        this.ColumnMeta = new Array(this.FieldsCount);
        for (let i = 0; i < this.FieldsCount; i++) {
            this.ColumnMeta[i] = {
                RecordOffset: reader.readUInt16LE(),
                Size: reader.readUInt16LE(),
                AdditionalDataSize: reader.readUInt32LE(),
                CompressionType: reader.readUInt32LE(),
                ColumnCompressionData: [reader.readUInt32LE(), reader.readUInt32LE(), reader.readUInt32LE()]
            }
        }

        this.PalletData = new Array(this.ColumnMeta.length);
        for (let i = 0; i < this.ColumnMeta.length; i++) {
            if (this.ColumnMeta[i].CompressionType == CompressionType.Pallet || this.ColumnMeta[i].CompressionType == CompressionType.PalletArray) {
                this.PalletData[i] = reader.readUInt32LE(this.ColumnMeta[i].AdditionalDataSize / 4);
            }
        }

        this.CommonData = new Array(this.ColumnMeta.length);
        for (let i = 0; i < this.ColumnMeta.length; i++) {
            if (this.ColumnMeta[i].CompressionType == CompressionType.Common) {
                var commonValues = new Map();

                for (let j = 0; j < this.ColumnMeta[i].AdditionalDataSize / 8; j++) {
                    commonValues.set(reader.readUInt32LE(), reader.readUInt32LE());
                }
                this.CommonData[i] = commonValues;
            }
        }

        let previousStringTableSize = 0;
        let previousRecordCount = 0;

        const records: Map<number, T> = new Map();

        for (const header of sectionHeaders) {
            reader.seek(header.FileOffset);

            if (hasDB2Flag(this.Flags, DB2Flags.Sparse)) {
                // sparse data with inlined strings
                this.RecordsData = reader.readInt8(header.OffsetRecordsEndOffset - header.FileOffset);
            } else {
                // records data
                this.RecordsData = reader.readInt8(this.RecordSize * header.NumRecords);

                // string data
                const sectionStringTable = this.readStringTable(reader, header.StringTableSize, previousStringTableSize);
                sectionStringTable.forEach((v, k) => this.StringTable.set(k, v));

                previousStringTableSize += header.StringTableSize;
            }
            // Add extra 0s for reading data
            this.RecordsData.push(0, 0, 0, 0, 0, 0, 0, 0)

            // Skip encrypted sections with zeroed data
            if (header.TactKeyLookup != BigInt(0)) {
                let isZeroed = true;
                for (let i = 0; i < this.RecordsData.length; i++) {
                    if (this.RecordsData[i] !== 0) {
                        isZeroed = false;
                        break;
                    }
                }

                if (isZeroed && (header.IndexDataSize > 0 || header.CopyTableCount > 0)) {
                    isZeroed = reader.readInt32LE() == 0;
                    reader.move(-4);
                } else if (isZeroed && header.OffsetMapIDCount > 0) {
                    reader.move(4);
                    const size = reader.readUInt16LE();
                    isZeroed = size === 0;
                    reader.move(-6);
                }

                if (isZeroed) {
                    previousRecordCount += header.NumRecords;
                    continue;
                }
            }

            this.IndexData = reader.readInt32LE(header.IndexDataSize / 4);

            // fix zero-filled index data
            if (this.IndexData.length > 0 && this.IndexData.every((x) => x === 0)) {
                this.IndexData = [...Array(header.NumRecords).keys()].map(x => x + this.MinIndex + previousRecordCount);
            }

            // duplicate rows data
            if (header.CopyTableCount > 0) {
                for (let i = 0; i < header.CopyTableCount; i++) {
                    var destRowId = reader.readInt32LE();
                    var srcRowId = reader.readInt32LE();
                    if (destRowId != srcRowId) {
                        this.CopyData.set(destRowId, srcRowId);
                    }
                }
            }

            if (header.OffsetMapIDCount > 0) {
                this.SparseEntries = Array(header.OffsetMapIDCount);
                for (let i = 0; i < header.OffsetMapIDCount; i++) {
                    this.SparseEntries[i] = {
                        Offset: reader.readUInt32LE(),
                        Size: reader.readUInt16LE()
                    }
                }
            }

            let refData = new ReferenceData();
            if (header.ParentLookupDataSize > 0) {
                refData.MinId = reader.readInt32LE();
                refData.MaxId = reader.readInt32LE();

                for (let i = 0; i < refData.NumRecords; i++) {
                    refData.Entries.set(reader.readInt32LE(), reader.readInt32LE());
                }
            }

            if (header.OffsetMapIDCount > 0 && !hasDB2Flag(this.Flags, DB2Flags.SecondaryKey)) {
                this.IndexData = reader.readInt32LE(header.OffsetMapIDCount);
            }

            let position = 0;
            let recordsData = BufferWrapper.from(this.RecordsData);

            const layoutHash = decimalToHex(this.LayoutHash, 4).toUpperCase();
            const def = getVersionDefinitionByLayoutHash(dbDefinition, layoutHash);
            const fields = def.definitions;
            const columnDefs = def.definitions.map(x => dbDefinition.columnDefinitions[x.name]);
            for (let i = 0; i < header.NumRecords; i++) {
                const bitReader = new BitReader(recordsData);
                bitReader.bitPosition = 0;

                if (hasDB2Flag(this.Flags, DB2Flags.Sparse)) {
                    bitReader.bitPosition = position;
                    position += this.SparseEntries[i].Size * 8;
                } else {
                    bitReader.byteOffset = i * this.RecordSize;
                }

                let refId;
                if (hasDB2Flag(this.Flags, DB2Flags.SecondaryKey)) {
                    refId = refData.Entries.get(this.IndexData[i])
                } else {
                    refId = refData.Entries.get(i);
                }

                const row = new WDC3Row(this, bitReader, header.IndexDataSize != 0 ? this.IndexData[i] : -1, refId ?? 0, i + previousRecordCount);
                records.set(row.Id, row.readData(fields, columnDefs));
            }

            previousRecordCount += header.NumRecords;
        }

        // Add Copy Data
        if (this.CopyData != null && Object.keys(this.CopyData).length > 0) {
            for(const key in this.CopyData) {
                const keyId = parseInt(key, 10);
                records.set(keyId, Object.assign({}, records.get(keyId)));
            }
        }
        return records;
    }
}