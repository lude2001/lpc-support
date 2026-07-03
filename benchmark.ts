import { performance } from 'perf_hooks';

const SyntaxKind = {
    AssignmentExpression: 1,
    Other: 2
};

const nodes = [];
for (let i = 0; i < 100000; i++) {
    nodes.push({
        kind: i % 10 === 0 ? SyntaxKind.AssignmentExpression : SyntaxKind.Other,
        metadata: { operator: '=' },
        children: [{}, {}]
    });
}

function runFilter(nodes) {
    let count = 0;
    for (const assignment of nodes.filter((node) => node.kind === SyntaxKind.AssignmentExpression)) {
        if (assignment.metadata?.operator !== '=') continue;
        count++;
    }
    return count;
}

function runNoFilter(nodes) {
    let count = 0;
    for (const node of nodes) {
        if (node.kind !== SyntaxKind.AssignmentExpression) continue;
        const assignment = node;
        if (assignment.metadata?.operator !== '=') continue;
        count++;
    }
    return count;
}

// Warmup
for (let i = 0; i < 100; i++) {
    runFilter(nodes);
    runNoFilter(nodes);
}

// Benchmark
const filterStart = performance.now();
for (let i = 0; i < 1000; i++) {
    runFilter(nodes);
}
const filterEnd = performance.now();

const noFilterStart = performance.now();
for (let i = 0; i < 1000; i++) {
    runNoFilter(nodes);
}
const noFilterEnd = performance.now();

console.log(`Baseline (Filter): ${filterEnd - filterStart} ms`);
console.log(`Optimized (No Filter): ${noFilterEnd - noFilterStart} ms`);
