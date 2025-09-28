// 测试数组定界符语法
void test_array_delimiters() {
    // 基础数组定界符
    string[] names =
    @@NAMES
    "Alice"
    "Bob"
    "Charlie"
    "Diana"
    NAMES;

    // 数字数组定界符
    int[] numbers =
    @@NUMBERS
    42
    100
    256
    -50
    NUMBERS;

    // 混合类型数组定界符
    mixed[] data =
    @@DATA
    "text"
    123
    45.67
    'x'
    DATA;

    // 复杂数组定界符与嵌套
    string[] complex_data =
    @@COMPLEX
    "line1"
    "line2 with spaces"
    "line3 with \"quotes\""
    "line4"
    COMPLEX;

    // 使用数组
    for(int i = 0; i < sizeof(names); i++) {
        write(names[i]);
    }
}

// 测试在函数参数中使用数组定界符
void test_array_as_parameter() {
    process_strings(
        @@STRINGS
        "first"
        "second"
        "third"
        STRINGS
    );
}

void process_strings(string[] arr) {
    foreach(string str in arr) {
        write(str);
    }
}

// 测试空数组定界符
void test_empty_array() {
    string[] empty =
    @@EMPTY
    EMPTY;

    write("Empty array size: " + sizeof(empty));
}