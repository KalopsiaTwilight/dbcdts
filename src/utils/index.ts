export function decimalToHex(num: number, padding = 2) {
    var hex = Number(num).toString(16);
    while (hex.length < padding) {
        hex = "0" + hex;
    }
    return hex;
}