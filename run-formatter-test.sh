#!/bin/bash

# LPC格式化测试程序启动器 (Linux/macOS版本)

set -e

show_help() {
    echo ""
    echo "📚 LPC格式化测试程序使用方法:"
    echo ""
    echo "  ./run-formatter-test.sh                    # 显示交互菜单"
    echo "  ./run-formatter-test.sh builtin            # 运行内置测试用例"
    echo "  ./run-formatter-test.sh all                # 运行全部测试"
    echo "  ./run-formatter-test.sh file \"path.lpc\"    # 测试单个文件"
    echo "  ./run-formatter-test.sh dir \"path\"         # 测试目录"
    echo "  ./run-formatter-test.sh --help             # 显示此帮助"
    echo ""
    echo "📋 内置测试用例包括:"
    echo "  - 基础变量声明格式化"
    echo "  - 函数定义格式化"
    echo "  - LPC特有语法格式化 (数组、映射、函数指针等)"
    echo "  - 控制结构格式化"
    echo "  - 错误处理测试"
    echo ""
    echo "🔄 全部测试包括:"
    echo "  - 所有内置测试用例"
    echo "  - test-files目录中的测试文件"
    echo "  - 项目根目录的测试文件"
    echo ""
}

show_menu() {
    echo ""
    echo "🚀 LPC格式化测试程序启动器"
    echo "================================"
    echo ""
    echo "请选择要执行的测试:"
    echo ""
    echo "[1] 运行内置测试用例"
    echo "[2] 运行全部测试"
    echo "[3] 测试单个文件"
    echo "[4] 测试目录"
    echo "[5] 显示帮助"
    echo "[0] 退出"
    echo ""

    read -p "请输入选择 (0-5): " choice

    case $choice in
        1)
            echo "📋 运行内置测试用例"
            npx ts-node standalone-formatter.ts --builtin
            ;;
        2)
            echo "🔄 运行全部测试"
            npx ts-node standalone-formatter.ts --all
            ;;
        3)
            read -p "请输入文件路径: " filepath
            echo "📄 测试单个文件: $filepath"
            npx ts-node standalone-formatter.ts --file "$filepath"
            ;;
        4)
            read -p "请输入目录路径: " dirpath
            echo "📁 测试目录: $dirpath"
            npx ts-node standalone-formatter.ts --dir "$dirpath"
            ;;
        5)
            show_help
            ;;
        0)
            echo "👋 再见!"
            exit 0
            ;;
        *)
            echo "❌ 无效选择，请重试"
            show_menu
            ;;
    esac

    echo ""
    echo "测试完成！"
    read -p "按Enter键继续..."
}

run_test() {
    echo "正在运行格式化测试..."
    echo ""

    case $1 in
        "builtin")
            echo "📋 运行内置测试用例"
            npx ts-node standalone-formatter.ts --builtin
            ;;
        "all")
            echo "🔄 运行全部测试"
            npx ts-node standalone-formatter.ts --all
            ;;
        "file")
            if [ -z "$2" ]; then
                echo "❌ 错误: 请指定要测试的文件路径"
                echo "用法: ./run-formatter-test.sh file \"path/to/file.lpc\""
                exit 1
            fi
            echo "📄 测试单个文件: $2"
            npx ts-node standalone-formatter.ts --file "$2"
            ;;
        "dir")
            if [ -z "$2" ]; then
                echo "❌ 错误: 请指定要测试的目录路径"
                echo "用法: ./run-formatter-test.sh dir \"path/to/directory\""
                exit 1
            fi
            echo "📁 测试目录: $2"
            npx ts-node standalone-formatter.ts --dir "$2"
            ;;
        *)
            echo "❌ 未知参数: $1"
            show_help
            exit 1
            ;;
    esac
}

# 主程序入口
main() {
    # 检查是否有参数
    if [ $# -eq 0 ]; then
        show_menu
        return
    fi

    # 处理帮助参数
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_help
        return
    fi

    # 运行指定的测试
    run_test "$@"
}

# 确保脚本具有执行权限
if [ ! -x "$0" ]; then
    echo "⚠️  正在设置脚本执行权限..."
    chmod +x "$0"
fi

# 检查依赖
if ! command -v npx &> /dev/null; then
    echo "❌ 错误: 未找到 npx 命令，请先安装 Node.js"
    exit 1
fi

# 运行主程序
main "$@"