#include <net/socket.h>
#include <socket_err.h>

#define PORT 8092
#define HTTP_CONTROLLER_PATH(c_path) "/adm/special_ob/http/controller/" + c_path

int listen_fd;
void send_response(int fd, int status_code, string message);
void send_json_response(int fd, int status_code, mixed data);
string *parse_query_string(string query_string);
string *parse_post_data(string body);
string get_function_name(mixed *args);

void create()
{
    listen_fd = socket_create(STREAM, "read_callback", "close_callback");
    if (listen_fd < 0)
    {
        write("创建socket失败。\n");
        return;
    }

    if (socket_bind(listen_fd, PORT) < 0)
    {
        write("绑定socket失败。\n");
        socket_close(listen_fd);
        return;
    }

    if (socket_listen(listen_fd, "listen_callback") < 0)
    {
        write("监听socket失败。\n");
        socket_close(listen_fd);
        return;
    }

    write("HTTP守护进程正在监听端口 " + PORT + "\n");
}

void listen_callback(int fd)
{
    int client_fd;
    client_fd = socket_accept(fd, "read_callback", "write_callback");
    if (client_fd < 0)
    {
        write("接受连接失败。\n");
    }
}

void read_callback(int fd, mixed message)
{
    string method, path,  http_version;
    string header, body;
    string controller_name, function_name;
    object controller;
    mixed result;
    string *args = ({}); // Changed from ({}) to ({}), as per the code block
    string expected_method;
    string *ip_list = ({});
    string query_string = "";

    // 解析HTTP请求
    if (sscanf(message, "%s %s HTTP/%s\r\n%s\r\n\r\n%s", method, path, http_version, header, body) != 5)
    {
        send_response(fd, 400, "错误的请求");
        return;
    }

    // 解析路径和查询字符串
    if (strsrch(path, "?") != -1)
    {
        // 分离路径和查询字符串
        if (sscanf(path, "%s?%s", path, query_string) != 2)
        {
            send_response(fd, 400, "无效的请求路径" + path);
            return;
        }
    }

    // 从路径中提取控制器名和函数名
    if (sscanf(path, "/%s/%s", controller_name, function_name) != 2)
    {
        send_response(fd, 400, "无效的请求路径" + path);
        return;
    }

    // 根据请求方法处理参数
    if (method == "GET" && query_string != "")
    {
        args = parse_query_string(query_string);
    }
    else if (method == "POST")
    {

        if (body == "" || !body)
        {
            args = parse_query_string(query_string);
        }
        else
        {
            args = parse_post_data(body);
        }

    }

    // 加载控制器
    controller = load_object(HTTP_CONTROLLER_PATH(controller_name));
    if (!objectp(controller))
    {
        send_response(fd, 404, "未找到控制器:" + HTTP_CONTROLLER_PATH(controller_name));
        return;
    }

    //检查控制是否有地址限制
    if (controller->get_limit_ip_list())
    {
        string source_address;
        string ip, port;
        int is_allowed = 0;

        ip_list = controller->get_limit_ip_list();

        // 返回的格式类似于"127.0.0.1 23"
        source_address = socket_address(fd);
        
        // 解析IP地址和端口
        if (sscanf(source_address, "%s %s", ip, port) != 2)
        {
            send_response(fd, 400, "无效的客户端地址");
            return;
        }

        // 检查IP是否在白名单中
        foreach (string allowed_ip in ip_list)
        {
            if (ip == allowed_ip)
            {
                is_allowed = 1;
                break;
            }
        }

        // 如果IP不在白名单中,返回403错误
        if (!is_allowed)
        {
            send_response(fd, 403, "IP地址 " + ip + " 不在允许访问列表中");
            return;
        }
    }

    // 检查函数是否存在
    if (!function_exists(function_name, controller))
    {
        send_response(fd, 404, "未找到函数:" + function_name);
        return;
    }

    // 检查请求方法是否匹配
    expected_method = controller->get_function_request_type(function_name);
    if (expected_method && expected_method != method)
    {
        send_response(fd, 405, "方法不允许");
        return;
    }
    // 调用函数
    result = call_other(controller, function_name, args...);

    if (!result)
    {
        send_response(fd, 405, base_name(controller) + "的" + function_name + "方法没有然后返回:" + result);
        return;
    }

    // 发送响应
    send_json_response(fd, 200, result);
}

// 修改解析查询字符串函数
string *parse_query_string(string query_string)
{
    string *args = ({}); // Changed from ({}) to ({}), as per the code block
    if (query_string && query_string != "")
    {
        if (strsrch(query_string, "&") != -1)
        {
            // 包含多个参数
            string *params = explode(query_string, "&");
            foreach (string param in params)
            {
                string key, value;
                if (sscanf(param, "%s=%s", key, value) == 2)
                {
                    args += ({ value });
                }
                else
                {
                    args += ({ "" });
                }
            }
        }
        else
        {
            // 只有一个参数
            string key, value;
            if (sscanf(query_string, "%s=%s", key, value) == 2)
            {
                args += ({ value });
            }
            else
            {
                args += ({ "" });
            }
        }
    }


    return args;
}

// 新增函数: 解析POST数据
string *parse_post_data(string body)
{
    string *args = ({}); // Changed from ({}) to ({}), as per the code block
    if (body && body != "")
    {
        
        if (strsrch(body, "&") != -1)
        {
            // 包含多个参数
            string *params = explode(body, "&");
            foreach (string param in params)
            {
                string key, value;
                if (sscanf(param, "%s=%s", key, value) == 2)
                {
                    args += ({ value });
                }
                else
                {
                    args += ({ "" });
                }
            }
        }
        else
        {
            // 只有一个参数
            string key, value;
            if (sscanf(body, "%s=%s", key, value) == 2)
            {
                args += ({ value });
            }
            else
            {
                args += ({ body });
            }
        }
    }
    return args;
}

void send_response(int fd, int status_code, string message)
{
    string response = sprintf("HTTP/1.1 %d %s\r\n"
                              "Content-Type: text/plain; charset=UTF-8\r\n"
                              "Content-Length: %d\r\n"
                              "Connection: close\r\n"
                              "\r\n"
                              "%s",
                              status_code,
                              status_code == 200 ? "OK" : message,
                              sizeof(string_encode(message, "utf-8")),
                              message);
    socket_write(fd, response);
}

void send_json_response(int fd, int status_code, mixed data)
{
    string json_data;
    string response;

    json_data = json_encode(data);
    
    response = sprintf("HTTP/1.1 %d OK\r\n"
                              "Content-Type: application/json; charset=UTF-8\r\n"
                              "Content-Length: %d\r\n"
                              "Connection: close\r\n"
                              "\r\n"
                              "%s",
                              status_code,
                              sizeof(string_encode(json_data, "utf-8")),
                              json_data);
    socket_write(fd, response);
}

void write_callback(int fd)
{
    socket_close(fd);
}

void close_callback(int fd)
{
    write("连接已关闭。\n");
}
