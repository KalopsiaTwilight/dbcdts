import BufferWrapper from "../bufferWrapper";
import { Build, BuildRange, ColumnDefinition, DBDefinition, Definition, parseBuild, parseBuildRange, VersionDefinitions } from "./interfaces";

function indexOfAny(searchStr: string, chars: string[]) {
    for(let i = 0; i < searchStr.length; i ++) {
        for(const char of chars) {
            if (searchStr[i] == char) {
                return i;
            }
        }
    }
    return -1;
}

export class DBDReader {
    public read(buffer: BufferWrapper): DBDefinition {
        var columnDefinitionDictionary: { [key: string]: ColumnDefinition } = {};

        var lines = buffer.readLines();
        var lineNumber = 0;

        if (lines[0].startsWith("COLUMNS")) {
            lineNumber++;
            while (lineNumber < lines.length) {
                var line = lines[lineNumber++];

                // Column definitions are done after encountering a newline
                if (line.trim() === "") break;

                // Create a new column definition to store information in
                let columnDefinition: ColumnDefinition = {
                    type: "",
                    verified: false
                }

                /* TYPE READING */
                // List of valid types, uint should be removed soon-ish
                var validTypes = [ "uint", "int", "float", "string", "locstring" ];

                // Check if line has a space in case someone didn't assign a type to a column name
                if (!line.includes(" ")) {
                    throw new Error("Line " + line + " does not contain a space between type and column name!");
                }

                // Read line up to space (end of type) or < (foreign key)
                var type = line.substring(0, indexOfAny(line, [' ', '<']));

                // Check if type is valid, throw Error if not!
                if (validTypes.indexOf(type) === -1) {
                    throw new Error("Invalid type: " + type + " on line " + lineNumber);
                }
                else {
                    columnDefinition.type = type;
                }

                /* FOREIGN KEY READING */
                // Only read foreign key if foreign key identifier is found right after type (it could also be in comments)
                if (line.startsWith(type + "<")) {
                    // Read foreign key info between < and > without < and > in result, then split on :: to separate table and field
                    var foreignKey = line.substring(line.indexOf('<') + 1, line.indexOf('>')).split("::");

                    // There should only be 2 values in foreignKey (table and col)
                    if (foreignKey.length != 2) {
                        throw new Error("Invalid foreign key length: " + foreignKey.length);
                    }
                    else {
                        columnDefinition.foreignTable = foreignKey[0];
                        columnDefinition.foreignColumn = foreignKey[1];
                    }
                }

                /* NAME READING */
                var name = "";
                // If there's only one space on the line at the same locaiton as the first one, assume a simple line like "uint ID", this can be better
                if (line.lastIndexOf(' ') == line.indexOf(' ')) {
                    name = line.substring(line.indexOf(' ') + 1);
                }
                else {
                    // Location of first space (after type)
                    var start = line.indexOf(' ');

                    // Second space (after name)
                    var end = line.indexOf(' ', start + 1);

                    name = line.substring(start + 1, end);
                }

                // If name ends in ? it's unverified
                if (name.endsWith("?")) {
                    columnDefinition.verified = false;
                    name = name.slice(0, -1)
                }
                else {
                    columnDefinition.verified = true;
                }

                /* COMMENT READING */
                if (line.includes("//")) {
                    columnDefinition.comment = line.substring(line.indexOf("//") + 2).trim();
                }

                // Add to dictionary
                if (!columnDefinitionDictionary[name]) {
                    columnDefinitionDictionary[name] = columnDefinition;
                }
            }
        }
        else {
            throw new Error("File does not start with column definitions!");
        }

        // There will be less comments from this point on, stuff used in above code is mostly repeated

        var versionDefinitions: VersionDefinitions[] = [];

        var definitions: Definition[] = [];
        var layoutHashes: string[] = [];
        var comment = "";
        var builds: Build[] = [];
        var buildRanges: BuildRange[] = [];

        for (var i = lineNumber; i < lines.length; i++) {
            var line = lines[i];

            if (line.trim() === "") {
                if (builds.length != 0 || buildRanges.length != 0 || layoutHashes.length != 0) {
                    versionDefinitions.push(
                        {
                            builds: builds,
                            buildRanges: buildRanges,
                            layoutHashes: layoutHashes,
                            comment: comment,
                            definitions: definitions
                        }
                    );
                }
                else if (definitions.length != 0 || !(comment.trim() === "")) {
                    throw new Error("No BUILD or LAYOUT, but non-empty lines/'definitions'.");
                }

                definitions = [];
                layoutHashes = [];
                comment = "";
                builds = [];
                buildRanges = [];
            }

            if (line.startsWith("LAYOUT")) {
                var splitLayoutHashes = line.slice(7).split(", ");
                layoutHashes.push(...splitLayoutHashes);
            }

            if (line.startsWith("BUILD")) {
                var splitBuilds = line.slice(6).split(", ");
                for(const splitBuild of splitBuilds)
                {
                    if (splitBuild.includes("-")) {
                        var splitRange = splitBuild.split('-');
                        buildRanges.push({
                            minBuild: parseBuild(splitRange[0]), 
                            maxBuild: parseBuild(splitRange[1])
                        });
                    }
                    else {
                        builds.push(parseBuild(splitBuild));
                    }
                }
            }

            if (line.startsWith("COMMENT")) {
                comment = line.substring(7).trim();
            }

            if (!line.startsWith("LAYOUT") && !line.startsWith("BUILD") && !line.startsWith("COMMENT") && !(line.trim() === "")) {
                let definition: Definition = {
                    size: 0,
                    arrLength: 0,
                    name: "",
                    isID: false,
                    isRelation: false,
                    isNonInline: false,
                    isSigned: false,
                    comment: ""
                }

                // Default to everything being inline
                definition.isNonInline = false;

                if (line.includes("$")) {
                    var annotationStart = line.indexOf("$");
                    var annotationEnd = line.indexOf("$", 1);

                    var annotations = line.substring(annotationStart + 1, annotationEnd).split(',');

                    if (annotations.indexOf("id") !== -1) {
                        definition.isID = true;
                    }

                    if (annotations.indexOf("noninline") !== -1) {
                        definition.isNonInline = true;
                    }

                    if (annotations.indexOf("relation") !== -1) {
                        definition.isRelation = true;
                    }

                    line = line.slice(annotationEnd + 1);
                }

                if (line.includes("<")) {
                    const size = line.substring(line.indexOf('<') + 1, line.indexOf('>'));

                    if (size[0] == 'u') {
                        definition.isSigned = false;
                        definition.size = parseInt(size.replace("u", ""), 10);
                    }
                    else {
                        definition.isSigned = true;
                        definition.size = parseInt(size, 10);
                    }

                    line = line.slice(0, line.indexOf('<')) + line.slice(line.indexOf('>') + 1);
                }

                if (line.includes("[")) {
                    definition.arrLength = parseInt(line.substring(line.indexOf('[') + 1, line.indexOf(']')), 10);
                    line = line.slice(0, line.indexOf('['));
                }

                if (line.includes("//")) {
                    definition.comment = line.substring(line.indexOf("//") + 2).trim();
                    line = line.slice(0, line.indexOf("//") - 1).trim();
                }

                definition.name = line;

                // Check if this column name is known in column definitions, if not throw Error
                if (!columnDefinitionDictionary[definition.name]) {
                    throw new Error("Unable to find " + definition.name + " in column definitions!");
                }
                else {
                    // Temporary unsigned format update conversion code
                    if (columnDefinitionDictionary[definition.name].type == "uint") {
                        definition.isSigned = false;
                    }
                }

                definitions.push(definition);
            }

            if (lines.length == (i + 1)) {
                if (builds.length != 0 || buildRanges.length != 0 || layoutHashes.length != 0) {
                    versionDefinitions.push(
                        {
                            builds: builds,
                            buildRanges: buildRanges,
                            layoutHashes: layoutHashes,
                            comment: comment,
                            definitions: definitions
                        }
                    );
                }
                else if (definitions.length != 0 || !(comment.trim() === "")) {
                    throw new Error("No BUILD or LAYOUT, but non-empty lines/'definitions'.");
                }
            }
        }

        return {
            columnDefinitions: columnDefinitionDictionary,
            versionDefinitions: versionDefinitions
        };
    }
}