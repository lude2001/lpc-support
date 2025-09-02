/**
 * @brief error_info.c - HTTP 控制器，用于获取错误信息
 * @details 提供 HTTP 接口来查询 LINT_D 中记录的运行时错误信息。
 * @author Gemini AI Assistant
 * @date 2024-07-27
 */
// 定义请求类型宏，简化接口函数定义
#define RequestType(f_name, http_type) string f_name##_request_type = http_type;

// 继承基础 HTTP 控制器
inherit "/adm/special_ob/http/base.c";

/**
 * @brief 获取所有运行时错误信息
 * @details 通过 HTTP GET 请求调用此接口，返回 LINT_D 中缓存的所有运行时错误信息。
 * 
 * @section http_usage HTTP 调用说明
 * 
 * **URL:** `/error_info/get_runtime_errors`
 * 
 * **Method:** `GET`
 * 
 * **Parameters:** None
 * 
 * **Success Response:**
 *   - **Code:** 200 OK
 *   - **Content:** JSON 对象，包含一个名为 "errors" 的数组。
 *     ```json
 *     {
 *       "errors": [
 *         {
 *           "message": "Error message text",
 *           "file": "/path/to/error/file.c",
 *           "line": 123,
 *           "count": 5
 *         },
 *         {
 *           "message": "Another error",
 *           "file": "/another/path/object.c",
 *           "line": 45,
 *           "count": 1
 *         }
 *       ]
 *     }
 *     ```
 *   - **Note:** 如果没有运行时错误记录，`errors` 数组将为空 `[]`。
 * 
 * **Error Response:**
 *   - **Code:** 404 Not Found (如果 LINT_D 未加载)
 *   - **Content:** JSON 对象，包含一个名为 "error" 的字符串。
 *     ```json
 *     {
 *       "error": "LINT_D daemon not found."
 *     }
 *     ```
 * 
 * @section curl_example Curl 调用示例
 * ```bash
 * curl -X GET http://your_mud_ip:8092/error_info/get_runtime_errors 
 * ```
 * 
 * @return array 一个包含所有运行时错误信息的映射数组，每个映射包含 message, file, line, count。
 *               如果 LINT_D 未找到，返回包含错误信息的映射。
 */
RequestType(get_runtime_errors, "GET")
varargs mixed get_runtime_errors(string file_name) // 使用 mixed 因为可能返回错误映射
{
    object lint_d;
    mapping error_cache;
    mixed *result_array = ({}); // 初始化为空数组
    string err_msg, err_file;
    int err_line;

    // 查找 LINT_D 对象
    lint_d = load_object(LINT_D);
    if (!lint_d)
    {
        // 如果 LINT_D 未找到，返回错误信息
        // 注意：根据 httpd.c 的逻辑，直接返回非映射或非数组可能导致错误。
        // 返回一个包含错误信息的标准结构可能更好，但这需要调整 httpd.c 或 base.c。
        // 暂时返回一个包含错误信息的映射，以便 httpd.c 的 send_json_response 处理。
         return ([ "error": "LINT_D daemon not found." ]);
        // 或者，如果 base.c 或 httpd.c 支持，可以这样设置状态码：
        // set_http_status(404); 
        // return "LINT_D daemon not found.";
    }

    // 获取运行时错误缓存
    error_cache = lint_d->query_runtime_error_cache();

    // 检查缓存是否有效且不为空
    if (!mapp(error_cache) || sizeof(error_cache) == 0)
    {
        // 没有错误记录，返回包含空数组的映射
        return ([ "errors": result_array ]); 
    }

    // 遍历缓存并格式化输出
    foreach (string key, int count in error_cache)
    {
        // 解析错误 key: "错误信息|文件路径|行号"
        if (sscanf(key, "%s|%s|%d", err_msg, err_file, err_line) == 3)
        {
            result_array += ({ 
                ([ 
                    "message": err_msg, 
                    "file": err_file, 
                    "line": err_line, 
                    "count": count 
                ]) 
            });
        }
        else
        {
            // 如果 key 格式不正确，记录一个日志并跳过
            log_file("lints_http_error", sprintf("Invalid error key format found in runtime_error_cache: %s at %s\n", key, ctime(time())));
            // 也可以在返回的 JSON 中包含一个格式错误的条目
             result_array += ({ 
                ([ 
                    "error": "Invalid key format", 
                    "original_key": key,
                    "count": count 
                ]) 
            });
        }
    }

    // 返回包含错误数组的映射
    return ([ "errors": result_array ]);
}

/**
 * @brief 获取所有编译时错误信息
 * @details 通过 HTTP GET 请求调用此接口，返回 LINT_D 中记录的所有编译时错误信息。
 * 
 * @section http_usage HTTP 调用说明
 * 
 * **URL:** `/error_info/get_compile_errors`
 * 
 * **Method:** `GET`
 * 
 * **Parameters:** None
 * 
 * **Success Response:**
 *   - **Code:** 200 OK
 *   - **Content:** JSON 对象，包含一个名为 "errors" 的数组。
 *     ```json
 *     {
 *       "errors": [
 *         {
 *           "file": "/path/to/error/file.c",
 *           "error": "Error message text",
 *           "time": 1678886400 
 *         },
 *         {
 *           "file": "/another/path/object.c",
 *           "error": "Another error message",
 *           "time": 1678886410
 *         }
 *       ]
 *     }
 *     ```
 *   - **Note:** 如果没有编译错误记录，`errors` 数组将为空 `[]`。
 * 
 * **Error Response:**
 *   - **Code:** 404 Not Found (如果 LINT_D 未加载)
 *   - **Content:** JSON 对象，包含一个名为 "error" 的字符串。
 *     ```json
 *     {
 *       "error": "LINT_D daemon not found."
 *     }
 *     ```
 * 
 * @section curl_example Curl 调用示例
 * ```bash
 * curl -X GET http://your_mud_ip:8092/error_info/get_compile_errors
 * ```
 * 
 * @return array 一个包含所有编译错误信息的映射数组，每个映射包含 file, error, time。
 *               如果 LINT_D 未找到，返回包含错误信息的映射。
 */
RequestType(get_compile_errors, "GET")
varargs mixed get_compile_errors(string file_name)
{
    object lint_d;
    mapping all_errors;
    mixed *result_array = ({});

    lint_d = load_object(LINT_D);
    if (!lint_d)
    {
        return ([ "error": "LINT_D daemon not found." ]);
    }

    all_errors = lint_d->query_all_err();

    if (!mapp(all_errors) || sizeof(all_errors) == 0)
    {
        return ([ "errors": result_array ]);
    }

    foreach (string file, mapping err_info in all_errors)
    {
        if (mapp(err_info) && !undefinedp(err_info["err"]) && !undefinedp(err_info["time"]))
        {
            result_array += ({ 
                ([ 
                    "file": file, 
                    "error": err_info["err"], 
                    "time": err_info["time"] 
                ]) 
            });
        }
    }

    return ([ "errors": result_array ]);
}

/**
 * @brief 清空所有记录的错误
 * @details 通过 HTTP POST 请求调用此接口，将清除 LINT_D 中记录的所有编译时和运行时错误。
 *          这是一个危险操作，应谨慎使用。
 * 
 * @section http_usage HTTP 调用说明
 * 
 * **URL:** `/error_info/clear_all_errors`
 * 
 * **Method:** `POST`
 * 
 * **Parameters:** None
 * 
 * **Success Response:**
 *   - **Code:** 200 OK
 *   - **Content:** JSON 对象，包含成功信息。
 *     ```json
 *     {
 *       "status": "success",
 *       "message": "All errors cleared."
 *     }
 *     ```
 * 
 * **Error Response:**
 *   - **Code:** 404 Not Found (如果 LINT_D 未加载)
 *   - **Content:** JSON 对象，包含错误信息。
 *     ```json
 *     {
 *       "error": "LINT_D daemon not found."
 *     }
 *     ```
 * 
 * @section curl_example Curl 调用示例
 * ```bash
 * curl -X POST http://your_mud_ip:8092/error_info/clear_all_errors
 * ```
 * 
 * @return mapping 返回一个包含操作状态的映射。
 */
RequestType(clear_all_errors, "POST")
mixed clear_all_errors()
{
    object lint_d;

    lint_d = find_object(LINT_D);
    if (!lint_d)
    {
        return ([ "error": "LINT_D daemon not found." ]);
    }

    lint_d->clear_all_errors();

    return ([ "status": "success", "message": "All errors cleared." ]);
}

void create() 
{
    // 控制器对象创建时的初始化（如果需要）
} 