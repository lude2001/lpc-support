inherit SKILL;
string type() { return "zhongji"; }

    mapping *action  =  ({
        ([      "action":"$N使一式「花随风移」，手中$w嗡嗡微振，幻成一无数花瓣刺向$n的$l", 
        "force" : 160, 
        "attack" : 50, 
        "dodge" : 80, 
        "parry" : 40, 
        "damage" : 100, 
        "skill_name" : "花随风移", 
        "damage_type":  "刺伤"
        ]), 
        ([      "action":"$N移步上前，使出「雨花纷飞」，剑气围绕，$w淡淡地向$n的$l挥去", 
        "force" : 160, 
        "attack" : 55, 
        "dodge" : 80, 
        "parry" : 40, 
        "damage" : 110, 
        "lvl" : 10, 
        "damage_type" : "刺伤"
        ]), 
        ([      "action":"$N一式「"HIM"花起剑落"NOR"」，纵身飘开数尺，运发剑气，手中$w遥遥飞向$n的$l", 
        "force" : 160, 
        "attack" : 100, 
        "dodge" : 80, 
        "parry" : 40, 
        "damage" : 120, 
        "lvl" : 120, 
        "damage_type" : "刺伤"
        ]), 
        ([      "action":"$N纵身轻轻跃起，一式「"HIC"紫花飞舞"NOR"」，剑光化为紫色，飘向$n的$l", 
        "force" : 160, 
        "attack" : 110, 
        "dodge" : 80, 
        "parry" : 40, 
        "damage" : 130, 
        "lvl" : 130, 
        "damage_type" : "刺伤"
        ]), 
        ([      "action":"$N手中$w中宫直进，一式「"HIB"花开花谢"NOR"」，无声无息地对准$n的$l刺出一剑", 
        "force" : 160, 
        "attack" : 120, 
        "dodge" : 80, 
        "parry" : 40, 
        "damage" : 140, 
        "lvl" : 140, 
        "damage_type" : "刺伤"
        ]), 
        ([      "action":"$N手中$w斜指苍天，剑芒吞吐，一式「"HIY"飞花落叶"NOR"」，对准$n的$l斜斜击出"NOR, 
        "force" : 160, 
        "attack" : 130, 
        "dodge" : 80, 
        "parry" : 40, 
        "damage" : 150, 
        "lvl" : 150, 
        "damage_type" : "刺伤"
        ]), 
        ([      "action":"$N左指凌空虚点，右手$w逼出丈许雪亮剑芒，一式「"HIG"春回大地"NOR"」刺向$n的$l"NOR, 
        "force" : 160, 
        "attack" : 140, 
        "dodge" : 80, 
        "parry" : 40, 
        "damage" : 160, 
        "lvl" : 160, 
        "damage_type" : "刺伤"
        ]), 
        ([      "action":HIM"狂风大起, 只见花瓣到处飞舞, 突然无数花瓣割向$n, $n顿时鲜血直喷"NOR, 
        "force" : 160, 
        "attack" : 150, 
        "dodge" : 80, 
        "parry" : 40, 
        "damage" : 170, 
        "lvl" : 160, 
        "damage_type" : "刺伤"
        ]), 
    });


int valid_enable(string usage) { return (usage == "sword") || (usage == "parry"); }

    int valid_learn(object me)
    {
        if (me- > query_skill("yifeng-jian") <  120 && me- > query("family/master_id")!="yao yue")
        return notify_fail("移风剑法是移花宫绝技，只有宫主邀月才能教你？\n");

        if ((int)me- > query_skill("mingyu-shengong", 1)  <  20)
        return notify_fail("你的冥雨神功火候太浅。\n");
        if ((int)me- > query("max_neili")  <  200)
        return notify_fail("你的内力不够。\n");
        if ((int)me- > query_skill("force", 1)  <  20)
        return notify_fail("你的基本内功火候太浅。\n");
        if ((int)me- > query_skill("sword", 1)  <  (int)me- > query_skill("yifeng-jian", 1))
        return notify_fail("你的基本剑法水平有限，无法领会更高深的移风剑法。\n");

        return 1;
    }
    mapping *query_action_all()
    {
        return action;
    }
    mapping query_action(object me, object weapon)
    {
        int i, level;
        level    =  (int) me- > query_skill("yifeng-jian", 1);
        for(i  =  sizeof(action); i  >  0; i--)
        if(level  >  action[i-1]["lvl"])
        return action[NewRandom(i, 20, level/5)];
    }

    mixed hit_ob(object me, object victim, int damage_bonus)
    {
        if ((damage_bonus * 15 / 100)  <  0)
        return 1;
        //  第六等级的伤气
        if( me- > query_skill("yifeng-jian", 1)  >  500 && me- > query_skill("martial-cognize"))
        {
            victim- > receive_damage("qi", (damage_bonus ) * 5 / 2  , me);
            return WHT "$N剑带箫音，移风剑法的精髓在无形中表露无遗，登时$n全身血液顿时沸腾！！！\n" NOR;
        }

        //  第五等级的伤气
        if( me- > query_skill("yifeng-jian", 1)  >  200 )
        {
            victim- > receive_damage("qi", damage_bonus  , me);
            return YEL "$N的移风剑法已经达到人剑合一的境界，随手数道剑气分刺$n数处大穴！！！\n" NOR;
        }
        //  第四等级的伤气
        if( me- > query_skill("yifeng-jian", 1) > 180 )
        {
            victim- > receive_damage("qi", (damage_bonus) / 2 * 3  , me);
            return MAG "$N灵台光闪，瞬间领悟到移风剑法髓，随手一剑妙到毫颠！！！\n" NOR;
        }


        //  第三等级的伤气
        if( me- > query_skill("yifeng-jian", 1) > 150 )
        {
            victim- > receive_damage("qi", (damage_bonus) / 2 * 3 , me);
            return CYN "$N的移风剑法已入返璞归真境界，随意一剑带出一阵剑气扑向$n！！！！！\n" NOR;
        }
        // 第二等级的伤气
        if ( me- > query_skill("yifeng-jian", 1) > 120 )
        {
            victim- > receive_damage("qi", (damage_bonus) / 2 * 3 , me);
            return RED "$N的移风剑法已初有小成, 每出一剑都带着强烈"HIR"剑气"HIW"扑向$n！！\n" NOR;
        }
    }

    int practice_skill(object me)
    {
        return notify_fail("移风剑法只能通过「"+HIC+"舞字决"+NOR+"」来演练。\n");
    }

    string perform_action_file(string action)
    {
        return __DIR__"yifeng-jian/" + action;
    }

    string query_description()
    {
        string msg;

        msg  =  HIY "【移风剑法】" ZJBR NOR;
        msg + =  WHT "移风剑法是移花宫的镇宫绝学，乃一门沾花带雨、柔中带刚的精妙剑术。" ZJBR;
        msg + =  WHT "此剑法重在身法与意境，讲究'花随风移'之意，剑招轻盈飘逸，如行云流水。" ZJBR ZJBR;

        msg + =  HIY "〖学习要求〗" ZJBR NOR;
        msg + =  "  武学修养：中级" ZJBR;
        msg + =  "  基本剑法：与移风剑法相当" ZJBR;
        msg + =  "  冥雨神功：20级" ZJBR;
        msg + =  "  基本内功：20级" ZJBR;
        msg + =  "  最大内力：200点" ZJBR;
        msg + =  "  特殊条件：120级以上需邀月宫主亲传" ZJBR ZJBR;

        msg + =  HIY "〖激发类型〗" ZJBR NOR;
        msg + =  "  剑法 (sword)" ZJBR;
        msg + =  "  可与招架 (parry) 互备" ZJBR ZJBR;

        msg + =  HIY "〖练习要求〗" ZJBR NOR;
        msg + =  "  移风剑法只能通过「舞字决」来演练" ZJBR ZJBR;

        msg + =  HIY "〖伤害特效〗" ZJBR NOR;
        msg + =  "  随着移风剑法等级提升，伤害效果逐步增强：" ZJBR;
        msg + =  "  120级以上：每剑带强烈剑气，额外造成1.5倍伤害" ZJBR;
        msg + =  "  150级以上：进入返璞归真境界，额外造成1.5倍伤害" ZJBR;
        msg + =  "  180级以上：领悟到移风剑法精髓，额外造成1.5倍伤害" ZJBR;
        msg + =  "  200级以上：达到人剑合一境界，额外造成1倍伤害" ZJBR;
        msg + =  "  500级以上且拥有武学修养：剑带箫音，额外造成2.5倍伤害" ZJBR ZJBR;

        msg + =  HIY "〖特殊招式〗" ZJBR NOR;

        msg + =  HIC "  舞字决 (wu)" ZJBR NOR;
        msg + =  "    使用要求：" ZJBR;
        msg + =  "      移风剑法等级：60级以上" ZJBR;
        msg + =  "      身上装备剑" ZJBR;
        msg + =  "      移花宫弟子" ZJBR;
        msg + =  "      不在战斗中" ZJBR;
        msg + =  "      当前内力：50点以上" ZJBR;
        msg + =  "    效果描述：" ZJBR;
        msg + =  "      用于练习移风剑法，可提高移风剑法等级" ZJBR;
        msg + =  "      练习效率随悟性提高而增加" ZJBR;
        msg + =  "    消耗：" ZJBR;
        msg + =  "      内力：50点" ZJBR;
        msg + =  "      精神：1点（悟性低于50时消耗更多）" ZJBR ZJBR;

        msg + =  HIC "  柔情媚影 (meiying)" ZJBR NOR;
        msg + =  "    使用要求：" ZJBR;
        msg + =  "      移风剑法等级：150级以上" ZJBR;
        msg + =  "      基本剑法等级：150级以上" ZJBR;
        msg + =  "      基本内功等级：100级以上" ZJBR;
        msg + =  "      基本轻功等级：100级以上" ZJBR;
        msg + =  "      最大内力：500点以上" ZJBR;
        msg + =  "      当前内力：200点以上" ZJBR;
        msg + =  "      身上装备剑" ZJBR;
        msg + =  "    效果描述：" ZJBR;
        msg + =  "      施展者姿态万千，身法飘逸如婀娜女子随歌漫舞" ZJBR;
        msg + =  "      判定公式：有效内功激发  >  目标内功/3" ZJBR;
        msg + =  "      成功则造成大量伤害并使目标忙乱1-3回合" ZJBR;
        msg + =  "      伤害计算：(移风剑法等级×5 + 有效内功激发×2)×(1+随机值)" ZJBR;
        msg + =  "      对非玩家目标伤害翻倍" ZJBR;
        msg + =  "    消耗与代价：" ZJBR;
        msg + =  "      内力：50点" ZJBR;
        msg + =  "      自身忙乱：2回合" ZJBR ZJBR;

        msg + =  HIC "  移风起兮云飞扬 (yifeng)" ZJBR NOR;
        msg + =  "    使用要求：" ZJBR;
        msg + =  "      女性角色" ZJBR;
        msg + =  "      移风剑法激发为剑法" ZJBR;
        msg + =  "      身法：25以上" ZJBR;
        msg + =  "      冥雨神功：100级以上" ZJBR;
        msg + =  "      基本轻功：100级以上" ZJBR;
        msg + =  "      基本剑法：120级以上" ZJBR;
        msg + =  "      当前内力：500点以上" ZJBR;
        msg + =  "      身上装备剑" ZJBR;
        msg + =  "    效果描述：" ZJBR;
        msg + =  "      剑化无数花瓣飞舞，连续发动多次攻击" ZJBR;
        msg + =  "      攻击次数取决于人物基础攻击次数" ZJBR;
        msg + =  "      若拥有奥义，增加命中率(剑法激发等级/10×奥义等级)" ZJBR;
        msg + =  "    消耗与代价：" ZJBR;
        msg + =  "      内力：50点" ZJBR;
        msg + =  "      冷却时间：3秒" ZJBR;

        return msg;
    }


