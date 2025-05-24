// Preprocessor Directives Test
#include <std.h>
#include "local.h"
#define MAX_USERS 100
#define IS_ADMIN(p) (p->query_level() > 5)
#define DEBUG_MODE
#undef OLD_FEATURE
#if MAX_USERS > 50
  #pragma message "Max users is greater than 50"
#elif defined(DEBUG_MODE)
  #warning "Debug mode is active"
#else
  #error "Unsupported configuration"
#endif

// Efun Highlighting Test (examples from config)
mixed val = allocate(5);
int is_arr = arrayp(val);
object ob = clone_object("/obj/thing");
write("Hello, " + this_player()->query_name() + "
");
set_light(10);
call_out("my_function", 2, "arg");

// Special LPC Functions Test
void create() {
    // creation code
}

void init() {
    // initialization code
}

void reset(int arg) {
    // reset code
}

// main is not always special but sometimes used as entry
void main(string arg) {
    // main code
}

// Function Pointers and Closures Test
function f_ptr_simple = #'my_function;
function f_ptr_object = #'this_object()->query_name;
function f_ptr_implicit = #'->my_other_function;

mixed closure_val = (: $1 + $2 :);
mixed complex_closure = (:
    string local_var = "inside closure";
    // A comment inside closure
    if ($1) {
        return $1->do_something(123, "test");
    }
    return 0;
:);

// Operator Highlighting Test
int a = 10 + 5 * 2 / 3 % 2;
a++;
a--;
a = b = c; // Assignment
a += 5; b -= 1; c *= 2; d /= 1; e %= 1;
f &= 0xFF; g |= 0x01; h ^= 0xAA;
i <<= 2; j >>= 1;
status k = (a == b) && (c != d) || !(e < f) && (g > h) && (i <= j) && (k >= a);
int ternary_result = k ? a : b;
object room = environment(this_object());
string name = room->query_short(); // Arrow operator
// Scope resolution (if used, e.g. for static class members or specific libs)
// mixed static_val = SomeClass::static_member; (Illustrative, may not be common LPC)

// Type Highlighting Test
void my_typed_function(int i, string s, object o, array arr, mapping map, float f, buffer buf, mixed m, function func_param, class MyClass c_inst, struct MyStruct s_inst) {
    // function body
}

// Number Highlighting Test
int int_val = 12345;
int hex_val = 0xDeadBeef;
int oct_val = 0777; // Octal
int zero_val = 0;
float float_val1 = 1.0;
float float_val2 = .5;
float float_val3 = 100.;
float float_val4 = 1.5e-2;
float float_val5 = 2E+3;

// Test for interactions and edge cases
#define MACRO_WITH_OPERATOR (1+2)
int test_macro_op = MACRO_WITH_OPERATOR;
string path = "/u/j/jules/workroom.c"; // String
/* Block comment
   with multiple lines
   and operators + - * / inside
*/
mapping test_map = ([ "key" : "value", "another":123 ]);
array test_arr = ({ 1, "two", 0x03, #'create });

// End of test file
