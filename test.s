.text
mov r2, #33
ldr r3, tty_ptr
ldr r4, hello_string_ptr
nop
loop:
ldr r2, [r4]
and r2, r2, #0xff
str r2, [r3]
add r4, r4, #1
nop
b loop

tty_ptr: .word 0x0000ff00
hello_string_ptr: .word hello_string
hello_string: .asciz "Hello world!"

