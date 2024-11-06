import BufferWrapper from "../bufferWrapper";
import { ColumnDefinition, Definition } from "./interfaces";

export enum FieldType {
    String,
	Int8,
	UInt8,
	Int16,
	UInt16,
	Int32,
	UInt32,
	Int64,
	UInt64,
	Float,
	Relation,
	NonInlineID,
}

export function getFieldTypeFromDBD(definition: Definition, columnDefinition: ColumnDefinition) {
	if (definition.isRelation && definition.isNonInline) {
		return FieldType.Relation;
	}
	if (definition.isID && definition.isNonInline) {
		return FieldType.NonInlineID;
	}
	switch(columnDefinition.type) {
		case "int": {
			switch(definition.size) {
				case 8: return definition.isSigned ? FieldType.Int8 : FieldType.UInt8;
				case 16: return definition.isSigned ? FieldType.Int16 : FieldType.Int16;
				case 32: return definition.isSigned ? FieldType.Int32 : FieldType.UInt32;
				case 64: return definition.isSigned ? FieldType.Int64 : FieldType.UInt64;
				default: throw new Error("Unsupported integer size: " + definition.size)
			}
		}
		case "locstring":
		case "string": {
			return FieldType.String;
		}
		case "float": {
			return FieldType.Float;
		}
		default: throw new Error("Unable to get field type from db definitions");
	}
}

export function reinterpretAsFieldType(val: number | bigint, type: FieldType) {
	const castBuffer = BufferWrapper.alloc(8, true);
	if (val < 0) {
		castBuffer.writeBigInt64LE(BigInt(val));
	} else {
		castBuffer.writeBigUInt64LE(BigInt(val));
	}
	castBuffer.seek(0);
	switch(type) {
		case FieldType.Float: return castBuffer.readFloatLE();
		case FieldType.Int16: return castBuffer.readInt16LE();
		case FieldType.Int32: return castBuffer.readInt32LE();
		case FieldType.Int64: return castBuffer.readInt64LE();
		case FieldType.Int8: return castBuffer.readInt8();
		case FieldType.NonInlineID: return castBuffer.readInt32LE();
		case FieldType.Relation: return castBuffer.readInt32LE();
		case FieldType.UInt16: return castBuffer.readUInt16LE();
		case FieldType.UInt32: return castBuffer.readUInt32LE();
		case FieldType.UInt64: return castBuffer.readUInt64LE();
		case FieldType.UInt8: return castBuffer.readUInt8();
	}
	throw new Error("Unsupport field type.");
}

export function getByteLength(type: FieldType) {
	switch(type) {
		case FieldType.Float: return 4;
		case FieldType.Int16: return 2;
		case FieldType.Int32: return 4;
		case FieldType.Int64: return 8;
		case FieldType.Int8: return 1;
		case FieldType.NonInlineID: return 4;
		case FieldType.Relation: return 4;
		case FieldType.UInt16: return 2;
		case FieldType.UInt32: return 4;
		case FieldType.UInt64: return 8;
		case FieldType.UInt8: return 1;
	}
	throw new Error("Unsupport field type.");
}