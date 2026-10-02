/**
 * @fileoverview Tactical Vector Simulator - Deterministic Lexer, AST Parser, and Memory Analyzer.
 * Conforms to FR-2 and FR-4 specifications.
 */

/**
 * @typedef {'AVANZAR' | 'GIRAR_DER' | 'GIRAR_IZQ' | 'LOOP' | 'SCAN'} CommandType
 */

/**
 * @typedef {'OPTIMAL' | 'NOMINAL' | 'OVERFLOW'} MemoryStatus
 */

/**
 * @typedef {Object} Token
 * @property {string} type
 * @property {string|number} value
 * @property {number} line
 * @property {number} column
 */

/**
 * @typedef {Object} ASTNode
 * @property {string} type
 * @property {number} [count]
 * @property {number} [iterations]
 * @property {ASTNode[]} [body]
 * @property {number} line
 */

/**
 * @typedef {Object} ExecutionStep
 * @property {'MOVE' | 'ROTATE_RIGHT' | 'ROTATE_LEFT' | 'SCAN'} action
 * @property {number} [distance]
 * @property {number} sourceLine
 */

/**
 * @typedef {Object} MemoryReport
 * @property {number} instructionCount
 * @property {MemoryStatus} status
 * @property {string} label
 * @property {string} description
 */

/**
 * @typedef {Object} ParseResult
 * @property {boolean} success
 * @property {ASTNode[]} ast
 * @property {ExecutionStep[]} steps
 * @property {MemoryReport} memory
 * @property {string|null} error
 * @property {number|null} errorLine
 */

/**
 * Lexer and Parser for Tactical Vector Simulator grammar.
 */
class TacticalParser {
    static COMMAND_FORWARD = 'AVANZAR';
    static COMMAND_TURN_RIGHT = 'GIRAR_DER';
    static COMMAND_TURN_LEFT = 'GIRAR_IZQ';
    static COMMAND_LOOP = 'LOOP';
    static COMMAND_SCAN = 'SCAN';

    static MAX_EXECUTION_STEPS = 1000;

    /**
     * Tokenizes a raw code string into lexical tokens.
     * @param {string} sourceCode
     * @returns {Token[]}
     * @throws {Error} When an invalid character or unrecognized token is encountered.
     */
    static tokenize(sourceCode) {
        const tokens = [];
        let cursor = 0;
        let line = 1;
        let column = 1;

        while (cursor < sourceCode.length) {
            const char = sourceCode[cursor];

            if (char === '\n') {
                line++;
                column = 1;
                cursor++;
                continue;
            }

            if (/\s/.test(char)) {
                column++;
                cursor++;
                continue;
            }

            if (char === ';') {
                cursor++;
                column++;
                continue;
            }

            if (char === '(' || char === ')' || char === '{' || char === '}') {
                tokens.push({
                    type: char,
                    value: char,
                    line,
                    column
                });
                cursor++;
                column++;
                continue;
            }

            if (/\d/.test(char)) {
                let numberString = '';
                const startColumn = column;
                while (cursor < sourceCode.length && /\d/.test(sourceCode[cursor])) {
                    numberString += sourceCode[cursor];
                    cursor++;
                    column++;
                }
                tokens.push({
                    type: 'NUMBER',
                    value: parseInt(numberString, 10),
                    line,
                    column: startColumn
                });
                continue;
            }

            if (/[a-zA-Z_]/.test(char)) {
                let identifier = '';
                const startColumn = column;
                while (cursor < sourceCode.length && /[a-zA-Z0-9_]/.test(sourceCode[cursor])) {
                    identifier += sourceCode[cursor];
                    cursor++;
                    column++;
                }

                const upperIdent = identifier.toUpperCase();
                tokens.push({
                    type: 'IDENTIFIER',
                    value: upperIdent,
                    line,
                    column: startColumn
                });
                continue;
            }

            throw new Error(`Unexpected character '${char}' at line ${line}, column ${column}`);
        }

        tokens.push({
            type: 'EOF',
            value: '',
            line,
            column
        });

        return tokens;
    }

    /**
     * Parses an array of tokens into an Abstract Syntax Tree (AST).
     * @param {Token[]} tokens
     * @returns {ASTNode[]}
     * @throws {Error} When a syntax rule is violated.
     */
    static parseTokens(tokens) {
        let currentIndex = 0;

        /**
         * @returns {Token}
         */
        function peek() {
            return tokens[currentIndex];
        }

        /**
         * @returns {Token}
         */
        function consume() {
            return tokens[currentIndex++];
        }

        /**
         * @param {string} expectedType
         * @param {string} [expectedValue]
         * @returns {Token}
         */
        function expect(expectedType, expectedValue) {
            const token = peek();
            if (!token || token.type !== expectedType) {
                const foundDesc = token ? `${token.type} (${token.value})` : 'EOF';
                throw new Error(`Line ${token ? token.line : 'end'}: Expected '${expectedValue || expectedType}' but found '${foundDesc}'`);
            }
            if (expectedValue !== undefined && token.value !== expectedValue) {
                throw new Error(`Line ${token.line}: Expected '${expectedValue}' but found '${token.value}'`);
            }
            return consume();
        }

        /**
         * Parses a list of statements until EOF or closing brace.
         * @param {boolean} insideBlock
         * @returns {ASTNode[]}
         */
        function parseStatements(insideBlock) {
            const statements = [];

            while (peek().type !== 'EOF') {
                if (insideBlock && peek().type === '}') {
                    break;
                }

                const token = peek();

                if (token.type !== 'IDENTIFIER') {
                    throw new Error(`Line ${token.line}: Expected command identifier but found '${token.value}'`);
                }

                const commandName = token.value;
                const commandLine = token.line;
                consume();

                if (commandName === TacticalParser.COMMAND_FORWARD) {
                    expect('(');
                    if (peek().type === 'NUMBER') {
                        const numToken = consume();
                        const units = Number(numToken.value);
                        if (units !== 1) {
                            throw new Error(`Line ${commandLine}: ${TacticalParser.COMMAND_FORWARD}() only advances 1 cell. To move multiple cells, use LOOP(n) { ${TacticalParser.COMMAND_FORWARD}() }`);
                        }
                    }
                    expect(')');
                    statements.push({
                        type: 'MOVE',
                        count: 1,
                        line: commandLine
                    });
                } else if (commandName === TacticalParser.COMMAND_TURN_RIGHT) {
                    expect('(');
                    if (peek().type === 'NUMBER') {
                        consume();
                    }
                    expect(')');
                    statements.push({
                        type: 'ROTATE_RIGHT',
                        line: commandLine
                    });
                } else if (commandName === TacticalParser.COMMAND_TURN_LEFT) {
                    expect('(');
                    if (peek().type === 'NUMBER') {
                        consume();
                    }
                    expect(')');
                    statements.push({
                        type: 'ROTATE_LEFT',
                        line: commandLine
                    });
                } else if (commandName === TacticalParser.COMMAND_SCAN) {
                    expect('(');
                    expect(')');
                    statements.push({
                        type: 'SCAN',
                        line: commandLine
                    });
                } else if (commandName === TacticalParser.COMMAND_LOOP) {
                    expect('(');
                    const iterationToken = expect('NUMBER');
                    const iterations = Number(iterationToken.value);
                    if (iterations <= 0) {
                        throw new Error(`Line ${commandLine}: LOOP iterations must be greater than 0`);
                    }
                    expect(')');
                    expect('{');
                    const loopBody = parseStatements(true);
                    expect('}');
                    statements.push({
                        type: 'LOOP',
                        iterations,
                        body: loopBody,
                        line: commandLine
                    });
                } else {
                    throw new Error(`Line ${commandLine}: Unknown command '${commandName}'. Valid: AVANZAR(n), GIRAR_DER(), GIRAR_IZQ(), LOOP(n) {}, SCAN()`);
                }
            }

            return statements;
        }

        return parseStatements(false);
    }

    /**
     * Calculates the static memory instruction budget according to FR-4.
     * @param {ASTNode[]} ast
     * @returns {MemoryReport}
     */
    static calculateMemory(ast) {
        /**
         * @param {ASTNode[]} nodes
         * @returns {number}
         */
        function countNodeInstructions(nodes) {
            let total = 0;
            for (const node of nodes) {
                if (node.type === 'LOOP') {
                    total += 1 + countNodeInstructions(node.body || []);
                } else {
                    total += 1;
                }
            }
            return total;
        }

        const instructionCount = countNodeInstructions(ast);

        let status = 'OPTIMAL';
        let label = 'OPTIMAL';
        let description = 'Resource budget optimal. Loop optimization rewarded.';

        if (instructionCount > 7) {
            status = 'OVERFLOW';
            label = 'OVERFLOW WARNING';
            description = 'Instruction threshold exceeded (> 7). Refactor sequence using LOOP constructs.';
        } else if (instructionCount >= 5) {
            status = 'NOMINAL';
            label = 'NOMINAL';
            description = 'Instruction budget nominal (5 - 7 instructions). Consider loop compression.';
        }

        return {
            instructionCount,
            status,
            label,
            description
        };
    }

    /**
     * Unrolls the AST into a sequential queue of discrete execution steps for the 3D engine.
     * @param {ASTNode[]} ast
     * @returns {ExecutionStep[]}
     * @throws {Error} When step execution limit is exceeded.
     */
    static generateExecutionSteps(ast) {
        const steps = [];

        /**
         * @param {ASTNode[]} nodes
         */
        function evaluateNodes(nodes) {
            for (const node of nodes) {
                if (steps.length > TacticalParser.MAX_EXECUTION_STEPS) {
                    throw new Error(`Execution limit exceeded (${TacticalParser.MAX_EXECUTION_STEPS} steps). Possible infinite recursion.`);
                }

                if (node.type === 'MOVE') {
                    const distance = node.count || 1;
                    for (let i = 0; i < distance; i++) {
                        steps.push({
                            action: 'MOVE',
                            distance: 1,
                            sourceLine: node.line
                        });
                    }
                } else if (node.type === 'ROTATE_RIGHT') {
                    steps.push({
                        action: 'ROTATE_RIGHT',
                        sourceLine: node.line
                    });
                } else if (node.type === 'ROTATE_LEFT') {
                    steps.push({
                        action: 'ROTATE_LEFT',
                        sourceLine: node.line
                    });
                } else if (node.type === 'SCAN') {
                    steps.push({
                        action: 'SCAN',
                        sourceLine: node.line
                    });
                } else if (node.type === 'LOOP') {
                    const times = node.iterations || 1;
                    for (let iter = 0; iter < times; iter++) {
                        evaluateNodes(node.body || []);
                    }
                }
            }
        }

        evaluateNodes(ast);
        return steps;
    }

    /**
     * Main compile entry point.
     * @param {string} sourceCode
     * @returns {ParseResult}
     */
    static compile(sourceCode) {
        if (!sourceCode || sourceCode.trim().length === 0) {
            return {
                success: true,
                ast: [],
                steps: [],
                memory: {
                    instructionCount: 0,
                    status: 'OPTIMAL',
                    label: 'IDLE',
                    description: 'Code buffer empty.'
                },
                error: null,
                errorLine: null
            };
        }

        try {
            const tokens = TacticalParser.tokenize(sourceCode);
            const ast = TacticalParser.parseTokens(tokens);
            const memory = TacticalParser.calculateMemory(ast);
            const steps = TacticalParser.generateExecutionSteps(ast);

            return {
                success: true,
                ast,
                steps,
                memory,
                error: null,
                errorLine: null
            };
        } catch (err) {
            const lineMatch = err.message.match(/Line (\d+)/i);
            const errorLine = lineMatch ? parseInt(lineMatch[1], 10) : null;

            return {
                success: false,
                ast: [],
                steps: [],
                memory: {
                    instructionCount: 0,
                    status: 'OVERFLOW',
                    label: 'SYNTAX ERROR',
                    description: err.message
                },
                error: err.message,
                errorLine
            };
        }
    }
}

window.TacticalParser = TacticalParser;
