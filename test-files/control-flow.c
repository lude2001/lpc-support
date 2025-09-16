// Control flow structures for testing
void test_if_statements(){
int x=10;
if(x>5){
print("x is greater than 5");
}else if(x<5){
print("x is less than 5");
}else{
print("x equals 5");
}

if(x>0&&x<20){print("x is between 0 and 20");}

if(condition1||condition2){
if(nested_condition){
do_something();
}
}
}

void test_loops(){
int i,j,sum=0;

for(i=0;i<10;i++){
sum+=i;
if(i%2==0){continue;}
print("Odd number: "+i);
}

while(sum>0){
sum--;
if(sum<5){break;}
}

do{
print("This runs at least once");
}while(0);

for(i=0;i<5;i++){
for(j=0;j<5;j++){
if(i==j){
print("Diagonal: "+i+","+j);
}
}
}
}

void test_switch(){
int value=random(5);
switch(value){
case 0:
print("Zero");
break;
case 1:
case 2:
print("One or Two");
break;
case 3:
print("Three");
// fall through
case 4:
print("Three or Four");
break;
default:
print("Unknown value");
break;
}
}