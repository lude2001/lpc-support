@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo 🚀 LPC格式化测试程序启动器
echo ================================
echo.

if "%1"=="" goto show_menu
if "%1"=="--help" goto show_help

:run_test
echo 正在运行格式化测试...
echo.

if "%1"=="builtin" (
    echo 📋 运行内置测试用例
    npx ts-node standalone-formatter.ts --builtin
    goto end
)

if "%1"=="all" (
    echo 🔄 运行全部测试
    npx ts-node standalone-formatter.ts --all
    goto end
)

if "%1"=="file" (
    if "%2"=="" (
        echo ❌ 错误: 请指定要测试的文件路径
        echo 用法: run-formatter-test.bat file "path/to/file.lpc"
        goto end
    )
    echo 📄 测试单个文件: %2
    npx ts-node standalone-formatter.ts --file "%2"
    goto end
)

if "%1"=="dir" (
    if "%2"=="" (
        echo ❌ 错误: 请指定要测试的目录路径
        echo 用法: run-formatter-test.bat dir "path/to/directory"
        goto end
    )
    echo 📁 测试目录: %2
    npx ts-node standalone-formatter.ts --dir "%2"
    goto end
)

echo ❌ 未知参数: %1
goto show_help

:show_menu
echo 请选择要执行的测试:
echo.
echo [1] 运行内置测试用例
echo [2] 运行全部测试
echo [3] 测试单个文件
echo [4] 测试目录
echo [5] 显示帮助
echo [0] 退出
echo.
set /p choice="请输入选择 (0-5): "

if "!choice!"=="1" (
    call :run_test builtin
    goto menu_end
)
if "!choice!"=="2" (
    call :run_test all
    goto menu_end
)
if "!choice!"=="3" (
    set /p filepath="请输入文件路径: "
    call :run_test file "!filepath!"
    goto menu_end
)
if "!choice!"=="4" (
    set /p dirpath="请输入目录路径: "
    call :run_test dir "!dirpath!"
    goto menu_end
)
if "!choice!"=="5" (
    goto show_help
    goto menu_end
)
if "!choice!"=="0" (
    echo 👋 再见!
    goto end
)

echo ❌ 无效选择，请重试
goto show_menu

:menu_end
echo.
echo 测试完成！
pause
goto end

:show_help
echo.
echo 📚 使用方法:
echo.
echo   run-formatter-test.bat                    # 显示交互菜单
echo   run-formatter-test.bat builtin            # 运行内置测试用例
echo   run-formatter-test.bat all                # 运行全部测试
echo   run-formatter-test.bat file "path.lpc"    # 测试单个文件
echo   run-formatter-test.bat dir "path"         # 测试目录
echo   run-formatter-test.bat --help             # 显示此帮助
echo.
echo 📋 内置测试用例包括:
echo   - 基础变量声明格式化
echo   - 函数定义格式化
echo   - LPC特有语法格式化 (数组、映射、函数指针等)
echo   - 控制结构格式化
echo   - 错误处理测试
echo.
echo 🔄 全部测试包括:
echo   - 所有内置测试用例
echo   - test-files目录中的测试文件
echo   - 项目根目录的测试文件
echo.

:end
endlocal