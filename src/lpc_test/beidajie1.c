// Room: /city/beidajie1.c

inherit ROOM;
void create()
{
	set("short", "古韵北街");
	set("long", @LONG
你走在一条青石板铺就的古街上，来往的行人衣着各异,操着天南地北的口音。
街上叫卖声此起彼伏，热闹非凡。南面是城中最大的广场，往来商贾不绝。东面一
座高大的客栈，门前悬挂着“醉仙客栈”的招牌,香飘四溢。西面是一家老字号钱庄，
门前的对联写着“生意通四海，财源遍五洲”。
LONG
	);
	set("outdoors", "city");
	set("objects", ([
	CLASS_D("ouyang") + "/ouyangke" : 1,
	]));
	set("exits", ([
		"east"  : __DIR__"kedian","south" : __DIR__"guangchang",
		"west"  : __DIR__"qianzhuang",
"north" : __DIR__"beidajie2",
	]));

	setup();
}
