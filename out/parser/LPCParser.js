// Generated from LPC.g4 by ANTLR 4.13.1
// jshint ignore: start
import antlr4 from 'antlr4';
import LPCListener from './LPCListener.js';
import LPCVisitor from './LPCVisitor.js';

const serializedATN = [4,1,111,793,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,2,40,7,40,2,41,7,41,
2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,46,7,46,2,47,7,47,2,48,7,48,2,
49,7,49,2,50,7,50,2,51,7,51,2,52,7,52,2,53,7,53,2,54,7,54,2,55,7,55,2,56,
7,56,2,57,7,57,2,58,7,58,2,59,7,59,2,60,7,60,2,61,7,61,2,62,7,62,2,63,7,
63,2,64,7,64,2,65,7,65,2,66,7,66,2,67,7,67,2,68,7,68,2,69,7,69,2,70,7,70,
2,71,7,71,2,72,7,72,2,73,7,73,2,74,7,74,2,75,7,75,2,76,7,76,2,77,7,77,2,
78,7,78,2,79,7,79,2,80,7,80,2,81,7,81,1,0,1,0,1,0,1,0,5,0,169,8,0,10,0,12,
0,172,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1,184,8,1,1,2,1,2,1,
2,1,2,1,3,1,3,1,3,1,3,1,3,3,3,195,8,3,1,3,3,3,198,8,3,1,3,3,3,201,8,3,1,
4,1,4,1,4,5,4,206,8,4,10,4,12,4,209,9,4,1,5,5,5,212,8,5,10,5,12,5,215,9,
5,1,6,1,6,1,6,1,6,1,7,1,7,1,7,1,7,1,8,1,8,1,8,1,9,1,9,1,9,1,10,1,10,1,10,
1,10,1,11,1,11,1,11,1,11,1,12,5,12,240,8,12,10,12,12,12,243,9,12,1,12,1,
12,1,12,1,12,1,13,1,13,1,13,5,13,252,8,13,10,13,12,13,255,9,13,1,14,1,14,
3,14,259,8,14,1,14,1,14,1,14,3,14,264,8,14,3,14,266,8,14,1,15,1,15,1,15,
3,15,271,8,15,1,15,4,15,274,8,15,11,15,12,15,275,1,16,1,16,1,16,1,16,5,16,
282,8,16,10,16,12,16,285,9,16,1,16,3,16,288,8,16,3,16,290,8,16,1,16,1,16,
1,17,1,17,3,17,296,8,17,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,
1,18,3,18,309,8,18,1,19,1,19,1,20,1,20,1,21,1,21,1,22,1,22,1,23,1,23,1,23,
1,23,3,23,323,8,23,1,24,1,24,1,25,1,25,1,25,1,25,1,25,1,25,3,25,333,8,25,
1,26,1,26,1,26,5,26,338,8,26,10,26,12,26,341,9,26,1,27,1,27,1,27,5,27,346,
8,27,10,27,12,27,349,9,27,1,28,1,28,1,28,5,28,354,8,28,10,28,12,28,357,9,
28,1,29,1,29,1,29,5,29,362,8,29,10,29,12,29,365,9,29,1,30,1,30,1,30,5,30,
370,8,30,10,30,12,30,373,9,30,1,31,1,31,1,31,5,31,378,8,31,10,31,12,31,381,
9,31,1,32,1,32,1,32,5,32,386,8,32,10,32,12,32,389,9,32,1,33,1,33,1,33,5,
33,394,8,33,10,33,12,33,397,9,33,1,34,1,34,1,34,5,34,402,8,34,10,34,12,34,
405,9,34,1,35,1,35,1,35,5,35,410,8,35,10,35,12,35,413,9,35,1,36,1,36,1,36,
1,36,1,36,1,36,3,36,421,8,36,1,37,1,37,1,37,3,37,426,8,37,1,38,1,38,1,38,
1,38,1,38,1,38,1,38,5,38,435,8,38,10,38,12,38,438,9,38,1,39,1,39,1,39,1,
39,1,39,1,40,1,40,1,41,1,41,1,41,1,42,1,42,3,42,452,8,42,1,42,1,42,1,43,
1,43,1,43,5,43,459,8,43,10,43,12,43,462,9,43,1,44,1,44,1,44,1,44,1,45,1,
45,3,45,470,8,45,1,45,1,45,3,45,474,8,45,1,45,1,45,1,46,1,46,1,46,1,46,1,
46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,3,46,491,8,46,1,47,1,47,1,47,
1,48,1,48,1,48,1,48,1,49,1,49,1,50,1,50,1,50,1,50,1,50,5,50,507,8,50,10,
50,12,50,510,9,50,1,50,3,50,513,8,50,3,50,515,8,50,1,50,1,50,1,51,1,51,1,
51,1,51,5,51,523,8,51,10,51,12,51,526,9,51,1,51,3,51,529,8,51,3,51,531,8,
51,1,51,1,51,1,52,1,52,1,52,1,52,1,53,1,53,1,53,1,53,1,53,3,53,544,8,53,
1,53,1,53,1,54,1,54,1,54,5,54,551,8,54,10,54,12,54,554,9,54,1,55,4,55,557,
8,55,11,55,12,55,558,1,56,1,56,1,57,1,57,1,57,1,57,1,57,3,57,568,8,57,1,
58,1,58,1,58,1,58,1,59,1,59,1,59,1,59,1,59,1,59,3,59,580,8,59,1,59,1,59,
1,60,1,60,1,60,5,60,587,8,60,10,60,12,60,590,9,60,1,61,1,61,1,61,1,61,1,
62,5,62,597,8,62,10,62,12,62,600,9,62,1,62,1,62,1,62,1,62,3,62,606,8,62,
1,62,1,62,1,62,1,63,1,63,1,63,5,63,614,8,63,10,63,12,63,617,9,63,1,63,1,
63,3,63,621,8,63,1,64,1,64,1,64,3,64,626,8,64,1,65,1,65,1,65,5,65,631,8,
65,10,65,12,65,634,9,65,1,65,1,65,1,66,1,66,1,66,1,66,1,66,1,66,1,66,3,66,
645,8,66,1,67,3,67,648,8,67,1,67,1,67,1,68,1,68,3,68,654,8,68,1,69,1,69,
1,69,1,69,1,69,1,69,1,69,3,69,663,8,69,1,70,1,70,1,70,1,70,1,70,1,70,5,70,
671,8,70,10,70,12,70,674,9,70,1,70,3,70,677,8,70,1,70,1,70,1,71,1,71,1,71,
3,71,684,8,71,1,71,1,71,5,71,688,8,71,10,71,12,71,691,9,71,1,72,1,72,1,72,
5,72,696,8,72,10,72,12,72,699,9,72,1,73,1,73,1,73,1,73,3,73,705,8,73,1,74,
1,74,1,74,1,74,1,74,1,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,76,1,
76,1,76,1,76,1,76,3,76,726,8,76,1,76,1,76,1,76,1,77,1,77,1,77,3,77,734,8,
77,1,77,1,77,1,77,3,77,739,8,77,1,77,3,77,742,8,77,1,77,1,77,1,77,1,77,1,
77,1,78,1,78,1,78,1,78,1,78,1,78,3,78,755,8,78,1,78,3,78,758,8,78,1,79,1,
79,3,79,762,8,79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,
1,81,1,81,1,81,1,81,3,81,779,8,81,1,81,1,81,1,81,5,81,784,8,81,10,81,12,
81,787,9,81,1,81,1,81,3,81,791,8,81,1,81,0,0,82,0,2,4,6,8,10,12,14,16,18,
20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,
68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,
112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,
148,150,152,154,156,158,160,162,0,13,2,0,100,100,107,107,1,0,20,25,1,0,62,
72,1,0,78,79,1,0,80,83,1,0,84,85,1,0,86,87,1,0,88,90,2,0,87,87,91,94,1,0,
93,94,1,0,105,107,1,0,95,96,2,0,101,101,107,107,831,0,170,1,0,0,0,2,183,
1,0,0,0,4,185,1,0,0,0,6,189,1,0,0,0,8,202,1,0,0,0,10,213,1,0,0,0,12,216,
1,0,0,0,14,220,1,0,0,0,16,224,1,0,0,0,18,227,1,0,0,0,20,230,1,0,0,0,22,234,
1,0,0,0,24,241,1,0,0,0,26,248,1,0,0,0,28,256,1,0,0,0,30,273,1,0,0,0,32,277,
1,0,0,0,34,293,1,0,0,0,36,308,1,0,0,0,38,310,1,0,0,0,40,312,1,0,0,0,42,314,
1,0,0,0,44,316,1,0,0,0,46,318,1,0,0,0,48,324,1,0,0,0,50,326,1,0,0,0,52,334,
1,0,0,0,54,342,1,0,0,0,56,350,1,0,0,0,58,358,1,0,0,0,60,366,1,0,0,0,62,374,
1,0,0,0,64,382,1,0,0,0,66,390,1,0,0,0,68,398,1,0,0,0,70,406,1,0,0,0,72,420,
1,0,0,0,74,425,1,0,0,0,76,427,1,0,0,0,78,439,1,0,0,0,80,444,1,0,0,0,82,446,
1,0,0,0,84,449,1,0,0,0,86,455,1,0,0,0,88,463,1,0,0,0,90,467,1,0,0,0,92,490,
1,0,0,0,94,492,1,0,0,0,96,495,1,0,0,0,98,499,1,0,0,0,100,501,1,0,0,0,102,
518,1,0,0,0,104,534,1,0,0,0,106,538,1,0,0,0,108,547,1,0,0,0,110,556,1,0,
0,0,112,560,1,0,0,0,114,562,1,0,0,0,116,569,1,0,0,0,118,573,1,0,0,0,120,
583,1,0,0,0,122,591,1,0,0,0,124,598,1,0,0,0,126,610,1,0,0,0,128,622,1,0,
0,0,130,627,1,0,0,0,132,644,1,0,0,0,134,647,1,0,0,0,136,653,1,0,0,0,138,
655,1,0,0,0,140,664,1,0,0,0,142,680,1,0,0,0,144,692,1,0,0,0,146,704,1,0,
0,0,148,706,1,0,0,0,150,712,1,0,0,0,152,720,1,0,0,0,154,730,1,0,0,0,156,
757,1,0,0,0,158,759,1,0,0,0,160,766,1,0,0,0,162,774,1,0,0,0,164,169,3,2,
1,0,165,169,3,24,12,0,166,169,3,124,62,0,167,169,3,162,81,0,168,164,1,0,
0,0,168,165,1,0,0,0,168,166,1,0,0,0,168,167,1,0,0,0,169,172,1,0,0,0,170,
168,1,0,0,0,170,171,1,0,0,0,171,173,1,0,0,0,172,170,1,0,0,0,173,174,5,0,
0,1,174,1,1,0,0,0,175,184,3,4,2,0,176,184,3,6,3,0,177,184,3,12,6,0,178,184,
3,14,7,0,179,184,3,16,8,0,180,184,3,18,9,0,181,184,3,20,10,0,182,184,3,22,
11,0,183,175,1,0,0,0,183,176,1,0,0,0,183,177,1,0,0,0,183,178,1,0,0,0,183,
179,1,0,0,0,183,180,1,0,0,0,183,181,1,0,0,0,183,182,1,0,0,0,184,3,1,0,0,
0,185,186,5,1,0,0,186,187,5,2,0,0,187,188,7,0,0,0,188,5,1,0,0,0,189,190,
5,1,0,0,190,191,5,3,0,0,191,197,5,101,0,0,192,194,5,50,0,0,193,195,3,8,4,
0,194,193,1,0,0,0,194,195,1,0,0,0,195,196,1,0,0,0,196,198,5,51,0,0,197,192,
1,0,0,0,197,198,1,0,0,0,198,200,1,0,0,0,199,201,3,10,5,0,200,199,1,0,0,0,
200,201,1,0,0,0,201,7,1,0,0,0,202,207,5,101,0,0,203,204,5,57,0,0,204,206,
5,101,0,0,205,203,1,0,0,0,206,209,1,0,0,0,207,205,1,0,0,0,207,208,1,0,0,
0,208,9,1,0,0,0,209,207,1,0,0,0,210,212,5,110,0,0,211,210,1,0,0,0,212,215,
1,0,0,0,213,211,1,0,0,0,213,214,1,0,0,0,214,11,1,0,0,0,215,213,1,0,0,0,216,
217,5,1,0,0,217,218,5,4,0,0,218,219,5,101,0,0,219,13,1,0,0,0,220,221,5,1,
0,0,221,222,5,5,0,0,222,223,5,101,0,0,223,15,1,0,0,0,224,225,5,1,0,0,225,
226,5,6,0,0,226,17,1,0,0,0,227,228,5,1,0,0,228,229,5,7,0,0,229,19,1,0,0,
0,230,231,5,1,0,0,231,232,5,8,0,0,232,233,5,101,0,0,233,21,1,0,0,0,234,235,
5,1,0,0,235,236,5,9,0,0,236,237,3,10,5,0,237,23,1,0,0,0,238,240,3,42,21,
0,239,238,1,0,0,0,240,243,1,0,0,0,241,239,1,0,0,0,241,242,1,0,0,0,242,244,
1,0,0,0,243,241,1,0,0,0,244,245,3,34,17,0,245,246,3,26,13,0,246,247,5,56,
0,0,247,25,1,0,0,0,248,253,3,28,14,0,249,250,5,57,0,0,250,252,3,28,14,0,
251,249,1,0,0,0,252,255,1,0,0,0,253,251,1,0,0,0,253,254,1,0,0,0,254,27,1,
0,0,0,255,253,1,0,0,0,256,258,5,101,0,0,257,259,3,30,15,0,258,257,1,0,0,
0,258,259,1,0,0,0,259,265,1,0,0,0,260,263,5,62,0,0,261,264,3,44,22,0,262,
264,3,32,16,0,263,261,1,0,0,0,263,262,1,0,0,0,264,266,1,0,0,0,265,260,1,
0,0,0,265,266,1,0,0,0,266,29,1,0,0,0,267,270,5,54,0,0,268,271,3,44,22,0,
269,271,1,0,0,0,270,268,1,0,0,0,270,269,1,0,0,0,271,272,1,0,0,0,272,274,
5,55,0,0,273,267,1,0,0,0,274,275,1,0,0,0,275,273,1,0,0,0,275,276,1,0,0,0,
276,31,1,0,0,0,277,289,5,44,0,0,278,283,3,44,22,0,279,280,5,57,0,0,280,282,
3,44,22,0,281,279,1,0,0,0,282,285,1,0,0,0,283,281,1,0,0,0,283,284,1,0,0,
0,284,287,1,0,0,0,285,283,1,0,0,0,286,288,5,57,0,0,287,286,1,0,0,0,287,288,
1,0,0,0,288,290,1,0,0,0,289,278,1,0,0,0,289,290,1,0,0,0,290,291,1,0,0,0,
291,292,5,45,0,0,292,33,1,0,0,0,293,295,3,36,18,0,294,296,3,38,19,0,295,
294,1,0,0,0,295,296,1,0,0,0,296,35,1,0,0,0,297,309,5,10,0,0,298,309,5,11,
0,0,299,309,5,12,0,0,300,309,5,13,0,0,301,309,5,14,0,0,302,309,5,15,0,0,
303,309,5,16,0,0,304,309,5,17,0,0,305,309,5,18,0,0,306,309,5,19,0,0,307,
309,3,40,20,0,308,297,1,0,0,0,308,298,1,0,0,0,308,299,1,0,0,0,308,300,1,
0,0,0,308,301,1,0,0,0,308,302,1,0,0,0,308,303,1,0,0,0,308,304,1,0,0,0,308,
305,1,0,0,0,308,306,1,0,0,0,308,307,1,0,0,0,309,37,1,0,0,0,310,311,5,88,
0,0,311,39,1,0,0,0,312,313,5,101,0,0,313,41,1,0,0,0,314,315,7,1,0,0,315,
43,1,0,0,0,316,317,3,46,23,0,317,45,1,0,0,0,318,322,3,50,25,0,319,320,3,
48,24,0,320,321,3,46,23,0,321,323,1,0,0,0,322,319,1,0,0,0,322,323,1,0,0,
0,323,47,1,0,0,0,324,325,7,2,0,0,325,49,1,0,0,0,326,332,3,52,26,0,327,328,
5,59,0,0,328,329,3,44,22,0,329,330,5,58,0,0,330,331,3,50,25,0,331,333,1,
0,0,0,332,327,1,0,0,0,332,333,1,0,0,0,333,51,1,0,0,0,334,339,3,54,27,0,335,
336,5,73,0,0,336,338,3,54,27,0,337,335,1,0,0,0,338,341,1,0,0,0,339,337,1,
0,0,0,339,340,1,0,0,0,340,53,1,0,0,0,341,339,1,0,0,0,342,347,3,56,28,0,343,
344,5,74,0,0,344,346,3,56,28,0,345,343,1,0,0,0,346,349,1,0,0,0,347,345,1,
0,0,0,347,348,1,0,0,0,348,55,1,0,0,0,349,347,1,0,0,0,350,355,3,58,29,0,351,
352,5,75,0,0,352,354,3,58,29,0,353,351,1,0,0,0,354,357,1,0,0,0,355,353,1,
0,0,0,355,356,1,0,0,0,356,57,1,0,0,0,357,355,1,0,0,0,358,363,3,60,30,0,359,
360,5,76,0,0,360,362,3,60,30,0,361,359,1,0,0,0,362,365,1,0,0,0,363,361,1,
0,0,0,363,364,1,0,0,0,364,59,1,0,0,0,365,363,1,0,0,0,366,371,3,62,31,0,367,
368,5,77,0,0,368,370,3,62,31,0,369,367,1,0,0,0,370,373,1,0,0,0,371,369,1,
0,0,0,371,372,1,0,0,0,372,61,1,0,0,0,373,371,1,0,0,0,374,379,3,64,32,0,375,
376,7,3,0,0,376,378,3,64,32,0,377,375,1,0,0,0,378,381,1,0,0,0,379,377,1,
0,0,0,379,380,1,0,0,0,380,63,1,0,0,0,381,379,1,0,0,0,382,387,3,66,33,0,383,
384,7,4,0,0,384,386,3,66,33,0,385,383,1,0,0,0,386,389,1,0,0,0,387,385,1,
0,0,0,387,388,1,0,0,0,388,65,1,0,0,0,389,387,1,0,0,0,390,395,3,68,34,0,391,
392,7,5,0,0,392,394,3,68,34,0,393,391,1,0,0,0,394,397,1,0,0,0,395,393,1,
0,0,0,395,396,1,0,0,0,396,67,1,0,0,0,397,395,1,0,0,0,398,403,3,70,35,0,399,
400,7,6,0,0,400,402,3,70,35,0,401,399,1,0,0,0,402,405,1,0,0,0,403,401,1,
0,0,0,403,404,1,0,0,0,404,69,1,0,0,0,405,403,1,0,0,0,406,411,3,72,36,0,407,
408,7,7,0,0,408,410,3,72,36,0,409,407,1,0,0,0,410,413,1,0,0,0,411,409,1,
0,0,0,411,412,1,0,0,0,412,71,1,0,0,0,413,411,1,0,0,0,414,415,5,50,0,0,415,
416,3,34,17,0,416,417,5,51,0,0,417,418,3,72,36,0,418,421,1,0,0,0,419,421,
3,74,37,0,420,414,1,0,0,0,420,419,1,0,0,0,421,73,1,0,0,0,422,423,7,8,0,0,
423,426,3,74,37,0,424,426,3,76,38,0,425,422,1,0,0,0,425,424,1,0,0,0,426,
75,1,0,0,0,427,436,3,92,46,0,428,435,3,80,40,0,429,435,3,82,41,0,430,435,
3,84,42,0,431,435,3,88,44,0,432,435,3,90,45,0,433,435,3,78,39,0,434,428,
1,0,0,0,434,429,1,0,0,0,434,430,1,0,0,0,434,431,1,0,0,0,434,432,1,0,0,0,
434,433,1,0,0,0,435,438,1,0,0,0,436,434,1,0,0,0,436,437,1,0,0,0,437,77,1,
0,0,0,438,436,1,0,0,0,439,440,5,95,0,0,440,441,5,1,0,0,441,442,5,61,0,0,
442,443,5,101,0,0,443,79,1,0,0,0,444,445,7,9,0,0,445,81,1,0,0,0,446,447,
5,95,0,0,447,448,5,101,0,0,448,83,1,0,0,0,449,451,5,50,0,0,450,452,3,86,
43,0,451,450,1,0,0,0,451,452,1,0,0,0,452,453,1,0,0,0,453,454,5,51,0,0,454,
85,1,0,0,0,455,460,3,46,23,0,456,457,5,57,0,0,457,459,3,46,23,0,458,456,
1,0,0,0,459,462,1,0,0,0,460,458,1,0,0,0,460,461,1,0,0,0,461,87,1,0,0,0,462,
460,1,0,0,0,463,464,5,54,0,0,464,465,3,44,22,0,465,466,5,55,0,0,466,89,1,
0,0,0,467,469,5,54,0,0,468,470,3,44,22,0,469,468,1,0,0,0,469,470,1,0,0,0,
470,471,1,0,0,0,471,473,5,97,0,0,472,474,3,44,22,0,473,472,1,0,0,0,473,474,
1,0,0,0,474,475,1,0,0,0,475,476,5,55,0,0,476,91,1,0,0,0,477,491,5,101,0,
0,478,491,3,98,49,0,479,480,5,50,0,0,480,481,3,44,22,0,481,482,5,51,0,0,
482,491,1,0,0,0,483,491,3,100,50,0,484,491,3,102,51,0,485,491,3,106,53,0,
486,491,3,116,58,0,487,491,3,118,59,0,488,491,3,94,47,0,489,491,3,96,48,
0,490,477,1,0,0,0,490,478,1,0,0,0,490,479,1,0,0,0,490,483,1,0,0,0,490,484,
1,0,0,0,490,485,1,0,0,0,490,486,1,0,0,0,490,487,1,0,0,0,490,488,1,0,0,0,
490,489,1,0,0,0,491,93,1,0,0,0,492,493,5,98,0,0,493,494,5,105,0,0,494,95,
1,0,0,0,495,496,5,99,0,0,496,497,3,44,22,0,497,498,5,51,0,0,498,97,1,0,0,
0,499,500,7,10,0,0,500,99,1,0,0,0,501,514,5,44,0,0,502,515,3,86,43,0,503,
508,3,44,22,0,504,505,5,57,0,0,505,507,3,44,22,0,506,504,1,0,0,0,507,510,
1,0,0,0,508,506,1,0,0,0,508,509,1,0,0,0,509,512,1,0,0,0,510,508,1,0,0,0,
511,513,5,57,0,0,512,511,1,0,0,0,512,513,1,0,0,0,513,515,1,0,0,0,514,502,
1,0,0,0,514,503,1,0,0,0,514,515,1,0,0,0,515,516,1,0,0,0,516,517,5,45,0,0,
517,101,1,0,0,0,518,530,5,46,0,0,519,524,3,104,52,0,520,521,5,57,0,0,521,
523,3,104,52,0,522,520,1,0,0,0,523,526,1,0,0,0,524,522,1,0,0,0,524,525,1,
0,0,0,525,528,1,0,0,0,526,524,1,0,0,0,527,529,5,57,0,0,528,527,1,0,0,0,528,
529,1,0,0,0,529,531,1,0,0,0,530,519,1,0,0,0,530,531,1,0,0,0,531,532,1,0,
0,0,532,533,5,47,0,0,533,103,1,0,0,0,534,535,3,44,22,0,535,536,5,58,0,0,
536,537,3,44,22,0,537,105,1,0,0,0,538,543,5,48,0,0,539,544,3,108,54,0,540,
544,3,110,55,0,541,544,3,112,56,0,542,544,3,114,57,0,543,539,1,0,0,0,543,
540,1,0,0,0,543,541,1,0,0,0,543,542,1,0,0,0,544,545,1,0,0,0,545,546,5,49,
0,0,546,107,1,0,0,0,547,548,3,126,63,0,548,552,7,11,0,0,549,551,3,132,66,
0,550,549,1,0,0,0,551,554,1,0,0,0,552,550,1,0,0,0,552,553,1,0,0,0,553,109,
1,0,0,0,554,552,1,0,0,0,555,557,3,132,66,0,556,555,1,0,0,0,557,558,1,0,0,
0,558,556,1,0,0,0,558,559,1,0,0,0,559,111,1,0,0,0,560,561,3,44,22,0,561,
113,1,0,0,0,562,563,3,44,22,0,563,564,5,57,0,0,564,567,7,12,0,0,565,566,
5,57,0,0,566,568,3,100,50,0,567,565,1,0,0,0,567,568,1,0,0,0,568,115,1,0,
0,0,569,570,5,1,0,0,570,571,5,61,0,0,571,572,5,101,0,0,572,117,1,0,0,0,573,
574,5,26,0,0,574,575,5,50,0,0,575,576,5,27,0,0,576,579,3,40,20,0,577,578,
5,57,0,0,578,580,3,120,60,0,579,577,1,0,0,0,579,580,1,0,0,0,580,581,1,0,
0,0,581,582,5,51,0,0,582,119,1,0,0,0,583,588,3,122,61,0,584,585,5,57,0,0,
585,587,3,122,61,0,586,584,1,0,0,0,587,590,1,0,0,0,588,586,1,0,0,0,588,589,
1,0,0,0,589,121,1,0,0,0,590,588,1,0,0,0,591,592,5,101,0,0,592,593,5,58,0,
0,593,594,3,44,22,0,594,123,1,0,0,0,595,597,3,42,21,0,596,595,1,0,0,0,597,
600,1,0,0,0,598,596,1,0,0,0,598,599,1,0,0,0,599,601,1,0,0,0,600,598,1,0,
0,0,601,602,3,34,17,0,602,603,5,101,0,0,603,605,5,50,0,0,604,606,3,126,63,
0,605,604,1,0,0,0,605,606,1,0,0,0,606,607,1,0,0,0,607,608,5,51,0,0,608,609,
3,130,65,0,609,125,1,0,0,0,610,615,3,128,64,0,611,612,5,57,0,0,612,614,3,
128,64,0,613,611,1,0,0,0,614,617,1,0,0,0,615,613,1,0,0,0,615,616,1,0,0,0,
616,620,1,0,0,0,617,615,1,0,0,0,618,619,5,57,0,0,619,621,5,60,0,0,620,618,
1,0,0,0,620,621,1,0,0,0,621,127,1,0,0,0,622,623,3,34,17,0,623,625,5,101,
0,0,624,626,3,38,19,0,625,624,1,0,0,0,625,626,1,0,0,0,626,129,1,0,0,0,627,
632,5,52,0,0,628,631,3,24,12,0,629,631,3,132,66,0,630,628,1,0,0,0,630,629,
1,0,0,0,631,634,1,0,0,0,632,630,1,0,0,0,632,633,1,0,0,0,633,635,1,0,0,0,
634,632,1,0,0,0,635,636,5,53,0,0,636,131,1,0,0,0,637,645,3,134,67,0,638,
645,3,130,65,0,639,645,3,136,68,0,640,645,3,146,73,0,641,645,3,156,78,0,
642,645,3,158,79,0,643,645,3,160,80,0,644,637,1,0,0,0,644,638,1,0,0,0,644,
639,1,0,0,0,644,640,1,0,0,0,644,641,1,0,0,0,644,642,1,0,0,0,644,643,1,0,
0,0,645,133,1,0,0,0,646,648,3,44,22,0,647,646,1,0,0,0,647,648,1,0,0,0,648,
649,1,0,0,0,649,650,5,56,0,0,650,135,1,0,0,0,651,654,3,138,69,0,652,654,
3,140,70,0,653,651,1,0,0,0,653,652,1,0,0,0,654,137,1,0,0,0,655,656,5,28,
0,0,656,657,5,50,0,0,657,658,3,44,22,0,658,659,5,51,0,0,659,662,3,132,66,
0,660,661,5,6,0,0,661,663,3,132,66,0,662,660,1,0,0,0,662,663,1,0,0,0,663,
139,1,0,0,0,664,665,5,29,0,0,665,666,5,50,0,0,666,667,3,44,22,0,667,668,
5,51,0,0,668,672,5,52,0,0,669,671,3,142,71,0,670,669,1,0,0,0,671,674,1,0,
0,0,672,670,1,0,0,0,672,673,1,0,0,0,673,676,1,0,0,0,674,672,1,0,0,0,675,
677,3,144,72,0,676,675,1,0,0,0,676,677,1,0,0,0,677,678,1,0,0,0,678,679,5,
53,0,0,679,141,1,0,0,0,680,683,5,30,0,0,681,684,3,44,22,0,682,684,5,107,
0,0,683,681,1,0,0,0,683,682,1,0,0,0,684,685,1,0,0,0,685,689,5,58,0,0,686,
688,3,132,66,0,687,686,1,0,0,0,688,691,1,0,0,0,689,687,1,0,0,0,689,690,1,
0,0,0,690,143,1,0,0,0,691,689,1,0,0,0,692,693,5,31,0,0,693,697,5,58,0,0,
694,696,3,132,66,0,695,694,1,0,0,0,696,699,1,0,0,0,697,695,1,0,0,0,697,698,
1,0,0,0,698,145,1,0,0,0,699,697,1,0,0,0,700,705,3,148,74,0,701,705,3,152,
76,0,702,705,3,150,75,0,703,705,3,154,77,0,704,700,1,0,0,0,704,701,1,0,0,
0,704,702,1,0,0,0,704,703,1,0,0,0,705,147,1,0,0,0,706,707,5,32,0,0,707,708,
5,50,0,0,708,709,3,44,22,0,709,710,5,51,0,0,710,711,3,132,66,0,711,149,1,
0,0,0,712,713,5,33,0,0,713,714,3,132,66,0,714,715,5,32,0,0,715,716,5,50,
0,0,716,717,3,44,22,0,717,718,5,51,0,0,718,719,5,56,0,0,719,151,1,0,0,0,
720,721,5,34,0,0,721,722,5,50,0,0,722,723,3,134,67,0,723,725,3,134,67,0,
724,726,3,44,22,0,725,724,1,0,0,0,725,726,1,0,0,0,726,727,1,0,0,0,727,728,
5,51,0,0,728,729,3,132,66,0,729,153,1,0,0,0,730,731,5,35,0,0,731,733,5,50,
0,0,732,734,3,34,17,0,733,732,1,0,0,0,733,734,1,0,0,0,734,735,1,0,0,0,735,
741,5,101,0,0,736,738,5,57,0,0,737,739,3,34,17,0,738,737,1,0,0,0,738,739,
1,0,0,0,739,740,1,0,0,0,740,742,5,101,0,0,741,736,1,0,0,0,741,742,1,0,0,
0,742,743,1,0,0,0,743,744,5,36,0,0,744,745,3,44,22,0,745,746,5,51,0,0,746,
747,3,132,66,0,747,155,1,0,0,0,748,749,5,37,0,0,749,758,5,56,0,0,750,751,
5,38,0,0,751,758,5,56,0,0,752,754,5,39,0,0,753,755,3,44,22,0,754,753,1,0,
0,0,754,755,1,0,0,0,755,756,1,0,0,0,756,758,5,56,0,0,757,748,1,0,0,0,757,
750,1,0,0,0,757,752,1,0,0,0,758,157,1,0,0,0,759,761,5,40,0,0,760,762,3,42,
21,0,761,760,1,0,0,0,761,762,1,0,0,0,762,763,1,0,0,0,763,764,5,107,0,0,764,
765,5,56,0,0,765,159,1,0,0,0,766,767,5,41,0,0,767,768,3,130,65,0,768,769,
5,42,0,0,769,770,5,50,0,0,770,771,5,101,0,0,771,772,5,51,0,0,772,773,3,130,
65,0,773,161,1,0,0,0,774,775,5,27,0,0,775,778,5,101,0,0,776,777,5,43,0,0,
777,779,3,40,20,0,778,776,1,0,0,0,778,779,1,0,0,0,779,780,1,0,0,0,780,785,
5,52,0,0,781,784,3,24,12,0,782,784,3,124,62,0,783,781,1,0,0,0,783,782,1,
0,0,0,784,787,1,0,0,0,785,783,1,0,0,0,785,786,1,0,0,0,786,788,1,0,0,0,787,
785,1,0,0,0,788,790,5,53,0,0,789,791,5,56,0,0,790,789,1,0,0,0,790,791,1,
0,0,0,791,163,1,0,0,0,81,168,170,183,194,197,200,207,213,241,253,258,263,
265,270,275,283,287,289,295,308,322,332,339,347,355,363,371,379,387,395,
403,411,420,425,434,436,451,460,469,473,490,508,512,514,524,528,530,543,
552,558,567,579,588,598,605,615,620,625,630,632,644,647,653,662,672,676,
683,689,697,704,725,733,738,741,754,757,761,778,783,785,790];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class LPCParser extends antlr4.Parser {

    static grammarFileName = "LPC.g4";
    static literalNames = [ null, "'#'", "'include'", "'define'", "'ifdef'",
                            "'ifndef'", "'else'", "'endif'", "'undef'",
                            "'pragma'", "'void'", "'int'", "'string'", "'object'",
                            "'float'", "'mixed'", "'status'", "'buffer'",
                            "'mapping'", "'function'", "'static'", "'nomask'",
                            "'private'", "'public'", "'varargs'", "'nosave'",
                            "'new'", "'class'", "'if'", "'switch'", "'case'",
                            "'default'", "'while'", "'do'", "'for'", "'foreach'",
                            "'in'", "'break'", "'continue'", "'return'",
                            "'inherit'", "'try'", "'catch'", "'extends'",
                            "'({'", "'})'", "'(['", "'])'", "'(:'", "':)'",
                            "'('", "')'", "'{'", "'}'", "'['", "']'", "';'",
                            "','", "':'", "'?'", "'...'", "'''", "'='",
                            "'+='", "'-='", "'*='", "'/='", "'%='", "'&='",
                            "'|='", "'^='", "'<<='", "'>>='", "'||'", "'&&'",
                            "'|'", "'^'", "'&'", "'=='", "'!='", "'<'",
                            "'>'", "'<='", "'>='", "'<<'", "'>>'", "'+'",
                            "'-'", "'*'", "'/'", "'%'", "'!'", "'~'", "'++'",
                            "'--'", "'->'", "'=>'", "'..'", "'$'", "'$('" ];
    static symbolicNames = [ null, "HASH", "INCLUDE", "DEFINE", "IFDEF",
                             "IFNDEF", "ELSE", "ENDIF", "UNDEF", "PRAGMA",
                             "VOID", "INT", "STRING", "OBJECT", "FLOAT",
                             "MIXED", "STATUS", "BUFFER", "MAPPING", "FUNCTION",
                             "STATIC", "NOMASK", "PRIVATE", "PUBLIC", "VARARGS",
                             "NOSAVE", "NEW", "CLASS", "IF", "SWITCH", "CASE",
                             "DEFAULT", "WHILE", "DO", "FOR", "FOREACH",
                             "IN", "BREAK", "CONTINUE", "RETURN", "INHERIT",
                             "TRY", "CATCH", "EXTENDS", "LBRACE_LITERAL",
                             "RBRACE_LITERAL", "LBRACKET_LITERAL", "RBRACKET_LITERAL",
                             "LBRACE_LPAREN", "RBRACE_RPAREN", "LPAREN",
                             "RPAREN", "LBRACE", "RBRACE", "LBRACKET", "RBRACKET",
                             "SEMICOLON", "COMMA", "COLON", "QUESTION",
                             "ELLIPSIS", "SINGLE_QUOTE", "ASSIGN", "ADD_ASSIGN",
                             "SUB_ASSIGN", "MUL_ASSIGN", "DIV_ASSIGN", "MOD_ASSIGN",
                             "AND_ASSIGN", "OR_ASSIGN", "XOR_ASSIGN", "LSHIFT_ASSIGN",
                             "RSHIFT_ASSIGN", "OR_OP", "AND_OP", "BITOR_OP",
                             "CARET_OP", "BITAND_OP", "EQ_OP", "NE_OP",
                             "LT_OP", "GT_OP", "LE_OP", "GE_OP", "LSHIFT_OP",
                             "RSHIFT_OP", "ADD_OP", "SUB_OP", "MUL_OP",
                             "DIV_OP", "MOD_OP", "BANG_OP", "BITNOT_OP",
                             "INC_OP", "DEC_OP", "ARROW", "LAMBDA_ARROW",
                             "RANGE_OP", "DOLLAR", "DOLLAR_LPAREN", "ANGLE_BRACKET_STRING_LITERAL",
                             "IDENTIFIER", "DECIMAL_LITERAL", "HEX_LITERAL",
                             "OCTAL_LITERAL", "INTEGER_LITERAL", "FLOAT_LITERAL",
                             "STRING_LITERAL", "LINE_COMMENT", "BLOCK_COMMENT",
                             "PREPROCESSOR_TOKEN", "WS" ];
    static ruleNames = [ "program", "preprocessorDirective", "includeDirective",
                         "defineDirective", "identifierList", "preprocessorTokenSequence",
                         "ifdefDirective", "ifndefDirective", "elseDirective",
                         "endifDirective", "undefDirective", "pragmaDirective",
                         "declaration", "variableDeclaratorList", "variableDeclarator",
                         "arrayIndices", "initializerList", "typeSpecifier",
                         "baseTypeSpecifier", "arraySpecifier", "classIdentifier",
                         "typeModifier", "expression", "assignmentExpression",
                         "assignmentOperator", "conditionalExpression",
                         "logicalOrExpression", "logicalAndExpression",
                         "bitwiseOrExpression", "bitwiseXorExpression",
                         "bitwiseAndExpression", "equalityExpression", "relationalExpression",
                         "shiftExpression", "additiveExpression", "multiplicativeExpression",
                         "castExpression", "unaryExpression", "postfixExpression",
                         "remoteFunctionPointerSuffix", "postfixOperator",
                         "memberAccess", "functionCall", "argumentExpressionList",
                         "arrayAccess", "rangeAccess", "primaryExpression",
                         "closureArgPlaceholder", "closureCapture", "constant",
                         "arrayLiteral", "mappingLiteral", "mappingElement",
                         "closureExpression", "closureArgsAndBody", "closureBodyOnly",
                         "expressionClosure", "objectFunctionClosure", "simpleFunctionPointerLiteral",
                         "classConstructorCall", "namedArgumentList", "namedArgument",
                         "functionDefinition", "parameterList", "parameterDeclaration",
                         "compoundStatement", "statement", "expressionStatement",
                         "selectionStatement", "ifStatement", "switchStatement",
                         "switchCase", "defaultCase", "iterationStatement",
                         "whileStatement", "doWhileStatement", "forStatement",
                         "foreachStatement", "jumpStatement", "inheritStatement",
                         "tryCatchStatement", "classDefinition" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = LPCParser.ruleNames;
        this.literalNames = LPCParser.literalNames;
        this.symbolicNames = LPCParser.symbolicNames;
    }



	program() {
	    let localctx = new ProgramContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, LPCParser.RULE_program);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 170;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 201325570) !== 0) || _la===101) {
	            this.state = 168;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,0,this._ctx);
	            switch(la_) {
	            case 1:
	                this.state = 164;
	                this.preprocessorDirective();
	                break;

	            case 2:
	                this.state = 165;
	                this.declaration();
	                break;

	            case 3:
	                this.state = 166;
	                this.functionDefinition();
	                break;

	            case 4:
	                this.state = 167;
	                this.classDefinition();
	                break;

	            }
	            this.state = 172;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 173;
	        this.match(LPCParser.EOF);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	preprocessorDirective() {
	    let localctx = new PreprocessorDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, LPCParser.RULE_preprocessorDirective);
	    try {
	        this.state = 183;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,2,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 175;
	            this.includeDirective();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 176;
	            this.defineDirective();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 177;
	            this.ifdefDirective();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 178;
	            this.ifndefDirective();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 179;
	            this.elseDirective();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 180;
	            this.endifDirective();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 181;
	            this.undefDirective();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 182;
	            this.pragmaDirective();
	            break;

	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	includeDirective() {
	    let localctx = new IncludeDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, LPCParser.RULE_includeDirective);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 185;
	        this.match(LPCParser.HASH);
	        this.state = 186;
	        this.match(LPCParser.INCLUDE);
	        this.state = 187;
	        _la = this._input.LA(1);
	        if(!(_la===100 || _la===107)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
			this._errHandler.reportMatch(this);
	            this.consume();
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	defineDirective() {
	    let localctx = new DefineDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, LPCParser.RULE_defineDirective);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 189;
	        this.match(LPCParser.HASH);
	        this.state = 190;
	        this.match(LPCParser.DEFINE);
	        this.state = 191;
	        this.match(LPCParser.IDENTIFIER);
	        this.state = 197;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===50) {
	            this.state = 192;
	            this.match(LPCParser.LPAREN);
	            this.state = 194;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===101) {
	                this.state = 193;
	                this.identifierList();
	            }

	            this.state = 196;
	            this.match(LPCParser.RPAREN);
	        }

	        this.state = 200;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,5,this._ctx);
	        if(la_===1) {
	            this.state = 199;
	            this.preprocessorTokenSequence();

	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	identifierList() {
	    let localctx = new IdentifierListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, LPCParser.RULE_identifierList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 202;
	        this.match(LPCParser.IDENTIFIER);
	        this.state = 207;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===57) {
	            this.state = 203;
	            this.match(LPCParser.COMMA);
	            this.state = 204;
	            this.match(LPCParser.IDENTIFIER);
	            this.state = 209;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	preprocessorTokenSequence() {
	    let localctx = new PreprocessorTokenSequenceContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, LPCParser.RULE_preprocessorTokenSequence);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 213;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===110) {
	            this.state = 210;
	            this.match(LPCParser.PREPROCESSOR_TOKEN);
	            this.state = 215;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	ifdefDirective() {
	    let localctx = new IfdefDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, LPCParser.RULE_ifdefDirective);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 216;
	        this.match(LPCParser.HASH);
	        this.state = 217;
	        this.match(LPCParser.IFDEF);
	        this.state = 218;
	        this.match(LPCParser.IDENTIFIER);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	ifndefDirective() {
	    let localctx = new IfndefDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, LPCParser.RULE_ifndefDirective);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 220;
	        this.match(LPCParser.HASH);
	        this.state = 221;
	        this.match(LPCParser.IFNDEF);
	        this.state = 222;
	        this.match(LPCParser.IDENTIFIER);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	elseDirective() {
	    let localctx = new ElseDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, LPCParser.RULE_elseDirective);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 224;
	        this.match(LPCParser.HASH);
	        this.state = 225;
	        this.match(LPCParser.ELSE);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	endifDirective() {
	    let localctx = new EndifDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, LPCParser.RULE_endifDirective);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 227;
	        this.match(LPCParser.HASH);
	        this.state = 228;
	        this.match(LPCParser.ENDIF);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	undefDirective() {
	    let localctx = new UndefDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, LPCParser.RULE_undefDirective);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 230;
	        this.match(LPCParser.HASH);
	        this.state = 231;
	        this.match(LPCParser.UNDEF);
	        this.state = 232;
	        this.match(LPCParser.IDENTIFIER);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	pragmaDirective() {
	    let localctx = new PragmaDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, LPCParser.RULE_pragmaDirective);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 234;
	        this.match(LPCParser.HASH);
	        this.state = 235;
	        this.match(LPCParser.PRAGMA);
	        this.state = 236;
	        this.preprocessorTokenSequence();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	declaration() {
	    let localctx = new DeclarationContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, LPCParser.RULE_declaration);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 241;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 66060288) !== 0)) {
	            this.state = 238;
	            this.typeModifier();
	            this.state = 243;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 244;
	        this.typeSpecifier();
	        this.state = 245;
	        this.variableDeclaratorList();
	        this.state = 246;
	        this.match(LPCParser.SEMICOLON);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	variableDeclaratorList() {
	    let localctx = new VariableDeclaratorListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, LPCParser.RULE_variableDeclaratorList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 248;
	        this.variableDeclarator();
	        this.state = 253;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===57) {
	            this.state = 249;
	            this.match(LPCParser.COMMA);
	            this.state = 250;
	            this.variableDeclarator();
	            this.state = 255;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	variableDeclarator() {
	    let localctx = new VariableDeclaratorContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, LPCParser.RULE_variableDeclarator);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 256;
	        this.match(LPCParser.IDENTIFIER);
	        this.state = 258;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===54) {
	            this.state = 257;
	            this.arrayIndices();
	        }

	        this.state = 265;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===62) {
	            this.state = 260;
	            this.match(LPCParser.ASSIGN);
	            this.state = 263;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,11,this._ctx);
	            switch(la_) {
	            case 1:
	                this.state = 261;
	                this.expression();
	                break;

	            case 2:
	                this.state = 262;
	                this.initializerList();
	                break;

	            }
	        }

	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	arrayIndices() {
	    let localctx = new ArrayIndicesContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, LPCParser.RULE_arrayIndices);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 273;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 267;
	            this.match(LPCParser.LBRACKET);
	            this.state = 270;
	            this._errHandler.sync(this);
	            switch(this._input.LA(1)) {
	            case 1:
	            case 26:
	            case 44:
	            case 46:
	            case 48:
	            case 50:
	            case 87:
	            case 91:
	            case 92:
	            case 93:
	            case 94:
	            case 98:
	            case 99:
	            case 101:
	            case 105:
	            case 106:
	            case 107:
	                this.state = 268;
	                this.expression();
	                break;
	            case 55:
	                break;
	            default:
	                throw new antlr4.error.NoViableAltException(this);
	            }
	            this.state = 272;
	            this.match(LPCParser.RBRACKET);
	            this.state = 275;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===54);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	initializerList() {
	    let localctx = new InitializerListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, LPCParser.RULE_initializerList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 277;
	        this.match(LPCParser.LBRACE_LITERAL);
	        this.state = 289;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1 || _la===26 || ((((_la - 44)) & ~0x1f) === 0 && ((1 << (_la - 44)) & 85) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 278;
	            this.expression();
	            this.state = 283;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,15,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 279;
	                    this.match(LPCParser.COMMA);
	                    this.state = 280;
	                    this.expression();
	                }
	                this.state = 285;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,15,this._ctx);
	            }

	            this.state = 287;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===57) {
	                this.state = 286;
	                this.match(LPCParser.COMMA);
	            }

	        }

	        this.state = 291;
	        this.match(LPCParser.RBRACE_LITERAL);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	typeSpecifier() {
	    let localctx = new TypeSpecifierContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, LPCParser.RULE_typeSpecifier);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 293;
	        this.baseTypeSpecifier();
	        this.state = 295;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===88) {
	            this.state = 294;
	            this.arraySpecifier();
	        }

	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	baseTypeSpecifier() {
	    let localctx = new BaseTypeSpecifierContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, LPCParser.RULE_baseTypeSpecifier);
	    try {
	        this.state = 308;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 10:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 297;
	            this.match(LPCParser.VOID);
	            break;
	        case 11:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 298;
	            this.match(LPCParser.INT);
	            break;
	        case 12:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 299;
	            this.match(LPCParser.STRING);
	            break;
	        case 13:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 300;
	            this.match(LPCParser.OBJECT);
	            break;
	        case 14:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 301;
	            this.match(LPCParser.FLOAT);
	            break;
	        case 15:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 302;
	            this.match(LPCParser.MIXED);
	            break;
	        case 16:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 303;
	            this.match(LPCParser.STATUS);
	            break;
	        case 17:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 304;
	            this.match(LPCParser.BUFFER);
	            break;
	        case 18:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 305;
	            this.match(LPCParser.MAPPING);
	            break;
	        case 19:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 306;
	            this.match(LPCParser.FUNCTION);
	            break;
	        case 101:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 307;
	            this.classIdentifier();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	arraySpecifier() {
	    let localctx = new ArraySpecifierContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 38, LPCParser.RULE_arraySpecifier);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 310;
	        this.match(LPCParser.MUL_OP);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	classIdentifier() {
	    let localctx = new ClassIdentifierContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 40, LPCParser.RULE_classIdentifier);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 312;
	        this.match(LPCParser.IDENTIFIER);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	typeModifier() {
	    let localctx = new TypeModifierContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 42, LPCParser.RULE_typeModifier);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 314;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 66060288) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
			this._errHandler.reportMatch(this);
	            this.consume();
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	expression() {
	    let localctx = new ExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 44, LPCParser.RULE_expression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 316;
	        this.assignmentExpression();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	assignmentExpression() {
	    let localctx = new AssignmentExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 46, LPCParser.RULE_assignmentExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 318;
	        this.conditionalExpression();
	        this.state = 322;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(((((_la - 62)) & ~0x1f) === 0 && ((1 << (_la - 62)) & 2047) !== 0)) {
	            this.state = 319;
	            this.assignmentOperator();
	            this.state = 320;
	            this.assignmentExpression();
	        }

	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	assignmentOperator() {
	    let localctx = new AssignmentOperatorContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 48, LPCParser.RULE_assignmentOperator);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 324;
	        _la = this._input.LA(1);
	        if(!(((((_la - 62)) & ~0x1f) === 0 && ((1 << (_la - 62)) & 2047) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
			this._errHandler.reportMatch(this);
	            this.consume();
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	conditionalExpression() {
	    let localctx = new ConditionalExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 50, LPCParser.RULE_conditionalExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 326;
	        this.logicalOrExpression();
	        this.state = 332;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===59) {
	            this.state = 327;
	            this.match(LPCParser.QUESTION);
	            this.state = 328;
	            this.expression();
	            this.state = 329;
	            this.match(LPCParser.COLON);
	            this.state = 330;
	            this.conditionalExpression();
	        }

	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	logicalOrExpression() {
	    let localctx = new LogicalOrExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 52, LPCParser.RULE_logicalOrExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 334;
	        this.logicalAndExpression();
	        this.state = 339;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===73) {
	            this.state = 335;
	            this.match(LPCParser.OR_OP);
	            this.state = 336;
	            this.logicalAndExpression();
	            this.state = 341;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	logicalAndExpression() {
	    let localctx = new LogicalAndExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 54, LPCParser.RULE_logicalAndExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 342;
	        this.bitwiseOrExpression();
	        this.state = 347;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===74) {
	            this.state = 343;
	            this.match(LPCParser.AND_OP);
	            this.state = 344;
	            this.bitwiseOrExpression();
	            this.state = 349;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	bitwiseOrExpression() {
	    let localctx = new BitwiseOrExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 56, LPCParser.RULE_bitwiseOrExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 350;
	        this.bitwiseXorExpression();
	        this.state = 355;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===75) {
	            this.state = 351;
	            this.match(LPCParser.BITOR_OP);
	            this.state = 352;
	            this.bitwiseXorExpression();
	            this.state = 357;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	bitwiseXorExpression() {
	    let localctx = new BitwiseXorExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 58, LPCParser.RULE_bitwiseXorExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 358;
	        this.bitwiseAndExpression();
	        this.state = 363;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===76) {
	            this.state = 359;
	            this.match(LPCParser.CARET_OP);
	            this.state = 360;
	            this.bitwiseAndExpression();
	            this.state = 365;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	bitwiseAndExpression() {
	    let localctx = new BitwiseAndExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 60, LPCParser.RULE_bitwiseAndExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 366;
	        this.equalityExpression();
	        this.state = 371;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===77) {
	            this.state = 367;
	            this.match(LPCParser.BITAND_OP);
	            this.state = 368;
	            this.equalityExpression();
	            this.state = 373;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	equalityExpression() {
	    let localctx = new EqualityExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 62, LPCParser.RULE_equalityExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 374;
	        this.relationalExpression();
	        this.state = 379;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===78 || _la===79) {
	            this.state = 375;
	            _la = this._input.LA(1);
	            if(!(_la===78 || _la===79)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
			this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 376;
	            this.relationalExpression();
	            this.state = 381;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	relationalExpression() {
	    let localctx = new RelationalExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 64, LPCParser.RULE_relationalExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 382;
	        this.shiftExpression();
	        this.state = 387;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 80)) & ~0x1f) === 0 && ((1 << (_la - 80)) & 15) !== 0)) {
	            this.state = 383;
	            _la = this._input.LA(1);
	            if(!(((((_la - 80)) & ~0x1f) === 0 && ((1 << (_la - 80)) & 15) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
			this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 384;
	            this.shiftExpression();
	            this.state = 389;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	shiftExpression() {
	    let localctx = new ShiftExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 66, LPCParser.RULE_shiftExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 390;
	        this.additiveExpression();
	        this.state = 395;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===84 || _la===85) {
	            this.state = 391;
	            _la = this._input.LA(1);
	            if(!(_la===84 || _la===85)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
			this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 392;
	            this.additiveExpression();
	            this.state = 397;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	additiveExpression() {
	    let localctx = new AdditiveExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 68, LPCParser.RULE_additiveExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 398;
	        this.multiplicativeExpression();
	        this.state = 403;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===86 || _la===87) {
	            this.state = 399;
	            _la = this._input.LA(1);
	            if(!(_la===86 || _la===87)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
			this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 400;
	            this.multiplicativeExpression();
	            this.state = 405;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	multiplicativeExpression() {
	    let localctx = new MultiplicativeExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 70, LPCParser.RULE_multiplicativeExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 406;
	        this.castExpression();
	        this.state = 411;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 88)) & ~0x1f) === 0 && ((1 << (_la - 88)) & 7) !== 0)) {
	            this.state = 407;
	            _la = this._input.LA(1);
	            if(!(((((_la - 88)) & ~0x1f) === 0 && ((1 << (_la - 88)) & 7) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
			this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 408;
	            this.castExpression();
	            this.state = 413;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	castExpression() {
	    let localctx = new CastExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 72, LPCParser.RULE_castExpression);
	    try {
	        this.state = 420;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,32,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 414;
	            this.match(LPCParser.LPAREN);
	            this.state = 415;
	            this.typeSpecifier();
	            this.state = 416;
	            this.match(LPCParser.RPAREN);
	            this.state = 417;
	            this.castExpression();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 419;
	            this.unaryExpression();
	            break;

	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	unaryExpression() {
	    let localctx = new UnaryExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 74, LPCParser.RULE_unaryExpression);
	    var _la = 0;
	    try {
	        this.state = 425;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 87:
	        case 91:
	        case 92:
	        case 93:
	        case 94:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 422;
	            _la = this._input.LA(1);
	            if(!(((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 241) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
			this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 423;
	            this.unaryExpression();
	            break;
	        case 1:
	        case 26:
	        case 44:
	        case 46:
	        case 48:
	        case 50:
	        case 98:
	        case 99:
	        case 101:
	        case 105:
	        case 106:
	        case 107:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 424;
	            this.postfixExpression();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	postfixExpression() {
	    let localctx = new PostfixExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 76, LPCParser.RULE_postfixExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 427;
	        this.primaryExpression();
	        this.state = 436;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===50 || _la===54 || ((((_la - 93)) & ~0x1f) === 0 && ((1 << (_la - 93)) & 7) !== 0)) {
	            this.state = 434;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,34,this._ctx);
	            switch(la_) {
	            case 1:
	                this.state = 428;
	                this.postfixOperator();
	                break;

	            case 2:
	                this.state = 429;
	                this.memberAccess();
	                break;

	            case 3:
	                this.state = 430;
	                this.functionCall();
	                break;

	            case 4:
	                this.state = 431;
	                this.arrayAccess();
	                break;

	            case 5:
	                this.state = 432;
	                this.rangeAccess();
	                break;

	            case 6:
	                this.state = 433;
	                this.remoteFunctionPointerSuffix();
	                break;

	            }
	            this.state = 438;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	remoteFunctionPointerSuffix() {
	    let localctx = new RemoteFunctionPointerSuffixContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 78, LPCParser.RULE_remoteFunctionPointerSuffix);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 439;
	        this.match(LPCParser.ARROW);
	        this.state = 440;
	        this.match(LPCParser.HASH);
	        this.state = 441;
	        this.match(LPCParser.SINGLE_QUOTE);
	        this.state = 442;
	        this.match(LPCParser.IDENTIFIER);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	postfixOperator() {
	    let localctx = new PostfixOperatorContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 80, LPCParser.RULE_postfixOperator);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 444;
	        _la = this._input.LA(1);
	        if(!(_la===93 || _la===94)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
			this._errHandler.reportMatch(this);
	            this.consume();
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	memberAccess() {
	    let localctx = new MemberAccessContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 82, LPCParser.RULE_memberAccess);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 446;
	        this.match(LPCParser.ARROW);
	        this.state = 447;
	        this.match(LPCParser.IDENTIFIER);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	functionCall() {
	    let localctx = new FunctionCallContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 84, LPCParser.RULE_functionCall);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 449;
	        this.match(LPCParser.LPAREN);
	        this.state = 451;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1 || _la===26 || ((((_la - 44)) & ~0x1f) === 0 && ((1 << (_la - 44)) & 85) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 450;
	            this.argumentExpressionList();
	        }

	        this.state = 453;
	        this.match(LPCParser.RPAREN);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	argumentExpressionList() {
	    let localctx = new ArgumentExpressionListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 86, LPCParser.RULE_argumentExpressionList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 455;
	        this.assignmentExpression();
	        this.state = 460;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===57) {
	            this.state = 456;
	            this.match(LPCParser.COMMA);
	            this.state = 457;
	            this.assignmentExpression();
	            this.state = 462;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	arrayAccess() {
	    let localctx = new ArrayAccessContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 88, LPCParser.RULE_arrayAccess);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 463;
	        this.match(LPCParser.LBRACKET);
	        this.state = 464;
	        this.expression();
	        this.state = 465;
	        this.match(LPCParser.RBRACKET);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	rangeAccess() {
	    let localctx = new RangeAccessContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 90, LPCParser.RULE_rangeAccess);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 467;
	        this.match(LPCParser.LBRACKET);
	        this.state = 469;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1 || _la===26 || ((((_la - 44)) & ~0x1f) === 0 && ((1 << (_la - 44)) & 85) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 468;
	            this.expression();
	        }

	        this.state = 471;
	        this.match(LPCParser.RANGE_OP);
	        this.state = 473;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1 || _la===26 || ((((_la - 44)) & ~0x1f) === 0 && ((1 << (_la - 44)) & 85) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 472;
	            this.expression();
	        }

	        this.state = 475;
	        this.match(LPCParser.RBRACKET);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	primaryExpression() {
	    let localctx = new PrimaryExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 92, LPCParser.RULE_primaryExpression);
	    try {
	        this.state = 490;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 101:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 477;
	            this.match(LPCParser.IDENTIFIER);
	            break;
	        case 105:
	        case 106:
	        case 107:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 478;
	            this.constant();
	            break;
	        case 50:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 479;
	            this.match(LPCParser.LPAREN);
	            this.state = 480;
	            this.expression();
	            this.state = 481;
	            this.match(LPCParser.RPAREN);
	            break;
	        case 44:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 483;
	            this.arrayLiteral();
	            break;
	        case 46:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 484;
	            this.mappingLiteral();
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 485;
	            this.closureExpression();
	            break;
	        case 1:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 486;
	            this.simpleFunctionPointerLiteral();
	            break;
	        case 26:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 487;
	            this.classConstructorCall();
	            break;
	        case 98:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 488;
	            this.closureArgPlaceholder();
	            break;
	        case 99:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 489;
	            this.closureCapture();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	closureArgPlaceholder() {
	    let localctx = new ClosureArgPlaceholderContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 94, LPCParser.RULE_closureArgPlaceholder);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 492;
	        this.match(LPCParser.DOLLAR);
	        this.state = 493;
	        this.match(LPCParser.INTEGER_LITERAL);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	closureCapture() {
	    let localctx = new ClosureCaptureContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 96, LPCParser.RULE_closureCapture);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 495;
	        this.match(LPCParser.DOLLAR_LPAREN);
	        this.state = 496;
	        this.expression();
	        this.state = 497;
	        this.match(LPCParser.RPAREN);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	constant() {
	    let localctx = new ConstantContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 98, LPCParser.RULE_constant);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 499;
	        _la = this._input.LA(1);
	        if(!(((((_la - 105)) & ~0x1f) === 0 && ((1 << (_la - 105)) & 7) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
			this._errHandler.reportMatch(this);
	            this.consume();
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	arrayLiteral() {
	    let localctx = new ArrayLiteralContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 100, LPCParser.RULE_arrayLiteral);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 501;
	        this.match(LPCParser.LBRACE_LITERAL);
	        this.state = 514;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,43,this._ctx);
	        if(la_===1) {
	            this.state = 502;
	            this.argumentExpressionList();

	        } else if(la_===2) {
	            this.state = 503;
	            this.expression();
	            this.state = 508;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,41,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 504;
	                    this.match(LPCParser.COMMA);
	                    this.state = 505;
	                    this.expression();
	                }
	                this.state = 510;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,41,this._ctx);
	            }

	            this.state = 512;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===57) {
	                this.state = 511;
	                this.match(LPCParser.COMMA);
	            }


	        }
	        this.state = 516;
	        this.match(LPCParser.RBRACE_LITERAL);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	mappingLiteral() {
	    let localctx = new MappingLiteralContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 102, LPCParser.RULE_mappingLiteral);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 518;
	        this.match(LPCParser.LBRACKET_LITERAL);
	        this.state = 530;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1 || _la===26 || ((((_la - 44)) & ~0x1f) === 0 && ((1 << (_la - 44)) & 85) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 519;
	            this.mappingElement();
	            this.state = 524;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,44,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 520;
	                    this.match(LPCParser.COMMA);
	                    this.state = 521;
	                    this.mappingElement();
	                }
	                this.state = 526;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,44,this._ctx);
	            }

	            this.state = 528;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===57) {
	                this.state = 527;
	                this.match(LPCParser.COMMA);
	            }

	        }

	        this.state = 532;
	        this.match(LPCParser.RBRACKET_LITERAL);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	mappingElement() {
	    let localctx = new MappingElementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 104, LPCParser.RULE_mappingElement);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 534;
	        this.expression();
	        this.state = 535;
	        this.match(LPCParser.COLON);
	        this.state = 536;
	        this.expression();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	closureExpression() {
	    let localctx = new ClosureExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 106, LPCParser.RULE_closureExpression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 538;
	        this.match(LPCParser.LBRACE_LPAREN);
	        this.state = 543;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,47,this._ctx);
	        switch(la_) {
	        case 1:
	            this.state = 539;
	            this.closureArgsAndBody();
	            break;

	        case 2:
	            this.state = 540;
	            this.closureBodyOnly();
	            break;

	        case 3:
	            this.state = 541;
	            this.expressionClosure();
	            break;

	        case 4:
	            this.state = 542;
	            this.objectFunctionClosure();
	            break;

	        }
	        this.state = 545;
	        this.match(LPCParser.RBRACE_RPAREN);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	closureArgsAndBody() {
	    let localctx = new ClosureArgsAndBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 108, LPCParser.RULE_closureArgsAndBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 547;
	        this.parameterList();
	        this.state = 548;
	        _la = this._input.LA(1);
	        if(!(_la===95 || _la===96)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
			this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 552;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 872415234) !== 0) || ((((_la - 32)) & ~0x1f) === 0 && ((1 << (_la - 32)) & 18174959) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 549;
	            this.statement();
	            this.state = 554;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	closureBodyOnly() {
	    let localctx = new ClosureBodyOnlyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 110, LPCParser.RULE_closureBodyOnly);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 556;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 555;
	            this.statement();
	            this.state = 558;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while((((_la) & ~0x1f) === 0 && ((1 << _la) & 872415234) !== 0) || ((((_la - 32)) & ~0x1f) === 0 && ((1 << (_la - 32)) & 18174959) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0));
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	expressionClosure() {
	    let localctx = new ExpressionClosureContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 112, LPCParser.RULE_expressionClosure);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 560;
	        this.expression();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	objectFunctionClosure() {
	    let localctx = new ObjectFunctionClosureContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 114, LPCParser.RULE_objectFunctionClosure);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 562;
	        this.expression();
	        this.state = 563;
	        this.match(LPCParser.COMMA);
	        this.state = 564;
	        _la = this._input.LA(1);
	        if(!(_la===101 || _la===107)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
			this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 567;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===57) {
	            this.state = 565;
	            this.match(LPCParser.COMMA);
	            this.state = 566;
	            this.arrayLiteral();
	        }

	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	simpleFunctionPointerLiteral() {
	    let localctx = new SimpleFunctionPointerLiteralContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 116, LPCParser.RULE_simpleFunctionPointerLiteral);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 569;
	        this.match(LPCParser.HASH);
	        this.state = 570;
	        this.match(LPCParser.SINGLE_QUOTE);
	        this.state = 571;
	        this.match(LPCParser.IDENTIFIER);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	classConstructorCall() {
	    let localctx = new ClassConstructorCallContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 118, LPCParser.RULE_classConstructorCall);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 573;
	        this.match(LPCParser.NEW);
	        this.state = 574;
	        this.match(LPCParser.LPAREN);
	        this.state = 575;
	        this.match(LPCParser.CLASS);
	        this.state = 576;
	        this.classIdentifier();
	        this.state = 579;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===57) {
	            this.state = 577;
	            this.match(LPCParser.COMMA);
	            this.state = 578;
	            this.namedArgumentList();
	        }

	        this.state = 581;
	        this.match(LPCParser.RPAREN);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	namedArgumentList() {
	    let localctx = new NamedArgumentListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 120, LPCParser.RULE_namedArgumentList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 583;
	        this.namedArgument();
	        this.state = 588;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===57) {
	            this.state = 584;
	            this.match(LPCParser.COMMA);
	            this.state = 585;
	            this.namedArgument();
	            this.state = 590;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	namedArgument() {
	    let localctx = new NamedArgumentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 122, LPCParser.RULE_namedArgument);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 591;
	        this.match(LPCParser.IDENTIFIER);
	        this.state = 592;
	        this.match(LPCParser.COLON);
	        this.state = 593;
	        this.expression();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	functionDefinition() {
	    let localctx = new FunctionDefinitionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 124, LPCParser.RULE_functionDefinition);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 598;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 66060288) !== 0)) {
	            this.state = 595;
	            this.typeModifier();
	            this.state = 600;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 601;
	        this.typeSpecifier();
	        this.state = 602;
	        this.match(LPCParser.IDENTIFIER);
	        this.state = 603;
	        this.match(LPCParser.LPAREN);
	        this.state = 605;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1047552) !== 0) || _la===101) {
	            this.state = 604;
	            this.parameterList();
	        }

	        this.state = 607;
	        this.match(LPCParser.RPAREN);
	        this.state = 608;
	        this.compoundStatement();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	parameterList() {
	    let localctx = new ParameterListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 126, LPCParser.RULE_parameterList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 610;
	        this.parameterDeclaration();
	        this.state = 615;
	        this._errHandler.sync(this);
	        var _alt = this._interp.adaptivePredict(this._input,55,this._ctx)
	        while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	            if(_alt===1) {
	                this.state = 611;
	                this.match(LPCParser.COMMA);
	                this.state = 612;
	                this.parameterDeclaration();
	            }
	            this.state = 617;
	            this._errHandler.sync(this);
	            _alt = this._interp.adaptivePredict(this._input,55,this._ctx);
	        }

	        this.state = 620;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===57) {
	            this.state = 618;
	            this.match(LPCParser.COMMA);
	            this.state = 619;
	            this.match(LPCParser.ELLIPSIS);
	        }

	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	parameterDeclaration() {
	    let localctx = new ParameterDeclarationContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 128, LPCParser.RULE_parameterDeclaration);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 622;
	        this.typeSpecifier();
	        this.state = 623;
	        this.match(LPCParser.IDENTIFIER);
	        this.state = 625;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===88) {
	            this.state = 624;
	            this.arraySpecifier();
	        }

	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	compoundStatement() {
	    let localctx = new CompoundStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 130, LPCParser.RULE_compoundStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 627;
	        this.match(LPCParser.LBRACE);
	        this.state = 632;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 939523074) !== 0) || ((((_la - 32)) & ~0x1f) === 0 && ((1 << (_la - 32)) & 18174959) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 630;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,58,this._ctx);
	            switch(la_) {
	            case 1:
	                this.state = 628;
	                this.declaration();
	                break;

	            case 2:
	                this.state = 629;
	                this.statement();
	                break;

	            }
	            this.state = 634;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 635;
	        this.match(LPCParser.RBRACE);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	statement() {
	    let localctx = new StatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 132, LPCParser.RULE_statement);
	    try {
	        this.state = 644;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	        case 26:
	        case 44:
	        case 46:
	        case 48:
	        case 50:
	        case 56:
	        case 87:
	        case 91:
	        case 92:
	        case 93:
	        case 94:
	        case 98:
	        case 99:
	        case 101:
	        case 105:
	        case 106:
	        case 107:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 637;
	            this.expressionStatement();
	            break;
	        case 52:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 638;
	            this.compoundStatement();
	            break;
	        case 28:
	        case 29:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 639;
	            this.selectionStatement();
	            break;
	        case 32:
	        case 33:
	        case 34:
	        case 35:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 640;
	            this.iterationStatement();
	            break;
	        case 37:
	        case 38:
	        case 39:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 641;
	            this.jumpStatement();
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 642;
	            this.inheritStatement();
	            break;
	        case 41:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 643;
	            this.tryCatchStatement();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	expressionStatement() {
	    let localctx = new ExpressionStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 134, LPCParser.RULE_expressionStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 647;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1 || _la===26 || ((((_la - 44)) & ~0x1f) === 0 && ((1 << (_la - 44)) & 85) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 646;
	            this.expression();
	        }

	        this.state = 649;
	        this.match(LPCParser.SEMICOLON);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	selectionStatement() {
	    let localctx = new SelectionStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 136, LPCParser.RULE_selectionStatement);
	    try {
	        this.state = 653;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 28:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 651;
	            this.ifStatement();
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 652;
	            this.switchStatement();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	ifStatement() {
	    let localctx = new IfStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 138, LPCParser.RULE_ifStatement);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 655;
	        this.match(LPCParser.IF);
	        this.state = 656;
	        this.match(LPCParser.LPAREN);
	        this.state = 657;
	        this.expression();
	        this.state = 658;
	        this.match(LPCParser.RPAREN);
	        this.state = 659;
	        this.statement();
	        this.state = 662;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,63,this._ctx);
	        if(la_===1) {
	            this.state = 660;
	            this.match(LPCParser.ELSE);
	            this.state = 661;
	            this.statement();

	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	switchStatement() {
	    let localctx = new SwitchStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 140, LPCParser.RULE_switchStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 664;
	        this.match(LPCParser.SWITCH);
	        this.state = 665;
	        this.match(LPCParser.LPAREN);
	        this.state = 666;
	        this.expression();
	        this.state = 667;
	        this.match(LPCParser.RPAREN);
	        this.state = 668;
	        this.match(LPCParser.LBRACE);
	        this.state = 672;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===30) {
	            this.state = 669;
	            this.switchCase();
	            this.state = 674;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 676;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===31) {
	            this.state = 675;
	            this.defaultCase();
	        }

	        this.state = 678;
	        this.match(LPCParser.RBRACE);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	switchCase() {
	    let localctx = new SwitchCaseContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 142, LPCParser.RULE_switchCase);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 680;
	        this.match(LPCParser.CASE);
	        this.state = 683;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,66,this._ctx);
	        switch(la_) {
	        case 1:
	            this.state = 681;
	            this.expression();
	            break;

	        case 2:
	            this.state = 682;
	            this.match(LPCParser.STRING_LITERAL);
	            break;

	        }
	        this.state = 685;
	        this.match(LPCParser.COLON);
	        this.state = 689;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 872415234) !== 0) || ((((_la - 32)) & ~0x1f) === 0 && ((1 << (_la - 32)) & 18174959) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 686;
	            this.statement();
	            this.state = 691;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	defaultCase() {
	    let localctx = new DefaultCaseContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 144, LPCParser.RULE_defaultCase);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 692;
	        this.match(LPCParser.DEFAULT);
	        this.state = 693;
	        this.match(LPCParser.COLON);
	        this.state = 697;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 872415234) !== 0) || ((((_la - 32)) & ~0x1f) === 0 && ((1 << (_la - 32)) & 18174959) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 694;
	            this.statement();
	            this.state = 699;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	iterationStatement() {
	    let localctx = new IterationStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 146, LPCParser.RULE_iterationStatement);
	    try {
	        this.state = 704;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 32:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 700;
	            this.whileStatement();
	            break;
	        case 34:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 701;
	            this.forStatement();
	            break;
	        case 33:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 702;
	            this.doWhileStatement();
	            break;
	        case 35:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 703;
	            this.foreachStatement();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	whileStatement() {
	    let localctx = new WhileStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 148, LPCParser.RULE_whileStatement);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 706;
	        this.match(LPCParser.WHILE);
	        this.state = 707;
	        this.match(LPCParser.LPAREN);
	        this.state = 708;
	        this.expression();
	        this.state = 709;
	        this.match(LPCParser.RPAREN);
	        this.state = 710;
	        this.statement();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	doWhileStatement() {
	    let localctx = new DoWhileStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 150, LPCParser.RULE_doWhileStatement);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 712;
	        this.match(LPCParser.DO);
	        this.state = 713;
	        this.statement();
	        this.state = 714;
	        this.match(LPCParser.WHILE);
	        this.state = 715;
	        this.match(LPCParser.LPAREN);
	        this.state = 716;
	        this.expression();
	        this.state = 717;
	        this.match(LPCParser.RPAREN);
	        this.state = 718;
	        this.match(LPCParser.SEMICOLON);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	forStatement() {
	    let localctx = new ForStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 152, LPCParser.RULE_forStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 720;
	        this.match(LPCParser.FOR);
	        this.state = 721;
	        this.match(LPCParser.LPAREN);
	        this.state = 722;
	        this.expressionStatement();
	        this.state = 723;
	        this.expressionStatement();
	        this.state = 725;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1 || _la===26 || ((((_la - 44)) & ~0x1f) === 0 && ((1 << (_la - 44)) & 85) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	            this.state = 724;
	            this.expression();
	        }

	        this.state = 727;
	        this.match(LPCParser.RPAREN);
	        this.state = 728;
	        this.statement();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	foreachStatement() {
	    let localctx = new ForeachStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 154, LPCParser.RULE_foreachStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 730;
	        this.match(LPCParser.FOREACH);
	        this.state = 731;
	        this.match(LPCParser.LPAREN);
	        this.state = 733;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,71,this._ctx);
	        if(la_===1) {
	            this.state = 732;
	            this.typeSpecifier();

	        }
	        this.state = 735;
	        this.match(LPCParser.IDENTIFIER);
	        this.state = 741;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===57) {
	            this.state = 736;
	            this.match(LPCParser.COMMA);
	            this.state = 738;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,72,this._ctx);
	            if(la_===1) {
	                this.state = 737;
	                this.typeSpecifier();

	            }
	            this.state = 740;
	            this.match(LPCParser.IDENTIFIER);
	        }

	        this.state = 743;
	        this.match(LPCParser.IN);
	        this.state = 744;
	        this.expression();
	        this.state = 745;
	        this.match(LPCParser.RPAREN);
	        this.state = 746;
	        this.statement();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	jumpStatement() {
	    let localctx = new JumpStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 156, LPCParser.RULE_jumpStatement);
	    var _la = 0;
	    try {
	        this.state = 757;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 37:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 748;
	            this.match(LPCParser.BREAK);
	            this.state = 749;
	            this.match(LPCParser.SEMICOLON);
	            break;
	        case 38:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 750;
	            this.match(LPCParser.CONTINUE);
	            this.state = 751;
	            this.match(LPCParser.SEMICOLON);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 752;
	            this.match(LPCParser.RETURN);
	            this.state = 754;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===1 || _la===26 || ((((_la - 44)) & ~0x1f) === 0 && ((1 << (_la - 44)) & 85) !== 0) || ((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 1857777) !== 0)) {
	                this.state = 753;
	                this.expression();
	            }

	            this.state = 756;
	            this.match(LPCParser.SEMICOLON);
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	inheritStatement() {
	    let localctx = new InheritStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 158, LPCParser.RULE_inheritStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 759;
	        this.match(LPCParser.INHERIT);
	        this.state = 761;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 66060288) !== 0)) {
	            this.state = 760;
	            this.typeModifier();
	        }

	        this.state = 763;
	        this.match(LPCParser.STRING_LITERAL);
	        this.state = 764;
	        this.match(LPCParser.SEMICOLON);
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	tryCatchStatement() {
	    let localctx = new TryCatchStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 160, LPCParser.RULE_tryCatchStatement);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 766;
	        this.match(LPCParser.TRY);
	        this.state = 767;
	        this.compoundStatement();
	        this.state = 768;
	        this.match(LPCParser.CATCH);
	        this.state = 769;
	        this.match(LPCParser.LPAREN);
	        this.state = 770;
	        this.match(LPCParser.IDENTIFIER);
	        this.state = 771;
	        this.match(LPCParser.RPAREN);
	        this.state = 772;
	        this.compoundStatement();
	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	classDefinition() {
	    let localctx = new ClassDefinitionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 162, LPCParser.RULE_classDefinition);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 774;
	        this.match(LPCParser.CLASS);
	        this.state = 775;
	        this.match(LPCParser.IDENTIFIER);
	        this.state = 778;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===43) {
	            this.state = 776;
	            this.match(LPCParser.EXTENDS);
	            this.state = 777;
	            this.classIdentifier();
	        }

	        this.state = 780;
	        this.match(LPCParser.LBRACE);
	        this.state = 785;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 67107840) !== 0) || _la===101) {
	            this.state = 783;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,78,this._ctx);
	            switch(la_) {
	            case 1:
	                this.state = 781;
	                this.declaration();
	                break;

	            case 2:
	                this.state = 782;
	                this.functionDefinition();
	                break;

	            }
	            this.state = 787;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 788;
	        this.match(LPCParser.RBRACE);
	        this.state = 790;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===56) {
	            this.state = 789;
	            this.match(LPCParser.SEMICOLON);
	        }

	    } catch (re) {
		if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
			throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}


}

LPCParser.EOF = antlr4.Token.EOF;
LPCParser.HASH = 1;
LPCParser.INCLUDE = 2;
LPCParser.DEFINE = 3;
LPCParser.IFDEF = 4;
LPCParser.IFNDEF = 5;
LPCParser.ELSE = 6;
LPCParser.ENDIF = 7;
LPCParser.UNDEF = 8;
LPCParser.PRAGMA = 9;
LPCParser.VOID = 10;
LPCParser.INT = 11;
LPCParser.STRING = 12;
LPCParser.OBJECT = 13;
LPCParser.FLOAT = 14;
LPCParser.MIXED = 15;
LPCParser.STATUS = 16;
LPCParser.BUFFER = 17;
LPCParser.MAPPING = 18;
LPCParser.FUNCTION = 19;
LPCParser.STATIC = 20;
LPCParser.NOMASK = 21;
LPCParser.PRIVATE = 22;
LPCParser.PUBLIC = 23;
LPCParser.VARARGS = 24;
LPCParser.NOSAVE = 25;
LPCParser.NEW = 26;
LPCParser.CLASS = 27;
LPCParser.IF = 28;
LPCParser.SWITCH = 29;
LPCParser.CASE = 30;
LPCParser.DEFAULT = 31;
LPCParser.WHILE = 32;
LPCParser.DO = 33;
LPCParser.FOR = 34;
LPCParser.FOREACH = 35;
LPCParser.IN = 36;
LPCParser.BREAK = 37;
LPCParser.CONTINUE = 38;
LPCParser.RETURN = 39;
LPCParser.INHERIT = 40;
LPCParser.TRY = 41;
LPCParser.CATCH = 42;
LPCParser.EXTENDS = 43;
LPCParser.LBRACE_LITERAL = 44;
LPCParser.RBRACE_LITERAL = 45;
LPCParser.LBRACKET_LITERAL = 46;
LPCParser.RBRACKET_LITERAL = 47;
LPCParser.LBRACE_LPAREN = 48;
LPCParser.RBRACE_RPAREN = 49;
LPCParser.LPAREN = 50;
LPCParser.RPAREN = 51;
LPCParser.LBRACE = 52;
LPCParser.RBRACE = 53;
LPCParser.LBRACKET = 54;
LPCParser.RBRACKET = 55;
LPCParser.SEMICOLON = 56;
LPCParser.COMMA = 57;
LPCParser.COLON = 58;
LPCParser.QUESTION = 59;
LPCParser.ELLIPSIS = 60;
LPCParser.SINGLE_QUOTE = 61;
LPCParser.ASSIGN = 62;
LPCParser.ADD_ASSIGN = 63;
LPCParser.SUB_ASSIGN = 64;
LPCParser.MUL_ASSIGN = 65;
LPCParser.DIV_ASSIGN = 66;
LPCParser.MOD_ASSIGN = 67;
LPCParser.AND_ASSIGN = 68;
LPCParser.OR_ASSIGN = 69;
LPCParser.XOR_ASSIGN = 70;
LPCParser.LSHIFT_ASSIGN = 71;
LPCParser.RSHIFT_ASSIGN = 72;
LPCParser.OR_OP = 73;
LPCParser.AND_OP = 74;
LPCParser.BITOR_OP = 75;
LPCParser.CARET_OP = 76;
LPCParser.BITAND_OP = 77;
LPCParser.EQ_OP = 78;
LPCParser.NE_OP = 79;
LPCParser.LT_OP = 80;
LPCParser.GT_OP = 81;
LPCParser.LE_OP = 82;
LPCParser.GE_OP = 83;
LPCParser.LSHIFT_OP = 84;
LPCParser.RSHIFT_OP = 85;
LPCParser.ADD_OP = 86;
LPCParser.SUB_OP = 87;
LPCParser.MUL_OP = 88;
LPCParser.DIV_OP = 89;
LPCParser.MOD_OP = 90;
LPCParser.BANG_OP = 91;
LPCParser.BITNOT_OP = 92;
LPCParser.INC_OP = 93;
LPCParser.DEC_OP = 94;
LPCParser.ARROW = 95;
LPCParser.LAMBDA_ARROW = 96;
LPCParser.RANGE_OP = 97;
LPCParser.DOLLAR = 98;
LPCParser.DOLLAR_LPAREN = 99;
LPCParser.ANGLE_BRACKET_STRING_LITERAL = 100;
LPCParser.IDENTIFIER = 101;
LPCParser.DECIMAL_LITERAL = 102;
LPCParser.HEX_LITERAL = 103;
LPCParser.OCTAL_LITERAL = 104;
LPCParser.INTEGER_LITERAL = 105;
LPCParser.FLOAT_LITERAL = 106;
LPCParser.STRING_LITERAL = 107;
LPCParser.LINE_COMMENT = 108;
LPCParser.BLOCK_COMMENT = 109;
LPCParser.PREPROCESSOR_TOKEN = 110;
LPCParser.WS = 111;

LPCParser.RULE_program = 0;
LPCParser.RULE_preprocessorDirective = 1;
LPCParser.RULE_includeDirective = 2;
LPCParser.RULE_defineDirective = 3;
LPCParser.RULE_identifierList = 4;
LPCParser.RULE_preprocessorTokenSequence = 5;
LPCParser.RULE_ifdefDirective = 6;
LPCParser.RULE_ifndefDirective = 7;
LPCParser.RULE_elseDirective = 8;
LPCParser.RULE_endifDirective = 9;
LPCParser.RULE_undefDirective = 10;
LPCParser.RULE_pragmaDirective = 11;
LPCParser.RULE_declaration = 12;
LPCParser.RULE_variableDeclaratorList = 13;
LPCParser.RULE_variableDeclarator = 14;
LPCParser.RULE_arrayIndices = 15;
LPCParser.RULE_initializerList = 16;
LPCParser.RULE_typeSpecifier = 17;
LPCParser.RULE_baseTypeSpecifier = 18;
LPCParser.RULE_arraySpecifier = 19;
LPCParser.RULE_classIdentifier = 20;
LPCParser.RULE_typeModifier = 21;
LPCParser.RULE_expression = 22;
LPCParser.RULE_assignmentExpression = 23;
LPCParser.RULE_assignmentOperator = 24;
LPCParser.RULE_conditionalExpression = 25;
LPCParser.RULE_logicalOrExpression = 26;
LPCParser.RULE_logicalAndExpression = 27;
LPCParser.RULE_bitwiseOrExpression = 28;
LPCParser.RULE_bitwiseXorExpression = 29;
LPCParser.RULE_bitwiseAndExpression = 30;
LPCParser.RULE_equalityExpression = 31;
LPCParser.RULE_relationalExpression = 32;
LPCParser.RULE_shiftExpression = 33;
LPCParser.RULE_additiveExpression = 34;
LPCParser.RULE_multiplicativeExpression = 35;
LPCParser.RULE_castExpression = 36;
LPCParser.RULE_unaryExpression = 37;
LPCParser.RULE_postfixExpression = 38;
LPCParser.RULE_remoteFunctionPointerSuffix = 39;
LPCParser.RULE_postfixOperator = 40;
LPCParser.RULE_memberAccess = 41;
LPCParser.RULE_functionCall = 42;
LPCParser.RULE_argumentExpressionList = 43;
LPCParser.RULE_arrayAccess = 44;
LPCParser.RULE_rangeAccess = 45;
LPCParser.RULE_primaryExpression = 46;
LPCParser.RULE_closureArgPlaceholder = 47;
LPCParser.RULE_closureCapture = 48;
LPCParser.RULE_constant = 49;
LPCParser.RULE_arrayLiteral = 50;
LPCParser.RULE_mappingLiteral = 51;
LPCParser.RULE_mappingElement = 52;
LPCParser.RULE_closureExpression = 53;
LPCParser.RULE_closureArgsAndBody = 54;
LPCParser.RULE_closureBodyOnly = 55;
LPCParser.RULE_expressionClosure = 56;
LPCParser.RULE_objectFunctionClosure = 57;
LPCParser.RULE_simpleFunctionPointerLiteral = 58;
LPCParser.RULE_classConstructorCall = 59;
LPCParser.RULE_namedArgumentList = 60;
LPCParser.RULE_namedArgument = 61;
LPCParser.RULE_functionDefinition = 62;
LPCParser.RULE_parameterList = 63;
LPCParser.RULE_parameterDeclaration = 64;
LPCParser.RULE_compoundStatement = 65;
LPCParser.RULE_statement = 66;
LPCParser.RULE_expressionStatement = 67;
LPCParser.RULE_selectionStatement = 68;
LPCParser.RULE_ifStatement = 69;
LPCParser.RULE_switchStatement = 70;
LPCParser.RULE_switchCase = 71;
LPCParser.RULE_defaultCase = 72;
LPCParser.RULE_iterationStatement = 73;
LPCParser.RULE_whileStatement = 74;
LPCParser.RULE_doWhileStatement = 75;
LPCParser.RULE_forStatement = 76;
LPCParser.RULE_foreachStatement = 77;
LPCParser.RULE_jumpStatement = 78;
LPCParser.RULE_inheritStatement = 79;
LPCParser.RULE_tryCatchStatement = 80;
LPCParser.RULE_classDefinition = 81;

class ProgramContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_program;
    }

	EOF() {
	    return this.getToken(LPCParser.EOF, 0);
	};

	preprocessorDirective = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(PreprocessorDirectiveContext);
	    } else {
	        return this.getTypedRuleContext(PreprocessorDirectiveContext,i);
	    }
	};

	declaration = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(DeclarationContext);
	    } else {
	        return this.getTypedRuleContext(DeclarationContext,i);
	    }
	};

	functionDefinition = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(FunctionDefinitionContext);
	    } else {
	        return this.getTypedRuleContext(FunctionDefinitionContext,i);
	    }
	};

	classDefinition = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ClassDefinitionContext);
	    } else {
	        return this.getTypedRuleContext(ClassDefinitionContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterProgram(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitProgram(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitProgram(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PreprocessorDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_preprocessorDirective;
    }

	includeDirective() {
	    return this.getTypedRuleContext(IncludeDirectiveContext,0);
	};

	defineDirective() {
	    return this.getTypedRuleContext(DefineDirectiveContext,0);
	};

	ifdefDirective() {
	    return this.getTypedRuleContext(IfdefDirectiveContext,0);
	};

	ifndefDirective() {
	    return this.getTypedRuleContext(IfndefDirectiveContext,0);
	};

	elseDirective() {
	    return this.getTypedRuleContext(ElseDirectiveContext,0);
	};

	endifDirective() {
	    return this.getTypedRuleContext(EndifDirectiveContext,0);
	};

	undefDirective() {
	    return this.getTypedRuleContext(UndefDirectiveContext,0);
	};

	pragmaDirective() {
	    return this.getTypedRuleContext(PragmaDirectiveContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterPreprocessorDirective(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitPreprocessorDirective(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitPreprocessorDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IncludeDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_includeDirective;
    }

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	INCLUDE() {
	    return this.getToken(LPCParser.INCLUDE, 0);
	};

	STRING_LITERAL() {
	    return this.getToken(LPCParser.STRING_LITERAL, 0);
	};

	ANGLE_BRACKET_STRING_LITERAL() {
	    return this.getToken(LPCParser.ANGLE_BRACKET_STRING_LITERAL, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterIncludeDirective(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitIncludeDirective(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitIncludeDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DefineDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_defineDirective;
    }

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	DEFINE() {
	    return this.getToken(LPCParser.DEFINE, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	preprocessorTokenSequence() {
	    return this.getTypedRuleContext(PreprocessorTokenSequenceContext,0);
	};

	identifierList() {
	    return this.getTypedRuleContext(IdentifierListContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterDefineDirective(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitDefineDirective(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitDefineDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IdentifierListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_identifierList;
    }

	IDENTIFIER = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.IDENTIFIER);
	    } else {
	        return this.getToken(LPCParser.IDENTIFIER, i);
	    }
	};


	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.COMMA);
	    } else {
	        return this.getToken(LPCParser.COMMA, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterIdentifierList(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitIdentifierList(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitIdentifierList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PreprocessorTokenSequenceContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_preprocessorTokenSequence;
    }

	PREPROCESSOR_TOKEN = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.PREPROCESSOR_TOKEN);
	    } else {
	        return this.getToken(LPCParser.PREPROCESSOR_TOKEN, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterPreprocessorTokenSequence(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitPreprocessorTokenSequence(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitPreprocessorTokenSequence(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IfdefDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_ifdefDirective;
    }

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	IFDEF() {
	    return this.getToken(LPCParser.IFDEF, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterIfdefDirective(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitIfdefDirective(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitIfdefDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IfndefDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_ifndefDirective;
    }

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	IFNDEF() {
	    return this.getToken(LPCParser.IFNDEF, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterIfndefDirective(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitIfndefDirective(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitIfndefDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ElseDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_elseDirective;
    }

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	ELSE() {
	    return this.getToken(LPCParser.ELSE, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterElseDirective(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitElseDirective(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitElseDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class EndifDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_endifDirective;
    }

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	ENDIF() {
	    return this.getToken(LPCParser.ENDIF, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterEndifDirective(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitEndifDirective(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitEndifDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class UndefDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_undefDirective;
    }

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	UNDEF() {
	    return this.getToken(LPCParser.UNDEF, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterUndefDirective(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitUndefDirective(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitUndefDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PragmaDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_pragmaDirective;
    }

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	PRAGMA() {
	    return this.getToken(LPCParser.PRAGMA, 0);
	};

	preprocessorTokenSequence() {
	    return this.getTypedRuleContext(PreprocessorTokenSequenceContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterPragmaDirective(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitPragmaDirective(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitPragmaDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DeclarationContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_declaration;
    }

	typeSpecifier() {
	    return this.getTypedRuleContext(TypeSpecifierContext,0);
	};

	variableDeclaratorList() {
	    return this.getTypedRuleContext(VariableDeclaratorListContext,0);
	};

	SEMICOLON() {
	    return this.getToken(LPCParser.SEMICOLON, 0);
	};

	typeModifier = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(TypeModifierContext);
	    } else {
	        return this.getTypedRuleContext(TypeModifierContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterDeclaration(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitDeclaration(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitDeclaration(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class VariableDeclaratorListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_variableDeclaratorList;
    }

	variableDeclarator = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(VariableDeclaratorContext);
	    } else {
	        return this.getTypedRuleContext(VariableDeclaratorContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.COMMA);
	    } else {
	        return this.getToken(LPCParser.COMMA, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterVariableDeclaratorList(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitVariableDeclaratorList(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitVariableDeclaratorList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class VariableDeclaratorContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_variableDeclarator;
    }

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	arrayIndices() {
	    return this.getTypedRuleContext(ArrayIndicesContext,0);
	};

	ASSIGN() {
	    return this.getToken(LPCParser.ASSIGN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	initializerList() {
	    return this.getTypedRuleContext(InitializerListContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterVariableDeclarator(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitVariableDeclarator(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitVariableDeclarator(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ArrayIndicesContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_arrayIndices;
    }

	LBRACKET = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.LBRACKET);
	    } else {
	        return this.getToken(LPCParser.LBRACKET, i);
	    }
	};


	RBRACKET = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.RBRACKET);
	    } else {
	        return this.getToken(LPCParser.RBRACKET, i);
	    }
	};


	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterArrayIndices(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitArrayIndices(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitArrayIndices(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class InitializerListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_initializerList;
    }

	LBRACE_LITERAL() {
	    return this.getToken(LPCParser.LBRACE_LITERAL, 0);
	};

	RBRACE_LITERAL() {
	    return this.getToken(LPCParser.RBRACE_LITERAL, 0);
	};

	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.COMMA);
	    } else {
	        return this.getToken(LPCParser.COMMA, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterInitializerList(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitInitializerList(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitInitializerList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TypeSpecifierContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_typeSpecifier;
    }

	baseTypeSpecifier() {
	    return this.getTypedRuleContext(BaseTypeSpecifierContext,0);
	};

	arraySpecifier() {
	    return this.getTypedRuleContext(ArraySpecifierContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterTypeSpecifier(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitTypeSpecifier(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitTypeSpecifier(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BaseTypeSpecifierContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_baseTypeSpecifier;
    }

	VOID() {
	    return this.getToken(LPCParser.VOID, 0);
	};

	INT() {
	    return this.getToken(LPCParser.INT, 0);
	};

	STRING() {
	    return this.getToken(LPCParser.STRING, 0);
	};

	OBJECT() {
	    return this.getToken(LPCParser.OBJECT, 0);
	};

	FLOAT() {
	    return this.getToken(LPCParser.FLOAT, 0);
	};

	MIXED() {
	    return this.getToken(LPCParser.MIXED, 0);
	};

	STATUS() {
	    return this.getToken(LPCParser.STATUS, 0);
	};

	BUFFER() {
	    return this.getToken(LPCParser.BUFFER, 0);
	};

	MAPPING() {
	    return this.getToken(LPCParser.MAPPING, 0);
	};

	FUNCTION() {
	    return this.getToken(LPCParser.FUNCTION, 0);
	};

	classIdentifier() {
	    return this.getTypedRuleContext(ClassIdentifierContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterBaseTypeSpecifier(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitBaseTypeSpecifier(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitBaseTypeSpecifier(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ArraySpecifierContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_arraySpecifier;
    }

	MUL_OP() {
	    return this.getToken(LPCParser.MUL_OP, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterArraySpecifier(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitArraySpecifier(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitArraySpecifier(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassIdentifierContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_classIdentifier;
    }

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterClassIdentifier(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitClassIdentifier(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitClassIdentifier(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TypeModifierContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_typeModifier;
    }

	STATIC() {
	    return this.getToken(LPCParser.STATIC, 0);
	};

	NOMASK() {
	    return this.getToken(LPCParser.NOMASK, 0);
	};

	PRIVATE() {
	    return this.getToken(LPCParser.PRIVATE, 0);
	};

	PUBLIC() {
	    return this.getToken(LPCParser.PUBLIC, 0);
	};

	VARARGS() {
	    return this.getToken(LPCParser.VARARGS, 0);
	};

	NOSAVE() {
	    return this.getToken(LPCParser.NOSAVE, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterTypeModifier(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitTypeModifier(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitTypeModifier(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_expression;
    }

	assignmentExpression() {
	    return this.getTypedRuleContext(AssignmentExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AssignmentExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_assignmentExpression;
    }

	conditionalExpression() {
	    return this.getTypedRuleContext(ConditionalExpressionContext,0);
	};

	assignmentOperator() {
	    return this.getTypedRuleContext(AssignmentOperatorContext,0);
	};

	assignmentExpression() {
	    return this.getTypedRuleContext(AssignmentExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterAssignmentExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitAssignmentExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitAssignmentExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AssignmentOperatorContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_assignmentOperator;
    }

	ASSIGN() {
	    return this.getToken(LPCParser.ASSIGN, 0);
	};

	ADD_ASSIGN() {
	    return this.getToken(LPCParser.ADD_ASSIGN, 0);
	};

	SUB_ASSIGN() {
	    return this.getToken(LPCParser.SUB_ASSIGN, 0);
	};

	MUL_ASSIGN() {
	    return this.getToken(LPCParser.MUL_ASSIGN, 0);
	};

	DIV_ASSIGN() {
	    return this.getToken(LPCParser.DIV_ASSIGN, 0);
	};

	MOD_ASSIGN() {
	    return this.getToken(LPCParser.MOD_ASSIGN, 0);
	};

	AND_ASSIGN() {
	    return this.getToken(LPCParser.AND_ASSIGN, 0);
	};

	OR_ASSIGN() {
	    return this.getToken(LPCParser.OR_ASSIGN, 0);
	};

	XOR_ASSIGN() {
	    return this.getToken(LPCParser.XOR_ASSIGN, 0);
	};

	LSHIFT_ASSIGN() {
	    return this.getToken(LPCParser.LSHIFT_ASSIGN, 0);
	};

	RSHIFT_ASSIGN() {
	    return this.getToken(LPCParser.RSHIFT_ASSIGN, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterAssignmentOperator(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitAssignmentOperator(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitAssignmentOperator(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ConditionalExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_conditionalExpression;
    }

	logicalOrExpression() {
	    return this.getTypedRuleContext(LogicalOrExpressionContext,0);
	};

	QUESTION() {
	    return this.getToken(LPCParser.QUESTION, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	COLON() {
	    return this.getToken(LPCParser.COLON, 0);
	};

	conditionalExpression() {
	    return this.getTypedRuleContext(ConditionalExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterConditionalExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitConditionalExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitConditionalExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LogicalOrExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_logicalOrExpression;
    }

	logicalAndExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(LogicalAndExpressionContext);
	    } else {
	        return this.getTypedRuleContext(LogicalAndExpressionContext,i);
	    }
	};

	OR_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.OR_OP);
	    } else {
	        return this.getToken(LPCParser.OR_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterLogicalOrExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitLogicalOrExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitLogicalOrExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LogicalAndExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_logicalAndExpression;
    }

	bitwiseOrExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(BitwiseOrExpressionContext);
	    } else {
	        return this.getTypedRuleContext(BitwiseOrExpressionContext,i);
	    }
	};

	AND_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.AND_OP);
	    } else {
	        return this.getToken(LPCParser.AND_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterLogicalAndExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitLogicalAndExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitLogicalAndExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BitwiseOrExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_bitwiseOrExpression;
    }

	bitwiseXorExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(BitwiseXorExpressionContext);
	    } else {
	        return this.getTypedRuleContext(BitwiseXorExpressionContext,i);
	    }
	};

	BITOR_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.BITOR_OP);
	    } else {
	        return this.getToken(LPCParser.BITOR_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterBitwiseOrExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitBitwiseOrExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitBitwiseOrExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BitwiseXorExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_bitwiseXorExpression;
    }

	bitwiseAndExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(BitwiseAndExpressionContext);
	    } else {
	        return this.getTypedRuleContext(BitwiseAndExpressionContext,i);
	    }
	};

	CARET_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.CARET_OP);
	    } else {
	        return this.getToken(LPCParser.CARET_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterBitwiseXorExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitBitwiseXorExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitBitwiseXorExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BitwiseAndExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_bitwiseAndExpression;
    }

	equalityExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(EqualityExpressionContext);
	    } else {
	        return this.getTypedRuleContext(EqualityExpressionContext,i);
	    }
	};

	BITAND_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.BITAND_OP);
	    } else {
	        return this.getToken(LPCParser.BITAND_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterBitwiseAndExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitBitwiseAndExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitBitwiseAndExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class EqualityExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_equalityExpression;
    }

	relationalExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(RelationalExpressionContext);
	    } else {
	        return this.getTypedRuleContext(RelationalExpressionContext,i);
	    }
	};

	EQ_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.EQ_OP);
	    } else {
	        return this.getToken(LPCParser.EQ_OP, i);
	    }
	};


	NE_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.NE_OP);
	    } else {
	        return this.getToken(LPCParser.NE_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterEqualityExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitEqualityExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitEqualityExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RelationalExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_relationalExpression;
    }

	shiftExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ShiftExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ShiftExpressionContext,i);
	    }
	};

	LT_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.LT_OP);
	    } else {
	        return this.getToken(LPCParser.LT_OP, i);
	    }
	};


	GT_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.GT_OP);
	    } else {
	        return this.getToken(LPCParser.GT_OP, i);
	    }
	};


	LE_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.LE_OP);
	    } else {
	        return this.getToken(LPCParser.LE_OP, i);
	    }
	};


	GE_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.GE_OP);
	    } else {
	        return this.getToken(LPCParser.GE_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterRelationalExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitRelationalExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitRelationalExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ShiftExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_shiftExpression;
    }

	additiveExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(AdditiveExpressionContext);
	    } else {
	        return this.getTypedRuleContext(AdditiveExpressionContext,i);
	    }
	};

	LSHIFT_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.LSHIFT_OP);
	    } else {
	        return this.getToken(LPCParser.LSHIFT_OP, i);
	    }
	};


	RSHIFT_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.RSHIFT_OP);
	    } else {
	        return this.getToken(LPCParser.RSHIFT_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterShiftExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitShiftExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitShiftExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AdditiveExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_additiveExpression;
    }

	multiplicativeExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MultiplicativeExpressionContext);
	    } else {
	        return this.getTypedRuleContext(MultiplicativeExpressionContext,i);
	    }
	};

	ADD_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.ADD_OP);
	    } else {
	        return this.getToken(LPCParser.ADD_OP, i);
	    }
	};


	SUB_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.SUB_OP);
	    } else {
	        return this.getToken(LPCParser.SUB_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterAdditiveExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitAdditiveExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitAdditiveExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MultiplicativeExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_multiplicativeExpression;
    }

	castExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(CastExpressionContext);
	    } else {
	        return this.getTypedRuleContext(CastExpressionContext,i);
	    }
	};

	MUL_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.MUL_OP);
	    } else {
	        return this.getToken(LPCParser.MUL_OP, i);
	    }
	};


	DIV_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.DIV_OP);
	    } else {
	        return this.getToken(LPCParser.DIV_OP, i);
	    }
	};


	MOD_OP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.MOD_OP);
	    } else {
	        return this.getToken(LPCParser.MOD_OP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterMultiplicativeExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitMultiplicativeExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitMultiplicativeExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class CastExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_castExpression;
    }

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	typeSpecifier() {
	    return this.getTypedRuleContext(TypeSpecifierContext,0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	castExpression() {
	    return this.getTypedRuleContext(CastExpressionContext,0);
	};

	unaryExpression() {
	    return this.getTypedRuleContext(UnaryExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterCastExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitCastExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitCastExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class UnaryExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_unaryExpression;
    }

	unaryExpression() {
	    return this.getTypedRuleContext(UnaryExpressionContext,0);
	};

	BANG_OP() {
	    return this.getToken(LPCParser.BANG_OP, 0);
	};

	BITNOT_OP() {
	    return this.getToken(LPCParser.BITNOT_OP, 0);
	};

	SUB_OP() {
	    return this.getToken(LPCParser.SUB_OP, 0);
	};

	INC_OP() {
	    return this.getToken(LPCParser.INC_OP, 0);
	};

	DEC_OP() {
	    return this.getToken(LPCParser.DEC_OP, 0);
	};

	postfixExpression() {
	    return this.getTypedRuleContext(PostfixExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterUnaryExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitUnaryExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitUnaryExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PostfixExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_postfixExpression;
    }

	primaryExpression() {
	    return this.getTypedRuleContext(PrimaryExpressionContext,0);
	};

	postfixOperator = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(PostfixOperatorContext);
	    } else {
	        return this.getTypedRuleContext(PostfixOperatorContext,i);
	    }
	};

	memberAccess = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MemberAccessContext);
	    } else {
	        return this.getTypedRuleContext(MemberAccessContext,i);
	    }
	};

	functionCall = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(FunctionCallContext);
	    } else {
	        return this.getTypedRuleContext(FunctionCallContext,i);
	    }
	};

	arrayAccess = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ArrayAccessContext);
	    } else {
	        return this.getTypedRuleContext(ArrayAccessContext,i);
	    }
	};

	rangeAccess = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(RangeAccessContext);
	    } else {
	        return this.getTypedRuleContext(RangeAccessContext,i);
	    }
	};

	remoteFunctionPointerSuffix = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(RemoteFunctionPointerSuffixContext);
	    } else {
	        return this.getTypedRuleContext(RemoteFunctionPointerSuffixContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterPostfixExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitPostfixExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitPostfixExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RemoteFunctionPointerSuffixContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_remoteFunctionPointerSuffix;
    }

	ARROW() {
	    return this.getToken(LPCParser.ARROW, 0);
	};

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	SINGLE_QUOTE() {
	    return this.getToken(LPCParser.SINGLE_QUOTE, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterRemoteFunctionPointerSuffix(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitRemoteFunctionPointerSuffix(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitRemoteFunctionPointerSuffix(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PostfixOperatorContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_postfixOperator;
    }

	INC_OP() {
	    return this.getToken(LPCParser.INC_OP, 0);
	};

	DEC_OP() {
	    return this.getToken(LPCParser.DEC_OP, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterPostfixOperator(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitPostfixOperator(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitPostfixOperator(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MemberAccessContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_memberAccess;
    }

	ARROW() {
	    return this.getToken(LPCParser.ARROW, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterMemberAccess(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitMemberAccess(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitMemberAccess(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FunctionCallContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_functionCall;
    }

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	argumentExpressionList() {
	    return this.getTypedRuleContext(ArgumentExpressionListContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterFunctionCall(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitFunctionCall(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitFunctionCall(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ArgumentExpressionListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_argumentExpressionList;
    }

	assignmentExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(AssignmentExpressionContext);
	    } else {
	        return this.getTypedRuleContext(AssignmentExpressionContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.COMMA);
	    } else {
	        return this.getToken(LPCParser.COMMA, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterArgumentExpressionList(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitArgumentExpressionList(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitArgumentExpressionList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ArrayAccessContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_arrayAccess;
    }

	LBRACKET() {
	    return this.getToken(LPCParser.LBRACKET, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RBRACKET() {
	    return this.getToken(LPCParser.RBRACKET, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterArrayAccess(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitArrayAccess(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitArrayAccess(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RangeAccessContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_rangeAccess;
    }

	LBRACKET() {
	    return this.getToken(LPCParser.LBRACKET, 0);
	};

	RANGE_OP() {
	    return this.getToken(LPCParser.RANGE_OP, 0);
	};

	RBRACKET() {
	    return this.getToken(LPCParser.RBRACKET, 0);
	};

	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterRangeAccess(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitRangeAccess(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitRangeAccess(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PrimaryExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_primaryExpression;
    }

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	constant() {
	    return this.getTypedRuleContext(ConstantContext,0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	arrayLiteral() {
	    return this.getTypedRuleContext(ArrayLiteralContext,0);
	};

	mappingLiteral() {
	    return this.getTypedRuleContext(MappingLiteralContext,0);
	};

	closureExpression() {
	    return this.getTypedRuleContext(ClosureExpressionContext,0);
	};

	simpleFunctionPointerLiteral() {
	    return this.getTypedRuleContext(SimpleFunctionPointerLiteralContext,0);
	};

	classConstructorCall() {
	    return this.getTypedRuleContext(ClassConstructorCallContext,0);
	};

	closureArgPlaceholder() {
	    return this.getTypedRuleContext(ClosureArgPlaceholderContext,0);
	};

	closureCapture() {
	    return this.getTypedRuleContext(ClosureCaptureContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterPrimaryExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitPrimaryExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitPrimaryExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClosureArgPlaceholderContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_closureArgPlaceholder;
    }

	DOLLAR() {
	    return this.getToken(LPCParser.DOLLAR, 0);
	};

	INTEGER_LITERAL() {
	    return this.getToken(LPCParser.INTEGER_LITERAL, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterClosureArgPlaceholder(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitClosureArgPlaceholder(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitClosureArgPlaceholder(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClosureCaptureContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_closureCapture;
    }

	DOLLAR_LPAREN() {
	    return this.getToken(LPCParser.DOLLAR_LPAREN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterClosureCapture(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitClosureCapture(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitClosureCapture(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ConstantContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_constant;
    }

	INTEGER_LITERAL() {
	    return this.getToken(LPCParser.INTEGER_LITERAL, 0);
	};

	FLOAT_LITERAL() {
	    return this.getToken(LPCParser.FLOAT_LITERAL, 0);
	};

	STRING_LITERAL() {
	    return this.getToken(LPCParser.STRING_LITERAL, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterConstant(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitConstant(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitConstant(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ArrayLiteralContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_arrayLiteral;
    }

	LBRACE_LITERAL() {
	    return this.getToken(LPCParser.LBRACE_LITERAL, 0);
	};

	RBRACE_LITERAL() {
	    return this.getToken(LPCParser.RBRACE_LITERAL, 0);
	};

	argumentExpressionList() {
	    return this.getTypedRuleContext(ArgumentExpressionListContext,0);
	};

	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.COMMA);
	    } else {
	        return this.getToken(LPCParser.COMMA, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterArrayLiteral(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitArrayLiteral(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitArrayLiteral(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MappingLiteralContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_mappingLiteral;
    }

	LBRACKET_LITERAL() {
	    return this.getToken(LPCParser.LBRACKET_LITERAL, 0);
	};

	RBRACKET_LITERAL() {
	    return this.getToken(LPCParser.RBRACKET_LITERAL, 0);
	};

	mappingElement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MappingElementContext);
	    } else {
	        return this.getTypedRuleContext(MappingElementContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.COMMA);
	    } else {
	        return this.getToken(LPCParser.COMMA, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterMappingLiteral(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitMappingLiteral(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitMappingLiteral(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MappingElementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_mappingElement;
    }

	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	COLON() {
	    return this.getToken(LPCParser.COLON, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterMappingElement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitMappingElement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitMappingElement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClosureExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_closureExpression;
    }

	LBRACE_LPAREN() {
	    return this.getToken(LPCParser.LBRACE_LPAREN, 0);
	};

	RBRACE_RPAREN() {
	    return this.getToken(LPCParser.RBRACE_RPAREN, 0);
	};

	closureArgsAndBody() {
	    return this.getTypedRuleContext(ClosureArgsAndBodyContext,0);
	};

	closureBodyOnly() {
	    return this.getTypedRuleContext(ClosureBodyOnlyContext,0);
	};

	expressionClosure() {
	    return this.getTypedRuleContext(ExpressionClosureContext,0);
	};

	objectFunctionClosure() {
	    return this.getTypedRuleContext(ObjectFunctionClosureContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterClosureExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitClosureExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitClosureExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClosureArgsAndBodyContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_closureArgsAndBody;
    }

	parameterList() {
	    return this.getTypedRuleContext(ParameterListContext,0);
	};

	ARROW() {
	    return this.getToken(LPCParser.ARROW, 0);
	};

	LAMBDA_ARROW() {
	    return this.getToken(LPCParser.LAMBDA_ARROW, 0);
	};

	statement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StatementContext);
	    } else {
	        return this.getTypedRuleContext(StatementContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterClosureArgsAndBody(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitClosureArgsAndBody(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitClosureArgsAndBody(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClosureBodyOnlyContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_closureBodyOnly;
    }

	statement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StatementContext);
	    } else {
	        return this.getTypedRuleContext(StatementContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterClosureBodyOnly(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitClosureBodyOnly(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitClosureBodyOnly(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ExpressionClosureContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_expressionClosure;
    }

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterExpressionClosure(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitExpressionClosure(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitExpressionClosure(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ObjectFunctionClosureContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_objectFunctionClosure;
    }

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.COMMA);
	    } else {
	        return this.getToken(LPCParser.COMMA, i);
	    }
	};


	STRING_LITERAL() {
	    return this.getToken(LPCParser.STRING_LITERAL, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	arrayLiteral() {
	    return this.getTypedRuleContext(ArrayLiteralContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterObjectFunctionClosure(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitObjectFunctionClosure(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitObjectFunctionClosure(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SimpleFunctionPointerLiteralContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_simpleFunctionPointerLiteral;
    }

	HASH() {
	    return this.getToken(LPCParser.HASH, 0);
	};

	SINGLE_QUOTE() {
	    return this.getToken(LPCParser.SINGLE_QUOTE, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterSimpleFunctionPointerLiteral(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitSimpleFunctionPointerLiteral(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitSimpleFunctionPointerLiteral(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassConstructorCallContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_classConstructorCall;
    }

	NEW() {
	    return this.getToken(LPCParser.NEW, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	CLASS() {
	    return this.getToken(LPCParser.CLASS, 0);
	};

	classIdentifier() {
	    return this.getTypedRuleContext(ClassIdentifierContext,0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	COMMA() {
	    return this.getToken(LPCParser.COMMA, 0);
	};

	namedArgumentList() {
	    return this.getTypedRuleContext(NamedArgumentListContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterClassConstructorCall(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitClassConstructorCall(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitClassConstructorCall(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class NamedArgumentListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_namedArgumentList;
    }

	namedArgument = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(NamedArgumentContext);
	    } else {
	        return this.getTypedRuleContext(NamedArgumentContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.COMMA);
	    } else {
	        return this.getToken(LPCParser.COMMA, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterNamedArgumentList(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitNamedArgumentList(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitNamedArgumentList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class NamedArgumentContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_namedArgument;
    }

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	COLON() {
	    return this.getToken(LPCParser.COLON, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterNamedArgument(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitNamedArgument(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitNamedArgument(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FunctionDefinitionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_functionDefinition;
    }

	typeSpecifier() {
	    return this.getTypedRuleContext(TypeSpecifierContext,0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	compoundStatement() {
	    return this.getTypedRuleContext(CompoundStatementContext,0);
	};

	typeModifier = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(TypeModifierContext);
	    } else {
	        return this.getTypedRuleContext(TypeModifierContext,i);
	    }
	};

	parameterList() {
	    return this.getTypedRuleContext(ParameterListContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterFunctionDefinition(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitFunctionDefinition(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitFunctionDefinition(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ParameterListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_parameterList;
    }

	parameterDeclaration = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ParameterDeclarationContext);
	    } else {
	        return this.getTypedRuleContext(ParameterDeclarationContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.COMMA);
	    } else {
	        return this.getToken(LPCParser.COMMA, i);
	    }
	};


	ELLIPSIS() {
	    return this.getToken(LPCParser.ELLIPSIS, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterParameterList(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitParameterList(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitParameterList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ParameterDeclarationContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_parameterDeclaration;
    }

	typeSpecifier() {
	    return this.getTypedRuleContext(TypeSpecifierContext,0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	arraySpecifier() {
	    return this.getTypedRuleContext(ArraySpecifierContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterParameterDeclaration(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitParameterDeclaration(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitParameterDeclaration(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class CompoundStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_compoundStatement;
    }

	LBRACE() {
	    return this.getToken(LPCParser.LBRACE, 0);
	};

	RBRACE() {
	    return this.getToken(LPCParser.RBRACE, 0);
	};

	declaration = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(DeclarationContext);
	    } else {
	        return this.getTypedRuleContext(DeclarationContext,i);
	    }
	};

	statement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StatementContext);
	    } else {
	        return this.getTypedRuleContext(StatementContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterCompoundStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitCompoundStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitCompoundStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_statement;
    }

	expressionStatement() {
	    return this.getTypedRuleContext(ExpressionStatementContext,0);
	};

	compoundStatement() {
	    return this.getTypedRuleContext(CompoundStatementContext,0);
	};

	selectionStatement() {
	    return this.getTypedRuleContext(SelectionStatementContext,0);
	};

	iterationStatement() {
	    return this.getTypedRuleContext(IterationStatementContext,0);
	};

	jumpStatement() {
	    return this.getTypedRuleContext(JumpStatementContext,0);
	};

	inheritStatement() {
	    return this.getTypedRuleContext(InheritStatementContext,0);
	};

	tryCatchStatement() {
	    return this.getTypedRuleContext(TryCatchStatementContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ExpressionStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_expressionStatement;
    }

	SEMICOLON() {
	    return this.getToken(LPCParser.SEMICOLON, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterExpressionStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitExpressionStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitExpressionStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SelectionStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_selectionStatement;
    }

	ifStatement() {
	    return this.getTypedRuleContext(IfStatementContext,0);
	};

	switchStatement() {
	    return this.getTypedRuleContext(SwitchStatementContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterSelectionStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitSelectionStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitSelectionStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IfStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_ifStatement;
    }

	IF() {
	    return this.getToken(LPCParser.IF, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	statement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StatementContext);
	    } else {
	        return this.getTypedRuleContext(StatementContext,i);
	    }
	};

	ELSE() {
	    return this.getToken(LPCParser.ELSE, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterIfStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitIfStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitIfStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SwitchStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_switchStatement;
    }

	SWITCH() {
	    return this.getToken(LPCParser.SWITCH, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	LBRACE() {
	    return this.getToken(LPCParser.LBRACE, 0);
	};

	RBRACE() {
	    return this.getToken(LPCParser.RBRACE, 0);
	};

	switchCase = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(SwitchCaseContext);
	    } else {
	        return this.getTypedRuleContext(SwitchCaseContext,i);
	    }
	};

	defaultCase() {
	    return this.getTypedRuleContext(DefaultCaseContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterSwitchStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitSwitchStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitSwitchStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SwitchCaseContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_switchCase;
    }

	CASE() {
	    return this.getToken(LPCParser.CASE, 0);
	};

	COLON() {
	    return this.getToken(LPCParser.COLON, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	STRING_LITERAL() {
	    return this.getToken(LPCParser.STRING_LITERAL, 0);
	};

	statement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StatementContext);
	    } else {
	        return this.getTypedRuleContext(StatementContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterSwitchCase(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitSwitchCase(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitSwitchCase(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DefaultCaseContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_defaultCase;
    }

	DEFAULT() {
	    return this.getToken(LPCParser.DEFAULT, 0);
	};

	COLON() {
	    return this.getToken(LPCParser.COLON, 0);
	};

	statement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StatementContext);
	    } else {
	        return this.getTypedRuleContext(StatementContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterDefaultCase(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitDefaultCase(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitDefaultCase(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IterationStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_iterationStatement;
    }

	whileStatement() {
	    return this.getTypedRuleContext(WhileStatementContext,0);
	};

	forStatement() {
	    return this.getTypedRuleContext(ForStatementContext,0);
	};

	doWhileStatement() {
	    return this.getTypedRuleContext(DoWhileStatementContext,0);
	};

	foreachStatement() {
	    return this.getTypedRuleContext(ForeachStatementContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterIterationStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitIterationStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitIterationStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WhileStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_whileStatement;
    }

	WHILE() {
	    return this.getToken(LPCParser.WHILE, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	statement() {
	    return this.getTypedRuleContext(StatementContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterWhileStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitWhileStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitWhileStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DoWhileStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_doWhileStatement;
    }

	DO() {
	    return this.getToken(LPCParser.DO, 0);
	};

	statement() {
	    return this.getTypedRuleContext(StatementContext,0);
	};

	WHILE() {
	    return this.getToken(LPCParser.WHILE, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	SEMICOLON() {
	    return this.getToken(LPCParser.SEMICOLON, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterDoWhileStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitDoWhileStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitDoWhileStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ForStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_forStatement;
    }

	FOR() {
	    return this.getToken(LPCParser.FOR, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	expressionStatement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionStatementContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionStatementContext,i);
	    }
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	statement() {
	    return this.getTypedRuleContext(StatementContext,0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterForStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitForStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitForStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ForeachStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_foreachStatement;
    }

	FOREACH() {
	    return this.getToken(LPCParser.FOREACH, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	IDENTIFIER = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(LPCParser.IDENTIFIER);
	    } else {
	        return this.getToken(LPCParser.IDENTIFIER, i);
	    }
	};


	IN() {
	    return this.getToken(LPCParser.IN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	statement() {
	    return this.getTypedRuleContext(StatementContext,0);
	};

	typeSpecifier = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(TypeSpecifierContext);
	    } else {
	        return this.getTypedRuleContext(TypeSpecifierContext,i);
	    }
	};

	COMMA() {
	    return this.getToken(LPCParser.COMMA, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterForeachStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitForeachStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitForeachStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class JumpStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_jumpStatement;
    }

	BREAK() {
	    return this.getToken(LPCParser.BREAK, 0);
	};

	SEMICOLON() {
	    return this.getToken(LPCParser.SEMICOLON, 0);
	};

	CONTINUE() {
	    return this.getToken(LPCParser.CONTINUE, 0);
	};

	RETURN() {
	    return this.getToken(LPCParser.RETURN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterJumpStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitJumpStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitJumpStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class InheritStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_inheritStatement;
    }

	INHERIT() {
	    return this.getToken(LPCParser.INHERIT, 0);
	};

	STRING_LITERAL() {
	    return this.getToken(LPCParser.STRING_LITERAL, 0);
	};

	SEMICOLON() {
	    return this.getToken(LPCParser.SEMICOLON, 0);
	};

	typeModifier() {
	    return this.getTypedRuleContext(TypeModifierContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterInheritStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitInheritStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitInheritStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TryCatchStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_tryCatchStatement;
    }

	TRY() {
	    return this.getToken(LPCParser.TRY, 0);
	};

	compoundStatement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(CompoundStatementContext);
	    } else {
	        return this.getTypedRuleContext(CompoundStatementContext,i);
	    }
	};

	CATCH() {
	    return this.getToken(LPCParser.CATCH, 0);
	};

	LPAREN() {
	    return this.getToken(LPCParser.LPAREN, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	RPAREN() {
	    return this.getToken(LPCParser.RPAREN, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterTryCatchStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitTryCatchStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitTryCatchStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassDefinitionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = LPCParser.RULE_classDefinition;
    }

	CLASS() {
	    return this.getToken(LPCParser.CLASS, 0);
	};

	IDENTIFIER() {
	    return this.getToken(LPCParser.IDENTIFIER, 0);
	};

	LBRACE() {
	    return this.getToken(LPCParser.LBRACE, 0);
	};

	RBRACE() {
	    return this.getToken(LPCParser.RBRACE, 0);
	};

	EXTENDS() {
	    return this.getToken(LPCParser.EXTENDS, 0);
	};

	classIdentifier() {
	    return this.getTypedRuleContext(ClassIdentifierContext,0);
	};

	declaration = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(DeclarationContext);
	    } else {
	        return this.getTypedRuleContext(DeclarationContext,i);
	    }
	};

	functionDefinition = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(FunctionDefinitionContext);
	    } else {
	        return this.getTypedRuleContext(FunctionDefinitionContext,i);
	    }
	};

	SEMICOLON() {
	    return this.getToken(LPCParser.SEMICOLON, 0);
	};

	enterRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.enterClassDefinition(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof LPCListener ) {
	        listener.exitClassDefinition(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof LPCVisitor ) {
	        return visitor.visitClassDefinition(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




LPCParser.ProgramContext = ProgramContext;
LPCParser.PreprocessorDirectiveContext = PreprocessorDirectiveContext;
LPCParser.IncludeDirectiveContext = IncludeDirectiveContext;
LPCParser.DefineDirectiveContext = DefineDirectiveContext;
LPCParser.IdentifierListContext = IdentifierListContext;
LPCParser.PreprocessorTokenSequenceContext = PreprocessorTokenSequenceContext;
LPCParser.IfdefDirectiveContext = IfdefDirectiveContext;
LPCParser.IfndefDirectiveContext = IfndefDirectiveContext;
LPCParser.ElseDirectiveContext = ElseDirectiveContext;
LPCParser.EndifDirectiveContext = EndifDirectiveContext;
LPCParser.UndefDirectiveContext = UndefDirectiveContext;
LPCParser.PragmaDirectiveContext = PragmaDirectiveContext;
LPCParser.DeclarationContext = DeclarationContext;
LPCParser.VariableDeclaratorListContext = VariableDeclaratorListContext;
LPCParser.VariableDeclaratorContext = VariableDeclaratorContext;
LPCParser.ArrayIndicesContext = ArrayIndicesContext;
LPCParser.InitializerListContext = InitializerListContext;
LPCParser.TypeSpecifierContext = TypeSpecifierContext;
LPCParser.BaseTypeSpecifierContext = BaseTypeSpecifierContext;
LPCParser.ArraySpecifierContext = ArraySpecifierContext;
LPCParser.ClassIdentifierContext = ClassIdentifierContext;
LPCParser.TypeModifierContext = TypeModifierContext;
LPCParser.ExpressionContext = ExpressionContext;
LPCParser.AssignmentExpressionContext = AssignmentExpressionContext;
LPCParser.AssignmentOperatorContext = AssignmentOperatorContext;
LPCParser.ConditionalExpressionContext = ConditionalExpressionContext;
LPCParser.LogicalOrExpressionContext = LogicalOrExpressionContext;
LPCParser.LogicalAndExpressionContext = LogicalAndExpressionContext;
LPCParser.BitwiseOrExpressionContext = BitwiseOrExpressionContext;
LPCParser.BitwiseXorExpressionContext = BitwiseXorExpressionContext;
LPCParser.BitwiseAndExpressionContext = BitwiseAndExpressionContext;
LPCParser.EqualityExpressionContext = EqualityExpressionContext;
LPCParser.RelationalExpressionContext = RelationalExpressionContext;
LPCParser.ShiftExpressionContext = ShiftExpressionContext;
LPCParser.AdditiveExpressionContext = AdditiveExpressionContext;
LPCParser.MultiplicativeExpressionContext = MultiplicativeExpressionContext;
LPCParser.CastExpressionContext = CastExpressionContext;
LPCParser.UnaryExpressionContext = UnaryExpressionContext;
LPCParser.PostfixExpressionContext = PostfixExpressionContext;
LPCParser.RemoteFunctionPointerSuffixContext = RemoteFunctionPointerSuffixContext;
LPCParser.PostfixOperatorContext = PostfixOperatorContext;
LPCParser.MemberAccessContext = MemberAccessContext;
LPCParser.FunctionCallContext = FunctionCallContext;
LPCParser.ArgumentExpressionListContext = ArgumentExpressionListContext;
LPCParser.ArrayAccessContext = ArrayAccessContext;
LPCParser.RangeAccessContext = RangeAccessContext;
LPCParser.PrimaryExpressionContext = PrimaryExpressionContext;
LPCParser.ClosureArgPlaceholderContext = ClosureArgPlaceholderContext;
LPCParser.ClosureCaptureContext = ClosureCaptureContext;
LPCParser.ConstantContext = ConstantContext;
LPCParser.ArrayLiteralContext = ArrayLiteralContext;
LPCParser.MappingLiteralContext = MappingLiteralContext;
LPCParser.MappingElementContext = MappingElementContext;
LPCParser.ClosureExpressionContext = ClosureExpressionContext;
LPCParser.ClosureArgsAndBodyContext = ClosureArgsAndBodyContext;
LPCParser.ClosureBodyOnlyContext = ClosureBodyOnlyContext;
LPCParser.ExpressionClosureContext = ExpressionClosureContext;
LPCParser.ObjectFunctionClosureContext = ObjectFunctionClosureContext;
LPCParser.SimpleFunctionPointerLiteralContext = SimpleFunctionPointerLiteralContext;
LPCParser.ClassConstructorCallContext = ClassConstructorCallContext;
LPCParser.NamedArgumentListContext = NamedArgumentListContext;
LPCParser.NamedArgumentContext = NamedArgumentContext;
LPCParser.FunctionDefinitionContext = FunctionDefinitionContext;
LPCParser.ParameterListContext = ParameterListContext;
LPCParser.ParameterDeclarationContext = ParameterDeclarationContext;
LPCParser.CompoundStatementContext = CompoundStatementContext;
LPCParser.StatementContext = StatementContext;
LPCParser.ExpressionStatementContext = ExpressionStatementContext;
LPCParser.SelectionStatementContext = SelectionStatementContext;
LPCParser.IfStatementContext = IfStatementContext;
LPCParser.SwitchStatementContext = SwitchStatementContext;
LPCParser.SwitchCaseContext = SwitchCaseContext;
LPCParser.DefaultCaseContext = DefaultCaseContext;
LPCParser.IterationStatementContext = IterationStatementContext;
LPCParser.WhileStatementContext = WhileStatementContext;
LPCParser.DoWhileStatementContext = DoWhileStatementContext;
LPCParser.ForStatementContext = ForStatementContext;
LPCParser.ForeachStatementContext = ForeachStatementContext;
LPCParser.JumpStatementContext = JumpStatementContext;
LPCParser.InheritStatementContext = InheritStatementContext;
LPCParser.TryCatchStatementContext = TryCatchStatementContext;
LPCParser.ClassDefinitionContext = ClassDefinitionContext;
