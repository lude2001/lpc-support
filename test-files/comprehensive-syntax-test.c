// LPC现代语法特性综合测试文件
// 测试所有新实现的语法特性

// =============================================================================
// 1. 开放范围 Switch 匹配 (已实现)
// =============================================================================

void test_switch_ranges() {
    int value = 15;

    switch (value) {
        case 1..10:
            printf("值在1到10之间\n");
            break;

        case 50..:
            printf("值大于等于50\n");
            break;

        case ..20:
            printf("值小于等于20\n");
            break;

        case 'a'..'z':
            printf("小写字母范围\n");
            break;

        default:
            printf("其他值\n");
            break;
    }
}

// =============================================================================
// 2. 字符串数组定界符 (已实现)
// =============================================================================

void test_array_delimiters() {
    // 基本使用
    string names = @@NAMES
        "Alice"
        "Bob"
        "Charlie"
        "David"
    NAMES;

    // 复杂内容定界符
    mixed configuration = @@CONFIG
        "server_host": "localhost",
        "server_port": 8080,
        "database": ({
            "host": "db.example.com",
            "port": 5432,
            "name": "myapp"
        }),
        "features": ({ "auth", "logging", "cache" })
    CONFIG;

    // 嵌套数组与定界符
    string template = @@HTML
        <html>
            <head><title>{{title}}</title></head>
            <body>
                <h1>{{header}}</h1>
                <ul>
                    {{#items}}
                    <li>{{name}}</li>
                    {{/items}}
                </ul>
            </body>
        </html>
    HTML;
}

// =============================================================================
// 3. 增强函数指针语法 (已实现)
// =============================================================================

void test_enhanced_function_pointers() {
    string func_name = "calculate_sum";

    // 变量引用函数指针
    function ptr1 = (: $func_name :);

    // 动态表达式函数指针
    function ptr2 = (: $(get_function_name("math")) :);

    // 复杂表达式
    string module = "utils";
    string operation = "process";
    function ptr3 = (: $(module + "_" + operation) :);

    // 条件函数指针
    function ptr4 = (: $(debug_mode ? "debug_handler" : "prod_handler") :);

    // 在实际使用中
    int result = evaluate(ptr1, ({ 10, 20, 30 }));
    printf("计算结果: %d\n", result);
}

// =============================================================================
// 4. 数组延展语法 (已实现)
// =============================================================================

void test_array_spread_syntax() {
    int arr1 = ({ 1, 2, 3 });
    int arr2 = ({ 4, 5, 6 });
    string names = ({ "Alice", "Bob", "Charlie" });

    // 函数调用中的参数解包
    printf("Values: %d %d %d\n", ...arr1);
    debug("All values:", ...arr1, ...arr2);

    // 混合普通参数和延展参数
    sprintf(buffer, "Format: %s %d %d %d", "test", ...arr1);
    call_function(42, ...arr1, 99);

    // 数组字面量中的延展
    int combined = ({ ...arr1, ...arr2 });
    int mixed = ({ 1, ...arr1, 2, ...arr2, 3 });
    int prefixed = ({ 0, ...arr1 });
    int suffixed = ({ ...arr1, 99 });

    // 空数组延展
    int empty = ({});
    int with_empty = ({ 1, ...empty, 2 });

    // 嵌套函数调用中的延展
    process_data(...get_first_batch(), process_item("special"), ...get_second_batch());

    // 在赋值表达式中
    result = combine(...arr1);

    // 在条件表达式中
    flag = is_valid(...arr1) ? 1 : 0;

    // 在return语句中
    return create_result(...arr1);
}

// 函数定义支持变参（可选延展参数）
void variadic_function(string format, ...) {
    // 处理变参
}

// =============================================================================
// 5. 综合使用示例
// =============================================================================

void comprehensive_example() {
    // 使用数组定界符定义复杂数据
    mixed user_data = @@USERS
        ({
            "id": 1,
            "name": "Alice",
            "permissions": ({ "read", "write" }),
            "settings": ([ "theme": "dark", "lang": "en" ])
        }),
        ({
            "id": 2,
            "name": "Bob",
            "permissions": ({ "read" }),
            "settings": ([ "theme": "light", "lang": "zh" ])
        })
    USERS;

    // 使用延展语法处理用户权限
    string all_permissions = ({});
    foreach (mixed user in user_data) {
        all_permissions = ({ ...all_permissions, ...user["permissions"] });
    }

    // 使用范围switch处理不同的用户级别
    foreach (mixed user in user_data) {
        switch (sizeof(user["permissions"])) {
            case 1..2:
                printf("普通用户: %s\n", user["name"]);
                break;
            case 3..:
                printf("高级用户: %s\n", user["name"]);
                break;
            default:
                printf("受限用户: %s\n", user["name"]);
                break;
        }
    }

    // 使用动态函数指针处理用户操作
    string action = "validate_user";
    function validator = (: $(action) :);

    foreach (mixed user in user_data) {
        if (evaluate(validator, user)) {
            printf("用户 %s 验证通过\n", user["name"]);
            // 使用延展语法调用处理函数
            process_user_permissions(...user["permissions"]);
        }
    }
}

// 辅助函数
string get_function_name(string category) {
    return category + "_processor";
}

int calculate_sum(int *arr) {
    int sum = 0;
    foreach (int val in arr) {
        sum += val;
    }
    return sum;
}

void process_user_permissions(string *permissions) {
    printf("处理权限: %s\n", implode(permissions, ", "));
}

// 测试用的其他函数
mixed get_first_batch() { return ({ "item1", "item2" }); }
mixed get_second_batch() { return ({ "item3", "item4" }); }
mixed process_item(string item) { return "processed_" + item; }
void process_data(mixed args...) { printf("处理数据: %O\n", args); }
int combine(int *arr) { return sizeof(arr); }
int is_valid(int *arr) { return sizeof(arr) > 0; }
mixed create_result(int *arr) { return ([ "count": sizeof(arr), "data": arr ]); }
int evaluate(function f, mixed args...) { return 1; }