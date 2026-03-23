#define RequestType(f_name,http_type) string f_name = http_type;

inherit "/external_system_package/http/base.c";

string url_decode(string str)
{
    str = replace_string(str, "%2F", "/");
    str = replace_string(str, "%20", " ");
    str = replace_string(str, "%3A", ":");
    str = replace_string(str, "%2E", ".");
    // 添加其他需要解码的字符
    return str;
}

RequestType(pay_add,"POST")
public mapping pay_add(string userid,mixed rmb)
{   
    mapping result = ([]);
    string file;
    mapping msg;

    if (!rmb)
    {
        result["code"] = "403";
        result["msg"] = "缺少金额数";
        return result;
    }

    sscanf(rmb,"%d",rmb);


    // tell_object(find_player("demo222"),sprintf("userid=%s,rmb=%d\n",userid,rmb));

    file = sprintf("user_id=%s&order_id=%s-%s-%d&pay_type=%d&result_code=0&amount=%d&pay_time=%s",
											userid, userid, userid, time(), 8, rmb, 
										CHINESE_D->chinese_date(time(), 5) + "  "+CHINESE_D->chinese_date(time(), 6));


    msg =  PAY_D->do_get(file, "127.0.0.1");
    
    // result["msg"] = msg;
    // result["code"] = "pay_game";
    result = msg;

    return result;
}

/**
 * 返回限制的IP地址列表
 * @return mapping 包含限制IP地址的映射
 */
// string *get_limit_ip_list()
// {
//     return ({
//         "47.109.195.115",
//         "127.0.0.1",
//     });
// }


