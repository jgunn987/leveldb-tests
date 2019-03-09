// to compile and run with gcc, gcc asm.c -o asm && ./asm
#include <stdio.h>

#define WINDOWS 1

#define ASM(a)
  #ifdef WINDOWS
  int main( ) {
     printf("windows");
     return 0;
  }
  #else
  int main( ) {
     printf("not windows");
     return 0;
  }
  #endif

       
ASM("OK"); 
