#define RequestType(f_name,http_type) string f_name = http_type;

inherit "/adm/special_ob/http/base.c";

string url_decode(string str)
{
    str = replace_string(str, "%2F", "/");
    str = replace_string(str, "%20", " ");
    str = replace_string(str, "%3A", ":");
    str = replace_string(str, "%2E", ".");
    // 添加其他需要解码的字符
    return str;
}

RequestType(update_file,"POST")
mapping update_file(string file_name)
{   
    mapping result = ([]);
    string msg;


    if (!file_name)
    {
        result["code"] = "update_file";
        result["file_name"] = "空文件";
        result["msg"] = "没有指定文件！";
        return result;
    }

    // 对文件名进行URL解码
    file_name = url_decode(file_name);

    result["code"] = "update_file";
    result["file_name"] = file_name;
    msg = call_other("/cmds/wiz/update", "compile_file", file_name);
    result["msg"] = msg;

    return result;
}

/**
 * 返回限制的IP地址列表
 * @return mapping 包含限制IP地址的映射
 */
string *get_limit_ip_list()
{
    return ({
        "127.0.0.1",
    });
}

