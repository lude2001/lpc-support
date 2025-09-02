//控制层基本类

//预定义宏
#define RequestType(f_name,http_type) string f_name = http_type;

mapping function_dict;

/**
 * @brief 更新函数字典，记录所有可调用函数的参数和返回类型信息
 * @return mapping 返回更新后的函数字典，包含所有函数的参数数量、返回类型和参数列表信息
 * @details 该函数通过调用LPC标准库的functions()函数获取当前对象的所有可调用函数信息
 *          其中第二个参数1用于获取完整的函数元数据（包括函数名、参数列表、返回类型等）
 *          存储结构采用层级映射，确保后续可快速通过函数名访问完整的函数描述
 *          设计初衷是建立程序内部函数的元数据管理机制，便于后续的函数调用优化、调试分析等场景使用
 */
mapping update_function_dict()
{
    mixed function_info_list = functions(this_object(),1);
    mapping data = ([]);

    foreach (mixed *single_function_info in function_info_list)
    {
        string function_name,function_return_type,*function_parameter_list;
        int function_parameter_count;
        mapping function_data = ([]);

        function_name = single_function_info[0];
        function_parameter_count = single_function_info[1];
        function_return_type = single_function_info[2];
        function_parameter_list = single_function_info[2..];

        function_data["parameter_count"] = function_parameter_count;
        function_data["return_type"] = function_return_type;
        function_data["parameter_list"] = function_parameter_list;

        data[function_name] = function_data;
    }

    function_dict = data;

    return data;

}

/**
 * @brief 获取或更新函数字典映射
 * @return mapping 函数字典映射结构
 * @details 该函数采用预加载+懒加载策略，确保函数字典在首次调用时通过update_function_dict进行解析，后续调用直接复用已有数据。这种设计避免了重复加载函数信息，既保证数据一致性又提升系统性能。
 */
mapping get_function_dict()
{
    if (!function_dict)
    {
        update_function_dict();
    }
    return function_dict;
}

/**
 * @brief 根据函数名获取对应的函数信息映射表条目
 * @param string function_name 必须存在的函数名，用于查询函数信息
 * @return mapping 返回对应的函数信息映射表条目，若函数不存在则返回 0
 * @details 该函数通过预定义的函数字典（get_function_dict()）实现函数信息的快速查找，
 * 确保函数名的合法性可避免无效访问，提高程序健壮性。当函数名不存在时返回 0 以明确表示查询失败。
 */
mapping get_function_info(string function_name)
{
    mapping dict = get_function_dict();
    return dict[function_name];
}

/**
 * @brief 获取所有可用函数名称列表
 * @return string[] 函数名称数组，包含所有系统内置和用户自定义函数
 * @details 该函数通过调用内部函数字典接口获取函数映射，再提取所有键作为结果。设计如此是为了统一函数管理接口，便于后续扩展函数元数据查询功能。当程序启动时未注册任何函数时，返回空数组。
 */
string *get_all_function_names()
{
    mapping dict = get_function_dict();
    return keys(dict);
}

/**
 * @brief 重置函数字典，确保初始状态
 * @details 该函数用于在游戏循环开始时重置全局函数字典，确保所有函数引用基于当前状态，避免残留的旧函数绑定导致逻辑错误或内存泄漏。调用此函数后，所有对function_dict的访问将指向空状态，需在后续操作前重新加载必要的函数定义。
 */
void reset_function_dict()
{
    function_dict = 0;
}

/**
 * @brief 检查HTTP方法是否为有效类型
 * @param string http_type 待验证的HTTP方法名称（不区分大小写）
 * @return int 返回1表示有效，0表示无效
 * @details 该函数通过预定义的HTTP方法白名单进行验证，采用以下设计原则：
 * 1. 使用固定数组而非动态查询提高性能，member_array操作时间复杂度为O(n)
 * 2. 内部通过upper_case统一转为大写处理，避免因客户端大小写不一致导致误判
 * 3. 预定义包含RFC 2616标准定义的8种常见HTTP方法（GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS）
 * 4. 返回值设计为二进制状态码，符合LPC函数返回整型状态码的约定
 */
int is_valid_http_type(string http_type)
{
    string *valid_types = ({"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"});
    return member_array(upper_case(http_type), valid_types) != -1;
}

/**
 * @brief 检查指定函数名是否存在于当前对象变量中，实际应用场景用于验证接口函数的请求类型
 * @param string function_name 需要查询的函数名称
 * @return string 存在则返回对应函数值，否则返回0
 * @details 该函数通过变量检查机制验证函数名的有效性，确保调用方能识别未注册的函数调用行为，避免因非法函数执行导致的系统崩溃。当函数名未在变量列表中时返回0，既符合LPC函数调用规范，又能通过后续判断处理异常情况。
 */
string get_function_request_type(string function_name)
{
    string *my_variables = variables(this_object());

    if (member_array(function_name, my_variables) == -1)
    {
        return 0;
    }
    return fetch_variable(function_name);
}

