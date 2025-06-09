"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIdentifierInfo = getIdentifierInfo;
function getIdentifierInfo(ctx) {
    var _a, _b, _c;
    const terminalNode = (_a = ctx.IDENTIFIER()) !== null && _a !== void 0 ? _a : (_c = (_b = ctx.keywordIdentifier()) === null || _b === void 0 ? void 0 : _b.children) === null || _c === void 0 ? void 0 : _c[0];
    if (terminalNode && 'symbol' in terminalNode) {
        return {
            name: terminalNode.text,
            token: terminalNode.symbol,
        };
    }
    return undefined;
}
//# sourceMappingURL=utils.js.map