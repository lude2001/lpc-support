// Complex mapping structures for testing
#include <lib.h>

mapping player_data=(["stats":(["strength":15,"dexterity":12,"constitution":14,"intelligence":13,"wisdom":11,"charisma":10,]),"skills":(["sword":75,"dodge":60,"parry":55,"magic":30,]),"equipment":(["weapon":"long sword","armor":"chain mail","shield":"small shield","ring":"protection ring",]),"inventory":(["gold":150,"potions":5,"food":3,]),]);

mapping quest_data=(["gather_herbs":(["name":"Gather Healing Herbs","description":"The village healer needs 10 healing herbs from the forest.","type":"collection","requirements":(["item":"healing_herb","quantity":10,]),"rewards":(["experience":100,"gold":50,"items":(["health_potion":2,]),]),"status":"available",]),"kill_wolves":(["name":"Eliminate Wolf Pack","description":"A pack of wolves is threatening the village livestock.","type":"elimination","requirements":(["target":"wolf","quantity":5,]),"rewards":(["experience":200,"gold":100,"reputation":10,]),"status":"available",]),"deliver_message":(["name":"Deliver Important Message","description":"Take this urgent message to the captain of the guard.","type":"delivery","requirements":(["destination":"guard_post","item":"sealed_letter",]),"rewards":(["experience":75,"gold":25,]),"status":"completed",]),]);

void test_complex_mapping(){
mapping nested_data=(["level1":(["level2":(["level3":(["value":42,"text":"deep nesting test",]),]),]),]);
mapping array_of_mappings=([
"entry1":(["data":(["a":1,"b":2,]),"meta":"test1",]),
"entry2":(["data":(["c":3,"d":4,]),"meta":"test2",]),
"entry3":(["data":(["e":5,"f":6,]),"meta":"test3",]),
]);
}