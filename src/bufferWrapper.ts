/*!
    Based off code from wow.export (https://github.com/Kruithne/wow.export)
    Authors: Kruithne <kruithne@gmail.com>, Marlamin <marlamin@marlamin.com>
    License: MIT
 */
import util from "node:util";
import crypto, { BinaryToTextEncoding } from "node:crypto";
import zlib from "node:zlib";
import path from "node:path";
import fsp from "node:fs/promises";

const LITTLE_ENDIAN = {
    READ_INT: Buffer.prototype.readIntLE,
    READ_UINT: Buffer.prototype.readUIntLE,
    READ_FLOAT: Buffer.prototype.readFloatLE,
    READ_DOUBLE: Buffer.prototype.readDoubleLE,
    READ_BIG_INT: Buffer.prototype.readBigInt64LE,
    READ_BIG_UINT: Buffer.prototype.readBigUInt64LE,
    WRITE_INT: Buffer.prototype.writeIntLE,
    WRITE_UINT: Buffer.prototype.writeUIntLE,
    WRITE_FLOAT: Buffer.prototype.writeFloatLE,
    WRITE_BIG_INT: Buffer.prototype.writeBigInt64LE,
    WRITE_BIG_UINT: Buffer.prototype.writeBigUInt64LE
};

const BIG_ENDIAN = {
    READ_INT: Buffer.prototype.readIntBE,
    READ_UINT: Buffer.prototype.readUIntBE,
    READ_FLOAT: Buffer.prototype.readFloatBE,
    READ_DOUBLE: Buffer.prototype.readDoubleBE,
    READ_BIG_INT: Buffer.prototype.readBigInt64BE,
    READ_BIG_UINT: Buffer.prototype.readBigUInt64BE,
    WRITE_INT: Buffer.prototype.writeIntBE,
    WRITE_UINT: Buffer.prototype.writeUIntBE,
    WRITE_FLOAT: Buffer.prototype.writeFloatBE,
    WRITE_BIG_INT: Buffer.prototype.writeBigInt64BE,
    WRITE_BIG_UINT: Buffer.prototype.writeBigUInt64BE
};

/**
 * This class is a wrapper for the node Buffer class which provides a more streamlined
 * interface for reading/writing data. Only required features have been implemented.
 * @class BufferWrapper
 */
export default class BufferWrapper {
    /**
     * Alloc a buffer with the given length and return it wrapped.
     * @param {number} length Initial capacity of the internal buffer.
     * @param {boolean} secure If true, buffer will be zeroed for security.
     * @returns {BufferWrapper}
     */
    static alloc(length: number, secure: boolean = false): BufferWrapper {
        return new BufferWrapper(secure ? Buffer.alloc(length) : Buffer.allocUnsafe(length));
    }

    static from(arrayBuffer: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): BufferWrapper;
    static from(data: Uint8Array | readonly number[]): BufferWrapper;
    static from(data: WithImplicitCoercion<Uint8Array | readonly number[] | string>): BufferWrapper;
    static from(source: any) {
        return new BufferWrapper(Buffer.from(source));
    }

    /**
     * Create a buffer from a source using Buffer.from().
     * @param {Array} source 
     */
    static fromBase64(source: WithImplicitCoercion<string> | { [Symbol.toPrimitive](hint: "string"): string; }) {
        return new BufferWrapper(Buffer.from(source, 'base64'));
    }

    /**
     * Concatenate an array of buffers into a single buffer.
     * @param {BufferWrapper[]} buffers 
     * @returns {BufferWrapper}
     */
    static concat(buffers: BufferWrapper[]) {
        return new BufferWrapper(Buffer.concat(buffers.map(buf => buf.raw)));
    }

    // /**
    //  * Create a BufferWrapper from a canvas element.
    //  * @param {HTMLCanvasElement|OffscreenCanvas} canvas 
    //  * @param {string} mimeType 
    //  */
    // static async fromCanvas(canvas: HTMLCanvasElement|OffscreenCanvas, mimeType: string) {
    //     let blob: Blob;
    //     if (canvas instanceof OffscreenCanvas)
    //         blob = await canvas.convertToBlob({ type: mimeType });
    //     else
    //         blob = await new Promise(res => canvas.toBlob(res, mimeType));

    //     return new BufferWrapper(Buffer.from(await blob.arrayBuffer()));
    // }

    /**
     * Load a file from disk at the given path into a wrapped buffer.
     * @param {string} file Path to the file.
     */
    static async readFile(file: string) {
        return new BufferWrapper(await fsp.readFile(file));
    }

    /**
     * Construct a new BufferWrapper.
     * @param {Buffer} buf 
     */
    _ofs: number;
    _buf: Buffer;
    dataURL: string;
    constructor(buf: Buffer) {
        this._ofs = 0;
        this._buf = buf;
    }

    /**
     * Get the full capacity of the buffer.
     * @returns {number}
     */
    get byteLength() {
        return this._buf.byteLength;
    }

    /**
     * Get the amount of remaining bytes until the end of the buffer.
     * @returns {number}
     */
    get remainingBytes() {
        return this.byteLength - this._ofs;
    }

    /**
     * Get the current offset within the buffer.
     * @returns {number}
     */
    get offset() {
        return this._ofs;
    }

    /**
     * Get the raw buffer wrapped by this instance.
     * @returns {Buffer}
     */
    get raw() {
        return this._buf;
    }

    /**
     * Get the internal ArrayBuffer used by this instance.
     * @returns {ArrayBuffer}
     */
    get internalArrayBuffer() {
        return this._buf.buffer;
    }

    
    clone() {
        const newBuffer = Buffer.alloc(this._buf.length)
        this._buf.copy(newBuffer)
        return new BufferWrapper(newBuffer);
    }

    /**
     * Set the absolute position of this buffer.
     * Negative values will set the position from the end of the buffer.
     * @param {number} ofs 
     */
    seek(ofs: number) {
        const pos = ofs < 0 ? this.byteLength + ofs : ofs;
        if (pos < 0 || pos > this.byteLength)
            throw new Error(util.format('seek() offset out of bounds %d -> %d ! %d', ofs, pos, this.byteLength));

        this._ofs = pos;
    }

    /**
     * Shift the position of the buffer relative to its current position.
     * Positive numbers seek forward, negative seek backwards.
     * @param {number} ofs 
     */
    move(ofs: number) {
        const pos = this.offset + ofs;
        if (pos < 0 || pos > this.byteLength)
            throw new Error(util.format('move() offset out of bounds %d -> %d ! %d', ofs, pos, this.byteLength));

        this._ofs = pos;
    }

    /**
     * Read one or more signed integers of variable byte length in little endian.
     * @param {number} byteLength 
     * @param {number} [count=1]
     * @returns {number[]}
     */
    readIntLE(byteLength: number): number
    readIntLE(byteLength: number, count: number): number[]
    readIntLE(byteLength: number, count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_INT, byteLength);
    }

    /**
     * Read one or more unsigned integers of variable byte length in little endian.
     * @param {number} byteLength 
     * @param {number} count
     * @returns {number|number[]}
     */
    readUIntLE(byteLength: number): number
    readUIntLE(byteLength: number, count: number): number[]
    readUIntLE(byteLength: number, count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_UINT, byteLength);
    }

    /**
     * Read one or more signed integers of variable byte length in big endian.
     * @param {number} byteLength 
     * @param {number} [count=1]
     * @returns {number}
     */
    readIntBE(byteLength: number): number
    readIntBE(byteLength: number, count: number): number[]
    readIntBE(byteLength: number, count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_INT, byteLength);
    }

    /**
     * Read one or more unsigned integers of variable byte length in big endian.
     * @param {number} byteLength 
     * @param {number} [count=1]
     * @returns {number}
     */
    readUIntBE(byteLength: number): number
    readUIntBE(byteLength: number, count: number): number[]
    readUIntBE(byteLength: number, count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_UINT, byteLength);
    }

    /**
     * Read one or more signed 8-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt8(): number
    readInt8(count: number): number[]
    readInt8(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_INT, 1);
    }

    /**
     * Read one or more unsigned 8-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */

    readUInt8(): number
    readUInt8(count: number): number[]
    readUInt8(count?: number | undefined) {
        return this._readInt(count, LITTLE_ENDIAN.READ_UINT, 1);
    }

    /**
     * Read one or more signed 16-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt16LE(): number
    readInt16LE(count: number): number[]
    readInt16LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_INT, 2);
    }

    /**
     * Read one or more unsigned 16-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt16LE(): number
    readUInt16LE(count: number): number[]
    readUInt16LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_UINT, 2);
    }

    /**
     * Read one or more signed 16-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt16BE(): number
    readInt16BE(count: number): number[]
    readInt16BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_INT, 2);
    }

    /**
     * Read one or more unsigned 16-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt16BE(): number
    readUInt16BE(count: number): number[]
    readUInt16BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_UINT, 2);
    }

    /**
     * Read one or more signed 24-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt24LE(): number
    readInt24LE(count: number): number[]
    readInt24LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_INT, 3);
    }

    /**
     * Read one or more unsigned 24-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt24LE(): number
    readUInt24LE(count: number): number[]
    readUInt24LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_UINT, 3);
    }

    /**
     * Read one or more signed 24-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt24BE(): number
    readInt24BE(count: number): number[]
    readInt24BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_INT, 3);
    }

    /**
     * Read one or more unsigned 24-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt24BE(): number
    readUInt24BE(count: number): number[]
    readUInt24BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_UINT, 3);
    }

    /**
     * Read one or more signed 32-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt32LE(): number
    readInt32LE(count: number): number[]
    readInt32LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_INT, 4);
    }

    /**
     * Read one or more unsigned 32-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt32LE(): number
    readUInt32LE(count: number): number[]
    readUInt32LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_UINT, 4);
    }

    /**
     * Read one or more signed 32-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt32BE(): number
    readInt32BE(count: number): number[]
    readInt32BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_INT, 4);
    }

    /**
     * Read one or more unsigned 32-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt32BE(): number
    readUInt32BE(count: number): number[]
    readUInt32BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_UINT, 4);
    }

    /**
     * Read one or more signed 40-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt40LE(): number
    readInt40LE(count: number): number[]
    readInt40LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_INT, 5);
    }

    /**
     * Read one or more unsigned 40-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt40LE(): number
    readUInt40LE(count: number): number[]
    readUInt40LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_UINT, 5);
    }

    /**
     * Read one or more signed 40-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt40BE(): number
    readInt40BE(count: number): number[]
    readInt40BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_INT, 5);
    }

    /**
     * Read one or more unsigned 40-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt40BE(): number
    readUInt40BE(count: number): number[]
    readUInt40BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_UINT, 5);
    }

    /**
     * Read one or more signed 48-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt48LE(): number
    readInt48LE(count: number): number[]
    readInt48LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_INT, 6);
    }

    /**
     * Read one or more unsigned 48-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt48LE(): number
    readUInt48LE(count: number): number[]
    readUInt48LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_UINT, 6);
    }

    /**
     * Read one of more signed 48-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt48BE(): number
    readInt48BE(count: number): number[]
    readInt48BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_INT, 6);
    }

    /**
     * Read one or more unsigned 48-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt48BE(): number
    readUInt48BE(count: number): number[]
    readUInt48BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_UINT, 6);
    }

    /**
     * Read one or more signed 64-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt64LE(): bigint
    readInt64LE(count: number): bigint[]
    readInt64LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_BIG_INT, 8);
    }

    /**
     * Read one or more unsigned 64-bit integers in little endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt64LE(): bigint
    readUInt64LE(count: number): bigint[]
    readUInt64LE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_BIG_UINT, 8);
    }

    /**
     * Read one or more signed 64-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readInt64BE(): bigint
    readInt64BE(count: number): bigint[]
    readInt64BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_BIG_INT, 8);
    }

    /**
     * Read one or more unsigned 64-bit integers in big endian.
     * @param {number} count How many to read.
     * @returns {number|number[]}
     */
    readUInt64BE(): number
    readUInt64BE(count: number): number[]
    readUInt64BE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_BIG_UINT, 8);
    }

    /**
     * Read one or more floats in little endian.
     * @param {number} count How many to read.
     * @returns {float|float[]}
     */
    readFloatLE(): number
    readFloatLE(count: number): number[]
    readFloatLE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_FLOAT, 4);
    }

    /**
     * Read one or more floats in big endian.
     * @param {number} count How many to read.
     * @returns {float|float[]}
     */
    readFloatBE(): number
    readFloatBE(count: number): number[]
    readFloatBE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_FLOAT, 4);
    }

    /**
     * Read one or more doubles in little endian.
     * @param {number} count How many to read.
     * @returns {double|double[]}
     */
    readDoubleLE(): number
    readDoubleLE(count: number): number[]
    readDoubleLE(count?: number) {
        return this._readInt(count, LITTLE_ENDIAN.READ_DOUBLE, 8);
    }

    /**
     * Read one or more doubles in big endian.
     * @param {number} count How many to read.
     * @returns {double|double[]}
     */
    readDoubleBE(): number
    readDoubleBE(count: number): number[]
    readDoubleBE(count?: number) {
        return this._readInt(count, BIG_ENDIAN.READ_DOUBLE, 8);
    }

    /**
     * Read a portion of this buffer as a hex string.
     * @param {number} length 
     */
    readHexString(length: number) {
        this._checkBounds(length);
        const hex = this._buf.subarray(this._ofs, this._ofs + length).toString('hex');
        this._ofs += length;
        return hex;
    }

    /**
     * Read a buffer from this buffer.
     * @param {?number} length How many bytes to read into the buffer.
     * @param {boolean} wrap If true, returns BufferWrapper, else raw buffer.
     * @param {boolean} inflate If true, data will be decompressed using inflate.
     */
    readBuffer(length: number): BufferWrapper
    readBuffer(length: number, wrap: true, inflate: boolean): BufferWrapper
    readBuffer(length: number, wrap: false, inflate: boolean): Buffer
    readBuffer(length: number, wrap: boolean, inflate: boolean): BufferWrapper | Buffer
    readBuffer(length = this.remainingBytes, wrap = true, inflate = false) {
        // Ensure we have enough data left to fulfill this.
        this._checkBounds(length);

        let buf = Buffer.allocUnsafe(length);
        this._buf.copy(buf, 0, this._ofs, this._ofs + length);
        this._ofs += length;

        if (inflate)
            buf = zlib.inflateSync(buf);

        return wrap ? new BufferWrapper(buf) : buf;
    }

    /**
     * Read a string from the buffer.
     * @param {?number} length 
     * @param {string} [encoding=utf8]
     * @returns {string}
     */
    readString(length = this.remainingBytes, encoding: BufferEncoding = 'utf8') {
        // If length is zero, just return an empty string.
        if (length === 0)
            return '';

        this._checkBounds(length);
        const str = this._buf.toString(encoding, this._ofs, this._ofs + length);
        this._ofs += length;

        return str;
    }

    /**
     * Read a null-terminated string from the buffer.
     * @param {string} [encoding=utf8]
     * @returns 
     */
    readNullTerminatedString(encoding: BufferEncoding = 'utf8') {
        const startPos = this.offset;
        let length = 0;

        while (this.remainingBytes > 0) {
            if (this.readUInt8() === 0x0)
                break;

            length++;
        }

        this.seek(startPos);

        const str = this.readString(length, encoding);
        this.move(1); // Skip the null-terminator.
        return str;
    }

    /**
     * Returns true if the buffer starts with any of the given string(s).
     * @param {string|array} input 
     * @param {string} [encoding=utf8]
     * @returns {boolean}
     */
    startsWith(input: string | string[], encoding: BufferEncoding = 'utf8') {
        this.seek(0);
        if (Array.isArray(input)) {
            for (const entry of input) {
                if (this.readString(entry.length, encoding) === entry)
                    return true;
            }

            return false;
        } else {
            return this.readString(input.length, encoding) === input;
        }
    }

    /**
     * Read a string from the buffer and parse it as JSON.
     * @param {?number} length
     * @param {encoding} [encoding=utf8]
     * @returns {object}
     */
    readJSON(length = this.remainingBytes, encoding: BufferEncoding = 'utf8') {
        return JSON.parse(this.readString(length, encoding));
    }

    /**
     * Read the entire buffer split by lines (\r\n, \n, \r).
     * Preserves current offset of the wrapper.
     * @param {string} encoding 
     */
    readLines(encoding: BufferEncoding = 'utf8') {
        const ofs = this._ofs;
        this.seek(0);

        const str = this.readString(this.remainingBytes, encoding);
        this.seek(ofs);

        return str.split(/\r\n|\n|\r/);
    }

    /**
     * Fill a buffer with the given value.
     * @param {number} value 
     * @param {number} length 
     */
    fill(value: number, length = this.remainingBytes) {
        this._checkBounds(length);
        this._buf.fill(value, this._ofs, this._ofs + length);
        this._ofs += length;
    }

    /**
     * Write a signed 8-bit integer in little endian.
     * @param {number} value
     */
    writeInt8(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_INT, 1);
    }

    /**
     * Write a unsigned 8-bit integer in little endian.
     * @param {number} value
     */
    writeUInt8(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_UINT, 1);
    }

    /**
     * Write a signed 16-bit integer in little endian.
     * @param {number} value
     */
    writeInt16LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_INT, 2);
    }

    /**
     * Write a unsigned 16-bit integer in little endian.
     * @param {number} value
     */
    writeUInt16LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_UINT, 2);
    }

    /**
     * Write a signed 16-bit integer in big endian.
     * @param {number} value
     */
    writeInt16BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_INT, 2);
    }

    /**
     * Write a unsigned 16-bit integer in big endian.
     * @param {number} value
     */
    writeUInt16BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_UINT, 2);
    }

    /**
     * Write a signed 24-bit integer in little endian.
     * @param {number} value
     */
    writeInt24LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_INT, 3);
    }

    /**
     * Write a unsigned 24-bit integer in little endian.
     * @param {number} value
     */
    writeUInt24LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_UINT, 3);
    }

    /**
     * Write a signed 24-bit integer in big endian.
     * @param {number} value
     */
    writeInt24BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_INT, 3);
    }

    /**
     * Write a unsigned 24-bit integer in big endian.
     * @param {number} value
     */
    writeUInt24BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_UINT, 3);
    }

    /**
     * Write a signed 32-bit integer in little endian.
     * @param {number} value
     */
    writeInt32LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_INT, 4);
    }

    /**
     * Write a unsigned 32-bit integer in little endian.
     * @param {number} value
     */
    writeUInt32LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_UINT, 4);
    }

    /**
     * Write a signed 32-bit integer in big endian.
     * @param {number} value
     */
    writeInt32BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_INT, 4);
    }

    /**
     * Write a unsigned 32-bit integer in big endian.
     * @param {number} value
     */
    writeUInt32BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_UINT, 4);
    }

    /**
     * Write a signed 40-bit integer in little endian.
     * @param {number} value
     */
    writeInt40LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_INT, 5);
    }

    /**
     * Write a unsigned 40-bit integer in little endian.
     * @param {number} value
     */
    writeUInt40LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_UINT, 5);
    }

    /**
     * Write a signed 40-bit integer in big endian.
     * @param {number} value
     */
    writeInt40BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_INT, 5);
    }

    /**
     * Write a unsigned 40-bit integer in big endian.
     * @param {number} value
     */
    writeUInt40BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_UINT, 5);
    }

    /**
     * Write a signed 48-bit integer in little endian.
     * @param {number} value
     */
    writeInt48LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_INT, 6);
    }

    /**
     * Write a unsigned 48-bit integer in little endian.
     * @param {number} value
     */
    writeUInt48LE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_UINT, 6);
    }

    /**
     * Write a signed 48-bit integer in big endian.
     * @param {number} value
     */
    writeInt48BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_INT, 6);
    }

    /**
     * Write a unsigned 48-bit integer in big endian.
     * @param {number} value
     */
    writeUInt48BE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_UINT, 6);
    }

    /**
     * Write a signed 64-bit integer in little endian.
     * @param {bigint} value
     */
    writeBigInt64LE(value: BigInt) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_BIG_INT, 8);
    }

    /**
     * Write a unsigned 64-bit integer in little endian.
     * @param {bigint} value
     */
    writeBigUInt64LE(value: BigInt) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_BIG_UINT, 8);
    }

    /**
     * Write a signed 64-bit integer in big endian.
     * @param {bigint} value
     */
    writeBigInt64BE(value: BigInt) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_BIG_INT, 8);
    }

    /**
     * Write a unsigned 64-bit integer in big endian.
     * @param {bigint} value
     */
    writeBigUInt64BE(value: BigInt) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_BIG_UINT, 8);
    }

    /**
     * Write a float in little endian.
     * @param {number} value
     */
    writeFloatLE(value: number) {
        return this._writeInt(value, LITTLE_ENDIAN.WRITE_FLOAT, 4);
    }

    /**
     * Write a float in big endian.
     * @param {number} value
     */
    writeFloatBE(value: number) {
        return this._writeInt(value, BIG_ENDIAN.WRITE_FLOAT, 4);
    }

    /**
     * Write the contents of a buffer to this buffer.
     * @param {Buffer|BufferWrapper} buf 
     * @param {number} copyLength
     */
    writeBuffer(buf: Buffer | BufferWrapper, copyLength = 0) {
        let startIndex = 0;
        let rawBuf: Buffer;

        // Unwrap the internal buffer if this is a wrapper.
        if (buf instanceof BufferWrapper) {
            startIndex = buf.offset;

            if (copyLength === 0)
                copyLength = buf.remainingBytes;
            else
                buf._checkBounds(copyLength);

            rawBuf = buf.raw;
        } else {
            rawBuf = buf;
            if (copyLength === 0)
                copyLength = buf.byteLength;
            else if (buf.length <= copyLength)
                new Error(util.format('Buffer operation out-of-bounds: %d > %d', copyLength, buf.byteLength));
        }

        // Ensure consuming this buffer won't overflow us.
        this._checkBounds(copyLength);

        rawBuf.copy(this._buf, this._ofs, startIndex, startIndex + copyLength);
        this._ofs += copyLength;

        if (buf instanceof BufferWrapper)
            buf._ofs += copyLength;
    }

    /**
     * Write the contents of this buffer to a file.
     * Directory path will be created if needed.
     * @param {string} file 
     */
    async writeToFile(file: string) {
        await fsp.mkdir(path.dirname(file), { recursive: true });
        await fsp.writeFile(file, this._buf);
    }

    /**
     * Get the index of the given char from start.
     * Defaults to the current reader offset.
     * @param {string} char 
     * @param {number} start 
     * @returns {number}
     */
    indexOfChar(char: string, start = this.offset) {
        if (char.length > 1)
            throw new Error('BufferWrapper.indexOfChar() given string, expected single character.');

        return this.indexOf(char.charCodeAt(0), start);
    }

    /**
     * Get the index of the given byte from start.
     * Defaults to the current reader offset.
     * @param {number} byte
     * @param {number} start 
     * @returns {number}
     */
    indexOf(byte: number, start = this.offset) {
        const resetPos = this.offset;
        this.seek(start);

        while (this.remainingBytes > 0) {
            const mark = this.offset;
            if (this.readUInt8() === byte) {
                this.seek(resetPos);
                return mark;
            }
        }

        this.seek(resetPos);
        return -1;
    }

    /**
     * Decode this buffer using the given audio context.
     * @param {AudioContext} context 
     */
    async decodeAudio(context: AudioContext) {
        return await context.decodeAudioData(this._buf.buffer);
    }

    /**
     * Assign a data URL for this buffer.
     * @returns {string}
     */
    getDataURL() {
        if (!this.dataURL) {
            const blob = new Blob([this.internalArrayBuffer]);
            this.dataURL = URL.createObjectURL(blob);
        }
        return this.dataURL;
    }

    /**
     * Revoke the data URL assigned to this buffer.
     */
    revokeDataURL() {
        if (this.dataURL) {
            URL.revokeObjectURL(this.dataURL);
            this.dataURL = undefined;
        }
    }

    /**
     * Returns the entire buffer encoded as base64.
     * @returns {string}
     */
    toBase64() {
        return this._buf.toString('base64');
    }

    /**
     * Replace the internal buffer with a different capacity.
     * If the specified capacity is lower than the current, there may be data loss.
     * @param {number} capacity New capacity of the internal buffer.
     * @param {boolean} secure If true, expanded capacity will be zeroed for security.
     */
    setCapacity(capacity: number, secure = false) {
        // Don't waste time replacing the buffer for nothing.
        if (capacity === this.byteLength)
            return;

        const buf = secure ? Buffer.alloc(capacity) : Buffer.allocUnsafe(capacity);
        this._buf.copy(buf, 0, 0, Math.min(capacity, this.byteLength));
        this._buf = buf;
    }

    /**
     * Calculate a hash of this buffer
     * @param {string} hash Hashing method, defaults to 'md5'.
     * @param {string} encoding Output encoding, defaults to 'hex'.
     */
    calculateHash(hash = 'md5', encoding: BinaryToTextEncoding = 'hex') {
        return crypto.createHash(hash).update(this._buf).digest(encoding);
    }

    /**
     * Check if this buffer is entirely zeroed.
     */
    isZeroed() {
        for (let i = 0, n = this.byteLength; i < n; i++) {
            if (this._buf[i] !== 0x0)
                return false;
        }

        return true;
    }

    /**
     * Returns a new deflated buffer using the contents of this buffer.
     * @returns {BufferWrapper}
     */
    deflate() {
        return new BufferWrapper(zlib.deflateSync(this._buf));
    }

    /**
     * Check a given length does not exceed current capacity.
     * @param {number} length 
     */
    _checkBounds(length: number) {
        if (this.remainingBytes < length)
            throw new Error(util.format('Buffer operation out-of-bounds: %d > %d', length, this.remainingBytes));
    }

    /**
     * Read one or more integers from the buffer.
     * @param {number} count How many integers to read.
     * @param {function} func Buffer prototype function.
     * @param {number} byteLength Byte-length of each integer.
     * @returns {number|number[]}
     */
    _readInt(count: number | undefined, func: Function, byteLength: number): bigint | bigint[] | number | number[] {
        if (count !== undefined) {
            this._checkBounds(byteLength * count);

            const values = new Array(count);
            for (let i = 0; i < count; i++) {
                values[i] = func.call(this._buf, this._ofs, byteLength);
                this._ofs += byteLength;
            }

            return values;
        } else {
            this._checkBounds(byteLength);

            const value = func.call(this._buf, this._ofs, byteLength);
            this._ofs += byteLength;
            return value;
        }
    }

    /**
     * Write an integer to the buffer.
     * @param {number} value
     * @param {function} func Buffer prototype function.
     * @param {number} byteLength Byte-length of the number to write.
     */
    _writeInt(value: number|BigInt, func: Function, byteLength: number) {
        this._checkBounds(byteLength);

        func.call(this._buf, value, this._ofs, byteLength);
        this._ofs += byteLength;
    }
}