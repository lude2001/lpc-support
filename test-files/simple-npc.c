// Simple NPC class for testing formatting
inherit"/lib/character";

void create(){
::create();
set_name("test npc");
set_id(({"npc","test"}));
set_race("human");
set_class("warrior");
set_level(5);
set_max_hp(150);
set_hp(150);
set_skill("dodge",60);
set_skill("parry",50);
set_property("full attacks",1);
}

void init(){
add_action("kill","do_kill");
add_action("look","do_look");
}

int do_kill(string str){
object target;
if(!str){
tell_object(this_object(),"Kill who?");
return 1;
}
target=present(str,environment(this_object()));
if(!target){
tell_object(this_object(),"They are not here.");
return 1;
}
if(target==this_object()){
tell_object(this_object(),"You can't kill yourself!");
return 1;
}
return 0;
}

void heart_beat(){
if(!random(5)){
switch(random(3)){
case 0:
tell_room(environment(),"The NPC looks around cautiously.");
break;
case 1:
tell_room(environment(),"The NPC adjusts their equipment.");
break;
case 2:
tell_room(environment(),"The NPC practices some combat moves.");
break;
}
}
}