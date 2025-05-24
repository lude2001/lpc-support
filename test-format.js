const fs = require('fs');
const path = require('path');

// 从编译后的 formatter.js 文件导入
const { formatLPCCode } = require('./out/formatter');

if (process.argv.length < 3) {
    console.error('Usage: node test-format.js <file_path>');
    process.exit(1);
}

const filePath = process.argv[2];
const outputFilePath = "formatted_output.txt"; 

// 显示更多调试信息
console.log("Reading file:", filePath);
const fileContent = fs.readFileSync(filePath, 'utf8');
console.log("Original file content length:", fileContent.length);

console.log("Formatting code...");
try {
    const formattedCode = formatLPCCode(fileContent);
    console.log("Formatted code length:", formattedCode.length);
    
    // 保存格式化后的代码到文件
    console.log("Writing formatted code to:", outputFilePath);
    fs.writeFileSync(outputFilePath, formattedCode, 'utf8');
    
    // 显示原始代码和格式化后的代码
    console.log("--- Original Code (" + path.basename(filePath) + ") ---");
    console.log(fileContent);
    
    console.log("\n--- Formatted Code (" + path.basename(filePath) + ") via console.log ---");
    console.log(formattedCode);
    console.log("--- Formatting Complete ---");
} catch (error) {
    console.error("Error during formatting:", error);
    console.error(error.stack); // Print stack trace for better debugging
    process.exit(1);
} 