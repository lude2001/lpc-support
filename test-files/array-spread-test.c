// 数组延展语法测试文件
// 测试各种数组延展的使用场景

void test_function_call_spread() {
    int arr1 = ({1, 2, 3});
    int arr2 = ({4, 5, 6});

    // 函数调用中的参数解包
    printf("Values: %d %d %d", ...arr1);
    debug("All values", ...arr1, ...arr2);

    // 混合普通参数和延展参数
    sprintf(buffer, "Format: %s %d %d %d", "test", ...arr1);
    call_function(42, ...arr1, 99);
}

void test_array_spread() {
    int base = ({10, 20});
    int extra = ({30, 40, 50});

    // 数组字面量中的延展
    int combined = ({...base, ...extra});
    int mixed = ({1, ...base, 2, ...extra, 3});
    int prefixed = ({0, ...base});
    int suffixed = ({...base, 99});

    // 空数组延展
    int empty = ({});
    int with_empty = ({1, ...empty, 2});
}

void test_foreach_spread() {
    string names = ({"Alice", "Bob", "Charlie"});
    int numbers = ({1, 2, 3, 4, 5});

    // foreach循环初始化中的延展（理论语法）
    foreach(string name in ...names) {
        printf("Name: %s\n", name);
    }

    // 表达式列表中的延展
    for(int i = 0; i < 5; i++, ...numbers) {
        // 复杂的for循环表达式
    }
}

void test_complex_spread() {
    mapping data = ([ "a": 1, "b": 2 ]);
    mixed complex_array = ({
        "start",
        ...({1, 2, 3}),
        data,
        ...get_array_function(),
        "end"
    });

    // 嵌套函数调用中的延展
    process_data(...get_first_batch(), process_item("special"), ...get_second_batch());
}

// 函数定义支持变参（可选延展参数）
void variadic_function(string format, ...) {
    // 处理变参
}

// 测试延展在不同上下文中的使用
void test_contexts() {
    int data = ({1, 2, 3});

    // 在赋值表达式中
    result = combine(...data);

    // 在条件表达式中
    flag = is_valid(...data) ? 1 : 0;

    // 在return语句中
    return create_result(...data);
}