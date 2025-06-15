"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugErrorListener = void 0;
class DebugErrorListener {
    constructor() {
        this.errors = [];
    }
    syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, e) {
        const ruleStack = typeof recognizer.getRuleInvocationStack === 'function'
            ? recognizer.getRuleInvocationStack()
            : [];
        const offending = offendingSymbol?.text ?? '<no token>';
        this.errors.push({
            line,
            column: charPositionInLine,
            offendingToken: offending,
            message: msg,
            ruleStack: ruleStack.reverse() // 更直观：从入口到出错规则
        });
    }
}
exports.DebugErrorListener = DebugErrorListener;
//# sourceMappingURL=DebugErrorListener.js.map