import BufferWrapper from "./bufferWrapper";

export default class BitReader {
    _data: BufferWrapper;

    byteOffset: number;
    bitPosition: number;

    constructor(data: BufferWrapper, offset = 0) {
        this._data = data;
        this.byteOffset = offset;
    }

    private readUInt32(numBits: number) {
        this._data.seek(this.byteOffset * 8 + this.bitPosition >> 3)
        let result = (this._data.readUInt32LE() >> (this.bitPosition & 7)) & (1 << numBits) - 1;
        this.bitPosition += numBits;
        return result;
    }

    private readUInt64(numBits: number) {
        this._data.seek(this.byteOffset * 8 + this.bitPosition >> 3)
        let result = (this._data.readUInt64LE() >> BigInt(this.bitPosition & 7)) & (BigInt(1) << BigInt(numBits)) - BigInt(1);
        this.bitPosition += numBits;
        return result;
    }

    private readInt64(numBits: number) {
        this._data.seek(this.byteOffset * 8 + this.bitPosition >> 3)
        let result = (this._data.readInt64LE() >> BigInt(this.bitPosition & 7)) & (BigInt(1) << BigInt(numBits)) - BigInt(1);
        this.bitPosition += numBits;
        return result;
    }

    readValue32(numBits: number) {
        return this.readUInt32(numBits);
    }

    readValue64(numBits: number) {
        return this.readUInt64(numBits);
    }

    readValue64Signed(numBits: number) {
        return this.readInt64(numBits);
    }

    readCString() {
        let num = 0;
        const bytes = []
        while ((num = this.readUInt32(8)) != 0) {
            bytes.push(num);
        }

        return Buffer.from(bytes).toString('utf8');
    }

    clone() {
        return new BitReader(this._data);
    }
}