/**
 * @file test.c
 * @author Lu dexiang
 * @brief 管理员测试命令 - 补发元宵节新增礼包
 */
inherit F_CLEAN_UP;

#include <ansi.h>

int main(object me, string arg)
{
    object *users, who;
    int success = 0, fail = 0;
    mapping failed = ([]);
    
    // 检查管理员权限
    if (!wizardp(me)) {
        return notify_fail("只有巫师才能执行此命令。\n");
    }

    int cas;
    
    // 获取在线玩家列表
    users = children(USER_OB);
    
    foreach (who in users) 
    {

        int total_recharge;

        if (!objectp(who) || !userp(who)) {
            continue;
        }
        

        // 检查累计充值金额
        total_recharge = who->query("yuanxiao_cz/2025");
        
        // 补发6元礼包
        if (total_recharge >= 6 && !who->query("yuanxiao_gift/mini_gift")) {
            "/adm/daemons/payd/yuanxiao"->give_gift_items(who, 0); // GIFT_MINI = 0
            who->set("yuanxiao_gift/mini_gift", 1);
            tell_object(me, sprintf("%s 补发了6元礼包\n", who->query("name")));
            tell_object(who, HIG "系统补发了你的元宵小额礼包。\n" NOR);
        }
        
        // 补发30元礼包
        if (total_recharge >= 30 && !who->query("yuanxiao_gift/basic_gift")) {
            "/adm/daemons/payd/yuanxiao"->give_gift_items(who, 1); // GIFT_BASIC = 1
            who->set("yuanxiao_gift/basic_gift", 1);
            tell_object(me, sprintf("%s 补发了30元礼包\n", who->query("name")));
            tell_object(who, HIG "系统补发了你的元宵基础礼包。\n" NOR);
        }
        
        // 保存玩家数据
        who->save();
        success++;
    }
    
    // 输出结果统计
    tell_object(me, sprintf("\n补发完成：\n处理玩家：%d 个\n", success));
    
    return 1;
}
