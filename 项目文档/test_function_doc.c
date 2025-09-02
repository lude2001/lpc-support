/**
 * @brief 测试函数文档面板的示例文件
 * @author Test
 * @since 1.0
 */

/**
 * @brief 计算两个数的和
 * @details 这个函数接受两个整数参数并返回它们的和
 * @param int a 第一个加数
 * @param int b 第二个加数  
 * @return int 两个数的和
 * @example
 * int result = add(5, 3);
 * // result 将等于 8
 */
int add(int a, int b) {
    return a + b;
}

/**
 * @brief 计算数字的平方
 * @param int num 要计算平方的数字
 * @return int 输入数字的平方
 */
int square(int num) {
    return num * num;
}

/**
 * 一个没有JavaDoc注释的简单函数
 */
void simple_function() {
    printf("Hello World!\n");
}

// 带有单行注释的函数
string get_name() {
    return "Test Name";
}