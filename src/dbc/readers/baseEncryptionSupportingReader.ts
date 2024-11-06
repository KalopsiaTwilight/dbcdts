import { BaseReader } from "./baseReader";
import { IEncryptableDatabaseSection, IEncryptionSupportingReader } from "./interfaces";

export abstract class BaseEncryptionSupportingReader extends BaseReader implements IEncryptionSupportingReader
{
    protected sections: IEncryptableDatabaseSection[] 
    protected encryptedIds: { [key: number]: number[] }

    constructor() {
        super();
    }

    GetEncryptedSections(): IEncryptableDatabaseSection[] {
        return this.sections.filter(x => x.TactKeyLookup != BigInt(0));
    }
    GetEncryptedIDs(): { [key: number]: number[]; } {
        return this.encryptedIds;
    }

}