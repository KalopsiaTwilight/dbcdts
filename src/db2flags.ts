export enum DB2Flags
{
    None = 0x0,
    Sparse = 0x1,
    SecondaryKey = 0x2,
    Index = 0x4,
    Unknown1 = 0x8, // modern client explicitly throws an exception
    BitPacked = 0x10
}

export function hasDB2Flag(flag: DB2Flags, test: DB2Flags) {
    return (flag & test) === test;
}