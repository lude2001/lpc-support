// 测试Switch范围匹配语法
void test_switch_ranges() {
    int value = 42;

    switch(value) {
        // 完整范围匹配 (已支持)
        case 1..10:
            write("1到10之间");
            break;

        // 开放范围匹配 (向上开放)
        case 50..:
            write("50及以上");
            break;

        // 封闭范围匹配 (向下开放)
        case ..20:
            write("20及以下");
            break;

        // 多个范围
        case 30..35:
        case 40..45:
            write("30-35或40-45");
            break;

        default:
            write("其他值");
            break;
    }
}

// 测试嵌套switch中的范围语法
void test_nested_switch() {
    int x = 10, y = 20;

    switch(x) {
        case 1..5:
            switch(y) {
                case ..15:
                    write("x在1-5, y≤15");
                    break;
                case 16..:
                    write("x在1-5, y≥16");
                    break;
            }
            break;

        case 6..:
            write("x≥6");
            break;
    }
}

// 测试字符范围
void test_char_ranges() {
    int ch = 'M';

    switch(ch) {
        case 'A'..'Z':
            write("大写字母");
            break;
        case 'a'..'z':
            write("小写字母");
            break;
        case '0'..'9':
            write("数字字符");
            break;
        default:
            write("其他字符");
            break;
    }
}