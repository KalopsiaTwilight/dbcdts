export interface DBDefinition {
    columnDefinitions: { [key: string] : ColumnDefinition };
    versionDefinitions: VersionDefinitions[];
}

export interface VersionDefinitions {
    builds: Build[];
    buildRanges: BuildRange[];
    layoutHashes: string[];
    comment: string;
    definitions: Definition[];
}

export interface Definition {
    size: number;
    arrLength: number;
    name: string;
    isID: boolean;
    isRelation: boolean;
    isNonInline: boolean;
    isSigned: boolean;
    comment: string;
}

export interface ColumnDefinition {
    type: string;
    foreignTable?: string;
    foreignColumn?: string;
    comment?: string;
    verified: boolean;
}

export interface Build {
    expansion: number;
    major: number;
    minor: number;
    build: number;
}

export interface BuildRange {
    minBuild: Build;
    maxBuild: Build; 
}

export function parseBuild(buildString: string): Build {
    var split = buildString.split('.');
    
    return { 
        expansion: parseInt(split[0], 10),
        major: parseInt(split[1], 10),
        minor: parseInt(split[2], 10),
        build: parseInt(split[3], 10),
    }
}

export function parseBuildRange(buildRange: string): BuildRange {
    var split = buildRange.split('-');
    const result =  {
        minBuild: parseBuild(split[0]),
        maxBuild: parseBuild(split[1])
    }
    
    if (result.minBuild.expansion != result.maxBuild.expansion)
        throw new Error("Expansion differs across build range. This is not allowed!");

    return result;
}

export function buildToString(build: Build): string {
    return build.expansion + "." + build.major + "." + build.minor + "." + build.build;
}

export function buildRangeToString(buildRange: BuildRange) {
    return buildToString(buildRange.minBuild) + "-" + buildToString(buildRange.maxBuild);
}

export function buildRangeContainsRange(buildRange: BuildRange, build: Build) {
    const toInt = (build: Build) => parseInt(
        build.expansion.toString(10).padStart(2, '0') +
        build.major.toString(10).padStart(2, '0') + 
        build.minor.toString(10).padStart(3, '0') + 
        build.build.toString(10).padStart(6, '0')
    );

    const buildInt = toInt(build);
    return buildInt >= toInt(buildRange.minBuild) && buildInt <= toInt(buildRange.maxBuild);
}

export function getVersionDefinitionByLayoutHash(definition: DBDefinition, layoutHash: string) {
    for(const def of definition.versionDefinitions) {
        if (def.layoutHashes.indexOf(layoutHash) !== -1) {
            return def;
        }
    }
    return null;
}

export function getVersionDefinitionByBuild(definition: DBDefinition, build: Build) {
    const buildStr = buildToString(build);
    for(const def of definition.versionDefinitions) {
        if (def.builds.map(x => buildToString(x)).indexOf(buildStr) !== -1) {
            return def;
        }
        for(const range of def.buildRanges) {
            if (buildRangeContainsRange(range, build)) {
                return def;
            }
        }
    }
    return null;
}