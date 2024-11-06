import BufferWrapper from "../bufferWrapper";
import { DBDefinition } from "../dbd";

import { WDC3Reader } from "./readers";

export class DbReader {
    read<T>(buffer: Buffer, dbDefinition: DBDefinition): Map<number, T> {
        const dataReader = new BufferWrapper(buffer);
        const ident = dataReader.readString(4);
        dataReader.seek(0);
        switch(ident) {
            case "WDC3": {
                const reader = new WDC3Reader();
                return reader.readRecords<T>(dataReader, dbDefinition);
            }
        }
        throw new Error("Unsupported DB Format: " + ident);
    }
}